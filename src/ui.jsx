import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Check,
  CheckSquare2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock3,
  Eye,
  EyeOff,
  Flag,
  Plus,
  X,
} from 'lucide-react'
import {
  capitalize,
  dateKey,
  fullDate,
  initials,
  longDay,
  parseDay,
  priorities,
  statuses,
  todayInVietnam,
} from './model.js'

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
export function PasswordInput(props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-input-wrap">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle-btn"
        tabIndex={-1}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        onClick={() => setVisible((prev) => !prev)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
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
export function DatePicker({
  value = '',
  time = '09:00',
  withTime = false,
  min = '',
  disabled = false,
  required = false,
  onChange,
  onTimeChange,
  align = 'left',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const today = todayInVietnam()
  const baseDate = value ? parseDay(value) : parseDay(today)
  const [viewYear, setViewYear] = useState(() => baseDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => baseDate.getMonth())

  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
  const [hour, minute] = safeTime.split(':')
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, '0'),
  )

  useEffect(() => {
    if (value) {
      const parsed = parseDay(value)
      if (!Number.isNaN(parsed.getTime())) {
        setViewYear(parsed.getFullYear())
        setViewMonth(parsed.getMonth())
      }
    }
  }, [value])

  useEffect(() => {
    if (!open) return
    const handlePointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function shiftMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = firstOfMonth.getDay() // Sunday = 0 .. Saturday = 6
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset)
  const cells = Array.from({ length: 42 }, (_, index) => {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    )
    const key = dateKey(d)
    return {
      key,
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth,
      isToday: key === today,
      isSelected: key === value,
      isDisabled: Boolean(min && key < min),
    }
  })

  const headerDate = value ? parseDay(value) : parseDay(today)
  const headerLabel = capitalize(longDay.format(headerDate))
  const monthNames = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
  ]
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

  return (
    <div
      ref={ref}
      className={
        'datepicker' +
        (disabled ? ' is-disabled' : '') +
        (align === 'right' ? ' align-right' : '')
      }
    >
      <button
        type="button"
        disabled={disabled}
        className={'datepicker-trigger' + (open ? ' is-open' : '')}
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
      >
        <span className={value ? 'datepicker-value' : 'datepicker-placeholder'}>
          {value ? (
            <>
              <span>{fullDate(value)}</span>
              {withTime && (
                <span className="datepicker-time-chip">
                  <Clock3 size={12} />
                  {safeTime}
                </span>
              )}
            </>
          ) : withTime ? (
            'dd/mm/yyyy · --:--'
          ) : (
            'dd/mm/yyyy'
          )}
        </span>
        <CalendarIcon size={16} className="datepicker-icon" />
      </button>
      {required && (
        <input
          tabIndex={-1}
          className="sr-only"
          required={required}
          value={value}
          onChange={() => {}}
          aria-hidden="true"
        />
      )}
      {open && !disabled && (
        <div
          className="datepicker-popover"
          role="dialog"
          aria-label="Chọn ngày và giờ"
        >
          <div className="datepicker-top">
            <strong>{headerLabel}</strong>
            <button
              type="button"
              className="datepicker-today-btn"
              disabled={Boolean(min && today < min)}
              onClick={() => {
                if (min && today < min) return
                onChange?.(today)
                if (!withTime) setOpen(false)
              }}
            >
              Hôm nay
            </button>
          </div>
          <div className="datepicker-body">
            <div className="datepicker-nav">
              <span className="datepicker-month-title">
                {monthNames[viewMonth]}, {viewYear}
              </span>
              <div className="datepicker-nav-btns">
                <button
                  type="button"
                  className="datepicker-nav-btn"
                  aria-label="Tháng trước"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="datepicker-nav-btn"
                  aria-label="Tháng sau"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <div className="datepicker-weekdays">
              {weekdays.map((dayName) => (
                <span key={dayName}>{dayName}</span>
              ))}
            </div>
            <div className="datepicker-grid">
              {cells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  disabled={cell.isDisabled}
                  className={
                    'datepicker-day' +
                    (cell.inMonth ? '' : ' is-outside') +
                    (cell.isToday ? ' is-today' : '') +
                    (cell.isSelected ? ' is-selected' : '')
                  }
                  onClick={() => {
                    onChange?.(cell.key)
                    if (!withTime) setOpen(false)
                  }}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </div>
          {withTime && (
            <div className="datepicker-time-bar">
              <span className="datepicker-time-label">
                <Clock3 size={14} />
                <span>Giờ phút</span>
              </span>
              <div className="datepicker-time-controls">
                <select
                  aria-label="Giờ"
                  className="datepicker-time-select"
                  value={hour}
                  onChange={(event) => {
                    if (!value) onChange?.(today)
                    onTimeChange?.(`${event.target.value}:${minute}`)
                  }}
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="datepicker-time-sep">:</span>
                <select
                  aria-label="Phút"
                  className="datepicker-time-select"
                  value={minute}
                  onChange={(event) => {
                    if (!value) onChange?.(today)
                    onTimeChange?.(`${hour}:${event.target.value}`)
                  }}
                >
                  {minutes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="datepicker-done-btn"
                  onClick={() => setOpen(false)}
                >
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
