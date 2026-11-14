import net from 'node:net'
import tls from 'node:tls'

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://ojtandltxsysgtmhmnbx.supabase.co'
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_I_-jAuW2-UEYuH9Ko_YOaw_RGodU1tC'

function encodeBase64(str) {
  return Buffer.from(String(str || ''), 'utf8').toString('base64')
}

function encodeBase64Mime(str) {
  return encodeBase64(str).replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

function encodeHeader(str) {
  return '=?UTF-8?B?' + encodeBase64(str) + '?='
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtmlEmail({ subject, body, actionUrl, recipientName }) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let title = String(subject || '').replace(/^\[[^\]]+\]\s*/, '')
  const greeting = recipientName ? `Xin chào <strong>${escapeHtml(recipientName)}</strong>,` : 'Xin chào bạn,'

  const tableRows = []
  let highlightNote = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && colonIdx < 35) {
      const label = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim()
      tableRows.push({ label, val })
    } else if (!highlightNote) {
      highlightNote = line
    }
  }

  const rowsHtml = tableRows
    .map(
      ({ label, val }) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f0eef5;color:#6b7280;font-size:13px;width:36%;vertical-align:top;font-weight:500;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f0eef5;color:#111827;font-size:13.5px;vertical-align:top;font-weight:600;">
            ${escapeHtml(val)}
          </td>
        </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root { color-scheme: light; }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#1f2937;">
  <div style="max-width:540px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background-color:#5a32a3;padding:20px 24px;border-bottom:3px solid #7c4ddb;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#e9d8fd;margin-bottom:4px;">
              Nhịp việc · Thông báo công việc
            </div>
            <div style="font-size:17px;font-weight:700;line-height:1.35;color:#ffffff;">
              ${escapeHtml(title)}
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body content -->
    <div style="padding:24px 24px 20px 24px;background-color:#ffffff;">
      <!-- Greeting -->
      <p style="margin:0 0 14px 0;font-size:14.5px;line-height:1.6;color:#1f2937;">
        ${greeting}
      </p>

      ${
        highlightNote
          ? `<div style="margin:0 0 18px 0;padding:12px 16px;background-color:#f7f4fd;border-left:4px solid #6b46c1;border-radius:6px;font-size:13.5px;line-height:1.55;color:#44337a;font-weight:500;">
              ${escapeHtml(highlightNote)}
            </div>`
          : ''
      }

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse;background-color:#ffffff;border:1px solid #f0eef5;border-radius:10px;overflow:hidden;margin-bottom:22px;">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- CTA Button -->
      ${
        actionUrl
          ? `<div style="text-align:center;margin:24px 0 8px 0;">
              <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 28px;background-color:#5a32a3;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.01em;box-shadow:0 3px 8px rgba(90,50,163,0.25);">
                Xem chi tiết công việc →
              </a>
            </div>`
          : ''
      }
    </div>

    <!-- Footer -->
    <div style="padding:14px 24px;background-color:#fafafa;border-top:1px solid #f0f0f0;font-size:12px;color:#8c93a0;text-align:center;line-height:1.5;">
      Email gửi tự động từ hệ thống <strong>Nhịp việc</strong>. Vui lòng không trả lời trực tiếp email này.
    </div>
  </div>
</body>
</html>`
}

function sendBatchViaSmtp(settings, messages) {
  return new Promise((resolve) => {
    const cleanHost = String(settings?.smtp_host || 'smtp.gmail.com').trim()
    const cleanPort = Number(settings?.smtp_port) || 465
    const cleanUser = String(settings?.smtp_user || '').trim()
    const cleanPass = String(settings?.smtp_pass || '').replace(/\s+/g, '')
    const fromEmail = String(settings?.sender_email || cleanUser).trim()
    const fromName = String(settings?.sender_name || 'Nhịp việc').trim()

    if (!cleanUser || !cleanPass) {
      resolve(
        messages.map((m) => ({
          id: m.id,
          lease_id: m.lease_id,
          email: m.to,
          delivered: false,
          detail: 'Chưa cấu hình tài khoản hoặc mật khẩu SMTP',
        })),
      )
      return
    }

    let socket = null
    let finished = false
    let buffer = ''
    let phase = 'GREETING'
    let msgIdx = 0
    const outcomes = new Array(messages.length).fill(null)

    const finishAll = (fallbackError) => {
      if (finished) return
      finished = true
      try {
        socket?.destroy()
      } catch {
        // ignore
      }
      resolve(
        messages.map((m, i) => ({
          id: m.id,
          lease_id: m.lease_id,
          email: m.to,
          delivered: outcomes[i]?.delivered ?? false,
          detail: outcomes[i]?.detail ?? (fallbackError || 'Lỗi kết nối SMTP'),
        })),
      )
    }

    const timer = setTimeout(() => {
      finishAll('SMTP timeout sau 25 giây')
    }, 25000)

    const writeCmd = (cmd) => {
      socket.write(cmd + '\r\n')
    }

    const buildMime = (msg) => {
      const boundary = '----=_NhipViec_' + Date.now().toString(36) + '_' + msgIdx
      const domain = (fromEmail.split('@')[1] || 'gmail.com').replace(/[^a-zA-Z0-9.-]/g, '')
      const msgId = `<${Date.now()}.${msgIdx}.${Math.random().toString(36).slice(2, 10)}@${domain}>`
      return [
        `From: ${encodeHeader(fromName)} <${fromEmail}>`,
        `To: <${msg.to}>`,
        `Subject: ${encodeHeader(msg.subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${msgId}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        encodeBase64Mime(msg.text),
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        encodeBase64Mime(msg.html),
        '',
        `--${boundary}--`,
        '',
        '.',
      ].join('\r\n')
    }

    const startNextMessage = () => {
      if (msgIdx >= messages.length) {
        phase = 'QUIT'
        clearTimeout(timer)
        writeCmd('QUIT')
        finishAll('OK')
        return
      }
      phase = 'MAIL_FROM'
      writeCmd(`MAIL FROM:<${fromEmail}>`)
    }

    const handleResponse = (code, fullText) => {
      if (phase === 'GREETING' && code === 220) {
        phase = 'EHLO'
        writeCmd('EHLO nhipviec.local')
        return
      }
      if (phase === 'EHLO' && code === 250) {
        if (cleanPort !== 465 && !socket.encrypted && fullText.includes('STARTTLS')) {
          phase = 'STARTTLS'
          writeCmd('STARTTLS')
        } else {
          phase = 'AUTH'
          writeCmd('AUTH LOGIN')
        }
        return
      }
      if (phase === 'STARTTLS' && code === 220) {
        const tlsSocket = tls.connect({
          socket,
          servername: cleanHost,
          rejectUnauthorized: false,
        })
        socket = tlsSocket
        socket.encrypted = true
        attachListeners(socket)
        phase = 'EHLO'
        writeCmd('EHLO nhipviec.local')
        return
      }
      if (phase === 'AUTH' && code === 334) {
        phase = 'AUTH_USER'
        writeCmd(encodeBase64(cleanUser))
        return
      }
      if (phase === 'AUTH_USER' && code === 334) {
        phase = 'AUTH_PASS'
        writeCmd(encodeBase64(cleanPass))
        return
      }
      if (phase === 'AUTH_PASS' && code === 235) {
        startNextMessage()
        return
      }
      if (phase === 'MAIL_FROM' && code === 250) {
        phase = 'RCPT_TO'
        writeCmd(`RCPT TO:<${messages[msgIdx].to}>`)
        return
      }
      if (phase === 'RCPT_TO' && (code === 250 || code === 251)) {
        phase = 'DATA'
        writeCmd('DATA')
        return
      }
      if (phase === 'DATA' && code === 354) {
        phase = 'BODY'
        writeCmd(buildMime(messages[msgIdx]))
        return
      }
      if (phase === 'BODY' && code === 250) {
        outcomes[msgIdx] = { delivered: true, detail: 'OK' }
        msgIdx += 1
        startNextMessage()
        return
      }

      const errMsg = `SMTP ${code}: ${fullText.trim()}`
      if (
        phase === 'MAIL_FROM' ||
        phase === 'RCPT_TO' ||
        phase === 'DATA' ||
        phase === 'BODY'
      ) {
        outcomes[msgIdx] = { delivered: false, detail: errMsg }
        msgIdx += 1
        if (msgIdx < messages.length) {
          phase = 'RSET'
          writeCmd('RSET')
          return
        }
      }
      clearTimeout(timer)
      finishAll(errMsg)
    }

    const attachListeners = (sock) => {
      sock.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
        const lines = buffer.split('\r\n')
        buffer = lines.pop() || ''
        let collected = []
        for (const line of lines) {
          if (!line) continue
          collected.push(line)
          if (/^\d{3} /.test(line)) {
            const code = Number(line.slice(0, 3))
            const textResp = collected.join(' | ')
            collected = []
            if (phase === 'RSET') {
              startNextMessage()
            } else {
              handleResponse(code, textResp)
            }
          }
        }
      })
      sock.on('error', (err) => {
        clearTimeout(timer)
        finishAll(err?.message || 'Lỗi kết nối SMTP')
      })
      sock.on('close', () => {
        clearTimeout(timer)
        if (!finished) finishAll('Kết nối SMTP bị đóng sớm')
      })
    }

    try {
      if (cleanPort === 465) {
        socket = tls.connect({
          host: cleanHost,
          port: cleanPort,
          servername: cleanHost,
          rejectUnauthorized: false,
        })
        socket.encrypted = true
      } else {
        socket = net.connect({
          host: cleanHost,
          port: cleanPort,
        })
        socket.encrypted = false
      }
      attachListeners(socket)
    } catch (err) {
      clearTimeout(timer)
      finishAll(err?.message || 'Không thể khởi tạo kết nối SMTP')
    }
  })
}

