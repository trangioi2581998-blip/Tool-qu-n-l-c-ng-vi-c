-- ============================================================================
-- FIX: Khi thêm nhân sự mới trong Quản lý phòng ban, KHÔNG tự động gán vào bất kỳ dự án nào
-- Trưởng nhóm của từng dự án sẽ tự chủ động thêm nhân sự tương ứng vào dự án sau
-- Chạy script này trong Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

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

  -- Lưu nhân sự vào Danh bạ thành viên chung / Phòng ban
  insert into public.work_directory_members (user_id, display_name, email, department)
  values (account_id, clean_name, clean_email, clean_dept)
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_directory_members.department end;

  -- CHỈ thêm vào work_members (dự án) NẾU initial_team được chỉ định rõ ràng (khi thêm từ trong dự án)
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

