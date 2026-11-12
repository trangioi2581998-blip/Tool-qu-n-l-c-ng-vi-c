begin;

-- 1. Add email & department to work_members
alter table public.work_members
  add column if not exists email text,
  add column if not exists department text not null default '';

update public.work_members m
set email = lower(u.email)
from auth.users u
where m.user_id = u.id and m.email is null;

-- 2. Add status transition tracking columns to work_tasks for weekly reports
alter table public.work_tasks
  add column if not exists previous_status text check (previous_status in ('todo', 'doing', 'review', 'done')),
  add column if not exists status_updated_at timestamptz;

create or replace function nhip_viec_private.track_task_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.previous_status := old.status;
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists work_task_status_tracker on public.work_tasks;
create trigger work_task_status_tracker
before update of status on public.work_tasks
for each row execute function nhip_viec_private.track_task_status_change();

revoke all on function nhip_viec_private.track_task_status_change() from public, anon, authenticated;

-- 3. Track deleted tasks for weekly reports
create table if not exists public.work_deleted_tasks (
  id uuid primary key,
  team_id uuid references public.work_teams on delete cascade,
  title text not null,
  level smallint not null default 1,
  previous_status text not null default 'todo',
  assignee_ids jsonb not null default '[]'::jsonb,
  assigned_on date,
  created_by uuid references auth.users on delete set null,
  deleted_at timestamptz not null default now()
);

alter table public.work_deleted_tasks enable row level security;
revoke all on public.work_deleted_tasks from public, anon, authenticated;
grant select on public.work_deleted_tasks to authenticated;

drop policy if exists work_deleted_tasks_read on public.work_deleted_tasks;
create policy work_deleted_tasks_read on public.work_deleted_tasks for select to authenticated
  using ((team_id is null and created_by = (select auth.uid())) or nhip_viec_private.is_member(team_id));

create or replace function nhip_viec_private.record_deleted_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  people jsonb;
begin
  select coalesce(jsonb_agg(user_id order by user_id), '[]'::jsonb)
  into people
  from public.work_task_assignees
  where task_id = old.id;

  insert into public.work_deleted_tasks (
    id, team_id, title, level, previous_status, assignee_ids, assigned_on, created_by, deleted_at
  ) values (
    old.id, old.team_id, old.title, old.level, old.status, coalesce(people, '[]'::jsonb), old.assigned_on, old.created_by, now()
  )
  on conflict (id) do update set
    previous_status = excluded.previous_status,
    deleted_at = excluded.deleted_at;

  return old;
end;
$$;

drop trigger if exists work_task_record_deleted on public.work_tasks;
create trigger work_task_record_deleted
before delete on public.work_tasks
for each row execute function nhip_viec_private.record_deleted_task();

revoke all on function nhip_viec_private.record_deleted_task() from public, anon, authenticated;

-- 4. Update team creation & invite acceptance to populate email & department
create or replace function public.work_create_team(team_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_team uuid;
declare user_email text := lower(coalesce(auth.jwt()->>'email', ''));
declare name_for_team text := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
  split_part(auth.jwt()->>'email', '@', 1), 'Thành viên'), 80);
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
  insert into public.work_teams (name) values (btrim(team_name)) returning id into new_team;
  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (new_team, auth.uid(), name_for_team, user_email, btrim(team_name), 'owner');
  return new_team;
end;
$$;

