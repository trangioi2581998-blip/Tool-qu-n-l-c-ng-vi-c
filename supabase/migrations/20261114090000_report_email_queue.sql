-- Migration: Allow queueing report emails to email_outbox
create or replace function public.work_queue_report_emails(
  team_id uuid,
  recipient_ids uuid[],
  subject text,
  body text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  target_uid uuid;
  cnt integer := 0;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'Bạn cần đăng nhập.';
  end if;

  if recipient_ids is not null and array_length(recipient_ids, 1) > 0 then
    foreach target_uid in array recipient_ids loop
      insert into nhip_viec_private.email_outbox (
        event_key, recipient_id, subject, body, team_id
      )
      values (
        'report:' || coalesce(team_id::text, 'none') || ':' || target_uid::text || ':' || extract(epoch from clock_timestamp())::text,
        target_uid,
        subject,
        body,
        team_id
      )
      on conflict on constraint email_outbox_event_key_recipient_id_key do nothing;
      cnt := cnt + 1;
    end loop;
  end if;

  return jsonb_build_object('queued', cnt);
end;
$$;

grant execute on function public.work_queue_report_emails(uuid, uuid[], text, text) to authenticated;

