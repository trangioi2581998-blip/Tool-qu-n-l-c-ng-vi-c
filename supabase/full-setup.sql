-- ==========================================
-- Migration: 20261111090000_nhip_viec.sql
-- ==========================================
begin;

create schema nhip_viec_private;
revoke all on schema nhip_viec_private from public;
grant usage on schema nhip_viec_private to authenticated;

create table public.work_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.work_members (
  team_id uuid not null references public.work_teams on delete cascade,
  user_id uuid not null references auth.users,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role text not null check (role in ('owner', 'member')),
  primary key (team_id, user_id)
);
create index work_members_user_idx on public.work_members (user_id, team_id);
create table public.work_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.work_teams on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default 'purple' check (color in ('purple', 'blue', 'green', 'amber', 'pink')),
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now(),
  unique (team_id, id)
);
create table public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.work_teams on delete cascade,
  project_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  assignee_id uuid references auth.users,
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  foreign key (team_id, project_id) references public.work_projects (team_id, id),
  foreign key (team_id, assignee_id) references public.work_members (team_id, user_id),
  check (team_id is not null or (project_id is null and assignee_id is not null and assignee_id = created_by))
);
create index work_tasks_team_idx on public.work_tasks (team_id, id);
create index work_tasks_private_idx on public.work_tasks (created_by, id) where team_id is null;
create table public.work_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks on delete cascade,
  author_id uuid not null default auth.uid() references auth.users,
  author_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index work_comments_task_idx on public.work_comments (task_id, created_at, id);
create table nhip_viec_private.invites (
  token uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.work_teams on delete cascade,
  email text not null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users,
  accepted_at timestamptz
);
alter table nhip_viec_private.invites enable row level security;

create function nhip_viec_private.is_member(target_team uuid, owner_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_members
    where team_id = target_team and user_id = (select auth.uid())
      and (not owner_only or role = 'owner')
  );
$$;
revoke all on function nhip_viec_private.is_member(uuid, boolean) from public, anon, authenticated;
grant execute on function nhip_viec_private.is_member(uuid, boolean) to authenticated;

create function nhip_viec_private.bump_task_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.assignee_id is distinct from old.assignee_id or new.project_id is distinct from old.project_id)
    and old.created_by <> auth.uid()
    and not nhip_viec_private.is_member(old.team_id, true) then
    raise exception 'Chá»‰ ngÆ°á»i táº¡o viá»‡c hoáº·c chá»§ nhÃ³m má»›i cÃ³ thá»ƒ giao láº¡i hoáº·c Ä‘á»•i dá»± Ã¡n.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger work_tasks_update before update on public.work_tasks
for each row execute function nhip_viec_private.bump_task_version();

create function nhip_viec_private.set_comment_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select m.display_name into new.author_name
  from public.work_tasks t join public.work_members m on m.team_id = t.team_id
  where t.id = new.task_id and m.user_id = auth.uid();
  if new.author_name is null then raise exception 'CÃ´ng viá»‡c khÃ´ng cho phÃ©p bÃ¬nh luáº­n.'; end if;
  return new;
end;
$$;
create trigger work_comments_insert before insert on public.work_comments
for each row execute function nhip_viec_private.set_comment_author();
revoke all on function nhip_viec_private.bump_task_version(), nhip_viec_private.set_comment_author() from public, anon, authenticated;

alter table public.work_teams enable row level security;
alter table public.work_members enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_tasks enable row level security;
alter table public.work_comments enable row level security;

revoke all on public.work_teams, public.work_members, public.work_projects, public.work_tasks, public.work_comments
  from public, anon, authenticated;
grant select on public.work_teams, public.work_members, public.work_projects, public.work_tasks, public.work_comments to authenticated;
grant insert (team_id, name, color), update (name, color) on public.work_projects to authenticated;
grant insert (team_id, project_id, title, description, status, priority, due_date, assignee_id),
  update (project_id, title, description, status, priority, due_date, assignee_id),
  delete on public.work_tasks to authenticated;
grant insert (task_id, body) on public.work_comments to authenticated;

create policy work_teams_read on public.work_teams for select to authenticated
  using (nhip_viec_private.is_member(id));
create policy work_members_read on public.work_members for select to authenticated
  using (nhip_viec_private.is_member(team_id));
create policy work_projects_read on public.work_projects for select to authenticated
  using (nhip_viec_private.is_member(team_id));
create policy work_projects_create on public.work_projects for insert to authenticated
  with check (nhip_viec_private.is_member(team_id) and created_by = (select auth.uid()));
create policy work_projects_edit on public.work_projects for update to authenticated
  using (nhip_viec_private.is_member(team_id) and
    (created_by = (select auth.uid()) or nhip_viec_private.is_member(team_id, true)))
  with check (nhip_viec_private.is_member(team_id));

create policy work_tasks_read on public.work_tasks for select to authenticated
  using ((team_id is null and created_by = (select auth.uid())) or nhip_viec_private.is_member(team_id));
create policy work_tasks_create on public.work_tasks for insert to authenticated
  with check (created_by = (select auth.uid()) and (team_id is null or nhip_viec_private.is_member(team_id)));