create or replace function public.work_accept_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite nhip_viec_private.invites%rowtype;
declare account_id uuid := auth.uid();
declare confirmed_email text;
declare name_for_team text;
begin
  select lower(email) into confirmed_email
  from auth.users where id = account_id and email_confirmed_at is not null;
  if confirmed_email is null then raise exception 'Hãy đăng nhập bằng email đã xác nhận.'; end if;
  select * into invite from nhip_viec_private.invites where token = invite_token for update;
  if not found or invite.email <> confirmed_email then
    raise exception 'Lời mời không hợp lệ với tài khoản này.';
  end if;
  if invite.accepted_by = account_id then return invite.team_id; end if;
  if invite.expires_at <= now() or invite.accepted_by is not null then
    raise exception 'Lời mời đã hết hạn hoặc đã được sử dụng.';
  end if;
  name_for_team := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
    split_part(confirmed_email, '@', 1)), 80);
  insert into public.work_members (team_id, user_id, display_name, email, role)
  values (invite.team_id, account_id, name_for_team, confirmed_email, 'member')
  on conflict (team_id, user_id) do update set email = excluded.email;
  update nhip_viec_private.invites set accepted_by = account_id, accepted_at = now() where token = invite_token;
  return invite.team_id;
end;
$$;

-- 5. Update work_link_member and add work_update_member & work_remove_member RPCs
create or replace function public.work_link_member(
  target_team uuid,
  manager_id uuid,
  member_email text,
  member_name text,
  invited_now boolean default false,
  member_department text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid;
  added public.work_members;
  team_name text;
  clean_email text := lower(btrim(member_email));
  clean_dept text := coalesce(btrim(member_department), '');
begin
  select t.name into team_name from public.work_teams t join public.work_members m on m.team_id = t.id
  where t.id = target_team and m.user_id = manager_id and m.role = 'owner';
  if not found then raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể tạo tài khoản thành viên.'; end if;

  select u.id into account_id from auth.users u where lower(u.email) = clean_email and u.is_sso_user is not true;
  if account_id is null then return null; end if;
  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (target_team, account_id, btrim(member_name), clean_email, clean_dept, 'member')
  on conflict (team_id, user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_members.department end
  returning * into added;

  if not invited_now then
    insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
    values ('member:' || target_team::text || ':' || account_id::text, account_id, '[Nhịp việc] Bạn đã được thêm vào nhóm',
      'Bạn đã được thêm vào nhóm ' || team_name || '. Đăng nhập để mở nhóm.', target_team)
    on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
  end if;
  return jsonb_build_object(
    'user_id', added.user_id,
    'display_name', added.display_name,
    'email', added.email,
    'department', added.department,
    'role', added.role
  );
end;
$$;

create or replace function public.work_update_member(
  target_team uuid,
  target_user uuid,
  member_name text,
  member_email text,
  member_department text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  updated public.work_members;
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể chỉnh sửa thành viên.';
  end if;
  update public.work_members
  set
    display_name = btrim(member_name),
    email = lower(btrim(member_email)),
    department = coalesce(btrim(member_department), '')
  where team_id = target_team and user_id = target_user
  returning * into updated;

  if not found then
    raise exception 'Không tìm thấy thành viên trong nhóm.';
  end if;

  return jsonb_build_object(
    'user_id', updated.user_id,
    'display_name', updated.display_name,
    'email', updated.email,
    'department', updated.department,
    'role', updated.role
  );
end;
$$;

create or replace function public.work_remove_member(
  target_team uuid,
  target_user uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_role text;
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể xóa thành viên.';
  end if;
  select role into target_role from public.work_members where team_id = target_team and user_id = target_user;
  if not found then
    raise exception 'Không tìm thấy thành viên trong nhóm.';
  end if;
  if target_role = 'owner' then
    raise exception 'Không thể xóa trưởng nhóm khỏi nhóm.';
  end if;

  delete from public.work_task_assignees
  where team_id = target_team and user_id = target_user;

  delete from public.work_members
  where team_id = target_team and user_id = target_user;
end;
$$;

revoke all on function public.work_update_member(uuid, uuid, text, text, text),
  public.work_remove_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.work_update_member(uuid, uuid, text, text, text),
  public.work_remove_member(uuid, uuid) to authenticated;

revoke all on function public.work_link_member(uuid, uuid, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.work_link_member(uuid, uuid, text, text, boolean, text) to service_role;

notify pgrst, 'reload schema';
commit;

