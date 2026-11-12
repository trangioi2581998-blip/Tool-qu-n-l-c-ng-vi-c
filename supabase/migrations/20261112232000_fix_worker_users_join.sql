-- Fix recipient lookup and response shape in work_claim_pending_emails_worker

create or replace function public.work_claim_pending_emails_worker(
  secret text,
  batch_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, nhip_viec_private, auth
as $$
declare
  cfg nhip_viec_private.email_settings%rowtype;
  v_claim_id uuid := gen_random_uuid();
  v_jobs jsonb := '[]'::jsonb;
  v_configured boolean := false;
begin
  select * into cfg
  from nhip_viec_private.email_settings
  where id = 1;

  if not found or coalesce(cfg.worker_secret, '') = '' or cfg.worker_secret <> coalesce(secret, '') then
    raise exception 'Unauthorized email worker';
  end if;

  v_configured := cfg.enabled and (
    (cfg.provider = 'smtp' and coalesce(cfg.smtp_user, '') <> '' and coalesce(cfg.smtp_pass, '') <> '')
    or (cfg.provider in ('gas', 'google_script') and coalesce(cfg.webhook_url, '') <> '')
    or (cfg.provider = 'resend' and coalesce(cfg.resend_api_key, '') <> '')
  );

  if not v_configured then
    return jsonb_build_object(
      'configured', false,
      'settings', jsonb_build_object('enabled', false),
      'jobs', '[]'::jsonb
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
    returning o.id, o.lease_id, o.recipient_id, o.subject, o.body, o.task_id, o.team_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u_msg.id,
        'lease_id', u_msg.lease_id,
        'email', coalesce(nullif(au.email, ''), wm.email),
        'name', coalesce(wm.display_name, au.raw_user_meta_data->>'full_name', split_part(coalesce(au.email, wm.email, ''), '@', 1)),
        'subject', u_msg.subject,
        'body', u_msg.body,
        'task_id', u_msg.task_id,
        'team_id', u_msg.team_id
      )
    ),
    '[]'::jsonb
  )
  into v_jobs
  from updated u_msg
  left join auth.users au on au.id = u_msg.recipient_id
  left join lateral (
    select m.display_name, m.email
    from public.work_members m
    where m.user_id = u_msg.recipient_id
    limit 1
  ) wm on true
  where coalesce(nullif(au.email, ''), wm.email, '') <> '';

  return jsonb_build_object(
    'configured', true,
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
    'jobs', v_jobs
  );
end;
$$;

update nhip_viec_private.email_outbox
set next_attempt_at = now(),
    lease_until = null,
    lease_id = null
where sent_at is null
  and failed_at is null;