create policy work_tasks_edit on public.work_tasks for update to authenticated
  using (
    (team_id is null and created_by = (select auth.uid())) or (
      nhip_viec_private.is_member(team_id) and
      (created_by = (select auth.uid()) or assignee_id = (select auth.uid()) or nhip_viec_private.is_member(team_id, true))
    )
  )
  with check ((team_id is null and created_by = (select auth.uid())) or nhip_viec_private.is_member(team_id));
create policy work_tasks_delete on public.work_tasks for delete to authenticated
  using ((team_id is null and created_by = (select auth.uid())) or
    (nhip_viec_private.is_member(team_id) and
      (created_by = (select auth.uid()) or nhip_viec_private.is_member(team_id, true))));
create policy work_comments_read on public.work_comments for select to authenticated
  using (exists (select 1 from public.work_tasks t where t.id = task_id and t.team_id is not null));
create policy work_comments_create on public.work_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and
    exists (select 1 from public.work_tasks t where t.id = task_id and t.team_id is not null));

create function public.work_create_team(team_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_team uuid;
declare name_for_team text := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
  split_part(auth.jwt()->>'email', '@', 1), 'ThÃ nh viÃªn'), 80);
begin
  if auth.uid() is null then raise exception 'Báº¡n cáº§n Ä‘Äƒng nháº­p.'; end if;
  insert into public.work_teams (name) values (btrim(team_name)) returning id into new_team;
  insert into public.work_members (team_id, user_id, display_name, role)
  values (new_team, auth.uid(), name_for_team, 'owner');
  return new_team;
end;
$$;

create function public.work_create_invite(target_team uuid, invite_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_token uuid;
declare normalized_email text := lower(btrim(invite_email));
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception 'Chá»‰ chá»§ nhÃ³m cÃ³ thá»ƒ táº¡o lá»i má»i.';
  end if;
  if normalized_email is null or char_length(normalized_email) > 254 or
    normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Email má»i khÃ´ng há»£p lá»‡.';
  end if;
  insert into nhip_viec_private.invites (team_id, email)
  values (target_team, normalized_email) returning token into new_token;
  return new_token;
end;
$$;

create function public.work_accept_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite nhip_viec_private.invites%rowtype;
declare account_id uuid := auth.uid();
declare confirmed_email text;
declare name_for_team text;
begin
  select lower(email) into confirmed_email
  from auth.users where id = account_id and email_confirmed_at is not null;
  if confirmed_email is null then raise exception 'HÃ£y Ä‘Äƒng nháº­p báº±ng email Ä‘Ã£ xÃ¡c nháº­n.'; end if;
  select * into invite from nhip_viec_private.invites where token = invite_token for update;
  if not found or invite.email <> confirmed_email then
    raise exception 'Lá»i má»i khÃ´ng há»£p lá»‡ vá»›i tÃ i khoáº£n nÃ y.';
  end if;
  if invite.accepted_by = account_id then return invite.team_id; end if;
  if invite.expires_at <= now() or invite.accepted_by is not null then
    raise exception 'Lá»i má»i Ä‘Ã£ háº¿t háº¡n hoáº·c Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.';
  end if;
  name_for_team := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
    split_part(confirmed_email, '@', 1)), 80);
  insert into public.work_members (team_id, user_id, display_name, role)
  values (invite.team_id, account_id, name_for_team, 'member') on conflict (team_id, user_id) do nothing;
  update nhip_viec_private.invites set accepted_by = account_id, accepted_at = now() where token = invite_token;
  return invite.team_id;
end;
$$;

revoke all on function public.work_create_team(text), public.work_create_invite(uuid, text),
  public.work_accept_invite(uuid) from public, anon, authenticated;
grant execute on function public.work_create_team(text), public.work_create_invite(uuid, text),
  public.work_accept_invite(uuid) to authenticated;

commit;


-- ==========================================
-- Migration: 20261111103000_task_hierarchy_and_assignment.sql
-- ==========================================
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
    raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'ThÃ´ng tin cÃ´ng viá»‡c khÃ´ng há»£p lá»‡.';
  end if;

  if target_id is null then
    selected_team := (payload->>'team_id')::uuid;
    if selected_team is not null and not nhip_viec_private.is_member(selected_team, true) then
      raise exception using errcode = '42501', message = 'Chá»‰ quáº£n lÃ½ Ä‘Æ°á»£c táº¡o vÃ  giao cÃ´ng viá»‡c nhÃ³m.';
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
      raise exception using errcode = 'NV001', message = 'CÃ´ng viá»‡c khÃ´ng cÃ²n kháº£ dá»¥ng.';
    end if;

    if old_task.team_id is not null and not nhip_viec_private.is_member(old_task.team_id, true) then
      if payload ?| array['team_id', 'project_id', 'assignee_ids', 'level', 'parent_id']
        or not exists (
          select 1 from public.work_task_assignees a where a.task_id = old_task.id and a.user_id = actor
        ) then
        raise exception using errcode = '42501', message = 'Quáº£n lÃ½ phÃ¢n cÃ´ng, nhÃ¢n viÃªn cáº­p nháº­t viá»‡c Ä‘Æ°á»£c giao.';
      end if;
    end if;
    if old_task.version is distinct from expected_version then
      raise exception using errcode = 'NV001', message = 'CÃ´ng viá»‡c Ä‘Ã£ thay Ä‘á»•i. HÃ£y Ä‘Ã³ng vÃ  má»Ÿ láº¡i cÃ´ng viá»‡c.';
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
        raise exception 'Danh sÃ¡ch ngÆ°á»i thá»±c hiá»‡n khÃ´ng há»£p lá»‡.';
      end if;
      select coalesce(array_agg(distinct person::uuid order by person::uuid), '{}'::uuid[])
      into selected_users from jsonb_array_elements_text(payload->'assignee_ids') as input(person);
    else
      selected_users := case when saved.team_id is null then array[actor] else '{}'::uuid[] end;
    end if;
    if saved.team_id is null and selected_users is distinct from array[actor] then
      raise exception using errcode = '42501', message = 'Viá»‡c riÃªng chá»‰ thuá»™c ngÆ°á»i táº¡o.';
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


