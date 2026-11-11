export const taskLevels = {
  1: 'L1 · Việc chính',
  2: 'L2 · Việc con',
}

export function taskLevelCode(task) {
  return task.level === 2 && task.sibling_no
    ? 'L2.' + task.sibling_no
    : 'L' + task.level
}

export function taskCompletionError(status, parent, children = []) {
  if (status === 'done' && children.some((child) => child.status !== 'done'))
    return 'Cần hoàn thành tất cả việc con trước khi hoàn thành việc chính.'
  return ''
}

export const statuses = {
  todo: { label: 'Cần làm', color: 'gray' },
  doing: { label: 'Đang làm', color: 'purple' },
  review: { label: 'Chờ duyệt', color: 'amber' },
  done: { label: 'Hoàn thành', color: 'green' },
}
export const priorities = {
  high: { label: 'Cao', color: 'red' },
  medium: { label: 'Vừa', color: 'amber' },
  low: { label: 'Thấp', color: 'blue' },
}
export const longDay = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
export const shortDateTime = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
export const parseDay = (value) => new Date(value + 'T00:00:00')
export const dateKey = (d = new Date()) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
const vietnamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export function todayInVietnam(value = new Date()) {
  const parts = Object.fromEntries(
    vietnamDate.formatToParts(value).map((part) => [part.type, part.value]),
  )
  return [parts.year, parts.month, parts.day].join('-')
}
export const fullDate = (value) =>
  value ? value.split('-').reverse().join('/') : 'Chưa đặt'

export function shiftDay(offset, start = new Date()) {
  const d = new Date(start)
  d.setDate(d.getDate() + offset)
  return dateKey(d)
}
export const initials = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
export const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
export const capitalize = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1)
export const overdue = (task, today) =>
  Boolean(task.due_date && task.due_date < today && task.status !== 'done')
export function dueLabel(value, today) {
  if (!value) return 'Chưa đặt hạn'
  if (value === today) return 'Hôm nay'
  if (value === shiftDay(1, parseDay(today))) return 'Ngày mai'
  return value.slice(8, 10) + '/' + value.slice(5, 7)
}
export const byDeadline = (a, b) =>
  (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
  b.created_at.localeCompare(a.created_at)
