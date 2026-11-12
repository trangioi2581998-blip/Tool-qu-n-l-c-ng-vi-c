-- Automatic server-side email dispatch via pg_net + worker RPCs

alter table nhip_viec_private.email_settings
  add column if not exists worker_secret text not null default encode(gen_random_bytes(24), 'hex');

create or replace function public.work_claim_pending_emails_worker(
  secret text,
  batch_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, nhip_viec_private
as $$
declare
  cfg nhip_viec_private.email_settings%rowtype;
  v_claim_id uuid := gen_random_uuid();
  v_messages jsonb := '[]'::jsonb;
begin
  select * into cfg
  from nhip_viec_private.email_settings
  where id = 1;

  if not found or coalesce(cfg.worker_secret, '') = '' or cfg.worker_secret <> coalesce(secret, '') then
    raise exception 'Unauthorized email worker';
  end if;

  if not cfg.enabled then
    return jsonb_build_object(
      'settings', jsonb_build_object('enabled', false),
      'claim_id', v_claim_id,
      'messages', '[]'::jsonb
    );
  end if;

  with picked as (
    select o.id
    from nhip_viec_private.email_outbox o
    where o.sent_at is null
      and o.failed_at is null
      and (o.lease_until is null or o.lease_until < now())
      and (o.next_attempt_at is null or o.next_attempt_at <= now())
    order by o.created_at asc
    limit greatest(1, least(coalesce(batch_size, 20), 50))
    for update skip locked
  ),
  updated as (
    update nhip_viec_private.email_outbox o
    set lease_id = v_claim_id,
        lease_until = now() + interval '2 minutes',
        attempts = o.attempts + 1
    from picked
    where o.id = picked.id
    returning o.id, o.recipient_id, o.subject, o.body
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u_msg.id,
        'recipient_email', usr.email,
        'recipient_name', usr.full_name,
        'subject', u_msg.subject,
        'body', u_msg.body
      )
    ),
    '[]'::jsonb
  )
  into v_messages
  from updated u_msg
  join nhip_viec_private.users usr on usr.id = u_msg.recipient_id
  where coalesce(usr.email, '') <> '';

  return jsonb_build_object(
    'settings', jsonb_build_object(
      'enabled', cfg.enabled,
      'provider', cfg.provider,
      'smtp_host', cfg.smtp_host,
      'smtp_port', cfg.smtp_port,
      'smtp_user', cfg.smtp_user,
      'smtp_pass', cfg.smtp_pass,
      'gas_webhook_url', cfg.gas_webhook_url,
      'resend_api_key', cfg.resend_api_key,
      'from_email', cfg.from_email,
      'from_name', cfg.from_name
    ),
    'claim_id', v_claim_id,
    'messages', v_messages
  );
end;
$$;

create or replace function public.work_complete_pending_email_worker(
  secret text,
  message_id uuid,
  claim_id uuid,
  delivered boolean,
  detail text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, nhip_viec_private
as $$
declare
  cfg nhip_viec_private.email_settings%rowtype;
begin
  select * into cfg
  from nhip_viec_private.email_settings
  where id = 1;

  if not found or coalesce(cfg.worker_secret, '') = '' or cfg.worker_secret <> coalesce(secret, '') then
    raise exception 'Unauthorized email worker';
  end if;

  if delivered then
    update nhip_viec_private.email_outbox
    set sent_at = now(),
        lease_id = null,
        lease_until = null,
        last_error = null
    where id = message_id
      and lease_id = claim_id;
  else
    update nhip_viec_private.email_outbox
    set lease_id = null,
        lease_until = null,
        failed_at = case when attempts >= 5 then now() else null end,
        next_attempt_at = case when attempts >= 5 then null else now() + interval '1 minute' end,
        last_error = left(coalesce(detail, 'Send failed'), 500)
    where id = message_id
      and lease_id = claim_id;
  end if;

  return found;
end;
$$;

grant execute on function public.work_claim_pending_emails_worker(text, integer) to anon, authenticated;
grant execute on function public.work_complete_pending_email_worker(text, uuid, uuid, boolean, text) to anon, authenticated;

create or replace function nhip_viec_private.trigger_dispatch_emails()
returns trigger
language plpgsql
security definer
set search_path = public, nhip_viec_private, extensions, net
as $$
declare
  cfg nhip_viec_private.email_settings%rowtype;
  has_credentials boolean := false;
begin
  select * into cfg
  from nhip_viec_private.email_settings
  where id = 1;

  if not found or not cfg.enabled or coalesce(cfg.worker_secret, '') = '' then
    return null;
  end if;

  has_credentials :=
    (cfg.provider = 'smtp' and coalesce(cfg.smtp_user, '') <> '' and coalesce(cfg.smtp_pass, '') <> '')
    or (cfg.provider = 'gas' and coalesce(cfg.gas_webhook_url, '') <> '')
    or (cfg.provider = 'resend' and coalesce(cfg.resend_api_key, '') <> '');

  if not has_credentials then
    return null;
  end if;

  perform net.http_post(
    url := 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/api/send-email',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'worker_secret', cfg.worker_secret,
      'baseUrl', 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/'
    )
  );

  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_email_outbox_auto_dispatch on nhip_viec_private.email_outbox;
create trigger trg_email_outbox_auto_dispatch
  after insert on nhip_viec_private.email_outbox
  for each statement
  execute function nhip_viec_private.trigger_dispatch_emails();

-- Skip stale pre-existing backlog so only new actions trigger immediate emails
update nhip_viec_private.email_outbox
set failed_at = now(),
    lease_id = null,
    lease_until = null,
    last_error = coalesce(nullif(last_error, ''), 'Đã bỏ qua thông báo cũ trước khi bật tự động gửi')
where sent_at is null
  and failed_at is null
  and created_at < now() - interval '15 minutes';
