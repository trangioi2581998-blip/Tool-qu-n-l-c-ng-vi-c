import net from 'node:net'
import tls from 'node:tls'

function encodeBase64(str) {
  return Buffer.from(String(str || ''), 'utf8').toString('base64')
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

function buildHtmlEmail({ subject, body, actionUrl }) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rowsHtml = lines
    .map((line, index) => {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0 && colonIdx < 35) {
        const label = escapeHtml(line.slice(0, colonIdx))
        const val = escapeHtml(line.slice(colonIdx + 1).trim())
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #efeaf8;color:#6c6584;font-size:13px;font-weight:600;width:38%;vertical-align:top;">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #efeaf8;color:#221c35;font-size:13px;font-weight:600;vertical-align:top;">${val}</td>
          </tr>`
      }
      return `
        <tr>
          <td colspan="2" style="padding:10px 12px;border-bottom:1px solid #efeaf8;color:${index === 1 ? '#4f359b' : '#2d2642'};background:${index === 1 ? '#f7f3ff' : 'transparent'};font-size:13.5px;line-height:1.5;">
            ${escapeHtml(line)}
          </td>
        </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#f4f1fa;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#221c35;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4ddf4;box-shadow:0 8px 24px rgba(45,26,102,0.08);">
    <div style="background:linear-gradient(135deg,#5b38c9,#7c5dfa);padding:20px 24px;color:#ffffff;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;opacity:0.9;margin-bottom:4px;">Nhịp việc · Thông báo tự động</div>
      <h1 style="margin:0;font-size:18px;font-weight:700;line-height:1.35;color:#ffffff;">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #ece6f8;border-radius:10px;overflow:hidden;">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${
        actionUrl
          ? `<div style="margin-top:20px;text-align:center;">
              <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:11px 22px;background:#6544d8;color:#ffffff;text-decoration:none;border-radius:9px;font-size:13.5px;font-weight:700;">Mở công việc trên Nhịp việc →</a>
            </div>`
          : ''
      }
    </div>
    <div style="padding:12px 24px;background:#faf8ff;border-top:1px solid #eee9f9;font-size:11.5px;color:#7a7293;text-align:center;">
      Email này được gửi tự động từ hệ thống quản lý công việc Nhịp việc.
    </div>
  </div>
</body>
</html>`
}

function sendViaSmtp({ host, port, user, pass, senderName, senderEmail, to, subject, text, html }) {
  return new Promise((resolve) => {
    const cleanHost = String(host || 'smtp.gmail.com').trim()
    const cleanPort = Number(port) || 465
    const cleanUser = String(user || '').trim()
    const cleanPass = String(pass || '').replace(/\s+/g, '')
    const fromEmail = String(senderEmail || cleanUser).trim()
    const fromName = String(senderName || 'Nhịp việc').trim()
    const boundary = '----=_NhipViec_' + Date.now().toString(36)

    const mime = [
      `From: ${encodeHeader(fromName)} <${fromEmail}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64(text),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64(html),
      '',
      `--${boundary}--`,
      '',
      '.',
    ].join('\r\n')

    let socket = null
    let finished = false
    let buffer = ''
    let step = 0

    const finish = (delivered, detail) => {
      if (finished) return
      finished = true
      try {
        socket?.destroy()
      } catch {
        // ignore
      }
      resolve({ delivered, detail })
    }

    const timer = setTimeout(() => {
      finish(false, 'SMTP timeout sau 15 giây')
    }, 15000)

    const writeCmd = (cmd) => {
      socket.write(cmd + '\r\n')
    }

    const handleResponse = (code, fullText) => {
      if (code >= 400) {
        clearTimeout(timer)
        finish(false, `SMTP ${code}: ${fullText.trim()}`)
        return
      }
      if (step === 0 && code === 220) {
        step = 1
        writeCmd(`EHLO nhipviec.local`)
      } else if (step === 1 && code === 250) {
        if (cleanPort !== 465 && !socket.encrypted && fullText.includes('STARTTLS')) {
          step = 1.5
          writeCmd('STARTTLS')
        } else {
          step = 2
          writeCmd('AUTH LOGIN')
        }
      } else if (step === 1.5 && code === 220) {
        const tlsSocket = tls.connect({
          socket,
          servername: cleanHost,
          rejectUnauthorized: false,
        })
        socket = tlsSocket
        socket.encrypted = true
        attachListeners(socket)
        step = 1
        writeCmd(`EHLO nhipviec.local`)
      } else if (step === 2 && code === 334) {
        step = 3
        writeCmd(encodeBase64(cleanUser))
      } else if (step === 3 && code === 334) {
        step = 4
        writeCmd(encodeBase64(cleanPass))
      } else if (step === 4 && code === 235) {
        step = 5
        writeCmd(`MAIL FROM:<${fromEmail}>`)
      } else if (step === 5 && code === 250) {
        step = 6
        writeCmd(`RCPT TO:<${to}>`)
      } else if (step === 6 && (code === 250 || code === 251)) {
        step = 7
        writeCmd('DATA')
      } else if (step === 7 && code === 354) {
        step = 8
        writeCmd(mime)
      } else if (step === 8 && code === 250) {
        step = 9
        clearTimeout(timer)
        writeCmd('QUIT')
        finish(true, 'OK')
      }
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
            handleResponse(code, textResp)
          }
        }
      })
      sock.on('error', (err) => {
        clearTimeout(timer)
        finish(false, err?.message || 'Lỗi kết nối SMTP')
      })
      sock.on('close', () => {
        clearTimeout(timer)
        if (!finished) finish(false, 'Kết nối SMTP bị đóng sớm')
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
      finish(false, err?.message || 'Không thể khởi tạo kết nối SMTP')
    }
  })
}

