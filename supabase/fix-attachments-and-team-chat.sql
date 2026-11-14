-- ============================================================================
-- Fix Task Attachments Upload Policy & Add Team Chat Feature
-- ============================================================================

-- 1. FIX ATTACHMENT UPLOAD RLS POLICY
-- Ensure storage bucket 'work-task-attachments' exists and is properly configured
insert into storage.buckets (id, name, public, file_size_limit)
values ('work-task-attachments', 'work-task-attachments', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

-- Drop existing restrictive storage policies for work-task-attachments
drop policy if exists "work_task_files_all" on storage.objects;
drop policy if exists "work_task_files_add" on storage.objects;
drop policy if exists "work_task_files_read" on storage.objects;
drop policy if exists "work_task_files_update" on storage.objects;
drop policy if exists "work_task_files_remove" on storage.objects;
drop policy if exists "work_task_files_select" on storage.objects;
drop policy if exists "work_task_files_insert" on storage.objects;
drop policy if exists "work_task_files_delete" on storage.objects;

-- Create clean and robust policies allowing authenticated team members to upload & manage attachments
create policy "work_task_files_select" on storage.objects for select to authenticated, anon
using (bucket_id = 'work-task-attachments');

create policy "work_task_files_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'work-task-attachments');

create policy "work_task_files_update" on storage.objects for update to authenticated
using (bucket_id = 'work-task-attachments')
with check (bucket_id = 'work-task-attachments');

create policy "work_task_files_delete" on storage.objects for delete to authenticated
using (bucket_id = 'work-task-attachments');


-- 2. CREATE TEAM CHAT MESSAGES TABLE
create table if not exists public.work_team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.work_teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists work_team_messages_team_idx on public.work_team_messages (team_id, created_at asc);

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

-- Enable real-time replication for team messages
alter publication supabase_realtime add table public.work_team_messages;

