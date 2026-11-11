import { useEffect, useRef } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckSquare2,
  ChevronDown,
  CircleDashed,
  Flag,
  Plus,
  X,
} from 'lucide-react'
import { initials, priorities, statuses } from './model.js'

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <CheckSquare2 size={20} strokeWidth={2.3} />
      </span>
      <span>
        nhịp việc<span className="brand-period">.</span>
      </span>
    </div>
  )
}
export function Avatar({ name, id = '', size = '' }) {
  const tone = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5
  return (
    <span
      className={'avatar tone-' + tone + ' ' + size}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}
export function StatusBadge({ status }) {
  const item = statuses[status]
  return (
    <span className={'badge ' + item.color}>
      <span className="status-dot" />
      {item.label}
    </span>
  )
}
export function Priority({ priority }) {
  const item = priorities[priority]
  return (
    <span className={'priority ' + item.color}>
      <Flag size={13} strokeWidth={2} />
      {item.label}
    </span>
  )
}
export function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )
}
export function ErrorText({ message }) {
  return message ? (
    <p className="error" role="alert">
      <AlertCircle size={16} />
      {message}
    </p>
  ) : null
}
export function readableError(error) {
  if (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === 'PGRST200' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST202'
  )
    return 'Chưa tìm thấy cấu trúc dữ liệu. Hãy chạy migration trong SQL Editor của Supabase.'
  if (error?.code === '42501')
    return 'Tài khoản hiện tại không có quyền thực hiện thao tác này.'
  if (error?.code === '23503' && error.message.includes('work_tasks_parent_fk'))
    return 'Việc cấp trên phải là L1 trong cùng phạm vi. Nếu việc đang có cấp dưới, hãy chuyển các việc con trước.'
  if (
    error?.code === '23503' &&
    error.message.includes('work_task_assignees_team_fk')
  )
    return 'Chỉ có thể giao việc cho thành viên của nhóm này.'
  if (error?.code === '23503')
    return 'Công việc liên quan hoặc người thực hiện đã thay đổi. Hãy tải lại danh sách và chọn lại.'
  if (error?.code === '23514')
    return 'Một trường thông tin chưa hợp lệ. Hãy kiểm tra lại nội dung công việc.'
  if (
    error?.message === 'Failed to fetch' ||
    error?.name === 'AuthRetryableFetchError'
  )
    return 'Không thể kết nối. Hãy kiểm tra mạng và cấu hình Supabase.'
  return error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.'
}
export function Dialog({
  title,
  description,
  tabs,
  onClose,
  children,
  wide = false,
}) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    dialog.querySelector('form input:enabled')?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={'dialog' + (wide ? ' dialog-wide' : '')}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="dialog-header">
        <div className="dialog-header-top">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Đóng" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {tabs}
      </header>
      {children}
    </dialog>
  )
}
export function Empty({ title, detail, onAdd, action = 'Tạo công việc' }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <CircleDashed size={22} />
      </span>
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
      {onAdd && (
        <button className="button secondary" onClick={onAdd}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  )
}
export function Dropdown({ label, children, trigger, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target))
        ref.current?.removeAttribute('open')
    }
    const escape = (event) => {
      if (event.key === 'Escape' && ref.current?.open) ref.current.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (
    <details ref={ref} className={'dropdown ' + className}>
      <summary aria-label={label}>
        {trigger}
        <ChevronDown className="dropdown-chevron" size={15} />
      </summary>
      <div className="dropdown-panel">
        {children(() => {
          ref.current.open = false
        })}
      </div>
    </details>
  )
}
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <i className="orbit orbit-1" />
      <i className="orbit orbit-2" />
      <i className="orbit orbit-3" />
      <i className="spark spark-1" />
      <i className="spark spark-2" />
      <i className="spark spark-3" />
      <div className="art-tile">
        <i />
        <i />
        <i />
      </div>
      <div className="art-check">
        <Check size={20} strokeWidth={2.8} />
      </div>
      <div className="art-arrow">
        <ArrowUpRight size={17} strokeWidth={2.6} />
      </div>
    </div>
  )
}
