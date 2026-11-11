-- Run after deploying notify-work-email and creating the two Vault secrets in README.md.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'work_supabase_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'work_email_worker_secret') then
    raise exception 'Create work_supabase_url and work_email_worker_secret in Supabase Vault first.';
  end if;
end;
$$;

select cron.schedule('nhip-viec-email-worker', '* * * * *', $job$
  select net.http_post(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'work_supabase_url'), '/')
      || '/functions/v1/notify-work-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-work-email-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'work_email_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- Hosted pg_cron uses UTC by default. 17:05 UTC = 00:05 the next day in Vietnam.
select cron.schedule('nhip-viec-overdue-reminders', '5 17 * * *', $job$
  select public.work_queue_overdue_emails();
$job$);
