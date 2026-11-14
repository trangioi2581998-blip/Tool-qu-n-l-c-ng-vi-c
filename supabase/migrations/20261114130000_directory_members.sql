-- ============================================================================
-- Bảng và RPC: Quản lý Thành viên chung (Common / Global Members Directory)
-- ============================================================================

create table if not exists public.work_directory_members (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  email text not null,
  department text default '',
  created_at timestamptz default now()
);

-- Tự động đổ dữ liệu sẵn có từ work_members vào work_directory_members
insert into public.work_directory_members (user_id, display_name, email, department)
select distinct on (user_id)
  user_id,
  display_name,
  email,
  coalesce(department, '')
from public.work_members
on conflict (user_id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  department = case when excluded.department <> '' then excluded.department else public.work_directory_members.department end;

-- Tự động đổ dữ liệu từ auth.users nếu có
insert into public.work_directory_members (user_id, display_name, email, department)
select
  id,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  email,
  coalesce(raw_user_meta_data->>'department', '')
from auth.users
where email is not null
on conflict (user_id) do nothing;

grant select, insert, update, delete on table public.work_directory_members to authenticated;

alter table public.work_directory_members enable row level security;
drop policy if exists "work_directory_members_select" on public.work_directory_members;
create policy "work_directory_members_select" on public.work_directory_members for select to authenticated using (true);

drop policy if exists "work_directory_members_all" on public.work_directory_members;
create policy "work_directory_members_all" on public.work_directory_members for all to authenticated using (true) with check (true);

-- 1. RPC: Tạo tài khoản thành viên mới trong Thành viên chung
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

  insert into public.work_directory_members (user_id, display_name, email, department)
  values (account_id, clean_name, clean_email, clean_dept)
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_directory_members.department end;

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
      role = excluded.role,
      display_name = excluded.display_name,
      email = excluded.email,
      department = excluded.department;
  end if;

  return jsonb_build_object(
    'user_id', account_id,
    'display_name', clean_name,
    'email', clean_email,
    'department', clean_dept,
    'accountCreated', not existed
  );
end;
$$;
grant execute on function public.work_create_directory_member(text, text, text, text, uuid, text) to authenticated;

-- 2. RPC: Lấy danh sách toàn bộ Thành viên chung kèm các dự án/nhóm đang tham gia
create or replace function public.work_list_all_members()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Đồng bộ thêm nếu có user trong work_members mà chưa có trong work_directory_members
  insert into public.work_directory_members (user_id, display_name, email, department)
  select distinct on (user_id) user_id, display_name, email, coalesce(department, '')
  from public.work_members
  on conflict (user_id) do update set
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.work_directory_members.display_name end,
    email = case when excluded.email <> '' then excluded.email else public.work_directory_members.email end,
    department = case when excluded.department <> '' then excluded.department else public.work_directory_members.department end;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', d.user_id,
        'display_name', d.display_name,
        'email', d.email,
        'department', coalesce(d.department, ''),
        'created_at', d.created_at,
        'teams', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'name', t.name,
              'role', wm.role
            )
          )
          from public.work_members wm
          join public.work_teams t on t.id = wm.team_id
          where wm.user_id = d.user_id
        ), '[]'::jsonb)
      ) order by d.display_name
    ), '[]'::jsonb)
    from public.work_directory_members d
  );
end;
$$;
grant execute on function public.work_list_all_members() to authenticated;

-- 3. RPC: Cập nhật thông tin thành viên chung
create or replace function public.work_update_directory_member(
  target_user uuid,
  new_name text,
  new_email text,
  new_dept text default '',
  new_password text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(btrim(new_email));
  clean_name text := btrim(new_name);
  clean_dept text := coalesce(btrim(new_dept), '');
begin
  update public.work_directory_members set
    display_name = clean_name,
    email = clean_email,
    department = clean_dept
  where user_id = target_user;

  update public.work_members set
    display_name = clean_name,
    email = clean_email,
    department = clean_dept
  where user_id = target_user;

  if new_password <> '' and char_length(new_password) >= 6 then
    perform nhip_viec_private.upsert_auth_user(target_user, clean_email, new_password, clean_name);
  end if;

  return jsonb_build_object(
    'user_id', target_user,
    'display_name', clean_name,
    'email', clean_email,
    'department', clean_dept
  );
end;
$$;
grant execute on function public.work_update_directory_member(uuid, text, text, text, text) to authenticated;

-- 4. RPC: Xóa thành viên khỏi danh bạ chung và tất cả các nhóm
create or replace function public.work_delete_directory_member(target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = target_user then
    raise exception 'Không thể tự xóa tài khoản của chính mình.';
  end if;
  delete from public.work_members where user_id = target_user;
  delete from public.work_directory_members where user_id = target_user;
  begin
    delete from auth.users where id = target_user;
  exception when others then
    -- Giữ an toàn nếu auth.users có ràng buộc khóa ngoại khác
  end;
end;
$$;
grant execute on function public.work_delete_directory_member(uuid) to authenticated;