-- ==========================================
-- Migration: 20261111110000_deadlines_and_notifications.sql
-- ==========================================
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
    'CÃ´ng viá»‡c: ' || task.title || E'\n' || detail ||
    E'\nTráº¡ng thÃ¡i hiá»‡n táº¡i: ' || (case task.status when 'todo' then 'Cáº§n lÃ m' when 'doing' then 'Äang lÃ m'
      when 'review' then 'Chá» duyá»‡t' else 'HoÃ n thÃ nh' end) ||
    E'\nNgÃ y giao: ' || coalesce(to_char(task.assigned_on, 'DD/MM/YYYY'), 'ChÆ°a Ä‘áº·t') ||
    E'\nHáº¡n hoÃ n thÃ nh: ' || coalesce(to_char(task.due_date, 'DD/MM/YYYY'), 'ChÆ°a Ä‘áº·t'),
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
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.'; end if;
  if target_id is not null then
    select * into previous from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = auth.uid()) or nhip_viec_private.is_member(t.team_id)
    ) for update;
    if not found then raise exception using errcode = 'NV001', message = 'CÃ´ng viá»‡c khÃ´ng cÃ²n kháº£ dá»¥ng.'; end if;
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
      raise exception using errcode = '42501', message = 'TrÆ°á»Ÿng nhÃ³m thiáº¿t láº­p ngÃ y giao vÃ  háº¡n hoÃ n thÃ nh.';
    end if;
    if dates_changed and exists (
      select 1 from public.work_deadline_requests where task_id = target_id and status = 'pending'
    ) then
      raise exception 'HÃ£y xá»­ lÃ½ yÃªu cáº§u gia háº¡n Ä‘ang chá» trÆ°á»›c khi sá»­a ngÃ y giao hoáº·c háº¡n hoÃ n thÃ nh.';
    end if;
    if (target_id is null or dates_changed) and (date_assigned is null or date_due is null or date_due < date_assigned) then
      raise exception 'NgÃ y giao vÃ  háº¡n hoÃ n thÃ nh lÃ  báº¯t buá»™c. Háº¡n hoÃ n thÃ nh pháº£i tá»« ngÃ y giao trá»Ÿ Ä‘i.';
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
    raise exception 'HÃ£y Ä‘áº·t háº¡n hoÃ n thÃ nh trÆ°á»›c khi giao viá»‡c.';
  end if;
  event_id := saved.id::text || ':' || saved.version::text || ':';

  if target_id is null then
    perform nhip_viec_private.task_email(saved, event_id || 'new', '[Nhá»‹p viá»‡c] CÃ´ng viá»‡c má»›i', 'TrÆ°á»Ÿng nhÃ³m Ä‘Ã£ táº¡o cÃ´ng viá»‡c.');
    return response;
  end if;
  if saved.status is distinct from previous.status then
    perform nhip_viec_private.task_email(saved, event_id || 'status', '[Nhá»‹p viá»‡c] Tráº¡ng thÃ¡i Ä‘Ã£ thay Ä‘á»•i',
      'Tráº¡ng thÃ¡i cÃ´ng viá»‡c Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t.', prior_people);
  end if;
  if new_people is distinct from prior_people then
    perform nhip_viec_private.task_email(saved, event_id || 'assigned', '[Nhá»‹p viá»‡c] PhÃ¢n cÃ´ng Ä‘Ã£ thay Ä‘á»•i',
      'Danh sÃ¡ch ngÆ°á»i thá»±c hiá»‡n Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t.', prior_people);
  end if;
  if dates_changed then
    perform nhip_viec_private.task_email(saved, event_id || 'dates', '[Nhá»‹p viá»‡c] NgÃ y giao hoáº·c háº¡n Ä‘Ã£ thay Ä‘á»•i',
      'Xem ngÃ y giao vÃ  háº¡n hoÃ n thÃ nh má»›i bÃªn dÆ°á»›i.', prior_people);
  end if;
  if (saved.title, saved.description, saved.priority, saved.project_id, saved.level, saved.parent_id)
     is distinct from (previous.title, previous.description, previous.priority, previous.project_id, previous.level, previous.parent_id) then
    perform nhip_viec_private.task_email(saved, event_id || 'details', '[Nhá»‹p viá»‡c] Chi tiáº¿t cÃ´ng viá»‡c Ä‘Ã£ thay Ä‘á»•i',
      'CÃ´ng viá»‡c cÃ³ ná»™i dung hoáº·c thÃ´ng tin tá»• chá»©c má»›i.', prior_people);
  end if;
  if saved.status = 'done' and previous.status <> 'done' then
    update public.work_deadline_requests set status = 'cancelled', reviewed_at = now(),
      decision_note = 'CÃ´ng viá»‡c Ä‘Ã£ hoÃ n thÃ nh.'
    where task_id = saved.id and status = 'pending' returning id into cancelled_id;
    if cancelled_id is not null then
      perform nhip_viec_private.task_email(saved, cancelled_id::text || ':cancelled',
        '[Nhá»‹p viá»‡c] ÄÃ£ Ä‘Ã³ng yÃªu cáº§u gia háº¡n', 'CÃ´ng viá»‡c Ä‘Ã£ hoÃ n thÃ nh.', prior_people);
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
  ) then raise exception using errcode = '42501', message = 'Chá»‰ nhÃ¢n viÃªn Ä‘Æ°á»£c giao viá»‡c má»›i cÃ³ thá»ƒ xin gia háº¡n.'; end if;
  if task.due_date is null or task.due_date >= nhip_viec_private.vn_today() or task.status = 'done' then
    raise exception 'Chá»‰ cÃ´ng viá»‡c quÃ¡ háº¡n vÃ  chÆ°a hoÃ n thÃ nh má»›i cÃ³ thá»ƒ xin gia háº¡n.';
  end if;
  if new_due_date is null or new_due_date < nhip_viec_private.vn_today() then
    raise exception 'Háº¡n Ä‘á» xuáº¥t pháº£i tá»« hÃ´m nay trá»Ÿ Ä‘i.';
  end if;
  if exists (select 1 from public.work_deadline_requests where task_id = target_task and status = 'pending') then
    raise exception 'CÃ´ng viá»‡c Ä‘Ã£ cÃ³ má»™t yÃªu cáº§u gia háº¡n Ä‘ang chá» duyá»‡t.';
  end if;
  insert into public.work_deadline_requests (task_id, requested_by, previous_due_date, requested_due_date, reason)
  values (target_task, auth.uid(), task.due_date, new_due_date, btrim(request_reason))
  returning * into request;
  perform nhip_viec_private.task_email(task, request.id::text || ':requested',
    '[Nhá»‹p viá»‡c] YÃªu cáº§u gia háº¡n Ä‘ang chá» duyá»‡t',
    'Háº¡n Ä‘á» xuáº¥t: ' || to_char(new_due_date, 'DD/MM/YYYY') || E'\nTrÆ°á»Ÿng nhÃ³m cÃ³ thá»ƒ má»Ÿ cÃ´ng viá»‡c Ä‘á»ƒ xem lÃ½ do vÃ  pháº£n há»“i.');
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
  if not found then raise exception using errcode = '42501', message = 'Chá»‰ trÆ°á»Ÿng nhÃ³m Ä‘Æ°á»£c duyá»‡t gia háº¡n.'; end if;
  select * into request from public.work_deadline_requests where id = request_id;
  if request.status <> 'pending' then raise exception 'YÃªu cáº§u nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½.'; end if;
  if approve is null then raise exception 'HÃ£y chá»n duyá»‡t hoáº·c tá»« chá»‘i.'; end if;
  if approve and (request.requested_due_date < nhip_viec_private.vn_today() or task.status = 'done'
    or task.due_date is distinct from request.previous_due_date) then
    raise exception 'Háº¡n Ä‘á» xuáº¥t hoáº·c tráº¡ng thÃ¡i cÃ´ng viá»‡c Ä‘Ã£ thay Ä‘á»•i. HÃ£y tá»« chá»‘i vÃ  yÃªu cáº§u gá»­i láº¡i.';
  end if;
  if not approve and coalesce(char_length(btrim(note)), 0) = 0 then raise exception 'HÃ£y nháº­p lÃ½ do tá»« chá»‘i.'; end if;
  if approve then
    update public.work_tasks set due_date = request.requested_due_date, updated_at = now(), version = version + 1
    where id = task.id returning * into task;
  end if;
  update public.work_deadline_requests set status = case when approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), decision_note = nullif(btrim(note), '')
  where id = request_id returning * into request;

  perform nhip_viec_private.task_email(task, request.id::text || ':' || request.status,
    case when approve then '[Nhá»‹p viá»‡c] Gia háº¡n Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t' else '[Nhá»‹p viá»‡c] Gia háº¡n bá»‹ tá»« chá»‘i' end,
    case when approve then 'Háº¡n má»›i Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t.' else 'Háº¡n hiá»‡n táº¡i váº«n Ã¡p dá»¥ng.' end, array[request.requested_by]);
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
      '[Nhá»‹p viá»‡c] CÃ³ bÃ¬nh luáº­n má»›i', 'Má»Ÿ cÃ´ng viá»‡c Ä‘á»ƒ xem bÃ¬nh luáº­n cá»§a ' || new.author_name || '.');
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
    perform nhip_viec_private.task_email(old, old.id::text || ':deleted', '[Nhá»‹p viá»‡c] CÃ´ng viá»‡c Ä‘Ã£ Ä‘Æ°á»£c xÃ³a',
      'TrÆ°á»Ÿng nhÃ³m Ä‘Ã£ xÃ³a cÃ´ng viá»‡c.');
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
      '[Nhá»‹p viá»‡c] CÃ´ng viá»‡c Ä‘Ã£ quÃ¡ háº¡n', 'HÃ£y cáº­p nháº­t tiáº¿n Ä‘á»™ hoáº·c má»Ÿ cÃ´ng viá»‡c Ä‘á»ƒ xin gia háº¡n.');
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
  if not found then raise exception using errcode = '42501', message = 'Chá»‰ trÆ°á»Ÿng nhÃ³m cÃ³ thá»ƒ táº¡o tÃ i khoáº£n thÃ nh viÃªn.'; end if;

  select u.id into account_id from auth.users u where lower(u.email) = lower(btrim(member_email)) and u.is_sso_user is not true;
  if account_id is null then return null; end if;
  insert into public.work_members (team_id, user_id, display_name, role)
  values (target_team, account_id, btrim(member_name), 'member')
  on conflict (team_id, user_id) do nothing returning * into added;
  if not found then
    select * into added from public.work_members where team_id = target_team and user_id = account_id;
  elsif not invited_now then
    insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
    values ('member:' || target_team::text || ':' || account_id::text, account_id, '[Nhá»‹p viá»‡c] Báº¡n Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o nhÃ³m',
      'Báº¡n Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o nhÃ³m ' || team_name || '. ÄÄƒng nháº­p Ä‘á»ƒ má»Ÿ nhÃ³m.', target_team)
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


