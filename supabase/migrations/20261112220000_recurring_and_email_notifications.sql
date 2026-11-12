begin;

-- 1. Upgrade email_outbox to support personal tasks, read status, and richer metadata
alter table nhip_viec_private.email_outbox
  alter column team_id drop not null,
  add column if not exists read_at timestamptz;

-- 2. Email settings table for SMTP / Google Apps Script / Resend configuration from UI
create table if not exists nhip_viec_private.email_settings (
  id smallint primary key default 1 check (id = 1),
  provider text not null default 'smtp' check (provider in ('smtp', 'google_script', 'resend')),
  smtp_host text not null default 'smtp.gmail.com',
  smtp_port integer not null default 465,
  smtp_user text not null default '',
  smtp_pass text not null default '',
  sender_name text not null default 'Nhịp việc',
  sender_email text not null default '',
  resend_api_key text not null default '',
  webhook_url text not null default '',
  enabled boolean not null default true,
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

insert into nhip_viec_private.email_settings (id)
values (1)
on conflict (id) do nothing;

alter table nhip_viec_private.email_settings enable row level security;

-- 3. Helper to get current actor display name
create or replace function nhip_viec_private.actor_display_name(actor_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select m.display_name from public.work_members m where m.user_id = actor_id limit 1),
    (select nullif(btrim(u.raw_user_meta_data->>'display_name'), '') from auth.users u where u.id = actor_id),
    (select split_part(u.email, '@', 1) from auth.users u where u.id = actor_id),
    'Hệ thống'
  );
$$;

