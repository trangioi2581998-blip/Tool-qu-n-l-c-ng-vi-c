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
  -- Cho phép nếu là Super admin hoặc trưởng nhóm (role = 'owner') của nhóm này
  if actor is not null then
    if not (
      exists (select 1 from auth.users where id = actor and lower(email) in ('gioitt@mbbank.com.vn', 'mrtran25081998@gmail.com'))
      or
      exists (select 1 from public.work_members where team_id = target_team and user_id = actor and role = 'owner')
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
