begin;

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
    if draft ? 'description' and jsonb_typeof(draft->'description') not in ('string', 'null') then
      raise exception 'Mô tả việc con phải là văn bản.';
    end if;
    select jsonb_object_agg(key, value) into child_fields
    from jsonb_each(draft)
    where key in ('title', 'description', 'status', 'priority', 'assigned_on', 'due_date', 'assignee_ids');
    children := children || jsonb_build_array(public.work_save_task(child_defaults || child_fields));
  end loop;
  return jsonb_build_object('task', main_saved, 'children', children);
end;
$$;

notify pgrst, 'reload schema';
commit;
