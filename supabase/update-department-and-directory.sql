-- ============================================================================
-- CẬP NHẬT HOÀN CHỈNH: QUẢN LÝ PHÒNG BAN & DANH BẠ NHÂN SỰ
-- 1. Thêm nhân sự từ Quản lý phòng ban: KHÔNG tự gán vào dự án nào
-- 2. Xóa nhân sự: Tự động gỡ sạch công việc được giao và khóa ngoại, xóa vĩnh viễn
-- ============================================================================

-- 1. HÀM TẠO NHÂN SỰ MỚI
create or replace function public.work_create_directory_member(
  member_name text,
  member_email text,
  member_password text,
  member_department text default '',
  initial_team uuid default null,
  initial_role text default 'member'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(btrim(member_email));
  clean_name text := btrim(member_name);
  clean_dept text := coalesce(btrim(member_department), '');
  account_id uuid;
  existed boolean;
begin
  if clean_name = '' or clean_email = '' then
    raise exception 'Vui lòng nhập đầy đủ họ tên và email.';
  end if;
  if coalesce(char_length(member_password), 0) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự.';
  end if;

  select exists(select 1 from auth.users where lower(email) = clean_email) into existed;
  account_id := nhip_viec_private.upsert_auth_user(null, clean_email, member_password, clean_name);

  -- Lưu vào danh bạ nhân sự phòng ban
  insert into public.work_directory_members (user_id, display_name, email, department)
  values (account_id, clean_name, clean_email, clean_dept)
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_directory_members.department end;

  -- CHỈ thêm vào dự án NẾU initial_team được chỉ định rõ ràng (khi thêm từ trong dự án)
  -- Khi thêm từ Quản lý phòng ban, initial_team = null => KHÔNG thuộc bất kỳ dự án nào!
  if initial_team is not null then
    insert into public.work_members (team_id, user_id, display_name, email, department, role)
    values (
      initial_team,
      account_id,
      clean_name,
      clean_email,
      clean_dept,
      case when initial_role in ('deputy', 'member') then initial_role else 'member' end
    )
    on conflict (team_id, user_id) do update set
      display_name = excluded.display_name,
      email = excluded.email,
      department = case when excluded.department <> '' then excluded.department else public.work_members.department end;
  end if;

  if clean_dept <> '' then
    insert into public.work_departments (name)
    values (clean_dept)
    on conflict (name) do nothing;
  end if;

  return jsonb_build_object(
    'user_id', account_id,
    'display_name', clean_name,
    'email', clean_email,
    'department', clean_dept,
    'teams', case when initial_team is not null then jsonb_build_array(jsonb_build_object('id', initial_team, 'role', initial_role)) else '[]'::jsonb end,
    'accountCreated', not existed
  );
end;
$$;

grant execute on function public.work_create_directory_member(text, text, text, text, uuid, text) to authenticated, anon;


-- 2. HÀM XÓA NHÂN SỰ TOÀN DIỆN
create or replace function public.work_delete_directory_member(target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := coalesce(auth.uid(), '10000000-0000-4000-8000-000000000001'::uuid);
begin
  if auth.uid() is not null and auth.uid() = target_user then
    raise exception 'Không thể tự xóa tài khoản của chính mình.';
  end if;

  -- Gỡ phân công công việc khỏi bảng work_task_assignees
  delete from public.work_task_assignees where user_id = target_user;

  -- Gỡ khỏi mảng assignee_ids và các trường liên kết trong work_tasks
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

  -- Xóa gia hạn deadline liên quan
  delete from public.work_deadline_extensions 
  where requested_by = target_user or reviewed_by = target_user;

  -- Xóa bình luận của user
  delete from public.work_comments where author_id = target_user;

  -- Xóa hàng đợi email
  delete from public.work_email_queue 
  where recipient_id = target_user;

  -- Xóa khỏi thành viên dự án
  delete from public.work_members where user_id = target_user;

  -- Xử lý nhóm/dự án user này từng tạo
  delete from public.work_teams 
  where created_by = target_user 
    and not exists (select 1 from public.work_members where team_id = public.work_teams.id);

  update public.work_teams 
  set created_by = admin_uid 
  where created_by = target_user;

  -- Xóa khỏi danh bạ nhân sự chung
  delete from public.work_directory_members where user_id = target_user;

  -- Xóa tài khoản đăng nhập auth.users
  begin
    delete from auth.users where id = target_user;
  exception when others then
  end;
end;
$$;

grant execute on function public.work_delete_directory_member(uuid) to authenticated, anon;