async function sendSingleEmail(settings, { to, subject, body, actionUrl }) {
  const text = actionUrl ? `${body}\n\nMở Nhịp việc: ${actionUrl}` : body
  const html = buildHtmlEmail({ subject, body, actionUrl })
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

  return sendViaSmtp({
    host: settings?.smtp_host || 'smtp.gmail.com',
    port: settings?.smtp_port || 465,
    user: settings?.smtp_user || '',
    pass: settings?.smtp_pass || '',
    senderName: settings?.sender_name || 'Nhịp việc',
    senderEmail: settings?.sender_email || settings?.smtp_user || '',
    to,
    subject,
    text,
    html,
  })
}

export async function handleEmailDispatchPayload(payload) {
  const { settings, jobs = [], baseUrl = '', testEmail = '' } = payload || {}

  if (testEmail) {
    const res = await sendSingleEmail(settings, {
      to: testEmail,
      subject: '[Nhịp việc] Kiểm tra kết nối gửi Email thông báo',
      body:
        'Công việc: Kiểm tra cấu hình gửi Email tự động\n' +
        'Hệ thống gửi thông báo qua Email của Nhịp việc đã hoạt động thành công.\n' +
        'Trạng thái hiện tại: Hoàn thành\n' +
        'Mỗi khi thêm, sửa, xóa, đổi trạng thái hoặc bình luận công việc, email sẽ được gửi tự động đến tài khoản.',
      actionUrl: baseUrl || 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/',
    })
    return { testResult: res }
  }

  const results = []
  for (const job of jobs) {
    let actionUrl = baseUrl || 'https://tool-qu-n-l-c-ng-vi-c.vercel.app/'
    try {
      const url = new URL(actionUrl)
      if (job.team_id) url.searchParams.set('team', job.team_id)
      if (job.task_id) url.searchParams.set('task', job.task_id)
      actionUrl = url.href
    } catch {
      // keep default URL
    }
    const outcome = await sendSingleEmail(settings, {
      to: job.email,
      subject: job.subject,
      body: job.body,
      actionUrl,
    })
    results.push({
      id: job.id,
      lease_id: job.lease_id,
      email: job.email,
      delivered: outcome.delivered,
      detail: outcome.detail,
    })
  }
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

