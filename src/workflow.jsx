import { useEffect, useState } from 'react'
import {
  Bell,
  CalendarClock,
  Check,
  Copy,
  Mail,
  RefreshCw,
  Send,
  Settings,
  UserRoundPlus,
} from 'lucide-react'
import {
  DatePicker,
  Dialog,
  ErrorText,
  PasswordInput,
  readableError,
} from './ui.jsx'
import {
  fullDate,
  overdue,
  shortDateTime,
  shiftDay,
  parseDay,
} from './model.js'

const extensionStatus = {
  pending: ['Chờ quản lý phê duyệt', 'amber'],
  approved: ['Đã phê duyệt', 'green'],
  rejected: ['Từ chối', 'gray'],
  cancelled: ['Đã đóng', 'gray'],
}

export function DeadlineExtension({
  task,
  repo,
  today,
  manager,
  members,
  onPending,
  onUpdated,
}) {
  const assigned = task.assignee_ids?.includes(repo.user.id)
  const isOverdue = overdue(task, today)
  const canRequest = isOverdue
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [nextDue, setNextDue] = useState(() => shiftDay(1, parseDay(today)))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState('')
  const pending = requests.find((item) => item.status === 'pending')

  useEffect(() => {
    let active = true
    repo
      .listExtensions(task)
      .then((rows) => {
        if (active) setRequests(rows)
      })
      .catch((error) => {
        if (active) setError(readableError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [task.id, repo, manager, assigned])
  useEffect(() => {
    onPending?.(Boolean(pending))
  }, [pending])

  async function submit() {
    if (busy || !reason.trim() || !nextDue) return
    setBusy(true)
    setError('')
    try {
      const request = await repo.requestExtension(task, nextDue, reason.trim())
      setRequests((current) => [request, ...current])
      onUpdated({ ...task, extension_pending: true })
      setAsking(false)
      setReason('')
    } catch (error) {
      setError(readableError(error))
    } finally {
      setBusy(false)
    }
  }

  async function review(approve) {
    if (busy || !pending || (!approve && !note.trim())) return
    setBusy(true)
    setError('')
    try {
      const result = await repo.reviewExtension(
        pending,
        approve,
        note.trim() || null,
      )
      setRequests((current) =>
        current.map((request) =>
          request.id === result.request.id ? result.request : request,
        ),
      )
      setRejecting(false)
      setNote('')
      onUpdated(result.task)
    } catch (error) {
      setError(readableError(error))
    } finally {
      setBusy(false)
    }
  }

  if (!loading && !canRequest && !requests.length && !error) return null
  return (
    <section className="task-relations extension-section">
      <header>
        <h3>
          <CalendarClock size={16} /> Gia hạn công việc
          {isOverdue && (
            <span
              className="badge amber"
              title={'Quá hạn so với hôm nay ' + fullDate(today)}
            >
              Quá hạn
            </span>
          )}
        </h3>
        {canRequest && !pending && !asking && !loading && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setAsking(true)}
          >
            Yêu cầu gia hạn
          </button>
        )}
      </header>
      {loading && <p className="muted">Đang tải yêu cầu gia hạn…</p>}
      <ErrorText message={error} />
      {asking && !pending && (
        <div className="extension-form">
          <div className="datepicker-field">
            <span className="field-label">Ngày muốn điều chỉnh</span>
            <DatePicker
              required
              value={nextDue}
              min={today}
              onChange={(val) => setNextDue(val)}
            />
          </div>
          <label>
            Nội dung yêu cầu gia hạn
            <textarea
              required
              rows={2}
              maxLength={1000}
              placeholder="Nhập lý do và nội dung xin gia hạn…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy || !reason.trim() || !nextDue}
              onClick={submit}
            >
              Gửi yêu cầu
            </button>
          </div>
        </div>
      )}
      {requests.map((request) => {
        const [label, color] = extensionStatus[request.status]
        const author = members.find(
          (member) => member.user_id === request.requested_by,
        )?.display_name
        return (
          <article className="extension-request" key={request.id}>
            <div className="extension-request-heading">
              <strong>
                {fullDate(request.previous_due_date)} →{' '}
                {fullDate(request.requested_due_date)}
              </strong>
              <span className={'badge ' + color}>{label}</span>
            </div>
            {author && (
              <p className="muted">
                {author} · {shortDateTime.format(new Date(request.created_at))}
              </p>
            )}
            <p>{request.reason}</p>
            {request.decision_note && (
              <p className="decision-note">
                <strong>Phản hồi</strong> {request.decision_note}
              </p>
            )}
            {manager && request.status === 'pending' && (
              <div className="extension-form">
                {rejecting && (
                  <label>
                    Lý do từ chối
                    <textarea
                      required
                      rows={2}
                      maxLength={1000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                )}
                <div className="form-actions">
                  {rejecting ? (
                    <>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          setRejecting(false)
                          setNote('')
                        }}
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        className="button danger"
                        disabled={busy || !note.trim()}
                        onClick={() => review(false)}
                      >
                        Xác nhận từ chối
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setRejecting(true)}
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        className="button primary"
                        disabled={busy}
                        onClick={() => review(true)}
                      >
                        <Check size={15} /> Phê duyệt gia hạn
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}

export function AccountDialog({
  team,
  repo,
  member,
  onClose,
  onCreated,
  onUpdated,
}) {
  const editing = Boolean(member)
  const isDemo = repo.mode === 'demo'
  const [name, setName] = useState(member?.display_name || '')
  const [email, setEmail] = useState(member?.email || '')
  const [department, setDepartment] = useState(member?.department || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requirePassword = !editing
  const minPassLen = 6
  async function submit(event) {
    event.preventDefault()
    if (busy || !name.trim() || !email.trim()) return
    if (requirePassword || password.trim()) {
      if (!password.trim() || password.length < minPassLen) {
        setError('Mật khẩu phải có ít nhất ' + minPassLen + ' ký tự.')
        return
      }
      if (new TextEncoder().encode(password).length > 72) {
        setError('Mật khẩu quá dài. Hãy dùng mật khẩu ngắn hơn.')
        return
      }
      if (password !== confirmation) {
        setError('Mật khẩu xác nhận chưa khớp.')
        return
      }
    }
    setBusy(true)
    setError('')
    try {
      if (editing) {
        const updated = await repo.updateMember(team, member.user_id, {
          display_name: name.trim(),
          email: email.trim(),
          department: department.trim(),
          ...(password.trim() ? { password } : {}),
        })
        onUpdated(updated)
      } else {
        onCreated(
          await repo.createMember(
            team,
            name.trim(),
            email.trim(),
            password,
            department.trim(),
          ),
        )
      }
    } catch (error) {
      setError(readableError(error))
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={editing ? 'Chỉnh sửa thành viên' : 'Thêm thành viên'}
      description={
        editing
          ? 'Cập nhật thông tin họ tên, email, phòng ban và mật khẩu của thành viên.'
          : 'Nhập thông tin và thiết lập mật khẩu đăng nhập cho thành viên mới.'
      }
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={submit}>
        <label>
          Họ và tên
          <input
            required
            autoFocus
            maxLength={80}
            placeholder="Nhập họ và tên…"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            maxLength={254}
            placeholder="ten@congty.vn"
            value={email}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Phòng ban
          <input
            maxLength={120}
            placeholder="VD: Product & CX, Kỹ thuật, Thiết kế…"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
        </label>
        <label>
          <span id="member-password-label">
            {editing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu'}
          </span>
          <PasswordInput
            required={requirePassword}
            minLength={minPassLen}
            maxLength={72}
            placeholder={
              editing
                ? 'Nhập mật khẩu mới nếu muốn đổi…'
                : 'Nhập mật khẩu đăng nhập…'
            }
            autoComplete="new-password"
            aria-labelledby="member-password-label"
            aria-describedby="member-password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small id="member-password-hint" className="muted field-hint">
            Dùng ít nhất {minPassLen} ký tự.
          </small>
        </label>
        {(requirePassword || password.length > 0) && (
          <label>
            Xác nhận mật khẩu
            <PasswordInput
              required={requirePassword || password.length > 0}
              maxLength={72}
              placeholder="Nhập lại mật khẩu…"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        )}
        <ErrorText message={error} />
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !name.trim() ||
              !email.trim() ||
              (requirePassword && (!password || !confirmation)) ||
              (password.length > 0 && !confirmation)
            }
          >
            {!editing && <UserRoundPlus size={16} />}
            {busy
              ? 'Đang lưu…'
              : editing
                ? 'Lưu thay đổi'
                : 'Thêm thành viên'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

const GOOGLE_APPS_SCRIPT_SNIPPET = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  MailApp.sendEmail({
    to: data.to,
    subject: data.subject,
    body: data.text,
    htmlBody: data.html,
    name: data.senderName || 'Nhịp việc'
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`

export function EmailDemoDialog({
  repo,
  tasks = [],
  onOpenTask,
  onClose,
  onReadAll,
}) {
  const [tab, setTab] = useState('inbox')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [configured, setConfigured] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [settings, setSettings] = useState({
    provider: 'smtp',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_user: '',
    smtp_pass: '',
    sender_name: 'Nhịp việc',
    sender_email: '',
    resend_api_key: '',
    webhook_url: '',
    enabled: true,
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [notifData, cfgData] = await Promise.all([
        repo.listNotifications(),
        repo.getEmailSettings(),
      ])
      setItems(notifData?.items || [])
      setConfigured(Boolean(notifData?.email_configured))
      if (cfgData) {
        setSettings((prev) => ({ ...prev, ...cfgData }))
      }
      await repo.markNotificationsRead()
      onReadAll?.()
    } catch (err) {
      setError(readableError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [repo])

  async function handleSaveSettings(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const saved = await repo.saveEmailSettings(settings)
      setSettings((prev) => ({ ...prev, ...saved }))
      const res = await repo.dispatchPendingEmails()
      await loadAll()
      setFeedback(
        res?.sent > 0
          ? `Đã lưu cấu hình và gửi thành công ${res.sent} email trong hàng đợi.`
          : 'Đã lưu cấu hình gửi email tự động.',
      )
    } catch (err) {
      setError(readableError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleTestEmail() {
    if (testing) return
    setTesting(true)
    setError('')
    setFeedback('')
    try {
      await repo.saveEmailSettings(settings)
      await repo.sendTestEmail(settings, repo.user.email)
      setFeedback(
        'Đã gửi email kiểm tra thành công tới ' +
          repo.user.email +
          '! Hãy kiểm tra hộp thư đến (hoặc mục Quảng cáo/Spam).',
      )
    } catch (err) {
      setError(readableError(err))
    } finally {
      setTesting(false)
    }
  }

  async function handleDispatchNow() {
    if (dispatching) return
    setDispatching(true)
    setError('')
    setFeedback('')
    try {
      const res = await repo.dispatchPendingEmails()
      await loadAll()
      if (!res?.configured) {
        setTab('settings')
        setError('Hãy cấu hình tài khoản gửi Email trước khi gửi hàng đợi.')
      } else if (res.sent > 0) {
        setFeedback(`Đã gửi thành công ${res.sent} email tới hộp thư.`)
      } else if (res.failed > 0) {
        setError(
          `Không thể gửi ${res.failed} email. Hãy kiểm tra lại thông tin cấu hình Email.`,
        )
      } else {
        setFeedback('Tất cả thông báo đều đã được gửi.')
      }
    } catch (err) {
      setError(readableError(err))
    } finally {
      setDispatching(false)
    }
  }

  const pendingCount = items.filter((item) => !item.sent_at).length

  return (
    <Dialog
      title="Thông báo & Email tự động"
      description={
        'Tài khoản nhận thông báo: ' + (repo.user.email || repo.user.name)
      }
      wide
      tabs={
        <div className="dialog-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'inbox'}
            className={tab === 'inbox' ? 'active' : ''}
            onClick={() => {
              setTab('inbox')
              setError('')
              setFeedback('')
            }}
          >
            <Bell size={15} /> Hộp thư ({items.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'settings'}
            className={tab === 'settings' ? 'active' : ''}
            onClick={() => {
              setTab('settings')
              setError('')
              setFeedback('')
            }}
          >
            <Settings size={15} /> Cấu hình gửi Email thật
          </button>
        </div>
      }
      onClose={onClose}
    >
      {tab === 'inbox' ? (
        <div className="email-center-body">
          <div className="email-center-banner">
            <div>
              <strong>
                {configured
                  ? 'Đã bật gửi Email tự động cho mọi thao tác'
                  : 'Chưa cấu hình máy chủ gửi Email ra hộp thư ngoài'}
              </strong>
              <p className="muted">
                {configured
                  ? 'Mọi thao tác thêm, sửa, xóa, đổi trạng thái, bình luận và gia hạn đều tự động gửi email về tài khoản.'
                  : 'Các thông báo đang được ghi nhận tại đây. Bấm "Cấu hình gửi Email" để đẩy thông báo về hộp thư ' +
                    (repo.user.email || 'email của bạn') +
                    '.'}
              </p>
            </div>
            <div className="email-center-banner-actions">
              {!configured ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setTab('settings')}
                >
                  <Settings size={15} /> Cấu hình gửi Email
                </button>
              ) : (
                pendingCount > 0 && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={dispatching}
                    onClick={handleDispatchNow}
                  >
                    <RefreshCw size={15} />{' '}
                    {dispatching
                      ? 'Đang gửi…'
                      : `Gửi ngay (${pendingCount} chờ)`}
                  </button>
                )
              )}
            </div>
          </div>

          <ErrorText message={error} />
          {feedback && <p className="email-feedback-success">{feedback}</p>}

          <div className="demo-mailbox">
            {loading && <p className="muted">Đang tải thông báo…</p>}
            {!loading && !items.length && (
              <p className="muted">Chưa có thông báo nào.</p>
            )}
            {items.map((message) => {
              const linkedTask =
                message.task_id &&
                tasks.find((item) => item.id === message.task_id)
              return (
                <article
                  key={message.id}
                  className={
                    'email-log-item' + (linkedTask ? ' is-clickable' : '')
                  }
                  onClick={() => {
                    if (linkedTask && onOpenTask) {
                      onOpenTask(linkedTask)
                    }
                  }}
                >
                  <Mail size={17} />
                  <div className="email-log-content">
                    <div className="email-log-header">
                      <strong>{message.subject}</strong>
                      {message.sent_at ? (
                        <span className="badge green">Đã gửi tới email</span>
                      ) : message.last_error ? (
                        <span
                          className="badge red-badge"
                          title={message.last_error}
                        >
                          Lỗi gửi mail
                        </span>
                      ) : (
                        <span className="badge amber">Chờ gửi mail</span>
                      )}
                    </div>
                    <p>{message.body}</p>
                    {message.last_error && !message.sent_at && (
                      <small className="email-error-detail">
                        Chi tiết lỗi: {message.last_error}
                      </small>
                    )}
                    <div className="email-log-footer">
                      <time dateTime={message.created_at}>
                        {shortDateTime.format(new Date(message.created_at))}
                        {message.recipient_email
                          ? ' · Tới: ' + message.recipient_email
                          : ''}
                      </time>
                      {linkedTask && (
                        <span className="email-open-task">
                          Xem công việc →
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : (
        <form className="dialog-form" onSubmit={handleSaveSettings}>
          <div className="email-provider-tabs">
            {[
              ['smtp', 'Gmail / SMTP (Khuyên dùng)'],
              ['google_script', 'Google Script (Không cần mật khẩu)'],
              ['resend', 'Resend API'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={settings.provider === key ? 'active' : ''}
                onClick={() =>
                  setSettings((prev) => ({ ...prev, provider: key }))
                }
              >
                {label}
              </button>
            ))}
          </div>

          {settings.provider === 'smtp' && (
            <div className="email-settings-box">
              <p className="field-hint muted">
                Nhập tài khoản Gmail (hoặc SMTP công ty) để gửi thông báo tới{' '}
                <strong>mọi địa chỉ email</strong> (kể cả{' '}
                <code>@mbbank.com.vn</code>, <code>@gmail.com</code>). Với Gmail,
                hãy bật xác minh 2 bước và tạo{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                >
                  Mật khẩu ứng dụng (16 ký tự)
                </a>
                .
              </p>
              <div className="form-grid">
                <label>
                  Máy chủ SMTP (Host)
                  <input
                    required
                    value={settings.smtp_host}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        smtp_host: e.target.value,
                      }))
                    }
                    placeholder="smtp.gmail.com"
                  />
                </label>
                <label>
                  Cổng (Port)
                  <input
                    required
                    type="number"
                    value={settings.smtp_port}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        smtp_port: Number(e.target.value) || 465,
                      }))
                    }
                    placeholder="465"
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Email tài khoản gửi (SMTP User)
                  <input
                    required
                    type="email"
                    value={settings.smtp_user}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        smtp_user: e.target.value,
                        sender_email: prev.sender_email || e.target.value,
                      }))
                    }
                    placeholder="tenban@gmail.com"
                  />
                </label>
                <label>
                  Mật khẩu ứng dụng (App Password)
                  <PasswordInput
                    required={!settings.smtp_pass}
                    value={settings.smtp_pass}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        smtp_pass: e.target.value,
                      }))
                    }
                    placeholder="Nhập mật khẩu ứng dụng 16 ký tự…"
                  />
                </label>
              </div>
              <label>
                Tên hiển thị người gửi
                <input
                  value={settings.sender_name}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      sender_name: e.target.value,
                    }))
                  }
                  placeholder="Nhịp việc"
                />
              </label>
            </div>
          )}

          {settings.provider === 'google_script' && (
            <div className="email-settings-box">
              <p className="field-hint muted">
                Cách gửi qua Gmail miễn phí 100% mà{' '}
                <strong>không cần tạo Mật khẩu ứng dụng</strong>:
                <br />
                1. Mở{' '}
                <a
                  href="https://script.google.com/home/start"
                  target="_blank"
                  rel="noreferrer"
                >
                  script.google.com
                </a>{' '}
                → bấm <strong>Dự án mới</strong> → dán đoạn mã bên dưới vào.
                <br />
                2. Bấm <strong>Triển khai (Deploy) → Tệp triển khai mới</strong>{' '}
                → Chọn loại <strong>Ứng dụng web (Web App)</strong>, mục{' '}
                <em>Ai có quyền truy cập</em> chọn <strong>Bất kỳ ai (Anyone)</strong>{' '}
                → Sao chép URL dán vào ô bên dưới.
              </p>
              <div className="script-snippet-box">
                <pre>{GOOGLE_APPS_SCRIPT_SNIPPET}</pre>
                <button
                  type="button"
                  className="button secondary script-copy-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(GOOGLE_APPS_SCRIPT_SNIPPET)
                    setCopiedScript(true)
                    setTimeout(() => setCopiedScript(false), 2000)
                  }}
                >
                  {copiedScript ? <Check size={14} /> : <Copy size={14} />}{' '}
                  {copiedScript ? 'Đã sao chép mã' : 'Sao chép mã'}
                </button>
              </div>
              <label>
                URL Ứng dụng Web (Google Apps Script Webhook URL)
                <input
                  required
                  type="url"
                  value={settings.webhook_url}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      webhook_url: e.target.value,
                    }))
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
              </label>
            </div>
          )}

          {settings.provider === 'resend' && (
            <div className="email-settings-box">
              <p className="field-hint muted">
                Sử dụng dịch vụ Resend (<code>api.resend.com</code>). Lưu ý: Để
                gửi tới nhiều email khác nhau trong công ty, bạn cần xác minh tên
                miền gửi trong Resend.
              </p>
              <label>
                Resend API Key
                <PasswordInput
                  required={!settings.resend_api_key}
                  value={settings.resend_api_key}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      resend_api_key: e.target.value,
                    }))
                  }
                  placeholder="re_..."
                />
              </label>
              <div className="form-grid">
                <label>
                  Địa chỉ Email gửi (From)
                  <input
                    required
                    value={settings.sender_email}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sender_email: e.target.value,
                      }))
                    }
                    placeholder="thongbao@tenmien.com"
                  />
                </label>
                <label>
                  Tên hiển thị người gửi
                  <input
                    value={settings.sender_name}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sender_name: e.target.value,
                      }))
                    }
                    placeholder="Nhịp việc"
                  />
                </label>
              </div>
            </div>
          )}

          <ErrorText message={error} />
          {feedback && <p className="email-feedback-success">{feedback}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={saving || testing}
              onClick={handleTestEmail}
            >
              <Send size={15} />{' '}
              {testing
                ? 'Đang gửi thử…'
                : 'Gửi thử tới ' + (repo.user.email || 'email của tôi')}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={saving || testing}
            >
              <Check size={16} />{' '}
              {saving ? 'Đang lưu & gửi…' : 'Lưu cấu hình & Gửi hàng đợi'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
