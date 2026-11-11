begin;

alter table public.work_tasks add column assigned_on date;
update public.work_tasks
set assigned_on = (created_at at time zone 'Asia/Ho_Chi_Minh')::date
where team_id is not null;

create table public.work_deadline_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks on delete cascade,
  requested_by uuid not null references auth.users,
  previous_due_date date not null,
  requested_due_date date not null check (requested_due_date > previous_due_date),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text check (char_length(decision_note) <= 1000),
  reviewed_by uuid references auth.users,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index work_deadline_pending_idx on public.work_deadline_requests (task_id) where status = 'pending';
create index work_deadline_history_idx on public.work_deadline_requests (task_id, created_at desc);

alter table public.work_deadline_requests enable row level security;
revoke all on public.work_deadline_requests from public, anon, authenticated;
grant select on public.work_deadline_requests to authenticated;
create policy work_deadline_read on public.work_deadline_requests for select to authenticated
using (exists (
  select 1 from public.work_tasks t where t.id = task_id and (
    nhip_viec_private.is_member(t.team_id, true) or requested_by = (select auth.uid()) or exists (
      select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = (select auth.uid())
    )
  )
));

create table nhip_viec_private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  recipient_id uuid not null references auth.users on delete cascade,
  subject text not null,
  body text not null,
  task_id uuid,
  team_id uuid not null,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  lease_id uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  unique (event_key, recipient_id)
);
create index work_email_ready_idx on nhip_viec_private.email_outbox (next_attempt_at)
where sent_at is null and failed_at is null;
alter table nhip_viec_private.email_outbox enable row level security;

create function nhip_viec_private.vn_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

create function nhip_viec_private.task_email(
  task public.work_tasks, event_key text, subject text, detail text,
  previous_assignees uuid[] default '{}'::uuid[]
) returns void language sql set search_path = '' as $$
  insert into nhip_viec_private.email_outbox (
    event_key, recipient_id, subject, body, task_id, team_id
  )
  select event_key, recipients.user_id, subject,
    'Công việc: ' || task.title || E'\n' || detail ||
    E'\nTrạng thái hiện tại: ' || (case task.status when 'todo' then 'Cần làm' when 'doing' then 'Đang làm'
      when 'review' then 'Chờ duyệt' else 'Hoàn thành' end) ||
    E'\nNgày giao: ' || coalesce(to_char(task.assigned_on, 'DD/MM/YYYY'), 'Chưa đặt') ||
    E'\nHạn hoàn thành: ' || coalesce(to_char(task.due_date, 'DD/MM/YYYY'), 'Chưa đặt'),
    task.id, task.team_id
  from (
    select m.user_id from public.work_members m where m.team_id = task.team_id and m.role = 'owner'
    union
    select a.user_id from public.work_task_assignees a where a.task_id = task.id
    union
    select m.user_id from public.work_members m where m.team_id = task.team_id and m.user_id = any(previous_assignees)
  ) recipients
  where task.team_id is not null
  on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
$$;

alter function public.work_save_task(jsonb, uuid, integer) rename to work_save_task_v2;
revoke all on function public.work_save_task_v2(jsonb, uuid, integer) from public, anon, authenticated;

