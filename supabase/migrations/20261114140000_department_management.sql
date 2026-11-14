-- ============================================================================
-- Bảng và RPC: Quản lý Phòng ban (Department Management)
-- ============================================================================

create table if not exists public.work_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 120),
  description text default '',
  created_at timestamptz default now()
);

-- Tự động đổ các phòng ban sẵn có từ work_directory_members và work_members
insert into public.work_departments (name)
select distinct btrim(department)
from public.work_directory_members
where coalesce(btrim(department), '') <> ''
on conflict (name) do nothing;

insert into public.work_departments (name)
select distinct btrim(department)
from public.work_members
where coalesce(btrim(department), '') <> ''
on conflict (name) do nothing;

-- Nếu chưa có phòng ban nào, tạo mẫu một số phòng ban chuẩn
insert into public.work_departments (name, description)
values
  ('Product & CX', 'Phòng Sản phẩm và Trải nghiệm khách hàng'),
  ('Kỹ thuật', 'Phòng Kỹ thuật & Công nghệ'),
  ('QA', 'Phòng Đảm bảo chất lượng'),
  ('Kinh doanh', 'Phòng Kinh doanh & Đối tác')
on conflict (name) do nothing;

grant select, insert, update, delete on table public.work_departments to authenticated;

alter table public.work_departments enable row level security;
drop policy if exists "work_departments_select" on public.work_departments;
create policy "work_departments_select" on public.work_departments for select to authenticated using (true);

drop policy if exists "work_departments_all" on public.work_departments;
create policy "work_departments_all" on public.work_departments for all to authenticated using (true) with check (true);

-- 1. RPC: Tạo phòng ban mới
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
grant execute on function public.work_create_department(text, text) to authenticated;

-- 2. RPC: Đổi tên phòng ban (tự động cập nhật cho các nhân sự thuộc phòng ban đó)
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

  -- Cập nhật nhân sự ở work_directory_members
  update public.work_directory_members
  set department = clean_new
  where department = clean_old;

  -- Cập nhật nhân sự ở work_members
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
grant execute on function public.work_rename_department(text, text, text) to authenticated;

-- 3. RPC: Xóa phòng ban (chuyển nhân sự thuộc phòng ban này thành Chưa phân phòng ban)
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
grant execute on function public.work_delete_department(text) to authenticated;

-- 4. RPC: Gán hoặc đổi phòng ban cho một nhân viên
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
grant execute on function public.work_assign_member_department(uuid, text) to authenticated;

