-- Add recurrence columns to public.work_tasks if not exists
alter table public.work_tasks
  add column if not exists recurrence_type text default 'none',
  add column if not exists recurrence_interval integer default 1,
  add column if not exists recurrence_count integer default 1;

-- Automated 2x/day reminder for tasks nearing deadline (starting 2 days before deadline until due date)
-- Runs every day at 08:30 and 14:30 (Asia/Bangkok = 01:30 and 07:30 UTC)
create or replace function nhip_viec_private.dispatch_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public, nhip_viec_private, auth, extensions, net
as $$
declare
  v_inserted integer := 0;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_slot text := case when extract(hour from (now() at time zone 'Asia/Bangkok')) < 12 then 'morning' else 'afternoon' end;
  v_rec record;
  cfg nhip_viec_private.email_settings%rowtype;
begin
  select * into cfg from nhip_viec_private.email_settings where id = 1;

  for v_rec in (
    select
      t.id as task_id,
      t.title,
      t.due_date,
      t.status,
      t.team_id,
      t.created_by,
      coalesce(t.recurrence_type, 'none') as recurrence_type,
      tm.user_id as recipient_id,
      coalesce(nullif(au.email, ''), wm.email) as recipient_email,
      coalesce(wm.display_name, au.raw_user_meta_data->>'full_name', split_part(coalesce(au.email, wm.email, ''), '@', 1)) as recipient_name,
      round(extract(epoch from (t.due_date - (now() at time zone 'Asia/Bangkok')))::numeric / 86400, 1) as days_left
    from public.work_tasks t
    join lateral (
      select distinct ta.user_id
      from public.work_task_assignees ta
      where ta.task_id = t.id
      union
      select t.created_by where t.created_by is not null
    ) tm on true
    left join auth.users au on au.id = tm.user_id
    left join lateral (
      select m.display_name, m.email
      from public.work_members m
      where m.user_id = tm.user_id
      limit 1
    ) wm on true
    where t.status in ('todo', 'in_progress', 'review')
      and t.due_date is not null
      -- From 2 days before due date up to the due date
      and t.due_date::date >= v_today
      and t.due_date::date <= v_today + 2
      and coalesce(nullif(au.email, ''), wm.email, '') <> ''
  ) loop
    declare
      v_event_key text := 'reminder:' || v_rec.task_id || ':' || v_rec.recipient_id || ':' || v_today || ':' || v_slot;
      v_subj text := '[Nhịp việc] Nhắc hạn: ' || v_rec.title || ' (Hạn: ' || to_char(v_rec.due_date, 'DD/MM/YYYY HH24:MI') || ')';
      v_body text := 'Công việc: ' || v_rec.title || E'\n' ||
                     'Trạng thái hiện tại: ' || case v_rec.status
                       when 'todo' then 'Cần làm'
                       when 'in_progress' then 'Đang làm'
                       when 'review' then 'Chờ duyệt'
                       else v_rec.status end || E'\n' ||
                     'Hạn hoàn thành: ' || to_char(v_rec.due_date, 'DD/MM/YYYY HH24:MI') ||
                     ' (còn ' || greatest(0, round(extract(epoch from (v_rec.due_date - (now() at time zone 'Asia/Bangkok')))::numeric / 86400, 1)) || ' ngày)' || E'\n' ||
                     case when v_rec.recurrence_type <> 'none' then 'Chu kỳ lặp lại: ' || v_rec.recurrence_type || E'\n' else '' end ||
                     'Vui lòng cập nhật tiến độ công việc trước thời hạn hoàn thành.';
    begin
      insert into nhip_viec_private.email_outbox(
        event_key,
        recipient_id,
        subject,
        body,
        task_id,
        team_id,
        created_at
      ) values (
        v_event_key,
        v_rec.recipient_id,
        v_subj,
        v_body,
        v_rec.task_id,
        v_rec.team_id,
        now()
      )
      on conflict (event_key) do nothing;

      if found then
        v_inserted := v_inserted + 1;
      end if;
    end;
  end loop;

  -- If any reminders were inserted and worker is configured, trigger dispatch immediately
  if v_inserted > 0 and cfg.enabled and coalesce(cfg.worker_secret, '') <> '' then
    begin
      perform extensions.net.http_post(
        url := 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/api/send-email',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object(
          'worker_secret', cfg.worker_secret,
          'baseUrl', 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/'
        )
      );
    exception
      when others then
        null;
    end;
  end if;

  return v_inserted;
end;
$$;