async function sendSingleViaApi(settings, { to, subject, text, html }) {
  const provider = settings?.provider || 'smtp'

  if (provider === 'google_script') {
    const webhookUrl = String(settings?.webhook_url || '').trim()
    if (!webhookUrl) return { delivered: false, detail: 'Chưa nhập Google Apps Script URL' }
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text,
          html,
          senderName: settings?.sender_name || 'Nhịp việc',
        }),
      })
      if (!response.ok) {
        return { delivered: false, detail: 'Webhook HTTP ' + response.status }
      }
      return { delivered: true, detail: 'OK' }
    } catch (err) {
      return { delivered: false, detail: err?.message || 'Lỗi gọi Google Script Webhook' }
    }
  }

  if (provider === 'resend') {
    const apiKey = String(settings?.resend_api_key || '').trim()
    const fromAddr = String(settings?.sender_email || 'onboarding@resend.dev').trim()
    const fromName = String(settings?.sender_name || 'Nhịp việc').trim()
    if (!apiKey) return { delivered: false, detail: 'Chưa nhập Resend API Key' }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr.includes('<') ? fromAddr : `${fromName} <${fromAddr}>`,
          to: [to],
          subject,
          text,
          html,
        }),
      })
      if (!response.ok) {
        const info = await response.json().catch(() => null)
        return {
          delivered: false,
          detail: info?.message || 'Resend HTTP ' + response.status,
        }
      }
      return { delivered: true, detail: 'OK' }
    } catch (err) {
      return { delivered: false, detail: err?.message || 'Lỗi kết nối Resend API' }
    }
  }

  const [res] = await sendBatchViaSmtp(settings, [
    { id: 'test', lease_id: 'test', to, subject, text, html },
  ])
  return { delivered: res.delivered, detail: res.detail }
}