-- ==========================================
-- Migration: 20261111113000_create_parent_with_children.sql
-- ==========================================
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
    raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.';
  end if;
  if jsonb_typeof(main_task) is distinct from 'object' or jsonb_typeof(child_titles) is distinct from 'array' then
    raise exception 'ThÃ´ng tin cÃ´ng viá»‡c khÃ´ng há»£p lá»‡.';
  end if;
  for child_title in select value from jsonb_array_elements(child_titles) loop
    if jsonb_typeof(child_title) <> 'string' or char_length(btrim(child_title #>> '{}')) not between 1 and 160 then
      raise exception 'Má»—i viá»‡c con cáº§n cÃ³ tÃªn tá»« 1 Ä‘áº¿n 160 kÃ½ tá»±.';
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


-- ==========================================
-- Migration: 20261111120000_two_level_task_tree.sql
-- ==========================================
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


-- ==========================================
-- Migration: 20261111123000_task_fields_and_completion.sql
-- ==========================================
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
      raise exception 'HÃ£y má»Ÿ láº¡i viá»‡c chÃ­nh trÆ°á»›c khi thÃªm hoáº·c má»Ÿ láº¡i viá»‡c con chÆ°a hoÃ n thÃ nh.';
    end if;
  elsif new.level = 1 and new.status = 'done' and exists (
    select 1 from public.work_tasks where parent_id = new.id and status <> 'done'
  ) then
    raise exception 'Cáº§n hoÃ n thÃ nh táº¥t cáº£ viá»‡c con trÆ°á»›c khi hoÃ n thÃ nh viá»‡c chÃ­nh.';
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
    raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.';
  end if;
  if target_id is not null then
    select * into previous from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = auth.uid()) or nhip_viec_private.is_member(t.team_id)
    ) for update;
    if not found then
      raise exception using errcode = 'NV001', message = 'CÃ´ng viá»‡c khÃ´ng cÃ²n kháº£ dá»¥ng.';
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
      raise exception 'NgÃ y giao vÃ  háº¡n hoÃ n thÃ nh lÃ  báº¯t buá»™c. Háº¡n hoÃ n thÃ nh pháº£i tá»« ngÃ y giao trá»Ÿ Ä‘i.';
    end if;
  end if;

  result := public.work_save_task_v3(payload, target_id, expected_version);
  if selected_team is not null then
    if jsonb_array_length(result->'assignee_ids') = 0 and (
      target_id is null or previously_assigned
      or (result->>'assigned_on')::date is distinct from previous.assigned_on
      or (result->>'due_date')::date is distinct from previous.due_date
    ) then
      raise exception 'HÃ£y chá»n Ã­t nháº¥t má»™t ngÆ°á»i thá»±c hiá»‡n.';
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
    raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.';
  end if;
  if jsonb_typeof(main_task) is distinct from 'object' or jsonb_typeof(child_titles) is distinct from 'array' then
    raise exception 'ThÃ´ng tin cÃ´ng viá»‡c khÃ´ng há»£p lá»‡.';
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
      raise exception 'Má»—i viá»‡c con cáº§n cÃ³ tÃªn tá»« 1 Ä‘áº¿n 160 kÃ½ tá»±.';
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


