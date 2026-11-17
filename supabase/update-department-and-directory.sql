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



-- ============================================================================
-- FIX: THÊM THÀNH VIÊN VÀO DỰ ÁN TRONG "QUẢN LÝ ALL DỰ ÁN"
-- ============================================================================

-- 1. Hàm thêm thành viên có sẵn từ danh bạ/phòng ban vào dự án cụ thể
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
  clean_role text := case when member_role in ('owner', 'deputy', 'member') then member_role else 'member' end;
begin
  -- Kiểm tra nhóm/dự án tồn tại
  select name into team_name from public.work_teams where id = target_team;
  if team_name is null then
    raise exception 'Không tìm thấy dự án.';
  end if;

  -- Kiểm tra quyền:
  -- Cho phép nếu là:
  -- - Super admin (gioitt@mbbank.com.vn, mrtran25081998@gmail.com)
  -- - Hoặc trưởng nhóm (role = 'owner') của nhóm này
  -- - Hoặc người tạo nhóm (created_by)
  if actor is not null then
    if not (
      exists (select 1 from auth.users where id = actor and lower(email) in ('gioitt@mbbank.com.vn', 'mrtran25081998@gmail.com'))
      or
      exists (select 1 from public.work_members where team_id = target_team and user_id = actor and role = 'owner')
      or
      exists (select 1 from public.work_teams where id = target_team and created_by = actor)
    ) then
      raise exception using errcode = '42501', message = 'Chỉ có trưởng nhóm mới có quyền thêm thành viên vào nhóm này.';
    end if;
  end if;

  -- Lấy thông tin nhân sự từ work_directory_members
  select display_name, email, coalesce(department, '') as department into source_member
  from public.work_directory_members
  where user_id = target_user
  limit 1;

  if source_member.email is not null then
    user_name := source_member.display_name;
    user_email := source_member.email;
    user_dept := source_member.department;
  else
    -- Nếu chưa có trong directory, lấy từ work_members
    select display_name, email, coalesce(department, '') as department into source_member
    from public.work_members
    where user_id = target_user
    order by created_at desc limit 1;

    if source_member.email is not null then
      user_name := source_member.display_name;
      user_email := source_member.email;
      user_dept := source_member.department;
    else
      -- Lấy từ auth.users
      select
        coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
        email,
        coalesce(raw_user_meta_data->>'department', '')
      into user_name, user_email, user_dept
      from auth.users where id = target_user;
    end if;
  end if;

  if user_email is null then
    raise exception 'Không tìm thấy thông tin tài khoản nhân sự này.';
  end if;

  -- Thêm hoặc cập nhật vào bảng work_members của dự án
  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (
    target_team,
    target_user,
    coalesce(nullif(btrim(user_name), ''), 'Thành viên'),
    user_email,
    coalesce(user_dept, ''),
    clean_role
  )
  on conflict (team_id, user_id) do update set
    role = excluded.role,
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.work_members.display_name end,
    email = case when excluded.email <> '' then excluded.email else public.work_members.email end,
    department = case when excluded.department <> '' then excluded.department else public.work_members.department end
  returning * into added;

  -- Đảm bảo có mặt trong work_directory_members
  insert into public.work_directory_members (user_id, display_name, email, department)
  values (target_user, added.display_name, added.email, coalesce(added.department, ''))
  on conflict (user_id) do update set
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.work_directory_members.display_name end,
    department = case when excluded.department <> '' then excluded.department else public.work_directory_members.department end;

  -- Gửi email thông báo tự động (nếu có outbox)
  begin
    insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
    values (
      'member_added:' || target_team::text || ':' || target_user::text || ':' || extract(epoch from now())::bigint::text,
      target_user,
      '[Nhịp việc] Bạn đã được thêm vào dự án: ' || coalesce(team_name, ''),
      'Xin chào ' || coalesce(added.display_name, '') || E',\n\nBạn đã được thêm vào dự án "' || coalesce(team_name, '') ||
      '" với vai trò: ' || (case when added.role = 'owner' then 'Trưởng nhóm' when added.role = 'deputy' then 'Phó nhóm' else 'Nhân viên' end) ||
      E'.\nHãy truy cập hệ thống Nhịp việc để xem công việc của dự án.',
      target_team
    )
    on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
  exception when others then
  end;

  return jsonb_build_object(
    'user_id', added.user_id,
    'display_name', added.display_name,
    'email', added.email,
    'department', coalesce(added.department, ''),
    'role', added.role
  );
end;
$$;

grant execute on function public.work_add_existing_member(uuid, uuid, text) to authenticated, anon;

-- Cấp quyền bảng work_members và cập nhật RLS policy
grant select, insert, update, delete on table public.work_members to authenticated;

drop policy if exists "work_members_insert_policy" on public.work_members;
create policy "work_members_insert_policy" on public.work_members
for insert to authenticated
with check (
  exists (
    select 1 from public.work_members
    where team_id = work_members.team_id and user_id = auth.uid() and role = 'owner'
  )
  or exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) in ('gioitt@mbbank.com.vn', 'mrtran25081998@gmail.com')
  )
  or exists (
    select 1 from public.work_teams
    where id = work_members.team_id and created_by = auth.uid()
  )
);

drop policy if exists "work_members_delete_policy" on public.work_members;
create policy "work_members_delete_policy" on public.work_members
for delete to authenticated
using (
  exists (
    select 1 from public.work_members
    where team_id = work_members.team_id and user_id = auth.uid() and role = 'owner'
  )
  or exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) in ('gioitt@mbbank.com.vn', 'mrtran25081998@gmail.com')
  )
);

notify pgrst, 'reload schema';
