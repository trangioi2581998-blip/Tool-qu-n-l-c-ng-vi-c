-- ============================================================================
-- FIX: XÓA TRIỆT ĐỂ NHÂN SỰ VÀ TÀI KHOẢN (Bao gồm các ràng buộc khóa ngoại)
-- Chạy script này trong Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

create or replace function public.work_delete_directory_member(target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := coalesce(auth.uid(), '10000000-0000-4000-8000-000000000001'::uuid);
begin
  if auth.uid() is not null and auth.uid() = target_user then
    raise exception 'Không thể tự xóa tài khoản của chính mình.';
  end if;

  -- 1. Xóa phân công công việc của user này khỏi bảng work_task_assignees
  delete from public.work_task_assignees where user_id = target_user;

  -- 2. Gỡ user này khỏi mảng assignee_ids và các trường liên kết trong work_tasks
  update public.work_tasks 
  set assignee_ids = array_remove(assignee_ids, target_user) 
  where target_user = any(assignee_ids);

  update public.work_tasks 
  set assignee_id = null 
  where assignee_id = target_user;

  update public.work_tasks 
  set assigned_by = null 
  where assigned_by = target_user;

  update public.work_tasks 
  set created_by = admin_uid 
  where created_by = target_user;

  -- 3. Xóa gia hạn deadline liên quan
  delete from public.work_deadline_extensions 
  where requested_by = target_user or reviewed_by = target_user;

  -- 4. Xóa bình luận của user
  delete from public.work_comments where author_id = target_user;

  -- 5. Xóa hàng đợi email của user
  delete from public.work_email_queue 
  where recipient_id = target_user;

  -- 6. Xóa khỏi danh sách thành viên dự án
  delete from public.work_members where user_id = target_user;

  -- 7. Xử lý các nhóm/dự án mà user này tạo:
  -- Nếu nhóm không còn ai khác, xóa nhóm
  delete from public.work_teams 
  where created_by = target_user 
    and not exists (select 1 from public.work_members where team_id = public.work_teams.id);

  -- Nếu nhóm còn người khác, chuyển người tạo sang tài khoản Admin
  update public.work_teams 
  set created_by = admin_uid 
  where created_by = target_user;

  -- 8. Xóa khỏi danh bạ nhân sự chung
  delete from public.work_directory_members where user_id = target_user;

  -- 9. Xóa tài khoản đăng nhập khỏi auth.users
  begin
    delete from auth.users where id = target_user;
  exception when others then
  end;
end;
$$;

grant execute on function public.work_delete_directory_member(uuid) to authenticated, anon;

