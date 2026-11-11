begin;

alter table public.work_tasks add column sibling_no integer;

with numbered as (
  select id, row_number() over (partition by parent_id order by created_at, id)::integer as ordinal
  from public.work_tasks where level = 2
)
update public.work_tasks t set sibling_no = numbered.ordinal
from numbered where t.id = numbered.id;

alter table public.work_tasks add constraint work_tasks_sibling_no_check check (
  (level = 2 and sibling_no is not null and sibling_no > 0)
  or (level <> 2 and sibling_no is null)
);
create unique index work_tasks_child_no_idx on public.work_tasks (parent_id, sibling_no) where level = 2;

create table nhip_viec_private.task_child_sequences (
  parent_id uuid primary key references public.work_tasks on delete cascade,
  last_number integer not null check (last_number > 0)
);
insert into nhip_viec_private.task_child_sequences (parent_id, last_number)
select parent_id, max(sibling_no) from public.work_tasks where level = 2 group by parent_id;
alter table nhip_viec_private.task_child_sequences enable row level security;

create function nhip_viec_private.number_task_child()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.level <> 2 or new.parent_id is null then
    new.sibling_no := null;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.level = 2 and old.parent_id = new.parent_id then
      new.sibling_no := old.sibling_no;
      return new;
    end if;
  end if;

  insert into nhip_viec_private.task_child_sequences as seq (parent_id, last_number)
  values (new.parent_id, 1)
  on conflict (parent_id) do update set last_number = seq.last_number + 1
  returning last_number into new.sibling_no;
  return new;
end;
$$;

create trigger work_task_number_child before insert or update of level, parent_id on public.work_tasks
for each row execute function nhip_viec_private.number_task_child();
revoke all on function nhip_viec_private.number_task_child() from public, anon, authenticated;

create function public.work_create_task_with_children(main_task jsonb, child_titles jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  main_saved jsonb;
  child_title jsonb;
  child_defaults jsonb;
  children jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;
  if jsonb_typeof(main_task) is distinct from 'object' or jsonb_typeof(child_titles) is distinct from 'array' then
    raise exception 'Thông tin công việc không hợp lệ.';
  end if;
  for child_title in select value from jsonb_array_elements(child_titles) loop
    if jsonb_typeof(child_title) <> 'string' or char_length(btrim(child_title #>> '{}')) not between 1 and 160 then
      raise exception 'Mỗi việc con cần có tên từ 1 đến 160 ký tự.';
    end if;
  end loop;

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
  for child_title in select value from jsonb_array_elements(child_titles) loop
    children := children || jsonb_build_array(
      public.work_save_task(child_defaults || jsonb_build_object('title', child_title))
    );
  end loop;
  return jsonb_build_object('task', main_saved, 'children', children);
end;
$$;

revoke all on function public.work_create_task_with_children(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.work_create_task_with_children(jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
