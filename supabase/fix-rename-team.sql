-- ==============================================================================
-- BỔ SUNG QUYỀN VÀ HÀM SỬA TÊN DỰ ÁN & XÓA DỰ ÁN (WORK_TEAMS)
-- Chạy đoạn này trong SQL Editor của Supabase để sửa lỗi "Chưa tìm thấy cấu trúc dữ liệu"
-- ==============================================================================

create or replace function public.work_rename_team(target_team uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  if coalesce(btrim(new_name), '') = '' then
    raise exception 'Tên dự án không được để trống.';
  end if;
  if char_length(btrim(new_name)) > 80 then
    raise exception 'Tên dự án không được quá 80 ký tự.';
  end if;
  update public.work_teams
  set name = btrim(new_name)
  where id = target_team;
end;
$$;

create or replace function public.work_delete_team(target_team uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  delete from public.work_teams
  where id = target_team;
end;
$$;

revoke all on function public.work_rename_team(uuid, text) from public, anon;
grant execute on function public.work_rename_team(uuid, text) to authenticated;

revoke all on function public.work_delete_team(uuid) from public, anon;
grant execute on function public.work_delete_team(uuid) to authenticated;

grant update (name), delete on public.work_teams to authenticated;

drop policy if exists work_teams_update on public.work_teams;
create policy work_teams_update on public.work_teams
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists work_teams_delete on public.work_teams;
create policy work_teams_delete on public.work_teams
  for delete to authenticated
  using (true);

notify pgrst, 'reload schema';
