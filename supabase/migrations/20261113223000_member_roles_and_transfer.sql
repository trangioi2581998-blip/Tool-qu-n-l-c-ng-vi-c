begin;

-- =========================================================
-- Migration: 20261113223000_member_roles_and_transfer.sql
-- Hỗ trợ vai trò Phó nhóm (deputy) và chuyển quyền Trưởng nhóm (owner)
-- =========================================================

-- 1. Cập nhật ràng buộc vai trò của thành viên nhóm
alter table public.work_members drop constraint if exists work_members_role_check;
alter table public.work_members add constraint work_members_role_check
  check (role in ('owner', 'deputy', 'member'));

-- 2. Cập nhật hàm is_member để phó nhóm (deputy) cũng có quyền quản lý công việc
create or replace function nhip_viec_private.is_member(target_team uuid, owner_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_members
    where team_id = target_team and user_id = (select auth.uid())
      and (not owner_only or role in ('owner', 'deputy'))
  );
$$;

-- 3. Hàm chuyển quyền trưởng nhóm
create or replace function public.work_transfer_owner(target_team uuid, new_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  -- Chỉ trưởng nhóm hiện tại mới có quyền chuyển giao
  if not exists (
    select 1 from public.work_members
    where team_id = target_team and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Chỉ trưởng nhóm mới có thể chuyển quyền trưởng nhóm.';
  end if;
  if not exists (
    select 1 from public.work_members
    where team_id = target_team and user_id = new_owner
  ) then
    raise exception 'Thành viên được chọn không thuộc nhóm này.';
  end if;
  if auth.uid() = new_owner then
    return;
  end if;

  -- Bổ nhiệm thành viên mới làm Trưởng nhóm (owner)
  update public.work_members
  set role = 'owner'
  where team_id = target_team and user_id = new_owner;

  -- Trưởng nhóm cũ chuyển thành Phó nhóm (deputy)
  update public.work_members
  set role = 'deputy'
  where team_id = target_team and user_id = auth.uid();
end;
$$;

-- 4. Hàm bổ nhiệm hoặc gỡ quyền phó nhóm
create or replace function public.work_set_member_role(target_team uuid, target_user uuid, new_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  -- Chỉ trưởng nhóm mới có thể thay đổi vai trò
  if not exists (
    select 1 from public.work_members
    where team_id = target_team and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Chỉ trưởng nhóm mới có quyền thay đổi vai trò thành viên.';
  end if;
  if new_role not in ('deputy', 'member') then
    raise exception 'Vai trò không hợp lệ.';
  end if;
  if target_user = auth.uid() then
    raise exception 'Trưởng nhóm không thể tự đổi vai trò của mình tại đây.';
  end if;

  update public.work_members
  set role = new_role
  where team_id = target_team and user_id = target_user;
end;
$$;

-- 5. Cấp quyền thực thi cho người dùng đã đăng nhập
revoke all on function public.work_transfer_owner(uuid, uuid) from public, anon;
grant execute on function public.work_transfer_owner(uuid, uuid) to authenticated;

revoke all on function public.work_set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.work_set_member_role(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
