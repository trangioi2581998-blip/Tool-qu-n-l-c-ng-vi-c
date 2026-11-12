begin;

-- ============================================================================
-- 1. Helper function to provision/upsert a confirmed Supabase Auth user directly
-- ============================================================================
create or replace function nhip_viec_private.upsert_auth_user(
  target_id uuid,
  user_email text,
  user_password text,
  user_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(btrim(user_email));
  clean_name text := left(btrim(user_name), 80);
  existing_id uuid;
  final_id uuid;
  hashed_pw text;
begin
  hashed_pw := extensions.crypt(user_password, extensions.gen_salt('bf'));

  select id into existing_id from auth.users where lower(email) = clean_email limit 1;

  if existing_id is not null then
    final_id := existing_id;
    update auth.users set
      encrypted_password = case when coalesce(user_password, '') <> '' then hashed_pw else encrypted_password end,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'display_name', clean_name,
        'email', clean_email,
        'email_verified', true
      ),
      updated_at = now()
    where id = final_id;
  else
    final_id := coalesce(target_id, gen_random_uuid());
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000',
      final_id,
      'authenticated',
      'authenticated',
      clean_email,
      hashed_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', clean_name, 'email', clean_email, 'email_verified', true),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false
    );
  end if;

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    final_id,
    final_id::text,
    jsonb_build_object(
      'sub', final_id::text,
      'email', clean_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    identity_data = excluded.identity_data,
    updated_at = now();

  return final_id;
end;
$$;

revoke all on function nhip_viec_private.upsert_auth_user(uuid, text, text, text) from public, anon, authenticated;

create or replace function nhip_viec_private.set_comment_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select m.display_name into new.author_name
  from public.work_tasks t join public.work_members m on m.team_id = t.team_id
  where t.id = new.task_id and m.user_id = coalesce(auth.uid(), new.author_id);
  if new.author_name is null then raise exception 'Công việc không cho phép bình luận.'; end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. Direct Member Create / Update / Register / Reset RPCs for Live App
-- ============================================================================
create or replace function public.work_create_member_direct(
  target_team uuid,
  member_name text,
  member_email text,
  member_password text,
  member_department text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(btrim(member_email));
  clean_name text := btrim(member_name);
  clean_dept text := coalesce(btrim(member_department), '');
  account_id uuid;
  existed boolean;
  added public.work_members;
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể thêm thành viên.';
  end if;
  if clean_name = '' or clean_email = '' then
    raise exception 'Vui lòng nhập đầy đủ họ tên và email.';
  end if;
  if coalesce(char_length(member_password), 0) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự.';
  end if;

  select exists(select 1 from auth.users where lower(email) = clean_email) into existed;
  account_id := nhip_viec_private.upsert_auth_user(null, clean_email, member_password, clean_name);

  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (target_team, account_id, clean_name, clean_email, clean_dept, 'member')
  on conflict (team_id, user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_members.department end
  returning * into added;

  return jsonb_build_object(
    'member', jsonb_build_object(
      'user_id', added.user_id,
      'display_name', added.display_name,
      'email', added.email,
      'department', added.department,
      'role', added.role
    ),
    'accountCreated', not existed,
    'confirmation', 'not_needed'
  );
end;
$$;

drop function if exists public.work_update_member(uuid, uuid, text, text, text);
create or replace function public.work_update_member(
  target_team uuid,
  target_user uuid,
  member_name text,
  member_email text,
  member_department text default '',
  member_password text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  updated public.work_members;
  clean_email text := lower(btrim(member_email));
  clean_name text := btrim(member_name);
  clean_dept text := coalesce(btrim(member_department), '');
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể chỉnh sửa thành viên.';
  end if;

  update public.work_members
  set
    display_name = clean_name,
    email = clean_email,
    department = clean_dept
  where team_id = target_team and user_id = target_user
  returning * into updated;

  if not found then
    raise exception 'Không tìm thấy thành viên trong nhóm.';
  end if;

  update auth.users set
    email = clean_email,
    encrypted_password = case
      when coalesce(btrim(member_password), '') <> '' then extensions.crypt(member_password, extensions.gen_salt('bf'))
      else encrypted_password
    end,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'display_name', clean_name,
      'email', clean_email,
      'email_verified', true
    ),
    updated_at = now()
  where id = target_user;

  update auth.identities set
    identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', clean_email),
    updated_at = now()
  where user_id = target_user and provider = 'email';

  return jsonb_build_object(
    'user_id', updated.user_id,
    'display_name', updated.display_name,
    'email', updated.email,
    'department', updated.department,
    'role', updated.role
  );
end;
$$;

create or replace function public.work_register_account(
  user_name text,
  user_email text,
  user_password text,
  user_department text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(btrim(user_email));
  clean_name text := btrim(user_name);
  clean_dept text := coalesce(btrim(user_department), '');
  account_id uuid;
  default_team uuid;
begin
  if clean_name = '' or clean_email = '' then
    raise exception 'Vui lòng nhập đầy đủ họ tên và email.';
  end if;
  if coalesce(char_length(user_password), 0) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự.';
  end if;
  if exists (select 1 from auth.users where lower(email) = clean_email) then
    raise exception 'Email này đã được đăng ký. Vui lòng đăng nhập.';
  end if;

  account_id := nhip_viec_private.upsert_auth_user(null, clean_email, user_password, clean_name);

  select id into default_team from public.work_teams order by created_at limit 1;
  if default_team is not null then
    insert into public.work_members (team_id, user_id, display_name, email, department, role)
    values (default_team, account_id, clean_name, clean_email, case when clean_dept <> '' then clean_dept else 'Product & CX' end, 'member')
    on conflict (team_id, user_id) do nothing;
  end if;

  return jsonb_build_object('user_id', account_id, 'email', clean_email);
end;
$$;

create or replace function public.work_reset_password_direct(
  user_email text,
  new_password text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(btrim(user_email));
  target_id uuid;
begin
  if coalesce(char_length(new_password), 0) < 6 then
    raise exception 'Mật khẩu mới phải có ít nhất 6 ký tự.';
  end if;
  select id into target_id from auth.users where lower(email) = clean_email limit 1;
  if target_id is null then
    raise exception 'Không tìm thấy tài khoản với email này.';
  end if;
  update auth.users set
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = target_id;
  return true;
end;
$$;

create or replace function public.work_list_demo_accounts()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.user_id,
        'name', m.display_name,
        'email', coalesce(m.email, u.email),
        'department', coalesce(m.department, ''),
        'role', m.role,
        'roleLabel', case when m.role = 'owner' then 'Trưởng nhóm' else 'Nhân viên' end
      )
      order by case when m.role = 'owner' then 0 else 1 end, m.display_name
    ),
    '[]'::jsonb
  )
  from public.work_members m
  join auth.users u on u.id = m.user_id
  where m.team_id = (select id from public.work_teams order by created_at limit 1);
$$;

grant execute on function public.work_create_member_direct(uuid, text, text, text, text) to authenticated;
grant execute on function public.work_update_member(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.work_register_account(text, text, text, text) to anon, authenticated;
grant execute on function public.work_reset_password_direct(text, text) to anon, authenticated;
grant execute on function public.work_list_demo_accounts() to anon, authenticated;

-- ============================================================================
-- 3. Seed Real Users, Team "Product & CX", Members, Tasks, Comments & Reports
-- ============================================================================
do $$
declare
  u_quy  uuid;
  u_linh uuid;
  u_an   uuid;
  u_thao uuid;
  v_team uuid := '20000000-0000-4000-8000-000000000001';
  today_vn date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  -- 3.1 Create / update 4 real accounts (password: 123456)
  u_quy  := nhip_viec_private.upsert_auth_user('10000000-0000-4000-8000-000000000001', 'tran.quy@nhipviec.vn',  '123456', 'Trần Quý');
  u_linh := nhip_viec_private.upsert_auth_user('10000000-0000-4000-8000-000000000002', 'mai.linh@nhipviec.vn',  '123456', 'Mai Linh');
  u_an   := nhip_viec_private.upsert_auth_user('10000000-0000-4000-8000-000000000003', 'hoang.an@nhipviec.vn',  '123456', 'Hoàng An');
  u_thao := nhip_viec_private.upsert_auth_user('10000000-0000-4000-8000-000000000004', 'minh.thao@nhipviec.vn', '123456', 'Minh Thảo');

  -- 3.2 Create team "Product & CX"
  insert into public.work_teams (id, name, created_at)
  values (v_team, 'Product & CX', now() - interval '21 days')
  on conflict (id) do update set name = excluded.name;

  -- 3.3 Seed team members with email & department
  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values
    (v_team, u_quy,  'Trần Quý',  'tran.quy@nhipviec.vn',  'Product & CX',        'owner'),
    (v_team, u_linh, 'Mai Linh',  'mai.linh@nhipviec.vn',  'Thiết kế (UI/UX)',    'member'),
    (v_team, u_an,   'Hoàng An',  'hoang.an@nhipviec.vn',  'Kỹ thuật (Dev)',      'member'),
    (v_team, u_thao, 'Minh Thảo', 'minh.thao@nhipviec.vn', 'Chăm sóc khách hàng', 'member')
  on conflict (team_id, user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = excluded.department,
    role = excluded.role;

  -- 3.4 Clear existing demo tasks in v_team before re-seeding cleanly
  delete from public.work_tasks where team_id = v_team or created_by = u_quy;
  delete from public.work_deleted_tasks where team_id = v_team;

  -- 3.5 Insert Level 1 tasks first
  insert into public.work_tasks (
    id, team_id, title, description, status, previous_status, status_updated_at,
    priority, assigned_on, due_date, assigned_by, created_by, created_at, updated_at, level, parent_id
  ) values
    -- t1: L1 parent (current week)
    ('30000000-0000-4000-8000-000000000001', v_team,
     'Tổng hợp phản hồi khách hàng tuần này',
     'Gom nhóm phản hồi từ hộp thư hỗ trợ và cuộc gọi sau bán hàng, chọn 3 vấn đề lặp lại nhiều nhất.',
     'doing', 'todo', now() - interval '1 day',
     'high', today_vn - 2, today_vn, u_quy, u_quy,
     now() - interval '2 days', now() - interval '1 day', 1, null),

    -- t2: L1 (current week)
    ('30000000-0000-4000-8000-000000000002', v_team,
     'Hoàn thiện kịch bản phỏng vấn khách hàng',
     'Soát lại 8 câu hỏi mở, thời lượng 25 phút và bảng ghi chú nhanh cho buổi phỏng vấn.',
     'review', 'doing', now() - interval '1 day',
     'medium', today_vn - 1, today_vn + 1, u_quy, u_quy,
     now() - interval '1 day', now() - interval '1 day', 1, null),

    -- t3: L1 (current week)
    ('30000000-0000-4000-8000-000000000003', v_team,
     'Cập nhật component trạng thái giao dịch',
     'Đồng bộ màu cảnh báo, trạng thái chờ xử lý và thông báo lỗi ngắn gọn trên màn hình chi tiết.',
     'doing', 'todo', now() - interval '12 hours',
     'medium', today_vn, today_vn + 3, u_quy, u_quy,
     now() - interval '12 hours', now() - interval '12 hours', 1, null),

    -- t4: L1 (last week)
    ('30000000-0000-4000-8000-000000000004', v_team,
     'Đối chiếu số liệu chuyển đổi bước thanh toán',
     'So sánh tỷ lệ hoàn tất giữa web và mobile sau đợt cập nhật biểu mẫu ngày 01.',
     'todo', null, null,
     'high', today_vn - 9, today_vn - 1, u_quy, u_quy,
     now() - interval '9 days', now() - interval '9 days', 1, null),

    -- t5: L1 (last week, completed this week)
    ('30000000-0000-4000-8000-000000000005', v_team,
     'Gửi lịch phỏng vấn đợt một',
     'Xác nhận khung giờ với 5 khách hàng đã đồng ý tham gia.',
     'done', 'review', now() - interval '1 day',
     'low', today_vn - 8, today_vn - 4, u_quy, u_quy,
     now() - interval '8 days', now() - interval '1 day', 1, null),

    -- t6: L1 private task of Trần Quý (current week)
    ('30000000-0000-4000-8000-000000000006', null,
     'Đọc ghi chú phỏng vấn và nhóm insight',
     'Chọn các trích dẫn quan trọng cho buổi tổng kết sản phẩm chiều thứ Sáu.',
     'todo', null, null,
     'low', today_vn - 1, today_vn + 4, u_quy, u_quy,
     now() - interval '1 day', now() - interval '1 day', 1, null),

    -- t7: L1 (last week)
    ('30000000-0000-4000-8000-000000000007', v_team,
     'Chuẩn bị tài liệu cho buổi chia sẻ CX',
     'Tóm tắt 3 tình huống khách hàng bỏ bước xác thực và đề xuất hướng xử lý.',
     'todo', 'doing', now() - interval '6 days',
     'low', today_vn - 7, today_vn + 7, u_quy, u_quy,
     now() - interval '7 days', now() - interval '6 days', 1, null),

    -- t11: L1 (last week, completed this week)
    ('30000000-0000-4000-8000-000000000011', v_team,
     'Chốt checklist bàn giao bản thiết kế cho Dev',
     'Rà soát đầy đủ trạng thái empty, loading, error và responsive mobile trước khi bàn giao.',
     'done', 'review', now() - interval '12 hours',
     'medium', today_vn - 6, today_vn - 2, u_quy, u_quy,
     now() - interval '6 days', now() - interval '12 hours', 1, null),

    -- t12: L1 (2 weeks ago, completed last week)
    ('30000000-0000-4000-8000-000000000012', v_team,
     'Thiết lập quy chuẩn đặt tên token màu sắc',
     'Thống nhất bảng màu ngữ nghĩa giữa Figma và biến CSS của hệ thống.',
     'done', 'doing', now() - interval '8 days',
     'low', today_vn - 15, today_vn - 9, u_quy, u_quy,
     now() - interval '15 days', now() - interval '8 days', 1, null),

    -- t13: L1 (2 weeks ago, completed last week)
    ('30000000-0000-4000-8000-000000000013', v_team,
     'Khảo sát tốc độ tải trang danh sách công việc',
     'Đo thời gian phản hồi khi danh sách vượt quá 200 đầu việc.',
     'done', 'review', now() - interval '7 days',
     'medium', today_vn - 14, today_vn - 8, u_quy, u_quy,
     now() - interval '14 days', now() - interval '7 days', 1, null);

  -- 3.6 Insert Level 2 child tasks under t1
  insert into public.work_tasks (
    id, team_id, title, description, status, previous_status, status_updated_at,
    priority, assigned_on, due_date, assigned_by, created_by, created_at, updated_at, level, parent_id
  ) values
    ('30000000-0000-4000-8000-000000000008', v_team,
     'Rà soát luồng đăng nhập trên mobile',
     'Kiểm tra bước nhập mã xác thực, thông báo lỗi và trạng thái bàn phím trên màn hình nhỏ.',
     'doing', 'todo', now() - interval '1 day',
     'high', today_vn - 1, today_vn - 1, u_quy, u_quy,
     now() - interval '1 day', now() - interval '1 day', 2, '30000000-0000-4000-8000-000000000001'),

    ('30000000-0000-4000-8000-000000000009', v_team,
     'Kiểm tra thông báo lỗi mã OTP trên iOS',
     'Đảm bảo thông báo đọc rõ với trình đọc màn hình và không che nút gửi lại mã.',
     'todo', null, null,
     'medium', today_vn, today_vn + 2, u_quy, u_quy,
     now() - interval '12 hours', now() - interval '12 hours', 2, '30000000-0000-4000-8000-000000000001'),

    ('30000000-0000-4000-8000-000000000010', v_team,
     'Ghi nhận phản hồi từ nhóm CSKH ca sáng',
     'Tổng hợp các câu hỏi khách thường gặp khi kích hoạt tài khoản lần đầu.',
     'review', 'doing', now() - interval '6 hours',
     'medium', today_vn, today_vn + 1, u_quy, u_quy,
     now() - interval '10 hours', now() - interval '6 hours', 2, '30000000-0000-4000-8000-000000000001');

  -- 3.7 Insert task assignees
  insert into public.work_task_assignees (task_id, user_id, team_id) values
    ('30000000-0000-4000-8000-000000000001', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000001', u_linh, v_team),
    ('30000000-0000-4000-8000-000000000008', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000008', u_linh, v_team),
    ('30000000-0000-4000-8000-000000000009', u_linh, v_team),
    ('30000000-0000-4000-8000-000000000009', u_an,   v_team),
    ('30000000-0000-4000-8000-000000000010', u_thao, v_team),
    ('30000000-0000-4000-8000-000000000002', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000003', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000003', u_an,   v_team),
    ('30000000-0000-4000-8000-000000000004', u_an,   v_team),
    ('30000000-0000-4000-8000-000000000005', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000006', u_quy,  null),
    ('30000000-0000-4000-8000-000000000007', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000007', u_thao, v_team),
    ('30000000-0000-4000-8000-000000000011', u_quy,  v_team),
    ('30000000-0000-4000-8000-000000000011', u_linh, v_team),
    ('30000000-0000-4000-8000-000000000012', u_linh, v_team),
    ('30000000-0000-4000-8000-000000000013', u_an,   v_team);

  -- 3.8 Insert sample deadline extension request (pending) so "Yêu cầu gia hạn" tab has real data
  insert into public.work_deadline_requests (
    task_id, requested_by, previous_due_date, requested_due_date, reason, status, created_at
  ) values (
    '30000000-0000-4000-8000-000000000008',
    u_linh,
    today_vn - 1,
    today_vn + 2,
    'Cần kiểm tra thêm trên thiết bị iOS 17 và Android màn hình nhỏ trước khi chốt kết quả.',
    'pending',
    now() - interval '3 hours'
  );

  -- 3.9 Insert real comments
  insert into public.work_comments (task_id, author_id, author_name, body, created_at) values
    ('30000000-0000-4000-8000-000000000008', u_linh, 'Mai Linh',
     'Mình đã gom các trường hợp bàn phím che nút tiếp tục trên iOS SE, chiều nay gửi bản chụp màn hình.',
     now() - interval '4 hours'),
    ('30000000-0000-4000-8000-000000000002', u_quy, 'Trần Quý',
     'Bản câu hỏi đã rút gọn còn 6 mục chính, nhờ mọi người xem qua trước 16h.',
     now() - interval '2 hours');

  -- 3.10 Insert deleted tasks history for Weekly Report ("Công việc bớt đi")
  insert into public.work_deleted_tasks (
    id, team_id, title, level, previous_status, assignee_ids, assigned_on, created_by, deleted_at
  ) values
    ('30000000-0000-4000-8000-000000000091', v_team,
     'Thử nghiệm pop-up khảo sát NPS cũ trên trang chủ',
     1, 'todo', jsonb_build_array(u_linh), today_vn - 5, u_quy, now() - interval '1 day'),
    ('30000000-0000-4000-8000-000000000092', v_team,
     'Tạo banner thông báo bảo trì máy chủ thử nghiệm',
     1, 'doing', jsonb_build_array(u_an), today_vn - 12, u_quy, now() - interval '8 days');
end;
$$;

notify pgrst, 'reload schema';
commit;

