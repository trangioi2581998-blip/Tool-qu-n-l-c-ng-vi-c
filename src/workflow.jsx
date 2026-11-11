import { useEffect, useState } from 'react'
import { CalendarClock, Check, Mail, UserRoundPlus } from 'lucide-react'
import { Dialog, ErrorText, readableError } from './ui.jsx'
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
          {isOverdue && <span className="badge amber">Quá hạn</span>}
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
          <label>
            Ngày muốn điều chỉnh
            <input
              required
              type="date"
              value={nextDue}
              min={today}
              onChange={(event) => setNextDue(event.target.value)}
            />
          </label>
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
  const minPassLen = isDemo ? 6 : 8
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
          <input
            required={requirePassword}
            type="password"
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
            <input
              required={requirePassword || password.length > 0}
              type="password"
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

export function EmailDemoDialog({ repo, onClose }) {
  const messages = repo.demoEmails()
  return (
    <Dialog
      title="Email mô phỏng"
      description={'Thông báo dành cho ' + repo.user.name + ' trong bản demo.'}
      wide
      onClose={onClose}
    >
      <div className="demo-mailbox">
        {!messages.length && <p className="muted">Chưa có thông báo email.</p>}
        {messages.map((message) => (
          <article key={message.id}>
            <Mail size={16} />
            <div>
              <strong>{message.subject}</strong>
              <p>{message.body}</p>
              <time dateTime={message.created_at}>
                {shortDateTime.format(new Date(message.created_at))}
              </time>
            </div>
          </article>
        ))}
      </div>
    </Dialog>
  )
}
