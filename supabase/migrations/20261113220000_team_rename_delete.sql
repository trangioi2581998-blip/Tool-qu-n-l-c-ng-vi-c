begin;

-- =========================================================
-- Migration: 20261113220000_team_rename_delete.sql
-- Cho phép trưởng nhóm (owner) đổi tên nhóm và xóa nhóm
-- =========================================================

-- 1. Hàm đổi tên nhóm (chỉ owner)
create or replace function public.work_rename_team(target_team uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception 'Chỉ trưởng nhóm mới có quyền đổi tên nhóm.';
  end if;
  if coalesce(btrim(new_name), '') = '' then
    raise exception 'Tên nhóm không được để trống.';
  end if;
  if char_length(btrim(new_name)) > 80 then
    raise exception 'Tên nhóm không được quá 80 ký tự.';
  end if;
  update public.work_teams
  set name = btrim(new_name)
  where id = target_team;
end;
$$;

-- 2. Hàm xóa nhóm (chỉ owner)
create or replace function public.work_delete_team(target_team uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception 'Chỉ trưởng nhóm mới có quyền xóa nhóm.';
  end if;
  delete from public.work_teams
  where id = target_team;
end;
$$;

-- 3. Cấp quyền thực thi các hàm trên cho tài khoản đã đăng nhập
revoke all on function public.work_rename_team(uuid, text) from public, anon;
grant execute on function public.work_rename_team(uuid, text) to authenticated;

revoke all on function public.work_delete_team(uuid) from public, anon;
grant execute on function public.work_delete_team(uuid) to authenticated;

-- 4. Bổ sung policy trực tiếp cho bảng work_teams để hỗ trợ đồng bộ
grant update (name), delete on public.work_teams to authenticated;

drop policy if exists work_teams_update on public.work_teams;
create policy work_teams_update on public.work_teams
  for update to authenticated
  using (nhip_viec_private.is_member(id, true))
  with check (nhip_viec_private.is_member(id, true));

drop policy if exists work_teams_delete on public.work_teams;
create policy work_teams_delete on public.work_teams
  for delete to authenticated
  using (nhip_viec_private.is_member(id, true));

commit;
