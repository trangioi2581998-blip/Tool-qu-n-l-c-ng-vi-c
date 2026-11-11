import { timingSafeEqual } from 'node:crypto'
import { adminClient, appUrl, env, json } from '../_shared/server.ts'

interface EmailJob {
  id: string
  lease_id: string
  email: string
  subject: string
  body: string
  task_id: string | null
  team_id: string
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const encoder = new TextEncoder()
    const expected = encoder.encode(env('WORK_EMAIL_WORKER_SECRET'))
    const provided = encoder.encode(
      req.headers.get('x-work-email-secret') || '',
    )
    if (
      expected.length < 32 ||
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    )
      return json({ error: 'Unauthorized' }, 401)

    const apiKey = env('RESEND_API_KEY')
    const sender = env('WORK_EMAIL_FROM')
    const baseUrl = appUrl()
    const admin = adminClient()
    const { data, error } = await admin.rpc('work_claim_emails', {
      batch_size: 10,
    })
    if (error) throw error
    const jobs = (data ?? []) as EmailJob[]
    let sent = 0
    let failed = 0

    for (const [index, job] of jobs.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 550))
      const url = new URL(baseUrl)
      url.searchParams.set('team', job.team_id)
      if (job.task_id) url.searchParams.set('task', job.task_id)
      let delivered = false
      let retryable = true
      let detail = 'Network timeout or interruption'
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'nhip-viec/' + job.id,
          },
          body: JSON.stringify({
            from: sender,
            to: [job.email],
            subject: job.subject,
            text: job.body + '\n\nMở Nhịp việc: ' + url.href,
          }),
          signal: AbortSignal.timeout(12000),
        })
        delivered = response.ok
        retryable =
          response.status === 429 ||
          response.status === 409 ||
          response.status >= 500
        detail = 'Resend HTTP ' + response.status
        await response.body?.cancel()
      } catch {
        // Keep the same message ID on retry if the provider accepted the request before the connection closed.
      }
      const saved = await admin.rpc('work_finish_email', {
        message_id: job.id,
        claim_id: job.lease_id,
        delivered,
        retryable,
        detail: delivered ? null : detail,
      })
      if (delivered && saved.data === true) sent += 1
      else failed += 1
    }
    return json({ processed: jobs.length, sent, failed })
  } catch {
    return json({ error: 'Email worker failed' }, 500)
  }
})