-- ==========================================
-- Migration: 20261111124500_optional_child_descriptions.sql
-- ==========================================
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
    raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.';
  end if;
  if jsonb_typeof(main_task) is distinct from 'object' or jsonb_typeof(child_titles) is distinct from 'array' then
    raise exception 'ThÃ´ng tin cÃ´ng viá»‡c khÃ´ng há»£p lá»‡.';
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
      raise exception 'Má»—i viá»‡c con cáº§n cÃ³ tÃªn tá»« 1 Ä‘áº¿n 160 kÃ½ tá»±.';
    end if;
    if draft ? 'description' and jsonb_typeof(draft->'description') not in ('string', 'null') then
      raise exception 'MÃ´ táº£ viá»‡c con pháº£i lÃ  vÄƒn báº£n.';
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


-- ==========================================
-- Migration: 20261111130000_remove_project_layer.sql
-- ==========================================
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


-- ==========================================
-- Migration: 20261111140000_task_attachments.sql
-- ==========================================
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('work-task-attachments', 'work-task-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create function nhip_viec_private.can_access_attachment(object_name text, access_mode text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
begin
  if actor is null or length(object_name) > 394 or object_name !~
    '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}_[A-Za-z0-9_-]+$' then
    return false;
  end if;
  target_id := split_part(object_name, '/', 1)::uuid;

  if not exists (
    select 1 from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = actor) or (
        nhip_viec_private.is_member(t.team_id) and (
          access_mode = 'read' or nhip_viec_private.is_member(t.team_id, true) or exists (
            select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = actor
          )
        )
      )
    )
  ) then
    return false;
  end if;

  if access_mode = 'upload' then
    -- Hold the task through object insertion to prevent deletion during upload.
    perform 1 from public.work_tasks where id = target_id for key share;
    return found;
  end if;
  return true;