create function public.work_save_task(payload jsonb, target_id uuid default null, expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous public.work_tasks;
  saved public.work_tasks;
  response jsonb;
  selected_team uuid;
  date_assigned date;
  date_due date;
  dates_changed boolean;
  prior_people uuid[] := '{}'::uuid[];
  new_people uuid[];
  event_id text;
  cancelled_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.'; end if;
  if target_id is not null then
    select * into previous from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = auth.uid()) or nhip_viec_private.is_member(t.team_id)
    ) for update;
    if not found then raise exception using errcode = 'NV001', message = 'Công việc không còn khả dụng.'; end if;
    select coalesce(array_agg(user_id order by user_id), '{}'::uuid[]) into prior_people
    from public.work_task_assignees where task_id = target_id;
  end if;

  selected_team := case when target_id is null then (payload->>'team_id')::uuid else previous.team_id end;
  date_assigned := case when payload ? 'assigned_on' then (payload->>'assigned_on')::date
    else coalesce(previous.assigned_on, nhip_viec_private.vn_today()) end;
  date_due := case when payload ? 'due_date' then (payload->>'due_date')::date else previous.due_date end;
  dates_changed := date_assigned is distinct from previous.assigned_on or date_due is distinct from previous.due_date;

  if selected_team is not null then
    if not nhip_viec_private.is_member(selected_team, true) and (target_id is null or payload ?| array['assigned_on', 'due_date']) then
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
  if selected_team is null then return response; end if;

  update public.work_tasks set assigned_on = date_assigned
  where id = (response->>'id')::uuid returning * into saved;
  response := response || jsonb_build_object('assigned_on', saved.assigned_on);
  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[]) into new_people
  from public.work_task_assignees where task_id = saved.id;
  if new_people is distinct from prior_people and date_due is null then
    raise exception 'Hãy đặt hạn hoàn thành trước khi giao việc.';
  end if;
  event_id := saved.id::text || ':' || saved.version::text || ':';

  if target_id is null then
    perform nhip_viec_private.task_email(saved, event_id || 'new', '[Nhịp việc] Công việc mới', 'Trưởng nhóm đã tạo công việc.');
    return response;
  end if;
  if saved.status is distinct from previous.status then
    perform nhip_viec_private.task_email(saved, event_id || 'status', '[Nhịp việc] Trạng thái đã thay đổi',
      'Trạng thái công việc đã được cập nhật.', prior_people);
  end if;
  if new_people is distinct from prior_people then
    perform nhip_viec_private.task_email(saved, event_id || 'assigned', '[Nhịp việc] Phân công đã thay đổi',
      'Danh sách người thực hiện đã được cập nhật.', prior_people);
  end if;
  if dates_changed then
    perform nhip_viec_private.task_email(saved, event_id || 'dates', '[Nhịp việc] Ngày giao hoặc hạn đã thay đổi',
      'Xem ngày giao và hạn hoàn thành mới bên dưới.', prior_people);
  end if;
  if (saved.title, saved.description, saved.priority, saved.project_id, saved.level, saved.parent_id)
     is distinct from (previous.title, previous.description, previous.priority, previous.project_id, previous.level, previous.parent_id) then
    perform nhip_viec_private.task_email(saved, event_id || 'details', '[Nhịp việc] Chi tiết công việc đã thay đổi',
      'Công việc có nội dung hoặc thông tin tổ chức mới.', prior_people);
  end if;
  if saved.status = 'done' and previous.status <> 'done' then
    update public.work_deadline_requests set status = 'cancelled', reviewed_at = now(),
      decision_note = 'Công việc đã hoàn thành.'
    where task_id = saved.id and status = 'pending' returning id into cancelled_id;
    if cancelled_id is not null then
      perform nhip_viec_private.task_email(saved, cancelled_id::text || ':cancelled',
        '[Nhịp việc] Đã đóng yêu cầu gia hạn', 'Công việc đã hoàn thành.', prior_people);
    end if;
  end if;
  return response || jsonb_build_object('extension_pending', exists (
    select 1 from public.work_deadline_requests where task_id = saved.id and status = 'pending'
  ));
end;
$$;

create function public.work_request_extension(target_task uuid, new_due_date date, request_reason text)
returns public.work_deadline_requests language plpgsql security definer set search_path = '' as $$
declare
  task public.work_tasks;
  request public.work_deadline_requests;
