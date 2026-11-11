begin;

-- Keep historical project records and task metadata. The tree now belongs
-- to its team or to the owner of a private task.
alter table public.work_tasks
  drop constraint work_tasks_parent_fk,
  drop constraint work_tasks_hierarchy_key,
  drop column hierarchy_scope;

alter table public.work_tasks
  add column hierarchy_scope text generated always as (
    case when team_id is null then 'private:' || created_by::text
         else 'team:' || team_id::text end
  ) stored,
  add constraint work_tasks_hierarchy_key unique (id, level, hierarchy_scope),
  add constraint work_tasks_parent_fk foreign key (parent_id, parent_level, hierarchy_scope)
    references public.work_tasks (id, level, hierarchy_scope) on update restrict on delete restrict;

revoke all on public.work_projects from public, anon, authenticated;

-- A stale client may still include project_id in a task RPC. Preserve
-- existing associations and ignore new ones while accepting the task save.
create function nhip_viec_private.retain_legacy_task_project()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.project_id := null;
  else
    new.project_id := old.project_id;
  end if;
  return new;
end;
$$;

create trigger work_task_retain_legacy_project
before insert or update of project_id on public.work_tasks
for each row execute function nhip_viec_private.retain_legacy_task_project();

revoke all on function nhip_viec_private.retain_legacy_task_project() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