end;
$$;

revoke all on function nhip_viec_private.can_access_attachment(text, text) from public, anon, authenticated;
grant execute on function nhip_viec_private.can_access_attachment(text, text) to authenticated;

create policy work_task_files_read on storage.objects for select to authenticated
using (bucket_id = 'work-task-attachments' and nhip_viec_private.can_access_attachment(name, 'read'));

create policy work_task_files_add on storage.objects for insert to authenticated
with check (bucket_id = 'work-task-attachments' and nhip_viec_private.can_access_attachment(name, 'upload'));

create policy work_task_files_remove on storage.objects for delete to authenticated
using (bucket_id = 'work-task-attachments' and nhip_viec_private.can_access_attachment(name, 'delete'));

create function nhip_viec_private.guard_task_attachment_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'work-task-attachments' and o.name like old.id::text || '/%'
  ) then
    raise exception 'HÃ£y gá»¡ tÃ i liá»‡u Ä‘Ã­nh kÃ¨m trÆ°á»›c khi xÃ³a cÃ´ng viá»‡c.';
  end if;
  return old;
end;
$$;

create trigger work_task_attachment_delete_guard before delete on public.work_tasks
for each row execute function nhip_viec_private.guard_task_attachment_deletion();
revoke all on function nhip_viec_private.guard_task_attachment_deletion() from public, anon, authenticated;

commit;


-- ==========================================
-- Migration: 20261111153000_task_assigned_by.sql
-- ==========================================
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
    raise exception using errcode = '42501', message = 'Báº¡n cáº§n Ä‘Äƒng nháº­p.';
  end if;
  if target_id is not null then
    select * into previous from public.work_tasks t where t.id = target_id and (
      (t.team_id is null and t.created_by = actor) or nhip_viec_private.is_member(t.team_id)
    ) for update;
    if not found then
      raise exception using errcode = 'NV001', message = 'CÃ´ng viá»‡c khÃ´ng cÃ²n kháº£ dá»¥ng.';
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
      raise exception 'NgÃ y giao vÃ  háº¡n hoÃ n thÃ nh lÃ  báº¯t buá»™c. Háº¡n hoÃ n thÃ nh pháº£i tá»« ngÃ y giao trá»Ÿ Ä‘i.';
    end if;
  end if;

  result := public.work_save_task_v3(payload, target_id, expected_version);
  if selected_team is not null and jsonb_array_length(result->'assignee_ids') = 0 and (
    target_id is null or jsonb_array_length(previous_people) > 0
    or (result->>'assigned_on')::date is distinct from previous.assigned_on
    or (result->>'due_date')::date is distinct from previous.due_date
  ) then
    raise exception 'HÃ£y chá»n Ã­t nháº¥t má»™t ngÆ°á»i thá»±c hiá»‡n.';
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


-- ==========================================
-- Migration: 20261112195000_members_and_reports.sql
-- ==========================================
begin;

-- 1. Add email & department to work_members
alter table public.work_members
  add column if not exists email text,
  add column if not exists department text not null default '';

update public.work_members m
set email = lower(u.email)
from auth.users u
where m.user_id = u.id and m.email is null;

-- 2. Add status transition tracking columns to work_tasks for weekly reports
alter table public.work_tasks
  add column if not exists previous_status text check (previous_status in ('todo', 'doing', 'review', 'done')),
  add column if not exists status_updated_at timestamptz;