-- 4. Upgrade task_email to notify all relevant users (including the actor's own email account, assignees, team owner, creator) for both team and personal tasks
create or replace function nhip_viec_private.task_email(
  task public.work_tasks,
  event_key text,
  subject text,
  detail text,
  previous_assignees uuid[] default '{}'::uuid[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_name text := nhip_viec_private.actor_display_name(auth.uid());
  status_label text := case task.status
    when 'todo' then 'Cần làm'
    when 'doing' then 'Đang làm'
    when 'review' then 'Chờ duyệt'
    else 'Hoàn thành'
  end;
  priority_label text := case task.priority
    when 'high' then 'Cao'
    when 'medium' then 'Vừa'
    else 'Thấp'
  end;
  assigned_str text := case
    when task.assigned_on is not null then to_char(task.assigned_on, 'DD/MM/YYYY') || ' · ' || coalesce(task.assigned_time, '09:00')
    else 'Chưa đặt'
  end;
  due_str text := case
    when task.due_date is not null then to_char(task.due_date, 'DD/MM/YYYY') || ' · ' || coalesce(task.due_time, '17:30')
    else 'Chưa đặt'
  end;
  full_body text;
begin
  full_body :=
    'Công việc: ' || task.title || ' (L' || coalesce(task.level, 1)::text || ')' || E'\n' ||
    detail || E'\n' ||
    'Người thực hiện thao tác: ' || actor_name || E'\n' ||
    'Trạng thái hiện tại: ' || status_label || E'\n' ||
    'Mức độ ưu tiên: ' || priority_label || E'\n' ||
    'Ngày giao: ' || assigned_str || E'\n' ||
    'Hạn hoàn thành: ' || due_str;

  insert into nhip_viec_private.email_outbox (
    event_key, recipient_id, subject, body, task_id, team_id
  )
  select
    event_key,
    recipients.user_id,
    subject,
    full_body,
    task.id,
    task.team_id
  from (
    select m.user_id from public.work_members m where task.team_id is not null and m.team_id = task.team_id and m.role = 'owner'
    union
    select a.user_id from public.work_task_assignees a where a.task_id = task.id
    union
    select m.user_id from public.work_members m where task.team_id is not null and m.team_id = task.team_id and m.user_id = any(previous_assignees)
    union
    select task.created_by where task.created_by is not null
    union
    select auth.uid() where auth.uid() is not null
  ) recipients
  where recipients.user_id is not null
  on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
end;
$$;

-- 5. Update work_save_task_v3 so personal tasks & time changes also trigger notifications
create or replace function public.work_save_task_v3(
  payload jsonb,
  target_id uuid default null,
  expected_version integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous public.work_tasks;
  saved public.work_tasks;
  response jsonb;
  selected_team uuid;
  date_assigned date;
  date_due date;
  time_assigned text;
  time_due text;
  dates_changed boolean;
  prior_people uuid[] := '{}'::uuid[];
  new_people uuid[];
  event_id text;
  cancelled_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  if target_id is not null then
    select * into previous from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = auth.uid()) or nhip_viec_private.is_member(t.team_id)
    ) for update;
    if not found then
      raise exception using errcode = 'NV001', message = 'Công việc không còn khả dụng.';
    end if;
    select coalesce(array_agg(user_id order by user_id), '{}'::uuid[]) into prior_people
    from public.work_task_assignees where task_id = target_id;
  end if;

  selected_team := case when target_id is null then (payload->>'team_id')::uuid else previous.team_id end;
  date_assigned := case when payload ? 'assigned_on' then (payload->>'assigned_on')::date
    else coalesce(previous.assigned_on, nhip_viec_private.vn_today()) end;
  date_due := case when payload ? 'due_date' then (payload->>'due_date')::date else previous.due_date end;
  time_assigned := case when payload ? 'assigned_time' then coalesce(nullif(btrim(payload->>'assigned_time'), ''), '09:00')
    else coalesce(previous.assigned_time, '09:00') end;
  time_due := case when payload ? 'due_time' then coalesce(nullif(btrim(payload->>'due_time'), ''), '17:30')
    else coalesce(previous.due_time, '17:30') end;
  dates_changed := date_assigned is distinct from previous.assigned_on
    or date_due is distinct from previous.due_date
    or time_assigned is distinct from previous.assigned_time
    or time_due is distinct from previous.due_time;

  if selected_team is not null then
    if not nhip_viec_private.is_member(selected_team, true) and (target_id is null or payload ?| array['assigned_on', 'due_date', 'assigned_time', 'due_time']) then
      raise exception using errcode = '42501', message = 'Trưởng nhóm thiết lập ngày giao và hạn hoàn thành.';
    end if;
    if dates_changed and exists (
      select 1 from public.work_deadline_requests where task_id = target_id and status = 'pending'
    ) then
      raise exception 'Hãy xử lý yêu cầu gia hạn đang chờ trước khi sửa ngày giao hoặc hạn hoàn thành.';
    end if;
    if (target_id is null or dates_changed) and (date_assigned is null or date_due is null or date_due < date_assigned) then
      raise exception 'Ngày giao và hạn hoàn thành là bắt buộc. Hạn hoàn thành phải từ ngày giao trở đi.';
    end if;
  end if;

  response := public.work_save_task_v2(payload, target_id, expected_version);

  update public.work_tasks set assigned_on = date_assigned
  where id = (response->>'id')::uuid returning * into saved;
  response := response || jsonb_build_object('assigned_on', saved.assigned_on);

  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[]) into new_people
  from public.work_task_assignees where task_id = saved.id;
  if selected_team is not null and new_people is distinct from prior_people and date_due is null then
    raise exception 'Hãy đặt hạn hoàn thành trước khi giao việc.';
  end if;
  event_id := saved.id::text || ':' || saved.version::text || ':';

  if target_id is null then
    perform nhip_viec_private.task_email(
      saved,
      event_id || 'new',
      '[Nhịp việc] Công việc mới: ' || saved.title,
      'Công việc mới vừa được tạo và phân công trên hệ thống.'
    );
    return response;
  end if;
  if saved.status is distinct from previous.status then
    perform nhip_viec_private.task_email(
      saved,
      event_id || 'status',
      '[Nhịp việc] Cập nhật trạng thái: ' || saved.title,
      'Trạng thái công việc đã được chuyển từ "' ||
        (case previous.status when 'todo' then 'Cần làm' when 'doing' then 'Đang làm' when 'review' then 'Chờ duyệt' else 'Hoàn thành' end) ||
        '" sang "' ||
        (case saved.status when 'todo' then 'Cần làm' when 'doing' then 'Đang làm' when 'review' then 'Chờ duyệt' else 'Hoàn thành' end) || '".',
      prior_people
    );
  end if;
  if new_people is distinct from prior_people then
    perform nhip_viec_private.task_email(
      saved,
      event_id || 'assigned',
      '[Nhịp việc] Thay đổi phân công: ' || saved.title,
      'Danh sách người thực hiện công việc đã được cập nhật.',
      prior_people
    );
  end if;
  if dates_changed then
    perform nhip_viec_private.task_email(
      saved,
      event_id || 'dates',
      '[Nhịp việc] Thay đổi lịch/hạn công việc: ' || saved.title,
      'Thời gian giao hoặc hạn hoàn thành của công việc đã được cập nhật.',
      prior_people
    );
  end if;
  if (saved.title, saved.description, saved.priority, saved.project_id, saved.level, saved.parent_id)
     is distinct from (previous.title, previous.description, previous.priority, previous.project_id, previous.level, previous.parent_id) then
    perform nhip_viec_private.task_email(
      saved,
      event_id || 'details',
      '[Nhịp việc] Cập nhật thông tin: ' || saved.title,
      'Nội dung chi tiết hoặc mức độ ưu tiên của công việc đã được chỉnh sửa.',
      prior_people
    );
  end if;
  if saved.status = 'done' and previous.status <> 'done' then
    update public.work_deadline_requests set status = 'cancelled', reviewed_at = now(),
      decision_note = 'Công việc đã hoàn thành.'
    where task_id = saved.id and status = 'pending' returning id into cancelled_id;
    if cancelled_id is not null then
      perform nhip_viec_private.task_email(
        saved,
        cancelled_id::text || ':cancelled',
        '[Nhịp việc] Đã đóng yêu cầu gia hạn: ' || saved.title,
        'Công việc đã hoàn thành nên yêu cầu gia hạn được đóng tự động.',
        prior_people
      );
    end if;
  end if;
  return response || jsonb_build_object('extension_pending', exists (
    select 1 from public.work_deadline_requests where task_id = saved.id and status = 'pending'
  ));
end;
$$;

-- 6. Update delete & comment triggers so all tasks (team & personal) notify properly
create or replace function nhip_viec_private.comment_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare task public.work_tasks;
begin
  select * into task from public.work_tasks where id = new.task_id;
  if found then
    perform nhip_viec_private.task_email(
      task,
      new.id::text || ':comment',
      '[Nhịp việc] Bình luận mới: ' || task.title,
      new.author_name || ' vừa bình luận: "' || left(new.body, 180) || '"'
    );
  end if;
  return new;
end;
$$;

create or replace function nhip_viec_private.task_deleted_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prior_assignees uuid[];
begin
  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[])
  into prior_assignees
  from public.work_task_assignees
  where task_id = old.id;

  perform nhip_viec_private.task_email(
    old,
    old.id::text || ':deleted',
    '[Nhịp việc] Đã xóa công việc: ' || old.title,
    'Công việc này đã được xóa khỏi danh sách làm việc.',
    prior_assignees
  );
  return old;
