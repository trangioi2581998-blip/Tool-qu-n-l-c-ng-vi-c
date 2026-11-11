begin;

alter table public.work_tasks
  add column level smallint not null default 1,
  add column parent_id uuid,
  add column parent_level smallint generated always as ((level - 1)::smallint) stored,
  add column hierarchy_scope text generated always as (
    case when team_id is null then 'private:' || created_by::text
         else 'team:' || team_id::text || ':' || coalesce(project_id::text, '') end
  ) stored,
  add constraint work_tasks_level_parent_check check (
    (level = 1 and parent_id is null) or (level in (2, 3) and parent_id is not null)
  ),
  add constraint work_tasks_private_project_check check (team_id is not null or project_id is null),
  add constraint work_tasks_hierarchy_key unique (id, level, hierarchy_scope),
  add constraint work_tasks_parent_fk foreign key (parent_id, parent_level, hierarchy_scope)
    references public.work_tasks (id, level, hierarchy_scope) on update restrict on delete restrict;
create index work_tasks_parent_idx on public.work_tasks (parent_id) where parent_id is not null;

create table public.work_task_assignees (
  task_id uuid not null references public.work_tasks on delete cascade,
  user_id uuid not null references auth.users,
  team_id uuid,
  primary key (task_id, user_id),
  constraint work_task_assignees_team_fk foreign key (team_id, user_id)
    references public.work_members (team_id, user_id)
);
create index work_task_assignees_user_idx on public.work_task_assignees (user_id, task_id);

insert into public.work_task_assignees (task_id, user_id, team_id)
select id, assignee_id, team_id from public.work_tasks where assignee_id is not null;

drop policy work_tasks_create on public.work_tasks;
drop policy work_tasks_edit on public.work_tasks;
drop policy work_tasks_delete on public.work_tasks;
drop trigger work_tasks_update on public.work_tasks;
drop function nhip_viec_private.bump_task_version();
revoke insert (team_id, project_id, title, description, status, priority, due_date, assignee_id),
  update (project_id, title, description, status, priority, due_date, assignee_id)
  on public.work_tasks from authenticated;
revoke insert, update on public.work_tasks from public, anon, authenticated;
alter table public.work_tasks drop column assignee_id;

create policy work_tasks_delete on public.work_tasks for delete to authenticated
  using (
    (team_id is null and created_by = (select auth.uid()))
    or nhip_viec_private.is_member(team_id, true)
  );

alter table public.work_task_assignees enable row level security;
revoke all on public.work_task_assignees from public, anon, authenticated;
grant select on public.work_task_assignees to authenticated;
create policy work_task_assignees_read on public.work_task_assignees for select to authenticated
  using (exists (select 1 from public.work_tasks t where t.id = task_id));

create function public.work_save_task(
  payload jsonb,
  target_id uuid default null,
  expected_version integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
      team_id, project_id, title, description, status, priority, due_date, created_by, level, parent_id
    ) values (
      selected_team, (payload->>'project_id')::uuid, btrim(payload->>'title'),
      coalesce(payload->>'description', ''), coalesce(payload->>'status', 'todo'),
      coalesce(payload->>'priority', 'medium'), (payload->>'due_date')::date, actor,
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
$$;

revoke all on function public.work_save_task(jsonb, uuid, integer) from public, anon, authenticated;
grant execute on function public.work_save_task(jsonb, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
