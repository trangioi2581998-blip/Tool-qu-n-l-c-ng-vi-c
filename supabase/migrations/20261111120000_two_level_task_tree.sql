begin;

alter table public.work_tasks drop constraint work_tasks_level_parent_check;

-- Keep task IDs and task data. Append former L3 tasks to their L1 tree as L2 siblings.
do $$
declare
  child record;
begin
  for child in
    select t.id, p.parent_id as root_id
    from public.work_tasks t
    join public.work_tasks p on p.id = t.parent_id
    where t.level = 3
    order by p.parent_id, p.sibling_no, t.created_at, t.id
  loop
    update public.work_tasks
    set level = 2, parent_id = child.root_id, version = version + 1, updated_at = now()
    where id = child.id;
  end loop;
end;
$$;

alter table public.work_tasks add constraint work_tasks_level_parent_check check (
  (level = 1 and parent_id is null) or (level = 2 and parent_id is not null)
);

notify pgrst, 'reload schema';
commit;
