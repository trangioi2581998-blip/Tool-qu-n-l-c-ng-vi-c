begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('work-task-attachments', 'work-task-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create function nhip_viec_private.can_access_attachment(object_name text, access_mode text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
begin
  if actor is null or length(object_name) > 394 or object_name !~
    '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}_[A-Za-z0-9_-]+$' then
    return false;
  end if;
  target_id := split_part(object_name, '/', 1)::uuid;

  if not exists (
    select 1 from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = actor) or (
        nhip_viec_private.is_member(t.team_id) and (
          access_mode = 'read' or nhip_viec_private.is_member(t.team_id, true) or exists (
            select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = actor
          )
        )
      )
    )
  ) then
    return false;
  end if;

  if access_mode = 'upload' then
    -- Hold the task through object insertion to prevent deletion during upload.
    perform 1 from public.work_tasks where id = target_id for key share;
    return found;
  end if;
  return true;
end;
$$;

revoke all on function nhip_viec_private.can_access_attachment(text, text) from public, anon, authenticated;
grant execute on function nhip_viec_private.can_access_attachment(text, text) to authenticated;

create policy work_task_files_read on storage.objects for select to authenticated
using (bucket_id = 'work-task-attachments' and nhip_viec_private.can_access_attachment(name, 'read'));

create policy work_task_files_add on storage.objects for insert to authenticated
with check (bucket_id = 'work-task-attachments' and nhip_viec_private.can_access_attachment(name, 'upload'));

create policy work_task_files_remove on storage.objects for delete to authenticated
using (bucket_id = 'work-task-attachments' and nhip_viec_private.can_access_attachment(name, 'delete'));

create function nhip_viec_private.guard_task_attachment_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'work-task-attachments' and o.name like old.id::text || '/%'
  ) then
    raise exception 'Hãy gỡ tài liệu đính kèm trước khi xóa công việc.';
  end if;
  return old;
end;
$$;

create trigger work_task_attachment_delete_guard before delete on public.work_tasks
for each row execute function nhip_viec_private.guard_task_attachment_deletion();
revoke all on function nhip_viec_private.guard_task_attachment_deletion() from public, anon, authenticated;

commit;
