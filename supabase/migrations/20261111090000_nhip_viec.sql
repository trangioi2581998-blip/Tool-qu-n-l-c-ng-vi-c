begin;

create schema nhip_viec_private;
revoke all on schema nhip_viec_private from public;
grant usage on schema nhip_viec_private to authenticated;

create table public.work_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.work_members (
  team_id uuid not null references public.work_teams on delete cascade,
  user_id uuid not null references auth.users,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role text not null check (role in ('owner', 'member')),
  primary key (team_id, user_id)
);
create index work_members_user_idx on public.work_members (user_id, team_id);
create table public.work_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.work_teams on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default 'purple' check (color in ('purple', 'blue', 'green', 'amber', 'pink')),
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now(),
  unique (team_id, id)
);
create table public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.work_teams on delete cascade,
  project_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  assignee_id uuid references auth.users,
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  foreign key (team_id, project_id) references public.work_projects (team_id, id),
  foreign key (team_id, assignee_id) references public.work_members (team_id, user_id),
  check (team_id is not null or (project_id is null and assignee_id is not null and assignee_id = created_by))
);
create index work_tasks_team_idx on public.work_tasks (team_id, id);
create index work_tasks_private_idx on public.work_tasks (created_by, id) where team_id is null;
create table public.work_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks on delete cascade,
  author_id uuid not null default auth.uid() references auth.users,
  author_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index work_comments_task_idx on public.work_comments (task_id, created_at, id);
create table nhip_viec_private.invites (
  token uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.work_teams on delete cascade,
  email text not null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users,
  accepted_at timestamptz
);
alter table nhip_viec_private.invites enable row level security;

create function nhip_viec_private.is_member(target_team uuid, owner_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_members
    where team_id = target_team and user_id = (select auth.uid())
      and (not owner_only or role = 'owner')
  );
$$;
revoke all on function nhip_viec_private.is_member(uuid, boolean) from public, anon, authenticated;
grant execute on function nhip_viec_private.is_member(uuid, boolean) to authenticated;

create function nhip_viec_private.bump_task_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.assignee_id is distinct from old.assignee_id or new.project_id is distinct from old.project_id)
    and old.created_by <> auth.uid()
    and not nhip_viec_private.is_member(old.team_id, true) then
    raise exception 'Chỉ người tạo việc hoặc chủ nhóm mới có thể giao lại hoặc đổi dự án.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger work_tasks_update before update on public.work_tasks
for each row execute function nhip_viec_private.bump_task_version();

create function nhip_viec_private.set_comment_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select m.display_name into new.author_name
  from public.work_tasks t join public.work_members m on m.team_id = t.team_id
  where t.id = new.task_id and m.user_id = auth.uid();
  if new.author_name is null then raise exception 'Công việc không cho phép bình luận.'; end if;
  return new;
end;
$$;
create trigger work_comments_insert before insert on public.work_comments
for each row execute function nhip_viec_private.set_comment_author();
revoke all on function nhip_viec_private.bump_task_version(), nhip_viec_private.set_comment_author() from public, anon, authenticated;

alter table public.work_teams enable row level security;
alter table public.work_members enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_tasks enable row level security;
alter table public.work_comments enable row level security;

revoke all on public.work_teams, public.work_members, public.work_projects, public.work_tasks, public.work_comments
  from public, anon, authenticated;
grant select on public.work_teams, public.work_members, public.work_projects, public.work_tasks, public.work_comments to authenticated;
grant insert (team_id, name, color), update (name, color) on public.work_projects to authenticated;
grant insert (team_id, project_id, title, description, status, priority, due_date, assignee_id),
  update (project_id, title, description, status, priority, due_date, assignee_id),
  delete on public.work_tasks to authenticated;
grant insert (task_id, body) on public.work_comments to authenticated;

create policy work_teams_read on public.work_teams for select to authenticated
  using (nhip_viec_private.is_member(id));
create policy work_members_read on public.work_members for select to authenticated
  using (nhip_viec_private.is_member(team_id));
create policy work_projects_read on public.work_projects for select to authenticated
  using (nhip_viec_private.is_member(team_id));
create policy work_projects_create on public.work_projects for insert to authenticated
  with check (nhip_viec_private.is_member(team_id) and created_by = (select auth.uid()));
create policy work_projects_edit on public.work_projects for update to authenticated
  using (nhip_viec_private.is_member(team_id) and
    (created_by = (select auth.uid()) or nhip_viec_private.is_member(team_id, true)))
  with check (nhip_viec_private.is_member(team_id));

create policy work_tasks_read on public.work_tasks for select to authenticated
  using ((team_id is null and created_by = (select auth.uid())) or nhip_viec_private.is_member(team_id));
create policy work_tasks_create on public.work_tasks for insert to authenticated
  with check (created_by = (select auth.uid()) and (team_id is null or nhip_viec_private.is_member(team_id)));
create policy work_tasks_edit on public.work_tasks for update to authenticated
  using (
    (team_id is null and created_by = (select auth.uid())) or (
      nhip_viec_private.is_member(team_id) and
      (created_by = (select auth.uid()) or assignee_id = (select auth.uid()) or nhip_viec_private.is_member(team_id, true))
    )
  )
  with check ((team_id is null and created_by = (select auth.uid())) or nhip_viec_private.is_member(team_id));
create policy work_tasks_delete on public.work_tasks for delete to authenticated
  using ((team_id is null and created_by = (select auth.uid())) or
    (nhip_viec_private.is_member(team_id) and
      (created_by = (select auth.uid()) or nhip_viec_private.is_member(team_id, true))));
create policy work_comments_read on public.work_comments for select to authenticated
  using (exists (select 1 from public.work_tasks t where t.id = task_id and t.team_id is not null));
create policy work_comments_create on public.work_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and
    exists (select 1 from public.work_tasks t where t.id = task_id and t.team_id is not null));

create function public.work_create_team(team_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_team uuid;
declare name_for_team text := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
  split_part(auth.jwt()->>'email', '@', 1), 'Thành viên'), 80);
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
  insert into public.work_teams (name) values (btrim(team_name)) returning id into new_team;
  insert into public.work_members (team_id, user_id, display_name, role)
  values (new_team, auth.uid(), name_for_team, 'owner');
  return new_team;
end;
$$;

create function public.work_create_invite(target_team uuid, invite_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_token uuid;
declare normalized_email text := lower(btrim(invite_email));
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception 'Chỉ chủ nhóm có thể tạo lời mời.';
  end if;
  if normalized_email is null or char_length(normalized_email) > 254 or
    normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Email mời không hợp lệ.';
  end if;
  insert into nhip_viec_private.invites (team_id, email)
  values (target_team, normalized_email) returning token into new_token;
  return new_token;
end;
$$;

create function public.work_accept_invite(invite_token uuid)
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
  insert into public.work_members (team_id, user_id, display_name, role)
  values (invite.team_id, account_id, name_for_team, 'member') on conflict (team_id, user_id) do nothing;
  update nhip_viec_private.invites set accepted_by = account_id, accepted_at = now() where token = invite_token;
  return invite.team_id;
end;
$$;

revoke all on function public.work_create_team(text), public.work_create_invite(uuid, text),
  public.work_accept_invite(uuid) from public, anon, authenticated;
grant execute on function public.work_create_team(text), public.work_create_invite(uuid, text),
  public.work_accept_invite(uuid) to authenticated;

commit;