create or replace function nhip_viec_private.track_task_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.previous_status := old.status;
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists work_task_status_tracker on public.work_tasks;
create trigger work_task_status_tracker
before update of status on public.work_tasks
for each row execute function nhip_viec_private.track_task_status_change();

revoke all on function nhip_viec_private.track_task_status_change() from public, anon, authenticated;

-- 3. Track deleted tasks for weekly reports
create table if not exists public.work_deleted_tasks (
  id uuid primary key,
  team_id uuid references public.work_teams on delete cascade,
  title text not null,
  level smallint not null default 1,
  previous_status text not null default 'todo',
  assignee_ids jsonb not null default '[]'::jsonb,
  assigned_on date,
  created_by uuid references auth.users on delete set null,
  deleted_at timestamptz not null default now()
);

alter table public.work_deleted_tasks enable row level security;
revoke all on public.work_deleted_tasks from public, anon, authenticated;
grant select on public.work_deleted_tasks to authenticated;

drop policy if exists work_deleted_tasks_read on public.work_deleted_tasks;
create policy work_deleted_tasks_read on public.work_deleted_tasks for select to authenticated
  using ((team_id is null and created_by = (select auth.uid())) or nhip_viec_private.is_member(team_id));

create or replace function nhip_viec_private.record_deleted_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  people jsonb;
begin
  select coalesce(jsonb_agg(user_id order by user_id), '[]'::jsonb)
  into people
  from public.work_task_assignees
  where task_id = old.id;

  insert into public.work_deleted_tasks (
    id, team_id, title, level, previous_status, assignee_ids, assigned_on, created_by, deleted_at
  ) values (
    old.id, old.team_id, old.title, old.level, old.status, coalesce(people, '[]'::jsonb), old.assigned_on, old.created_by, now()
  )
  on conflict (id) do update set
    previous_status = excluded.previous_status,
    deleted_at = excluded.deleted_at;

  return old;
end;
$$;

drop trigger if exists work_task_record_deleted on public.work_tasks;
create trigger work_task_record_deleted
before delete on public.work_tasks
for each row execute function nhip_viec_private.record_deleted_task();

revoke all on function nhip_viec_private.record_deleted_task() from public, anon, authenticated;

-- 4. Update team creation & invite acceptance to populate email & department
create or replace function public.work_create_team(team_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_team uuid;
declare user_email text := lower(coalesce(auth.jwt()->>'email', ''));
declare name_for_team text := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
  split_part(auth.jwt()->>'email', '@', 1), 'ThÃ nh viÃªn'), 80);
begin
  if auth.uid() is null then raise exception 'Báº¡n cáº§n Ä‘Äƒng nháº­p.'; end if;
  insert into public.work_teams (name) values (btrim(team_name)) returning id into new_team;
  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (new_team, auth.uid(), name_for_team, user_email, btrim(team_name), 'owner');
  return new_team;
end;
$$;

create or replace function public.work_accept_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite nhip_viec_private.invites%rowtype;
declare account_id uuid := auth.uid();
declare confirmed_email text;
declare name_for_team text;
begin
  select lower(email) into confirmed_email
  from auth.users where id = account_id and email_confirmed_at is not null;
  if confirmed_email is null then raise exception 'HÃ£y Ä‘Äƒng nháº­p báº±ng email Ä‘Ã£ xÃ¡c nháº­n.'; end if;
  select * into invite from nhip_viec_private.invites where token = invite_token for update;
  if not found or invite.email <> confirmed_email then
    raise exception 'Lá»i má»i khÃ´ng há»£p lá»‡ vá»›i tÃ i khoáº£n nÃ y.';
  end if;
  if invite.accepted_by = account_id then return invite.team_id; end if;
  if invite.expires_at <= now() or invite.accepted_by is not null then
    raise exception 'Lá»i má»i Ä‘Ã£ háº¿t háº¡n hoáº·c Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.';
  end if;
  name_for_team := left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'), ''),
    split_part(confirmed_email, '@', 1)), 80);
  insert into public.work_members (team_id, user_id, display_name, email, role)
  values (invite.team_id, account_id, name_for_team, confirmed_email, 'member')
  on conflict (team_id, user_id) do update set email = excluded.email;
  update nhip_viec_private.invites set accepted_by = account_id, accepted_at = now() where token = invite_token;
  return invite.team_id;
end;
$$;