end;
$$;

-- 7. Update member actions to also queue notifications
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
  team_name text;
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

  select name into team_name from public.work_teams where id = target_team;
  select exists(select 1 from auth.users where lower(email) = clean_email) into existed;
  account_id := nhip_viec_private.upsert_auth_user(null, clean_email, member_password, clean_name);

  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (target_team, account_id, clean_name, clean_email, clean_dept, 'member')
  on conflict (team_id, user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_members.department end
  returning * into added;

  insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
  select
    'member_created:' || target_team::text || ':' || account_id::text || ':' || extract(epoch from now())::bigint::text,
    uid,
    '[Nhịp việc] Tài khoản thành viên mới: ' || clean_name,
    'Thành viên ' || clean_name || ' (' || clean_email || ') đã được thêm vào nhóm ' || coalesce(team_name, '') ||
    (case when clean_dept <> '' then E'\nPhòng ban: ' || clean_dept else '' end) ||
    E'\nMật khẩu đăng nhập ban đầu: ' || member_password,
    target_team
  from unnest(array[account_id, auth.uid()]) as uid
  where uid is not null
  on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;

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
  team_name text;
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể chỉnh sửa thành viên.';
  end if;

  select name into team_name from public.work_teams where id = target_team;

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

  insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
  select
    'member_updated:' || target_team::text || ':' || target_user::text || ':' || extract(epoch from now())::bigint::text,
    uid,
    '[Nhịp việc] Cập nhật thông tin tài khoản: ' || clean_name,
    'Thông tin thành viên ' || clean_name || ' (' || clean_email || ') trong nhóm ' || coalesce(team_name, '') || ' đã được cập nhật.' ||
    (case when clean_dept <> '' then E'\nPhòng ban: ' || clean_dept else '' end) ||
    (case when coalesce(btrim(member_password), '') <> '' then E'\nMật khẩu đăng nhập đã được đặt lại.' else '' end),
    target_team
  from unnest(array[target_user, auth.uid()]) as uid
  where uid is not null
  on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;

  return jsonb_build_object(
    'user_id', updated.user_id,
    'display_name', updated.display_name,
    'email', updated.email,
    'department', updated.department,
    'role', updated.role
  );
end;
$$;

-- 8. RPCs for Notification Center, Email Settings, and Instant Email Dispatch
create or replace function public.work_list_my_notifications(limit_count integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  items jsonb;
  unread_count integer;
  cfg record;
  configured boolean := false;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;

  select * into cfg from nhip_viec_private.email_settings where id = 1;
  if found and cfg.enabled then
    if cfg.provider = 'smtp' and btrim(cfg.smtp_user) <> '' and btrim(cfg.smtp_pass) <> '' then
      configured := true;
    elsif cfg.provider = 'google_script' and btrim(cfg.webhook_url) <> '' then
      configured := true;
    elsif cfg.provider = 'resend' and btrim(cfg.resend_api_key) <> '' then
      configured := true;
    end if;
  end if;

  select count(*)::integer into unread_count
  from nhip_viec_private.email_outbox
  where recipient_id = uid and read_at is null;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into items
  from (
    select
      o.id,
      o.subject,
      o.body,
      o.task_id,
      o.team_id,
      o.created_at,
      o.sent_at,
      o.failed_at,
      o.last_error,
      o.read_at,
      u.email as recipient_email
    from nhip_viec_private.email_outbox o
    left join auth.users u on u.id = o.recipient_id
    where o.recipient_id = uid
    order by o.created_at desc
    limit least(greatest(limit_count, 1), 100)
  ) t;

  return jsonb_build_object(
    'items', items,
    'unread_count', coalesce(unread_count, 0),
    'email_configured', configured,
    'provider', coalesce(cfg.provider, 'smtp'),
    'sender_email', case
      when cfg.provider = 'smtp' then cfg.smtp_user
      else cfg.sender_email
    end
  );
end;
$$;

create or replace function public.work_mark_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update nhip_viec_private.email_outbox
  set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.work_get_email_settings()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cfg nhip_viec_private.email_settings;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  select * into cfg from nhip_viec_private.email_settings where id = 1;
  return jsonb_build_object(
    'provider', coalesce(cfg.provider, 'smtp'),
    'smtp_host', coalesce(cfg.smtp_host, 'smtp.gmail.com'),
    'smtp_port', coalesce(cfg.smtp_port, 465),
    'smtp_user', coalesce(cfg.smtp_user, ''),
    'smtp_pass', coalesce(cfg.smtp_pass, ''),
    'sender_name', coalesce(cfg.sender_name, 'Nhịp việc'),
    'sender_email', coalesce(cfg.sender_email, ''),
    'resend_api_key', coalesce(cfg.resend_api_key, ''),
    'webhook_url', coalesce(cfg.webhook_url, ''),
    'enabled', coalesce(cfg.enabled, true)
  );
end;
$$;

create or replace function public.work_save_email_settings(settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;

  insert into nhip_viec_private.email_settings (
    id, provider, smtp_host, smtp_port, smtp_user, smtp_pass,
    sender_name, sender_email, resend_api_key, webhook_url, enabled, updated_by, updated_at
  ) values (
    1,
    coalesce(nullif(btrim(settings->>'provider'), ''), 'smtp'),
    coalesce(nullif(btrim(settings->>'smtp_host'), ''), 'smtp.gmail.com'),
    coalesce((settings->>'smtp_port')::integer, 465),
    coalesce(btrim(settings->>'smtp_user'), ''),
    coalesce(btrim(settings->>'smtp_pass'), ''),
    coalesce(nullif(btrim(settings->>'sender_name'), ''), 'Nhịp việc'),
    coalesce(btrim(settings->>'sender_email'), ''),
    coalesce(btrim(settings->>'resend_api_key'), ''),
    coalesce(btrim(settings->>'webhook_url'), ''),
    coalesce((settings->>'enabled')::boolean, true),
    uid,
    now()
  )
  on conflict (id) do update set
    provider = excluded.provider,
    smtp_host = excluded.smtp_host,
    smtp_port = excluded.smtp_port,
    smtp_user = excluded.smtp_user,
    smtp_pass = case when excluded.smtp_pass <> '' then excluded.smtp_pass else nhip_viec_private.email_settings.smtp_pass end,
    sender_name = excluded.sender_name,
    sender_email = excluded.sender_email,
    resend_api_key = case when excluded.resend_api_key <> '' then excluded.resend_api_key else nhip_viec_private.email_settings.resend_api_key end,
    webhook_url = excluded.webhook_url,
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = now();

  -- Reset failed or pending emails so they can be dispatched immediately with the new config
  update nhip_viec_private.email_outbox
  set failed_at = null, attempts = 0, next_attempt_at = now(), lease_id = null, lease_until = null, last_error = null
  where sent_at is null;

  return public.work_get_email_settings();
end;
$$;

create or replace function public.work_claim_pending_emails(batch_size integer default 15)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cfg nhip_viec_private.email_settings;
  configured boolean := false;
  jobs jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;

  select * into cfg from nhip_viec_private.email_settings where id = 1;
  if found and cfg.enabled then
    if cfg.provider = 'smtp' and btrim(cfg.smtp_user) <> '' and btrim(cfg.smtp_pass) <> '' then
      configured := true;
    elsif cfg.provider = 'google_script' and btrim(cfg.webhook_url) <> '' then
      configured := true;
    elsif cfg.provider = 'resend' and btrim(cfg.resend_api_key) <> '' then
      configured := true;
    end if;
  end if;

  if not configured then
    return jsonb_build_object('configured', false, 'jobs', '[]'::jsonb);
  end if;

  with pending as (
    select o.id, u.email
    from nhip_viec_private.email_outbox o
    join auth.users u on u.id = o.recipient_id
    where o.sent_at is null
      and o.failed_at is null
      and o.next_attempt_at <= now()
      and (o.lease_until is null or o.lease_until <= now())
      and o.attempts < 8
      and u.email is not null
    order by o.created_at desc, o.id
    limit least(greatest(batch_size, 1), 30)
    for update of o skip locked
  ), claimed as (
    update nhip_viec_private.email_outbox o
    set
      attempts = o.attempts + 1,
      lease_id = gen_random_uuid(),
      lease_until = now() + interval '2 minutes'
    from pending p
    where p.id = o.id
    returning o.id, o.lease_id, p.email::text as email, o.subject, o.body, o.task_id, o.team_id
  )
  select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) into jobs from claimed c;

  return jsonb_build_object(
    'configured', true,
    'settings', jsonb_build_object(
      'provider', cfg.provider,
      'smtp_host', cfg.smtp_host,
      'smtp_port', cfg.smtp_port,
      'smtp_user', cfg.smtp_user,
      'smtp_pass', cfg.smtp_pass,
      'sender_name', cfg.sender_name,
      'sender_email', cfg.sender_email,
      'resend_api_key', cfg.resend_api_key,
      'webhook_url', cfg.webhook_url
    ),
    'jobs', jobs
  );
end;
$$;

create or replace function public.work_complete_pending_email(
  message_id uuid,
  claim_id uuid,
  delivered boolean,
  detail text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;

  update nhip_viec_private.email_outbox o set
    sent_at = case when delivered then now() else null end,
    failed_at = case when not delivered and attempts >= 5 then now() else null end,
    next_attempt_at = case when delivered then o.next_attempt_at else now() + interval '30 seconds' end,
    lease_id = null,
    lease_until = null,
    last_error = case when delivered then null else left(detail, 250) end
  where o.id = message_id and o.lease_id = claim_id and o.sent_at is null;
  return found;
end;
$$;

-- 9. Batch create recurring tasks RPC (transactional creation of multiple task cycles + subtasks)
create or replace function public.work_create_recurring_tasks(cycles jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cycle jsonb;
  main_task jsonb;
  child_tasks jsonb;
  batch_res jsonb;
  saved_main jsonb;
  all_tasks jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  if jsonb_typeof(cycles) is distinct from 'array' or jsonb_array_length(cycles) = 0 then
    raise exception 'Danh sách kỳ công việc không hợp lệ.';
  end if;
  if jsonb_array_length(cycles) > 60 then
    raise exception 'Tối đa 60 kỳ công việc trong một lần tạo.';
  end if;

  for cycle in select value from jsonb_array_elements(cycles) loop
    main_task := cycle->'main';
    child_tasks := coalesce(cycle->'children', '[]'::jsonb);
    if jsonb_array_length(child_tasks) > 0 then
      batch_res := public.work_create_task_with_children(main_task, child_tasks);
      all_tasks := all_tasks || jsonb_build_array(batch_res);
    else
      saved_main := public.work_save_task(main_task);
      all_tasks := all_tasks || jsonb_build_array(
        jsonb_build_object('task', saved_main, 'children', '[]'::jsonb)
      );
    end if;
  end loop;

  return all_tasks;
end;
$$;

grant execute on function
  public.work_list_my_notifications(integer),
  public.work_mark_notifications_read(),
  public.work_get_email_settings(),
  public.work_save_email_settings(jsonb),
  public.work_claim_pending_emails(integer),
  public.work_complete_pending_email(uuid, uuid, boolean, text),
  public.work_create_recurring_tasks(jsonb)
to authenticated;

notify pgrst, 'reload schema';
commit;