async function callSupabaseRpc(fnName, params) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`RPC ${fnName} HTTP ${response.status}: ${text}`)
  }
  return response.json().catch(() => null)
}

function prepareMessages(jobs, baseUrl) {
  return jobs.map((job) => {
    let actionUrl = baseUrl || 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/'
    try {
      const url = new URL(actionUrl)
      if (job.team_id) url.searchParams.set('team', job.team_id)
      if (job.task_id) url.searchParams.set('task', job.task_id)
      actionUrl = url.href
    } catch {
      // keep default URL
    }
    const greetingLine = job.name ? `Xin chào ${job.name},\n\n` : 'Xin chào bạn,\n\n'
    const text = actionUrl
      ? `${greetingLine}${job.body}\n\nXem chi tiết công việc: ${actionUrl}`
      : `${greetingLine}${job.body}`
    const html =
      job.html ||
      buildHtmlEmail({
        subject: job.subject,
        body: job.body,
        actionUrl,
        recipientName: job.name || '',
      })
    return {
      id: job.id,
      lease_id: job.lease_id,
      to: job.email,
      subject: job.subject,
      text,
      html,
    }
  })
}

async function dispatchBatch(settings, jobs, baseUrl) {
  if (!jobs?.length) return []
  const prepared = prepareMessages(jobs, baseUrl)
  if ((settings?.provider || 'smtp') === 'smtp') {
    return sendBatchViaSmtp(settings, prepared)
  }
  const results = []
  for (const msg of prepared) {
    const outcome = await sendSingleViaApi(settings, msg)
    results.push({
      id: msg.id,
      lease_id: msg.lease_id,
      email: msg.to,
      delivered: outcome.delivered,
      detail: outcome.detail,
    })
  }
  return results
}