-- 5. Update work_link_member and add work_update_member & work_remove_member RPCs
create or replace function public.work_link_member(
  target_team uuid,
  manager_id uuid,
  member_email text,
  member_name text,
  invited_now boolean default false,
  member_department text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid;
  added public.work_members;
  team_name text;
  clean_email text := lower(btrim(member_email));
  clean_dept text := coalesce(btrim(member_department), '');
begin
  select t.name into team_name from public.work_teams t join public.work_members m on m.team_id = t.id
  where t.id = target_team and m.user_id = manager_id and m.role = 'owner';
  if not found then raise exception using errcode = '42501', message = 'Chá»‰ trÆ°á»Ÿng nhÃ³m cÃ³ thá»ƒ táº¡o tÃ i khoáº£n thÃ nh viÃªn.'; end if;

  select u.id into account_id from auth.users u where lower(u.email) = clean_email and u.is_sso_user is not true;
  if account_id is null then return null; end if;
  insert into public.work_members (team_id, user_id, display_name, email, department, role)
  values (target_team, account_id, btrim(member_name), clean_email, clean_dept, 'member')
  on conflict (team_id, user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    department = case when excluded.department <> '' then excluded.department else public.work_members.department end
  returning * into added;

  if not invited_now then
    insert into nhip_viec_private.email_outbox (event_key, recipient_id, subject, body, team_id)
    values ('member:' || target_team::text || ':' || account_id::text, account_id, '[Nhá»‹p viá»‡c] Báº¡n Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o nhÃ³m',
      'Báº¡n Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o nhÃ³m ' || team_name || '. ÄÄƒng nháº­p Ä‘á»ƒ má»Ÿ nhÃ³m.', target_team)
    on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
  end if;
  return jsonb_build_object(
    'user_id', added.user_id,
    'display_name', added.display_name,
    'email', added.email,
    'department', added.department,
    'role', added.role
  );
end;
$$;

create or replace function public.work_update_member(
  target_team uuid,
  target_user uuid,
  member_name text,
  member_email text,
  member_department text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  updated public.work_members;
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chá»‰ trÆ°á»Ÿng nhÃ³m cÃ³ thá»ƒ chá»‰nh sá»­a thÃ nh viÃªn.';
  end if;
  update public.work_members
  set
    display_name = btrim(member_name),
    email = lower(btrim(member_email)),
    department = coalesce(btrim(member_department), '')
  where team_id = target_team and user_id = target_user
  returning * into updated;

  if not found then
    raise exception 'KhÃ´ng tÃ¬m tháº¥y thÃ nh viÃªn trong nhÃ³m.';
  end if;

  return jsonb_build_object(
    'user_id', updated.user_id,
    'display_name', updated.display_name,
    'email', updated.email,
    'department', updated.department,
    'role', updated.role
  );
end;
$$;

create or replace function public.work_remove_member(
  target_team uuid,
  target_user uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_role text;
begin
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception using errcode = '42501', message = 'Chá»‰ trÆ°á»Ÿng nhÃ³m cÃ³ thá»ƒ xÃ³a thÃ nh viÃªn.';
  end if;
  select role into target_role from public.work_members where team_id = target_team and user_id = target_user;
  if not found then
    raise exception 'KhÃ´ng tÃ¬m tháº¥y thÃ nh viÃªn trong nhÃ³m.';
  end if;
  if target_role = 'owner' then
    raise exception 'KhÃ´ng thá»ƒ xÃ³a trÆ°á»Ÿng nhÃ³m khá»i nhÃ³m.';
  end if;

  delete from public.work_task_assignees
  where team_id = target_team and user_id = target_user;

  delete from public.work_members
  where team_id = target_team and user_id = target_user;
end;
$$;

revoke all on function public.work_update_member(uuid, uuid, text, text, text),
  public.work_remove_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.work_update_member(uuid, uuid, text, text, text),
  public.work_remove_member(uuid, uuid) to authenticated;

revoke all on function public.work_link_member(uuid, uuid, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.work_link_member(uuid, uuid, text, text, boolean, text) to service_role;

notify pgrst, 'reload schema';
commit;

-- ==========================================
-- Migration: 20261113220000_team_rename_delete.sql
-- ==========================================
begin;

create or replace function public.work_rename_team(target_team uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as \$\$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception 'Chỉ trưởng nhóm mới có quyền đổi tên nhóm.';
  end if;
  if coalesce(btrim(new_name), '') = '' then
    raise exception 'Tên nhóm không được để trống.';
  end if;
  if char_length(btrim(new_name)) > 80 then
    raise exception 'Tên nhóm không được quá 80 ký tự.';
  end if;
  update public.work_teams
  set name = btrim(new_name)
  where id = target_team;
end;
\$\$;

create or replace function public.work_delete_team(target_team uuid)
returns void language plpgsql security definer set search_path = '' as \$\$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.';
  end if;
  if not nhip_viec_private.is_member(target_team, true) then
    raise exception 'Chỉ trưởng nhóm mới có quyền xóa nhóm.';
  end if;
  delete from public.work_teams
  where id = target_team;
end;
\$\$;

revoke all on function public.work_rename_team(uuid, text) from public, anon;
grant execute on function public.work_rename_team(uuid, text) to authenticated;

revoke all on function public.work_delete_team(uuid) from public, anon;
grant execute on function public.work_delete_team(uuid) to authenticated;

grant update (name), delete on public.work_teams to authenticated;

drop policy if exists work_teams_update on public.work_teams;
create policy work_teams_update on public.work_teams
  for update to authenticated
  using (nhip_viec_private.is_member(id, true))
  with check (nhip_viec_private.is_member(id, true));

drop policy if exists work_teams_delete on public.work_teams;
create policy work_teams_delete on public.work_teams
  for delete to authenticated
  using (nhip_viec_private.is_member(id, true));

notify pgrst, 'reload schema';
commit;

