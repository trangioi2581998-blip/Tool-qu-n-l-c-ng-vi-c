-- ============================================================================
-- RPC: Thêm thành viên có sẵn vào nhóm (không cần tạo lại tài khoản / mật khẩu)
-- ============================================================================

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

  -- Ghi nhận thông báo email
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

-- Cho phép SELECT / INSERT / UPDATE vào work_members cho authenticated theo RLS
grant select, insert, update on table public.work_members to authenticated;

drop policy if exists "work_members_insert_policy" on public.work_members;
create policy "work_members_insert_policy" on public.work_members
for insert to authenticated
with check (nhip_viec_private.is_member(team_id, true));

drop policy if exists "work_members_update_policy" on public.work_members;
create policy "work_members_update_policy" on public.work_members
for update to authenticated
using (nhip_viec_private.is_member(team_id, true));
