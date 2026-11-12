-- Fix column names in worker RPCs and trigger (sender_name, sender_email, webhook_url)

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
      'webhook_url', cfg.webhook_url,
      'resend_api_key', cfg.resend_api_key,
      'sender_email', cfg.sender_email,
      'sender_name', cfg.sender_name
    ),
    'claim_id', v_claim_id,
    'messages', v_messages
  );
end;
$$;

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
    or (cfg.provider in ('gas', 'google_script') and coalesce(cfg.webhook_url, '') <> '')
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

-- Stop retrying old messages that failed due to SMTP 534 auth error
update nhip_viec_private.email_outbox
set failed_at = now(),
    lease_id = null,
    lease_until = null
where sent_at is null
  and failed_at is null
  and last_error like '%534%';
