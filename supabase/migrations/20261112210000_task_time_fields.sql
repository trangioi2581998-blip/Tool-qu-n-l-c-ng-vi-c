begin;

alter table public.work_tasks
  add column if not exists assigned_time text not null default '09:00',
  add column if not exists due_time text not null default '17:30';

create or replace function public.work_save_task_v2(
  payload jsonb,
  target_id uuid default null,
  expected_version integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := auth.uid();
  old_task public.work_tasks%rowtype;
  saved public.work_tasks%rowtype;
  selected_team uuid;
  selected_users uuid[];
  saved_users jsonb;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Thông tin công việc không hợp lệ.';
  end if;

  if target_id is null then
    selected_team := (payload->>'team_id')::uuid;
    if selected_team is not null and not nhip_viec_private.is_member(selected_team, true) then
      raise exception using errcode = '42501', message = 'Chỉ quản lý được tạo và giao công việc nhóm.';
    end if;

    insert into public.work_tasks (
      team_id, project_id, title, description, status, priority, due_date, due_time, assigned_time, created_by, level, parent_id
    ) values (
      selected_team, (payload->>'project_id')::uuid, btrim(payload->>'title'),
      coalesce(payload->>'description', ''), coalesce(payload->>'status', 'todo'),
      coalesce(payload->>'priority', 'medium'), (payload->>'due_date')::date,
      coalesce(nullif(btrim(payload->>'due_time'), ''), '17:30'),
      coalesce(nullif(btrim(payload->>'assigned_time'), ''), '09:00'),
      actor,
      coalesce((payload->>'level')::smallint, 1), (payload->>'parent_id')::uuid
    ) returning * into saved;
  else
    select * into old_task from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = actor) or nhip_viec_private.is_member(t.team_id)
    ) for update;

    if not found then
      raise exception using errcode = 'NV001', message = 'Công việc không còn khả dụng.';
    end if;

    if old_task.team_id is not null and not nhip_viec_private.is_member(old_task.team_id, true) then
      if payload ?| array['team_id', 'project_id', 'assignee_ids', 'level', 'parent_id']
        or not exists (
          select 1 from public.work_task_assignees a where a.task_id = old_task.id and a.user_id = actor
        ) then
        raise exception using errcode = '42501', message = 'Quản lý phân công, nhân viên cập nhật việc được giao.';
      end if;
    end if;
    if old_task.version is distinct from expected_version then
      raise exception using errcode = 'NV001', message = 'Công việc đã thay đổi. Hãy đóng và mở lại công việc.';
    end if;

    update public.work_tasks set
      title = case when payload ? 'title' then btrim(payload->>'title') else old_task.title end,
      description = case when payload ? 'description' then payload->>'description' else old_task.description end,
      status = case when payload ? 'status' then payload->>'status' else old_task.status end,
      priority = case when payload ? 'priority' then payload->>'priority' else old_task.priority end,
      due_date = case when payload ? 'due_date' then (payload->>'due_date')::date else old_task.due_date end,
      due_time = case when payload ? 'due_time' then coalesce(nullif(btrim(payload->>'due_time'), ''), old_task.due_time) else old_task.due_time end,
      assigned_time = case when payload ? 'assigned_time' then coalesce(nullif(btrim(payload->>'assigned_time'), ''), old_task.assigned_time) else old_task.assigned_time end,
      project_id = case when payload ? 'project_id' then (payload->>'project_id')::uuid else old_task.project_id end,
      level = case when payload ? 'level' then (payload->>'level')::smallint else old_task.level end,
      parent_id = case when payload ? 'parent_id' then (payload->>'parent_id')::uuid else old_task.parent_id end,
      updated_at = now(),
      version = old_task.version + 1
    where id = old_task.id
    returning * into saved;
  end if;

  if target_id is null or payload ? 'assignee_ids' then
    if payload ? 'assignee_ids' then
      if jsonb_typeof(payload->'assignee_ids') <> 'array' then
        raise exception 'Danh sách người thực hiện không hợp lệ.';
      end if;
      select coalesce(array_agg(distinct person::uuid order by person::uuid), '{}'::uuid[])
      into selected_users from jsonb_array_elements_text(payload->'assignee_ids') as input(person);
    else
      selected_users := case when saved.team_id is null then array[actor] else '{}'::uuid[] end;
    end if;
    if saved.team_id is null and selected_users is distinct from array[actor] then
      raise exception using errcode = '42501', message = 'Việc riêng chỉ thuộc người tạo.';
    end if;

    delete from public.work_task_assignees where task_id = saved.id;
    insert into public.work_task_assignees (task_id, user_id, team_id)
      select saved.id, person, saved.team_id from unnest(selected_users) as input(person);
  end if;

  select coalesce(jsonb_agg(a.user_id order by a.user_id), '[]'::jsonb)
    into saved_users from public.work_task_assignees a where a.task_id = saved.id;

  return to_jsonb(saved) - 'hierarchy_scope' - 'parent_level'
    || jsonb_build_object('assignee_ids', saved_users);
end;
$fn$;

create or replace function public.work_create_task_with_children(main_task jsonb, child_titles jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
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
    'assigned_time', main_saved->'assigned_time',
    'due_date', main_saved->'due_date',
    'due_time', main_saved->'due_time',
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
    where key in ('title', 'status', 'priority', 'assigned_on', 'assigned_time', 'due_date', 'due_time', 'assignee_ids');
    children := children || jsonb_build_array(public.work_save_task(child_defaults || child_fields));
  end loop;
  return jsonb_build_object('task', main_saved, 'children', children);
end;
$fn$;

notify pgrst, 'reload schema';
commit;
