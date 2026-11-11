begin;

alter table public.work_tasks
  add column assigned_by uuid references auth.users on delete set null;

create or replace function public.work_save_task(payload jsonb, target_id uuid default null, expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous public.work_tasks;
  selected_team uuid;
  assignment_date date;
  deadline_date date;
  previous_people jsonb := '[]'::jsonb;
  assigner uuid;
  result jsonb;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  if target_id is not null then
    select * into previous from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = actor) or nhip_viec_private.is_member(t.team_id)
    ) for update;
    if not found then
      raise exception using errcode = 'NV001', message = 'Công việc không còn khả dụng.';
    end if;
    select coalesce(jsonb_agg(user_id order by user_id), '[]'::jsonb) into previous_people
    from public.work_task_assignees where task_id = target_id;
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
  if selected_team is not null and jsonb_array_length(result->'assignee_ids') = 0 and (
    target_id is null or jsonb_array_length(previous_people) > 0
    or (result->>'assigned_on')::date is distinct from previous.assigned_on
    or (result->>'due_date')::date is distinct from previous.due_date
  ) then
    raise exception 'Hãy chọn ít nhất một người thực hiện.';
  end if;

  assigner := case when result->'assignee_ids' is distinct from previous_people then actor else previous.assigned_by end;
  if selected_team is null then
    update public.work_tasks set assigned_on = assignment_date, assigned_by = assigner
    where id = (result->>'id')::uuid;
    result := result || jsonb_build_object('assigned_on', assignment_date);
  elsif assigner is distinct from previous.assigned_by then
    update public.work_tasks set assigned_by = assigner where id = (result->>'id')::uuid;
  end if;

  return result || jsonb_build_object('assigned_by', assigner);
end;
$$;

notify pgrst, 'reload schema';
commit;