begin
  select * into task from public.work_tasks t where t.id = target_task
    and nhip_viec_private.is_member(t.team_id) for update;
  if not found or nhip_viec_private.is_member(task.team_id, true) or not exists (
    select 1 from public.work_task_assignees where task_id = target_task and user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'Chỉ nhân viên được giao việc mới có thể xin gia hạn.'; end if;
  if task.due_date is null or task.due_date >= nhip_viec_private.vn_today() or task.status = 'done' then
    raise exception 'Chỉ công việc quá hạn và chưa hoàn thành mới có thể xin gia hạn.';
  end if;
  if new_due_date is null or new_due_date < nhip_viec_private.vn_today() then
    raise exception 'Hạn đề xuất phải từ hôm nay trở đi.';
  end if;
  if exists (select 1 from public.work_deadline_requests where task_id = target_task and status = 'pending') then
    raise exception 'Công việc đã có một yêu cầu gia hạn đang chờ duyệt.';
  end if;
  insert into public.work_deadline_requests (task_id, requested_by, previous_due_date, requested_due_date, reason)
  values (target_task, auth.uid(), task.due_date, new_due_date, btrim(request_reason))
  returning * into request;
  perform nhip_viec_private.task_email(task, request.id::text || ':requested',
    '[Nhịp việc] Yêu cầu gia hạn đang chờ duyệt',
    'Hạn đề xuất: ' || to_char(new_due_date, 'DD/MM/YYYY') || E'\nTrưởng nhóm có thể mở công việc để xem lý do và phản hồi.');
  return request;
end;
$$;

create function public.work_review_extension(request_id uuid, approve boolean, note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  task public.work_tasks;
  request public.work_deadline_requests;
  people jsonb;
begin
  select t.* into task from public.work_tasks t
  join public.work_deadline_requests r on r.task_id = t.id where r.id = request_id
    and nhip_viec_private.is_member(t.team_id, true) for update of t;
  if not found then raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm được duyệt gia hạn.'; end if;
  select * into request from public.work_deadline_requests where id = request_id;
  if request.status <> 'pending' then raise exception 'Yêu cầu này đã được xử lý.'; end if;
  if approve is null then raise exception 'Hãy chọn duyệt hoặc từ chối.'; end if;
  if approve and (request.requested_due_date < nhip_viec_private.vn_today() or task.status = 'done'
    or task.due_date is distinct from request.previous_due_date) then
    raise exception 'Hạn đề xuất hoặc trạng thái công việc đã thay đổi. Hãy từ chối và yêu cầu gửi lại.';
  end if;
  if not approve and coalesce(char_length(btrim(note)), 0) = 0 then raise exception 'Hãy nhập lý do từ chối.'; end if;
  if approve then
    update public.work_tasks set due_date = request.requested_due_date, updated_at = now(), version = version + 1
    where id = task.id returning * into task;
  end if;
  update public.work_deadline_requests set status = case when approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), decision_note = nullif(btrim(note), '')
  where id = request_id returning * into request;

  perform nhip_viec_private.task_email(task, request.id::text || ':' || request.status,
    case when approve then '[Nhịp việc] Gia hạn đã được duyệt' else '[Nhịp việc] Gia hạn bị từ chối' end,
    case when approve then 'Hạn mới đã được cập nhật.' else 'Hạn hiện tại vẫn áp dụng.' end, array[request.requested_by]);
  select coalesce(jsonb_agg(user_id order by user_id), '[]'::jsonb) into people
  from public.work_task_assignees where task_id = task.id;
  return jsonb_build_object('request', request, 'task',
    to_jsonb(task) - 'hierarchy_scope' - 'parent_level' || jsonb_build_object('assignee_ids', people, 'extension_pending', false));
end;
$$;

create function nhip_viec_private.comment_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare task public.work_tasks;
begin
  select * into task from public.work_tasks where id = new.task_id;
  if task.team_id is not null then
    perform nhip_viec_private.task_email(task, new.id::text || ':comment',
      '[Nhịp việc] Có bình luận mới', 'Mở công việc để xem bình luận của ' || new.author_name || '.');
  end if;
  return new;
end;
$$;
create trigger work_comment_notify after insert on public.work_comments
for each row execute function nhip_viec_private.comment_email();

create function nhip_viec_private.task_deleted_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.team_id is not null then
    perform nhip_viec_private.task_email(old, old.id::text || ':deleted', '[Nhịp việc] Công việc đã được xóa',
      'Trưởng nhóm đã xóa công việc.');
  end if;
  return old;
end;
$$;
create trigger work_task_delete_notify before delete on public.work_tasks
for each row execute function nhip_viec_private.task_deleted_email();

create function public.work_queue_overdue_emails()
returns void language plpgsql security definer set search_path = '' as $$
declare task public.work_tasks;
begin
  for task in select * from public.work_tasks where team_id is not null
    and due_date < nhip_viec_private.vn_today() and status <> 'done'
  loop
    perform nhip_viec_private.task_email(task, task.id::text || ':overdue:' || task.due_date::text,
      '[Nhịp việc] Công việc đã quá hạn', 'Hãy cập nhật tiến độ hoặc mở công việc để xin gia hạn.');
  end loop;
end;
$$;

create function public.work_claim_emails(batch_size integer default 10)
returns table(id uuid, lease_id uuid, email text, subject text, body text, task_id uuid, team_id uuid)
language sql security definer set search_path = '' as $$
  with exhausted as (
    update nhip_viec_private.email_outbox o
    set failed_at = now(), lease_id = null, lease_until = null, last_error = 'Delivery lease expired'
    where o.sent_at is null and o.failed_at is null and o.attempts >= 8 and o.lease_until <= now()
  ), pending as (
    select o.id, u.email from nhip_viec_private.email_outbox o
    join auth.users u on u.id = o.recipient_id
    where o.sent_at is null and o.failed_at is null and o.next_attempt_at <= now()
      and (o.lease_until is null or o.lease_until <= now())
      and o.attempts < 8 and u.email_confirmed_at is not null and u.email is not null
      and exists (select 1 from public.work_members m where m.team_id = o.team_id and m.user_id = o.recipient_id)
    order by o.next_attempt_at, o.id limit least(greatest(batch_size, 1), 20)
    for update of o skip locked
  )
  update nhip_viec_private.email_outbox o
  set attempts = o.attempts + 1, lease_id = gen_random_uuid(), lease_until = now() + interval '3 minutes'
  from pending p where p.id = o.id
  returning o.id, o.lease_id, p.email::text, o.subject, o.body, o.task_id, o.team_id;
$$;

create function public.work_finish_email(message_id uuid, claim_id uuid, delivered boolean, retryable boolean, detail text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update nhip_viec_private.email_outbox o set
    sent_at = case when delivered then now() else null end,
    failed_at = case when not delivered and (not retryable or attempts >= 8) then now() else null end,
    next_attempt_at = now() + make_interval(mins => least(60, (power(2, least(attempts, 6)))::integer)),
    lease_id = null, lease_until = null,
    last_error = left(detail, 200)
  where o.id = message_id and o.lease_id = claim_id and o.sent_at is null;
  return found;
end;
$$;

create function public.work_link_member(target_team uuid, manager_id uuid, member_email text, member_name text, invited_now boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid;
  added public.work_members;
  team_name text;
begin
  select t.name into team_name from public.work_teams t join public.work_members m on m.team_id = t.id
  where t.id = target_team and m.user_id = manager_id and m.role = 'owner';
  if not found then raise exception using errcode = '42501', message = 'Chỉ trưởng nhóm có thể tạo tài khoản thành viên.'; end if;

  select u.id into account_id from auth.users u where lower(u.email) = lower(btrim(member_email)) and u.is_sso_user is not true;
  if account_id is null then return null; end if;
  insert into public.work_members (team_id, user_id, display_name, role)
  values (target_team, account_id, btrim(member_name), 'member')
  on conflict (team_id, user_id) do nothing returning * into added;
  if not found then
    select * into added from public.work_members where team_id = target_team and user_id = account_id;
  elsif not invited_now then
    insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
    values ('member:' || target_team::text || ':' || account_id::text, account_id, '[Nhịp việc] Bạn đã được thêm vào nhóm',
      'Bạn đã được thêm vào nhóm ' || team_name || '. Đăng nhập để mở nhóm.', target_team)
    on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
  end if;
  return jsonb_build_object('user_id', added.user_id, 'display_name', added.display_name, 'role', added.role);
end;
$$;

revoke all on function public.work_save_task(jsonb, uuid, integer),
  public.work_request_extension(uuid, date, text), public.work_review_extension(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.work_save_task(jsonb, uuid, integer),
  public.work_request_extension(uuid, date, text), public.work_review_extension(uuid, boolean, text) to authenticated;

revoke all on function public.work_queue_overdue_emails(), public.work_claim_emails(integer),
  public.work_finish_email(uuid, uuid, boolean, boolean, text), public.work_link_member(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.work_queue_overdue_emails(), public.work_claim_emails(integer),
  public.work_finish_email(uuid, uuid, boolean, boolean, text), public.work_link_member(uuid, uuid, text, text, boolean) to service_role;

revoke all on function nhip_viec_private.vn_today(), nhip_viec_private.task_email(public.work_tasks, text, text, text, uuid[]),
  nhip_viec_private.comment_email(), nhip_viec_private.task_deleted_email() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
