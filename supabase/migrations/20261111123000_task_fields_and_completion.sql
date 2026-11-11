begin;

-- Fill the known creation date for personal tasks. Preserve any existing deadline.
update public.work_tasks
set assigned_on = (created_at at time zone 'Asia/Ho_Chi_Minh')::date
where assigned_on is null;

-- Existing inconsistent trees need a valid status before the new rule takes effect.
update public.work_tasks parent
set status = 'doing', version = parent.version + 1, updated_at = now()
where parent.level = 1 and parent.status = 'done' and exists (
  select 1 from public.work_tasks child where child.parent_id = parent.id and child.status <> 'done'
);

create function nhip_viec_private.guard_task_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_status text;
begin
  if tg_op = 'UPDATE' then
    if new.status = old.status and new.level = old.level and new.parent_id is not distinct from old.parent_id then
      return new;
    end if;
  end if;
  if new.level = 2 and new.parent_id is not null then
    -- Write the parent row without changing its data so parent and child transitions
    -- serialize even if a caller uses a repeatable-read snapshot.
    update public.work_tasks set updated_at = updated_at
    where id = new.parent_id returning status into parent_status;
    if parent_status = 'done' and new.status <> 'done' then
      raise exception 'Hãy mở lại việc chính trước khi thêm hoặc mở lại việc con chưa hoàn thành.';
    end if;
  elsif new.level = 1 and new.status = 'done' and exists (
    select 1 from public.work_tasks where parent_id = new.id and status <> 'done'
  ) then
    raise exception 'Cần hoàn thành tất cả việc con trước khi hoàn thành việc chính.';
  end if;
  return new;
end;
$$;

create trigger work_task_completion_guard
before insert or update of status, level, parent_id on public.work_tasks
for each row execute function nhip_viec_private.guard_task_completion();
revoke all on function nhip_viec_private.guard_task_completion() from public, anon, authenticated;

alter function public.work_save_task(jsonb, uuid, integer) rename to work_save_task_v3;
revoke all on function public.work_save_task_v3(jsonb, uuid, integer) from public, anon, authenticated;

create function public.work_save_task(payload jsonb, target_id uuid default null, expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous public.work_tasks;
  selected_team uuid;
  assignment_date date;
  deadline_date date;
  previously_assigned boolean := false;
  result jsonb;
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
    previously_assigned := exists (select 1 from public.work_task_assignees where task_id = target_id);
  end if;

  selected_team := case when target_id is null then (payload->>'team_id')::uuid else previous.team_id end;
  if selected_team is null then
    assignment_date := case when payload ? 'assigned_on' then (payload->>'assigned_on')::date
      else coalesce(previous.assigned_on, nhip_viec_private.vn_today()) end;
    deadline_date := case when payload ? 'due_date' then (payload->>'due_date')::date else previous.due_date end;
    if (target_id is null or assignment_date is distinct from previous.assigned_on or deadline_date is distinct from previous.due_date)
      and (assignment_date is null or deadline_date is null or deadline_date < assignment_date) then
      raise exception 'Ngày giao và hạn hoàn thành là bắt buộc. Hạn hoàn thành phải từ ngày giao trở đi.';
    end if;
  end if;

  result := public.work_save_task_v3(payload, target_id, expected_version);
  if selected_team is not null then
    if jsonb_array_length(result->'assignee_ids') = 0 and (
      target_id is null or previously_assigned
      or (result->>'assigned_on')::date is distinct from previous.assigned_on
      or (result->>'due_date')::date is distinct from previous.due_date
    ) then
      raise exception 'Hãy chọn ít nhất một người thực hiện.';
    end if;
    return result;
  end if;

  update public.work_tasks set assigned_on = assignment_date where id = (result->>'id')::uuid;
  return result || jsonb_build_object('assigned_on', assignment_date);
end;
$$;

revoke all on function public.work_save_task(jsonb, uuid, integer) from public, anon, authenticated;
grant execute on function public.work_save_task(jsonb, uuid, integer) to authenticated;

-- Keep the existing RPC signature so older clients can still send title-only drafts.
create or replace function public.work_create_task_with_children(main_task jsonb, child_titles jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  main_saved jsonb;
  draft jsonb;
  child_defaults jsonb;
  child_fields jsonb;
  children jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  if jsonb_typeof(main_task) is distinct from 'object' or jsonb_typeof(child_titles) is distinct from 'array' then
    raise exception 'Thông tin công việc không hợp lệ.';
  end if;

  main_saved := public.work_save_task(main_task || jsonb_build_object('level', 1, 'parent_id', null));
  child_defaults := jsonb_build_object(
    'team_id', main_saved->'team_id',
    'project_id', main_saved->'project_id',
    'parent_id', main_saved->'id',
    'level', 2,
    'assignee_ids', main_saved->'assignee_ids',
    'assigned_on', main_saved->'assigned_on',
    'due_date', main_saved->'due_date',
    'priority', main_saved->'priority',
    'status', 'todo'
  );
  for draft in select value from jsonb_array_elements(child_titles) loop
    if jsonb_typeof(draft) = 'string' then
      draft := jsonb_build_object('title', draft #>> '{}');
    end if;
    if jsonb_typeof(draft) <> 'object' or jsonb_typeof(draft->'title') is distinct from 'string'
       or char_length(btrim(draft->>'title')) not between 1 and 160 then
      raise exception 'Mỗi việc con cần có tên từ 1 đến 160 ký tự.';
    end if;
    select jsonb_object_agg(key, value) into child_fields
    from jsonb_each(draft)
    where key in ('title', 'status', 'priority', 'assigned_on', 'due_date', 'assignee_ids');
    children := children || jsonb_build_array(public.work_save_task(child_defaults || child_fields));
  end loop;
  return jsonb_build_object('task', main_saved, 'children', children);
end;
$$;

notify pgrst, 'reload schema';
commit;