export async function handleEmailDispatchPayload(payload) {
  const { settings, jobs = [], baseUrl = '', testEmail = '', worker_secret = '' } =
    payload || {}

  if (worker_secret) {
    const claimed = await callSupabaseRpc('work_claim_pending_emails_worker', {
      secret: worker_secret,
      batch_size: 20,
    })
    if (!claimed?.configured || !claimed?.jobs?.length) {
      return { configured: Boolean(claimed?.configured), sent: 0, failed: 0 }
    }
    const results = await dispatchBatch(
      claimed.settings,
      claimed.jobs,
      baseUrl || 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/',
    )
    let sent = 0
    let failed = 0
    for (const item of results) {
      await callSupabaseRpc('work_complete_pending_email_worker', {
        secret: worker_secret,
        message_id: item.id,
        claim_id: item.lease_id,
        delivered: Boolean(item.delivered),
        detail: item.detail || null,
      }).catch(() => null)
      if (item.delivered) sent += 1
      else failed += 1
    }
    return { configured: true, sent, failed }
  }

  if (testEmail) {
    const body =
      'Công việc: Kiểm tra cấu hình gửi Email tự động\n' +
      'Hệ thống gửi thông báo qua Email của Nhịp việc đã hoạt động thành công.\n' +
      'Trạng thái hiện tại: Hoàn thành\n' +
      'Mỗi khi thêm, sửa, xóa, đổi trạng thái hoặc bình luận công việc, email sẽ được gửi tự động đến tài khoản.'
    const actionUrl = baseUrl || 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/'
    const res = await sendSingleViaApi(settings, {
      to: testEmail,
      subject: '[Nhịp việc] Kiểm tra kết nối gửi Email thông báo',
      text: `${body}\n\nMở Nhịp việc: ${actionUrl}`,
      html: buildHtmlEmail({
        subject: '[Nhịp việc] Kiểm tra kết nối gửi Email thông báo',
        body,
        actionUrl,
      }),
    })
    return { testResult: res }
  }

  const results = await dispatchBatch(settings, jobs, baseUrl)
  return { results }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  try {
    let body = req.body
    if (typeof body === 'string') {
      body = JSON.parse(body || '{}')
    } else if (!body) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    }
    const output = await handleEmailDispatchPayload(body)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(output))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err?.message || 'Email dispatch error' }))
  }
}
