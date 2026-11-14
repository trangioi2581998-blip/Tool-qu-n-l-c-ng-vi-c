-- ============================================================================
-- Fix Task Attachments Upload Policy (Supabase Storage RLS) & Team Chat
-- ============================================================================

-- 1. CẤU HÌNH BUCKET 'work-task-attachments' VÀ PHÂN QUYỀN STORAGE
insert into storage.buckets (id, name, public, file_size_limit)
values ('work-task-attachments', 'work-task-attachments', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

-- Cấp quyền truy cập schema và tables storage cho các role
grant usage on schema storage to authenticated, anon;
grant select on table storage.buckets to authenticated, anon;
grant select, insert, update, delete on table storage.objects to authenticated;
grant select on table storage.objects to anon;

-- Xóa các policy cũ gây hạn chế hoặc xung đột
drop policy if exists "work_task_files_all" on storage.objects;
drop policy if exists "work_task_files_add" on storage.objects;
drop policy if exists "work_task_files_read" on storage.objects;
drop policy if exists "work_task_files_update" on storage.objects;
drop policy if exists "work_task_files_remove" on storage.objects;
drop policy if exists "work_task_files_select" on storage.objects;
drop policy if exists "work_task_files_insert" on storage.objects;
drop policy if exists "work_task_files_delete" on storage.objects;

-- Tạo các policy mới cho phép xem, tải lên, cập nhật và xóa tệp đính kèm
create policy "work_task_files_select" on storage.objects
for select to authenticated, anon
using (bucket_id = 'work-task-attachments');

create policy "work_task_files_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'work-task-attachments');

create policy "work_task_files_update" on storage.objects
for update to authenticated
using (bucket_id = 'work-task-attachments')
with check (bucket_id = 'work-task-attachments');

create policy "work_task_files_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'work-task-attachments');


-- 2. TẠO BẢNG CHAT NHÓM (WORK_TEAM_MESSAGES) VÀ REALTIME
create table if not exists public.work_team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.work_teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists work_team_messages_team_idx
on public.work_team_messages (team_id, created_at asc);

alter table public.work_team_messages enable row level security;

drop policy if exists "work_team_messages_select" on public.work_team_messages;
drop policy if exists "work_team_messages_insert" on public.work_team_messages;
drop policy if exists "work_team_messages_delete" on public.work_team_messages;

create policy "work_team_messages_select" on public.work_team_messages
for select to authenticated
using (nhip_viec_private.is_member(team_id));

create policy "work_team_messages_insert" on public.work_team_messages
for insert to authenticated
with check (nhip_viec_private.is_member(team_id) and sender_id = auth.uid());

create policy "work_team_messages_delete" on public.work_team_messages
for delete to authenticated
using (sender_id = auth.uid() or nhip_viec_private.is_member(team_id, true));

-- Thêm vào publication realtime nếu chưa có
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'work_team_messages'
  ) then
    alter publication supabase_realtime add table public.work_team_messages;
  end if;
end $$;


-- 3. THÊM THÀNH VIÊN CÓ SẴN VÀO NHÓM
create or replace function public.work_add_existing_member(
  target_team uuid,
  target_user uuid,
  member_role text default 'member'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  source_member record;
  user_email text;
  user_name text;
  user_dept text;
  added public.work_members;
  team_name text;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;

  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm hoặc phó nhóm mới có quyền thêm thành viên vào nhóm.';
  end if;

  select name into team_name from public.work_teams where id = target_team;

  -- 1. Tìm thông tin từ work_members của user này ở bất kỳ nhóm nào
  select display_name, email, department into source_member
  from public.work_members
  where user_id = target_user
  order by created_at desc limit 1;

  if source_member.display_name is not null then
    user_name := source_member.display_name;
    user_email := source_member.email;
    user_dept := coalesce(source_member.department, '');
  else
    -- 2. Nếu chưa có trong work_members, lấy từ auth.users
    select
      coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
      email,
      coalesce(raw_user_meta_data->>'department', '')
    into user_name, user_email, user_dept
    from auth.users where id = target_user;
  end if;

  if user_email is null then
    raise exception 'Không tìm thấy tài khoản người dùng.';
  end if;

  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (
    target_team,
    target_user,
    coalesce(user_name, 'Thành viên'),
    user_email,
    coalesce(user_dept, ''),
    case when member_role in ('deputy', 'member') then member_role else 'member' end
  )
  on conflict (team_id, user_id) do update set
    role = excluded.role,
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.work_members.display_name end,
    email = case when excluded.email <> '' then excluded.email else public.work_members.email end,
    department = case when excluded.department <> '' then excluded.department else public.work_members.department end
  returning * into added;

  insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
  values (
    'member_added:' || target_team::text || ':' || target_user::text || ':' || extract(epoch from now())::bigint::text,
    target_user,
    '[Nhịp việc] Bạn đã được thêm vào nhóm: ' || coalesce(team_name, ''),
    'Xin chào ' || coalesce(user_name, '') || E',\n\nBạn đã được thêm vào nhóm "' || coalesce(team_name, '') ||
    '" với vai trò: ' || (case when added.role = 'deputy' then 'Phó nhóm' else 'Nhân viên' end) ||
    E'.\nHãy truy cập hệ thống Nhịp việc để xem công việc của nhóm.',
    target_team
  )
  on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;

  return jsonb_build_object(
    'user_id', added.user_id,
    'display_name', added.display_name,
    'email', added.email,
    'department', added.department,
    'role', added.role
  );
end;
$$;

grant execute on function public.work_add_existing_member(uuid, uuid, text) to authenticated;

grant select, insert, update on table public.work_members to authenticated;

drop policy if exists "work_members_insert_policy" on public.work_members;
create policy "work_members_insert_policy" on public.work_members
for insert to authenticated
with check (nhip_viec_private.is_member(team_id, true));

drop policy if exists "work_members_update_policy" on public.work_members;
create policy "work_members_update_policy" on public.work_members
for update to authenticated
using (nhip_viec_private.is_member(team_id, true));
