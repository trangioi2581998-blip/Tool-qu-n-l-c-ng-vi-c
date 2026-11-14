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

