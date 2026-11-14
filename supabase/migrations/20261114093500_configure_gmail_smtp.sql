-- Configure active Gmail SMTP credentials in email_settings
insert into nhip_viec_private.email_settings (
  id,
  provider,
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_pass,
  sender_name,
  sender_email,
  enabled,
  updated_at
) values (
  1,
  'smtp',
  'smtp.gmail.com',
  465,
  'trangioi2581998@gmail.com',
  'xkoh htdy yqco hbjm',
  'Nhịp việc',
  'trangioi2581998@gmail.com',
  true,
  now()
)
on conflict (id) do update set
  provider = excluded.provider,
  smtp_host = excluded.smtp_host,
  smtp_port = excluded.smtp_port,
  smtp_user = excluded.smtp_user,
  smtp_pass = excluded.smtp_pass,
  sender_name = excluded.sender_name,
  sender_email = excluded.sender_email,
  enabled = excluded.enabled,
  updated_at = now();

update nhip_viec_private.email_outbox
set failed_at = null, attempts = 0, next_attempt_at = now(), lease_id = null, lease_until = null, last_error = null
where sent_at is null;

