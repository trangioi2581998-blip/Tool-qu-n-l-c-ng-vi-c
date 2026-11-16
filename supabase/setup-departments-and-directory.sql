-- ============================================================================
-- SETUP TOÀN DIỆN: QUẢN LÝ PHÒNG BAN & THÀNH VIÊN DANH BẠ CHUNG (DIRECTORY)
-- Chạy script này trong Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. BẢNG WORK_DIRECTORY_MEMBERS (Danh bạ nhân sự hệ thống)
-- ----------------------------------------------------------------------------
create table if not exists public.work_directory_members (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  email text not null,
  department text default '',
  created_at timestamptz default now()
);

-- Đồng bộ dữ liệu hiện có từ work_members
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

grant select, insert, update, delete on table public.work_directory_members to authenticated;
alter table public.work_directory_members enable row level security;
drop policy if exists "work_directory_members_select" on public.work_directory_members;
create policy "work_directory_members_select" on public.work_directory_members for select to authenticated using (true);
drop policy if exists "work_directory_members_all" on public.work_directory_members;
create policy "work_directory_members_all" on public.work_directory_members for all to authenticated using (true) with check (true);

-- 2. BẢNG WORK_DEPARTMENTS (Quản lý các phòng ban)
-- ----------------------------------------------------------------------------
create table if not exists public.work_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 120),
  description text default '',
  created_at timestamptz default now()
);

-- Đồng bộ tên phòng ban từ work_members & work_directory_members
insert into public.work_departments (name)
select distinct btrim(department)
from public.work_members
where coalesce(btrim(department), '') <> ''
on conflict (name) do nothing;

insert into public.work_departments (name)
select distinct btrim(department)
from public.work_directory_members
where coalesce(btrim(department), '') <> ''
on conflict (name) do nothing;

-- Mặc định phòng ban tiêu chuẩn nếu chưa có
insert into public.work_departments (name, description)
values
  ('Product & CX', 'Phòng Sản phẩm và Trải nghiệm khách hàng'),
  ('Kỹ thuật', 'Phòng Kỹ thuật & Công nghệ'),
  ('QA', 'Phòng Đảm bảo chất lượng')
on conflict (name) do nothing;

grant select, insert, update, delete on table public.work_departments to authenticated;
alter table public.work_departments enable row level security;
drop policy if exists "work_departments_select" on public.work_departments;
create policy "work_departments_select" on public.work_departments for select to authenticated using (true);
drop policy if exists "work_departments_all" on public.work_departments;
create policy "work_departments_all" on public.work_departments for all to authenticated using (true) with check (true);

-- 3. RPC: TẠO PHÒNG BAN MỚI
-- ----------------------------------------------------------------------------
create or replace function public.work_create_department(dept_name text, dept_desc text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_name text := btrim(dept_name);
  clean_desc text := coalesce(btrim(dept_desc), '');
  res public.work_departments;
begin
  if clean_name = '' then
    raise exception 'Tên phòng ban không được để trống.';
  end if;
  insert into public.work_departments (name, description)
  values (clean_name, clean_desc)
  on conflict (name) do update set
    description = case when clean_desc <> '' then clean_desc else public.work_departments.description end
  returning * into res;

  return jsonb_build_object(
    'id', res.id,
    'name', res.name,
    'description', res.description,
    'created_at', res.created_at
  );
end;
$$;
grant execute on function public.work_create_department(text, text) to authenticated, anon;

-- 4. RPC: ĐỔI TÊN PHÒNG BAN
-- ----------------------------------------------------------------------------
create or replace function public.work_rename_department(old_name text, new_name text, new_desc text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_old text := btrim(old_name);
  clean_new text := btrim(new_name);
  res public.work_departments;
begin
  if clean_new = '' then
    raise exception 'Tên phòng ban mới không được để trống.';
  end if;

  update public.work_departments
  set name = clean_new,
      description = coalesce(new_desc, description)
  where name = clean_old
  returning * into res;

  update public.work_directory_members
  set department = clean_new
  where department = clean_old;

  update public.work_members
  set department = clean_new
  where department = clean_old;

  return jsonb_build_object(
    'id', res.id,
    'name', res.name,
    'description', res.description
  );
end;
$$;
grant execute on function public.work_rename_department(text, text, text) to authenticated, anon;

-- 5. RPC: XÓA PHÒNG BAN
-- ----------------------------------------------------------------------------
create or replace function public.work_delete_department(dept_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  clean_name text := btrim(dept_name);
begin
  delete from public.work_departments where name = clean_name;

  update public.work_directory_members
  set department = ''
  where department = clean_name;

  update public.work_members
  set department = ''
  where department = clean_name;
end;
$$;
grant execute on function public.work_delete_department(text) to authenticated, anon;

-- 6. RPC: GÁN / ĐỔI PHÒNG BAN CHO NHÂN VIÊN
-- ----------------------------------------------------------------------------
create or replace function public.work_assign_member_department(target_user uuid, new_dept text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  clean_dept text := coalesce(btrim(new_dept), '');
begin
  update public.work_directory_members
  set department = clean_dept
  where user_id = target_user;

  update public.work_members
  set department = clean_dept
  where user_id = target_user;

  if clean_dept <> '' then
    insert into public.work_departments (name)
    values (clean_dept)
    on conflict (name) do nothing;
  end if;
end;
$$;
grant execute on function public.work_assign_member_department(uuid, text) to authenticated, anon;

-- 7. RPC: TẠO THÀNH VIÊN VÀ THÊM VÀO PHÒNG BAN
-- ----------------------------------------------------------------------------
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
  chosen_team uuid := initial_team;
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

  if chosen_team is null then
    select id into chosen_team from public.work_teams order by created_at asc limit 1;
  end if;

  if chosen_team is not null then
    insert into public.work_members (team_id, user_id, display_name, email, department, role)
    values (
      chosen_team,
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
    'accountCreated', not existed
  );
end;
$$;
grant execute on function public.work_create_directory_member(text, text, text, text, uuid, text) to authenticated, anon;

-- 8. RPC: DANH SÁCH TOÀN BỘ NHÂN SỰ
-- ----------------------------------------------------------------------------
create or replace function public.work_list_all_members()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
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
grant execute on function public.work_list_all_members() to authenticated, anon;

-- 9. RPC: CẬP NHẬT THÔNG TIN NHÂN SỰ
-- ----------------------------------------------------------------------------
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
grant execute on function public.work_update_directory_member(uuid, text, text, text, text) to authenticated, anon;

-- 10. RPC: XÓA NHÂN SỰ
-- ----------------------------------------------------------------------------
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
  end;
end;
$$;
grant execute on function public.work_delete_directory_member(uuid) to authenticated, anon;
