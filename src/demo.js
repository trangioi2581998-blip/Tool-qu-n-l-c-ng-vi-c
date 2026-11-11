import {
  fullDate,
  overdue,
  parseDay,
  shiftDay,
  statuses,
  taskCompletionError,
  todayInVietnam,
} from './model.js'
import {
  hasDemoAttachments,
  listDemoAttachments,
  putDemoAttachment,
  readDemoAttachment,
  removeDemoAttachment,
} from './demo-attachments.js'

const storageKey = 'nhip-viec.demo.v1'
const sessionKey = 'nhip-viec.demo.session'
const baseAccounts = [
  {
    id: 'demo-me',
    name: 'Trần Quý',
    email: 'quy@congty.vn',
    password: '123456',
    department: 'Product & CX',
    roleLabel: 'Trưởng nhóm',
  },
  {
    id: 'demo-linh',
    name: 'Mai Linh',
    email: 'linh@congty.vn',
    password: '123456',
    department: 'Thiết kế (UI/UX)',
    roleLabel: 'Nhân viên',
  },
  {
    id: 'demo-an',
    name: 'Hoàng An',
    email: 'an@congty.vn',
    password: '123456',
    department: 'Kỹ thuật (Dev)',
    roleLabel: 'Nhân viên',
  },
  {
    id: 'demo-thao',
    name: 'Minh Thảo',
    email: 'thao@congty.vn',
    password: '123456',
    department: 'Chăm sóc khách hàng',
    roleLabel: 'Nhân viên',
  },
]
const [me] = baseAccounts
const defaultTeam = 'demo-team'
const defaultMemberMeta = {
  [me.id]: { email: 'quy@congty.vn', department: 'Product & CX' },
  'demo-linh': { email: 'linh@congty.vn', department: 'Thiết kế (UI/UX)' },
  'demo-an': { email: 'an@congty.vn', department: 'Kỹ thuật (Dev)' },
  'demo-thao': { email: 'thao@congty.vn', department: 'Chăm sóc khách hàng' },
}
const members = [
  {
    user_id: me.id,
    display_name: me.name,
    email: 'quy@congty.vn',
    department: 'Product & CX',
    role: 'owner',
  },
  {
    user_id: 'demo-linh',
    display_name: 'Mai Linh',
    email: 'linh@congty.vn',
    department: 'Thiết kế (UI/UX)',
    role: 'member',
  },
  {
    user_id: 'demo-an',
    display_name: 'Hoàng An',
    email: 'an@congty.vn',
    department: 'Kỹ thuật (Dev)',
    role: 'member',
  },
  {
    user_id: 'demo-thao',
    display_name: 'Minh Thảo',
    email: 'thao@congty.vn',
    department: 'Chăm sóc khách hàng',
    role: 'member',
  },
]
function defaultTaskReportMeta(today) {
  return {
    'demo-task-1': {
      assigned_on: shiftDay(-2, today),
      previous_status: 'todo',
      status_updated_at: shiftDay(0, today),
    },
    'demo-task-2': {
      assigned_on: shiftDay(-2, today),
      previous_status: 'todo',
      status_updated_at: shiftDay(-1, today),
    },
    'demo-task-3': {
      assigned_on: shiftDay(-6, today),
      previous_status: 'doing',
      status_updated_at: shiftDay(-1, today),
    },
    'demo-task-4': {
      assigned_on: shiftDay(-7, today),
      previous_status: 'todo',
      status_updated_at: shiftDay(-2, today),
    },
    'demo-task-5': {
      assigned_on: shiftDay(-1, today),
      previous_status: null,
      status_updated_at: shiftDay(-1, today),
    },
    'demo-task-6': {
      assigned_on: shiftDay(-8, today),
      previous_status: 'review',
      status_updated_at: shiftDay(-2, today),
    },
    'demo-task-7': {
      assigned_on: shiftDay(-12, today),
      previous_status: null,
      status_updated_at: shiftDay(-12, today),
    },
    'demo-task-8': {
      assigned_on: shiftDay(-13, today),
      previous_status: 'doing',
      status_updated_at: shiftDay(-5, today),
    },
    'demo-task-9': {
      assigned_on: shiftDay(-6, today),
      previous_status: 'todo',
      status_updated_at: shiftDay(-1, today),
    },
    'demo-task-10': {
      assigned_on: shiftDay(0, today),
      previous_status: null,
      status_updated_at: shiftDay(0, today),
    },
    'demo-task-11': {
      assigned_on: shiftDay(-7, today),
      previous_status: 'doing',
      status_updated_at: shiftDay(-1, today),
    },
  }
}

function defaultDeletedTasks(today) {
  return [
    {
      id: 'demo-deleted-1',
      title: 'Khảo sát giao diện thanh toán cũ',
      team_id: defaultTeam,
      status: 'deleted',
      previous_status: 'doing',
      priority: 'low',
      assignee_ids: [me.id, 'demo-linh'],
      assigned_by: me.id,
      created_by: me.id,
      assigned_on: shiftDay(-7, today),
      due_date: shiftDay(-1, today),
      deleted_at: shiftDay(-1, today),
    },
    {
      id: 'demo-deleted-2',
      title: 'Tạo banner thử nghiệm mùa lễ',
      team_id: defaultTeam,
      status: 'deleted',
      previous_status: 'todo',
      priority: 'medium',
      assignee_ids: ['demo-linh'],
      assigned_by: me.id,
      created_by: me.id,
      assigned_on: shiftDay(-13, today),
      due_date: shiftDay(-6, today),
      deleted_at: shiftDay(-6, today),
    },
  ]
}

function seed() {
  const now = new Date().toISOString()
  const today = parseDay(todayInVietnam())
  const reportMeta = defaultTaskReportMeta(today)
  const samples = [
    [
      'Tổng hợp phản hồi khách hàng tuần này',
      defaultTeam,
      'doing',
      'high',
      0,
      me.id,
      'Gom phản hồi theo nhóm vấn đề, đính kèm ví dụ và xác định các điểm cần ưu tiên xử lý.',
    ],
    [
      'Rà soát luồng đăng nhập trên mobile',
      defaultTeam,
      'todo',
      'high',
      -1,
      me.id,
      'Kiểm tra thông báo lỗi và bước khôi phục khi khách hàng nhập sai thông tin.',
    ],
    [
      'Hoàn thiện kịch bản phỏng vấn khách hàng',
      defaultTeam,
      'review',
      'medium',
      1,
      me.id,
      'Chuẩn bị câu hỏi mở và các câu hỏi đào sâu theo từng nhóm người tham gia.',
    ],
    [
      'Cập nhật component trạng thái giao dịch',
      defaultTeam,
      'doing',
      'medium',
      3,
      me.id,
      'Bổ sung các trạng thái chờ xử lý, thành công và thất bại.',
    ],
    [
      'Đọc ghi chú phỏng vấn và nhóm insight',
      null,
      'todo',
      'low',
      4,
      me.id,
      'Việc ghi chú cá nhân sau buổi phỏng vấn.',
    ],
    [
      'Chốt checklist bàn giao cho Dev',
      defaultTeam,
      'done',
      'medium',
      -2,
      me.id,
    ],
    [
      'Chuẩn bị tài liệu cho buổi chia sẻ CX',
      defaultTeam,
      'todo',
      'low',
      7,
      me.id,
    ],
    ['Gửi lịch phỏng vấn đợt một', defaultTeam, 'done', 'low', -4, me.id],
    [
      'Đối chiếu số liệu lỗi theo kênh',
      defaultTeam,
      'doing',
      'high',
      1,
      'demo-linh',
    ],
    [
      'Cập nhật danh sách người tham gia',
      defaultTeam,
      'todo',
      'medium',
      2,
      'demo-an',
    ],
    [
      'Rà soát token màu cho giao diện tối',
      defaultTeam,
      'review',
      'medium',
      4,
      'demo-thao',
    ],
  ]
  const tasks = samples.map(
    (
      [title, team_id, status, priority, offset, assignee_id, description],
      index,
    ) => {
      const id = 'demo-task-' + (index + 1)
      const meta = reportMeta[id]
      return {
        id,
        title,
        team_id,
        status,
        previous_status: meta?.previous_status ?? null,
        status_updated_at: meta?.status_updated_at ?? shiftDay(-1, today),
        priority,
        assignee_ids:
          index === 0 || index === 1
            ? [assignee_id, 'demo-linh']
            : index === 8
              ? [assignee_id, 'demo-an']
              : [assignee_id],
        level: index === 1 || index === 8 ? 2 : 1,
        parent_id: index === 1 || index === 8 ? 'demo-task-1' : null,
        due_date: shiftDay(offset, today),
        sibling_no: index === 1 ? 1 : index === 8 ? 2 : null,
        assigned_on: meta?.assigned_on ?? shiftDay(-6, today),
        assigned_by: me.id,
        description: description ?? '',
        created_by: me.id,
        created_at: now,
        version: 1,
      }
    },
  )
  return {
    teams: [{ id: defaultTeam, name: 'Product & CX', created_at: now }],
    members: { [defaultTeam]: members },
    tasks,
    deletedTasks: defaultDeletedTasks(today),
    reportHydrated: true,
    childSequences: { 'demo-task-1': 2 },
    accounts: [],
    extensions: [],
    emails: [],
    comments: [
      {
        id: 'demo-comment',
        task_id: 'demo-task-3',
        author_id: 'demo-linh',
        body: 'Mình đã xem phần câu hỏi mở. Nhớ thêm một câu về cách khách hàng đang xử lý công việc hiện tại nhé.',
        author_name: 'Mai Linh',
        created_at: now,
      },
    ],
  }
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
    if (saved) {
      const today = parseDay(todayInVietnam())
      const reportMeta = defaultTaskReportMeta(today)
      const childSequences = { ...saved.childSequences }
      const tasks = saved.tasks.map(({ assignee_id, ...task }) => {
        const fallbackMeta = !saved.reportHydrated ? reportMeta[task.id] : null
        return {
          ...task,
          level: task.level ?? 1,
          parent_id: task.parent_id ?? null,
          sibling_no: task.sibling_no ?? null,
          assigned_on:
            fallbackMeta?.assigned_on ??
            task.assigned_on ??
            todayInVietnam(new Date(task.created_at)),
          previous_status:
            task.previous_status !== undefined
              ? task.previous_status
              : (fallbackMeta?.previous_status ?? null),
          status_updated_at:
            task.status_updated_at ??
            fallbackMeta?.status_updated_at ??
            todayInVietnam(new Date(task.created_at)),
          assignee_ids:
            task.assignee_ids ?? (assignee_id ? [assignee_id] : []),
        }
      })
      const childTasks = tasks.filter((task) => task.level === 2)
      for (const task of childTasks) {
        childSequences[task.parent_id] = Math.max(
          childSequences[task.parent_id] ?? 0,
          task.sibling_no ?? 0,
        )
      }
      for (const task of childTasks.sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      )) {
        if (!task.sibling_no) task.sibling_no = ++childSequences[task.parent_id]
      }
      const byId = new Map(tasks.map((task) => [task.id, task]))
      const formerThirdLevel = tasks.filter((task) => task.level === 3)
      formerThirdLevel.sort(
        (a, b) =>
          (byId.get(a.parent_id)?.sibling_no ?? 0) -
            (byId.get(b.parent_id)?.sibling_no ?? 0) ||
          a.created_at.localeCompare(b.created_at) ||
          a.id.localeCompare(b.id),
      )
      for (const task of formerThirdLevel) {
        const root = byId.get(byId.get(task.parent_id)?.parent_id)
        task.level = root?.level === 1 ? 2 : 1
        task.parent_id = task.level === 2 ? root.id : null
        task.sibling_no = task.parent_id
          ? (childSequences[task.parent_id] ?? 0) + 1
          : null
        if (task.parent_id) childSequences[task.parent_id] = task.sibling_no
        task.version += 1
      }
      const unfinishedParents = new Set(
        tasks
          .filter((task) => task.parent_id && task.status !== 'done')
          .map((task) => task.parent_id),
      )
      for (const task of tasks) {
        if (task.status === 'done' && unfinishedParents.has(task.id)) {
          task.status = 'doing'
          task.version += 1
        }
      }
      const hydratedMembers = Object.fromEntries(
        Object.entries(saved.members ?? {}).map(([teamId, list]) => [
          teamId,
          list.map((member) => {
            const fallback = defaultMemberMeta[member.user_id]
            const account = (saved.accounts ?? []).find(
              (item) => item.id === member.user_id,
            )
            return {
              ...member,
              email: member.email || account?.email || fallback?.email || '',
              department:
                member.department ||
                account?.department ||
                fallback?.department ||
                '',
            }
          }),
        ]),
      )
      return {
        ...saved,
        reportHydrated: true,
        members: hydratedMembers,
        accounts: saved.accounts ?? [],
        extensions: saved.extensions ?? [],
        emails: saved.emails ?? [],
        tasks,
        deletedTasks: saved.deletedTasks ?? defaultDeletedTasks(today),
        childSequences,
      }
    }
  } catch {
    /* An unavailable browser store still allows trying the demo. */
  }
  return seed()
}
let state = load()
export function demoAccounts() {
  const map = new Map(baseAccounts.map((acc) => [acc.id, { ...acc }]))
  for (const acc of state.accounts ?? []) {
    map.set(acc.id, { ...(map.get(acc.id) ?? {}), ...acc })
  }
  return [...map.values()]
}

export function getDemoSession() {
  try {
    const id = localStorage.getItem(sessionKey)
    if (!id) return null
    return demoAccounts().find((acc) => acc.id === id)?.id ?? null
  } catch {
    return null
  }
}

export function setDemoSession(userId) {
  try {
    if (userId) localStorage.setItem(sessionKey, userId)
    else localStorage.removeItem(sessionKey)
  } catch {
    /* Ignore storage errors. */
  }
}

export function authenticateDemo(email, password) {
  const normalized = email.trim().toLowerCase()
  const accounts = demoAccounts()
  const found = accounts.find(
    (item) =>
      item.email.toLowerCase() === normalized ||
      (item.id === 'demo-me' && normalized === 'quy@example.test') ||
      (item.id === 'demo-linh' && normalized === 'linh@example.test'),
  )
  if (!found) {
    throw new Error('Không tìm thấy tài khoản với email này.')
  }
  const expected = found.password || '123456'
  if (password !== expected) {
    throw new Error('Mật khẩu chưa đúng. Vui lòng kiểm tra lại.')
  }
  setDemoSession(found.id)
  return found
}

export function registerDemo(name, email, password, department = '') {
  const normalized = email.trim().toLowerCase()
  if (
    demoAccounts().some((item) => item.email.toLowerCase() === normalized)
  ) {
    throw new Error('Email này đã được đăng ký tài khoản.')
  }
  const account = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalized,
    password,
    department: department.trim() || 'Thành viên mới',
    roleLabel: 'Nhân viên',
  }
  state.accounts.push(account)
  if (state.members[defaultTeam]) {
    state.members[defaultTeam].push({
      user_id: account.id,
      display_name: account.name,
      email: account.email,
      department: account.department,
      role: 'member',
    })
  }
  save()
  setDemoSession(account.id)
  return account
}

export function resetDemoPassword(email, newPassword) {
  const normalized = email.trim().toLowerCase()
  const found = demoAccounts().find(
    (item) => item.email.toLowerCase() === normalized,
  )
  if (!found) {
    throw new Error('Không tìm thấy tài khoản với email này.')
  }
  const existing = state.accounts.find((item) => item.id === found.id)
  if (existing) {
    existing.password = newPassword
  } else {
    state.accounts.push({ ...found, password: newPassword })
  }
  save()
  return found
}

function queueMail(ids, key, subject, body) {
  const known = new Set(
    state.emails
      .filter((item) => item.key === key)
      .map((item) => item.recipient),
  )
  const newItems = [...new Set(ids)].filter((id) => !known.has(id))
  for (const recipient of newItems) {
    state.emails.push({
      id: crypto.randomUUID(),
      recipient,
      key,
      subject,
      body,
      created_at: new Date().toISOString(),
    })
  }
  return newItems.length > 0
}

function taskWithExtension(task) {
  return {
    ...task,
    extension_pending: state.extensions.some(
      (item) => item.task_id === task.id && item.status === 'pending',
    ),
  }
}
function taskMail(task, event, subject, detail, extra = []) {
  if (!task.team_id) return false
  const owners = state.members[task.team_id]
    .filter((member) => member.role === 'owner')
    .map((member) => member.user_id)
  return queueMail(
    [...owners, ...task.assignee_ids, ...extra],
    task.id + ':' + event,
    subject,
    task.title +
      '\n' +
      detail +
      '\nTrạng thái hiện tại: ' +
      statuses[task.status].label +
      '\nNgày giao: ' +
      fullDate(task.assigned_on) +
      '\nHạn hoàn thành: ' +
      fullDate(task.due_date),
  )
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    /* Keep session state. */
  }
}
function newRow(data) {
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...data,
  }
}
function insert(rows, data) {
  const row = newRow(data)
  rows.push(row)
  save()
  return row
}
function replace(rows, id, data) {
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) throw new Error('Mục này đã được xóa.')
  rows[index] = { ...rows[index], ...data }
  save()
  return rows[index]
}
export function createDemo(userId, onAccounts) {
  const user = demoAccounts().find((account) => account.id === userId)
  const membership = (teamId) =>
    state.members[teamId]?.find((member) => member.user_id === user.id)
  const canRead = (task) =>
    task.team_id
      ? Boolean(membership(task.team_id))
      : task.created_by === user.id
  const canManage = (task) =>
    task.team_id
      ? membership(task.team_id)?.role === 'owner'
      : task.created_by === user.id
  function attachmentTask(taskId, write = false) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (
      !task ||
      !canRead(task) ||
      (write && !canManage(task) && !task.assignee_ids.includes(user.id))
    )
      throw new Error('Bạn không có quyền truy cập tài liệu này.')
    return task.id
  }
  function checkVersion(task) {
    const current = state.tasks.find((item) => item.id === task.id)
    if (!current || !canRead(current) || current.version !== task.version)
      throw Object.assign(
        new Error('Công việc đã thay đổi. Hãy đóng và mở lại công việc.'),
        { code: 'TASK_CONFLICT' },
      )
    return current
  }
  function checkStructure(task, parent) {
    if (task.parent_id) {
      if (
        !parent ||
        !canRead(parent) ||
        parent.level !== 1 ||
        task.level !== 2 ||
        parent.team_id !== task.team_id ||
        parent.id === task.id
      )
        throw new Error('Hãy chọn việc chính L1 trong cùng phạm vi.')
    } else if (task.level !== 1) throw new Error('Hãy chọn việc cấp trên.')
    if (
      state.tasks.some(
        (child) =>
          child.parent_id === task.id && child.level !== task.level + 1,
      )
    ) {
      throw new Error('Công việc đang có việc con. Hãy chuyển việc con trước.')
    }
  }
  function prepareTask(data, current, newParent) {
    const task = {
      ...current,
      ...data,
      assignee_ids:
        data.assignee_ids ??
        current?.assignee_ids ??
        (data.team_id ? [] : [user.id]),
      assigned_on:
        data.assigned_on === undefined
          ? (current?.assigned_on ?? todayInVietnam())
          : data.assigned_on,
      created_by: current?.created_by ?? user.id,
    }
    if (!canManage(task)) {
      const changesAssignment = [
        'team_id',
        'level',
        'parent_id',
      ].some((key) => key in data)
      if (
        !current ||
        changesAssignment ||
        !current.assignee_ids.includes(user.id)
      )
        throw new Error('Quản lý phân công, nhân viên cập nhật việc được giao.')
    }
    const parent =
      newParent ?? state.tasks.find((item) => item.id === task.parent_id)
    checkStructure(task, parent)
    const completion = taskCompletionError(
      task.status,
      parent,
      state.tasks.filter((child) => child.parent_id === task.id),
    )
    if (completion) throw new Error(completion)
    const assignedChanged =
      Boolean(current) &&
      (task.assignee_ids.length !== current.assignee_ids.length ||
        task.assignee_ids.some((id) => !current.assignee_ids.includes(id)))
    task.assigned_by =
      !current || assignedChanged
        ? task.assignee_ids.length
          ? user.id
          : null
        : (current.assigned_by ?? null)
    const datesChanged =
      current &&
      (task.assigned_on !== current.assigned_on ||
        task.due_date !== current.due_date)
    if (task.team_id) {
      if (!canManage(task) && ('due_date' in data || 'assigned_on' in data))
        throw new Error('Trưởng nhóm thiết lập ngày giao và hạn hoàn thành.')
      if (
        datesChanged &&
        state.extensions.some(
          (item) => item.task_id === task.id && item.status === 'pending',
        )
      )
        throw new Error(
          'Hãy xử lý yêu cầu gia hạn đang chờ trước khi sửa hạn hoàn thành.',
        )
      if (
        (!current || current.assignee_ids.length || datesChanged) &&
        !task.assignee_ids.length
      )
        throw new Error('Hãy chọn ít nhất một người thực hiện.')
      if (
        task.assignee_ids.some(
          (id) =>
            !state.members[task.team_id].some(
              (member) => member.user_id === id,
            ),
        )
      )
        throw new Error('Chỉ có thể giao việc cho thành viên của nhóm này.')
    }
    if (
      (!current || datesChanged || (task.team_id && assignedChanged)) &&
      (!task.assigned_on || !task.due_date || task.due_date < task.assigned_on)
    )
      throw new Error(
        'Ngày giao và hạn hoàn thành là bắt buộc. Hạn phải từ ngày giao trở đi.',
      )
    return { task, assignedChanged, datesChanged }
  }
  function siblingNumber(task, current) {
    if (task.level !== 2) return null
    if (current?.level === 2 && current.parent_id === task.parent_id)
      return current.sibling_no
    const number = (state.childSequences[task.parent_id] ?? 0) + 1
    state.childSequences[task.parent_id] = number
    return number
  }
  return {
    mode: 'demo',
    user,
    async listTeams() {
      return state.teams.filter((team) => membership(team.id))
    },
    async load(team) {
      const activeTeam = membership(team) ? team : null
      const tasks = state.tasks.filter(
        (task) =>
          canRead(task) && (!task.team_id || task.team_id === activeTeam),
      )
      let queued = false
      for (const task of tasks) {
        if (
          overdue(task, todayInVietnam()) &&
          taskMail(
            task,
            'overdue:' + task.due_date,
            'Công việc đã quá hạn',
            'Mở công việc để cập nhật tiến độ hoặc xin gia hạn.',
          )
        )
          queued = true
      }
      if (queued) save()
      return {
        members: state.members[activeTeam] ?? [],
        tasks: tasks.map(taskWithExtension),
        deletedTasks: (state.deletedTasks ?? []).filter(
          (task) =>
            canRead(task) && (!task.team_id || task.team_id === activeTeam),
        ),
      }
    },
    async saveTask(data, previous) {
      const current = previous ? checkVersion(previous) : null
      const { task, assignedChanged, datesChanged } = prepareTask(data, current)
      task.sibling_no = siblingNumber(task, current)
      const statusChanged = Boolean(current && task.status !== current.status)
      const statusFields = statusChanged
        ? {
            previous_status: current.status,
            status_updated_at: todayInVietnam(),
          }
        : !current
          ? {
              previous_status: null,
              status_updated_at: task.assigned_on ?? todayInVietnam(),
            }
          : {}
      const saved = current
        ? replace(state.tasks, current.id, {
            ...task,
            ...statusFields,
            version: current.version + 1,
          })
        : insert(state.tasks, { ...task, ...statusFields, version: 1 })
      if (saved.parent_id && saved.status !== 'done') {
        const parentTask = state.tasks.find(
          (item) => item.id === saved.parent_id,
        )
        if (parentTask?.status === 'done') {
          replace(state.tasks, parentTask.id, {
            status: 'doing',
            previous_status: 'done',
            status_updated_at: todayInVietnam(),
            version: parentTask.version + 1,
          })
        }
      }
      if (!current)
        taskMail(saved, 'new', 'Công việc mới', 'Trưởng nhóm đã tạo công việc.')
      else {
        const event = saved.version + ':'
        if (assignedChanged)
          taskMail(
            saved,
            event + 'assigned',
            'Phân công đã thay đổi',
            'Danh sách người thực hiện đã được cập nhật.',
            current.assignee_ids,
          )
        if (datesChanged)
          taskMail(
            saved,
            event + 'dates',
            'Ngày giao hoặc hạn đã thay đổi',
            'Xem ngày giao và hạn hoàn thành mới bên dưới.',
          )
        if (saved.status !== current.status) {
          taskMail(
            saved,
            event + 'status',
            'Trạng thái đã thay đổi',
            'Trạng thái công việc đã được cập nhật.',
          )
          if (saved.status === 'done') {
            const pending = state.extensions.find(
              (item) => item.task_id === task.id && item.status === 'pending',
            )
            if (pending) {
              Object.assign(pending, {
                status: 'cancelled',
                decision_note: 'Công việc đã hoàn thành.',
              })
              taskMail(
                saved,
                pending.id + ':cancelled',
                'Đã đóng yêu cầu gia hạn',
                'Công việc đã hoàn thành.',
              )
            }
          }
        }
        if (
          ['title', 'description', 'priority', 'level', 'parent_id'].some(
            (key) => saved[key] !== current[key],
          )
        )
          taskMail(
            saved,
            event + 'details',
            'Chi tiết công việc đã thay đổi',
            'Công việc có nội dung hoặc thông tin tổ chức mới.',
          )
      }
      save()
      return taskWithExtension(saved)
    },
    async createTaskWithChildren(data, drafts) {
      const { task: prepared } = prepareTask(
        { ...data, level: 1, parent_id: null },
        null,
      )
      const task = newRow({ ...prepared, sibling_no: null, version: 1 })
      const children = drafts.map((item, index) => {
        const draft = typeof item === 'string' ? { title: item } : item
        const title = draft?.title?.trim()
        if (!title || [...title].length > 160)
          throw new Error('Mỗi việc con cần có tên từ 1 đến 160 ký tự.')
        const { task: child } = prepareTask(
          {
            team_id: task.team_id,
            assignee_ids: draft.assignee_ids ?? [...task.assignee_ids],
            assigned_on: draft.assigned_on ?? task.assigned_on,
            due_date: draft.due_date ?? task.due_date,
            priority: draft.priority ?? task.priority,
            title,
            description: draft.description?.trim() ?? '',
            status: draft.status ?? 'todo',
            level: 2,
            parent_id: task.id,
          },
          null,
          task,
        )
        return newRow({ ...child, sibling_no: index + 1, version: 1 })
      })
      state.tasks.push(task, ...children)
      if (children.length) state.childSequences[task.id] = children.length
      for (const item of [task, ...children]) {
        taskMail(item, 'new', 'Công việc mới', 'Trưởng nhóm đã tạo công việc.')
      }
      save()
      return {
        task: taskWithExtension(task),
        children: children.map(taskWithExtension),
      }
    },
    async listExtensions(task) {
      if (!canRead(task)) return []
      return state.extensions
        .filter((item) => item.task_id === task.id)
        .slice()
        .reverse()
    },
    async requestExtension(task, due, reason) {
      const current = checkVersion(task)
      if (!canRead(current))
        throw new Error('Bạn không có quyền xin gia hạn công việc này.')
      const today = todayInVietnam()
      if (!overdue(current, today))
        throw new Error(
          'Chỉ việc quá hạn và chưa hoàn thành mới có thể xin gia hạn.',
        )
      if (!due || due < today)
        throw new Error('Hạn đề xuất phải từ hôm nay trở đi.')
      if (
        state.extensions.some(
          (item) => item.task_id === current.id && item.status === 'pending',
        )
      )
        throw new Error('Công việc đã có một yêu cầu gia hạn đang chờ duyệt.')
      const request = insert(state.extensions, {
        task_id: current.id,
        requested_by: user.id,
        previous_due_date: current.due_date,
        requested_due_date: due,
        reason,
        status: 'pending',
      })
      taskMail(
        current,
        request.id + ':requested',
        'Yêu cầu gia hạn đang chờ duyệt',
        'Hạn đề xuất: ' + fullDate(due),
      )
      save()
      return request
    },
    async reviewExtension(request, approve, note) {
      const current = state.tasks.find((item) => item.id === request.task_id)
      const pending = state.extensions.find((item) => item.id === request.id)
      if (!current || !canManage(current))
        throw new Error('Chỉ trưởng nhóm được duyệt gia hạn.')
      if (pending?.status !== 'pending')
        throw new Error('Yêu cầu này đã được xử lý.')
      if (
        approve &&
        (current.status === 'done' ||
          current.due_date !== pending.previous_due_date ||
          pending.requested_due_date < todayInVietnam())
      )
        throw new Error('Hạn đề xuất hoặc trạng thái công việc đã thay đổi.')
      if (!approve && !note?.trim()) throw new Error('Hãy nhập lý do từ chối.')
      const task = approve
        ? replace(state.tasks, current.id, {
            due_date: pending.requested_due_date,
            version: current.version + 1,
          })
        : current
      const reviewed = replace(state.extensions, pending.id, {
        status: approve ? 'approved' : 'rejected',
        decision_note: note,
        reviewed_by: user.id,
      })
      taskMail(
        task,
        reviewed.id + ':' + reviewed.status,
        approve ? 'Gia hạn đã được duyệt' : 'Gia hạn bị từ chối',
        approve ? 'Hạn mới đã được cập nhật.' : 'Hạn hiện tại vẫn áp dụng.',
        [pending.requested_by],
      )
      save()
      return { request: reviewed, task: taskWithExtension(task) }
    },
    async createMember(team, name, email, password, department = '') {
      if (membership(team.id)?.role !== 'owner')
        throw new Error('Chỉ trưởng nhóm có thể tạo tài khoản.')
      const normalized = email.trim().toLowerCase()
      const dept = department.trim()
      const pass = password || '123456'
      let account = demoAccounts().find(
        (item) => item.email.toLowerCase() === normalized,
      )
      const accountCreated = !account
      if (!account) {
        account = {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: normalized,
          password: pass,
          department: dept,
          roleLabel: 'Nhân viên',
        }
        state.accounts.push(account)
      } else {
        const storedAcc = state.accounts.find((item) => item.id === account.id)
        if (storedAcc) {
          Object.assign(storedAcc, {
            name: name.trim(),
            email: normalized,
            password: pass,
            department: dept,
          })
        } else {
          state.accounts.push({
            ...account,
            name: name.trim(),
            email: normalized,
            password: pass,
            department: dept,
          })
        }
      }
      const current = state.members[team.id].find(
        (member) => member.user_id === account.id,
      )
      if (current) {
        Object.assign(current, {
          display_name: name.trim(),
          email: normalized,
          department: dept,
        })
        save()
        onAccounts(demoAccounts())
        return { member: { ...current }, accountCreated: false }
      }
      const member = {
        user_id: account.id,
        display_name: name.trim(),
        email: normalized,
        department: dept,
        role: 'member',
      }
      state.members[team.id].push(member)
      queueMail(
        [account.id],
        'member:' + team.id + ':' + account.id,
        accountCreated
          ? 'Xác nhận tài khoản Nhịp việc'
          : 'Bạn đã được thêm vào nhóm',
        'Bạn được thêm vào nhóm ' + team.name + '.',
      )
      save()
      onAccounts(demoAccounts())
      return { member, accountCreated }
    },
    async updateMember(
      team,
      userId,
      { display_name, email, department, password },
    ) {
      if (membership(team.id)?.role !== 'owner')
        throw new Error('Chỉ trưởng nhóm có thể chỉnh sửa thành viên.')
      const list = state.members[team.id] ?? []
      const target = list.find((item) => item.user_id === userId)
      if (!target) throw new Error('Không tìm thấy thành viên.')
      Object.assign(target, {
        display_name: display_name.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim(),
      })
      const baseAcc = demoAccounts().find((item) => item.id === userId)
      const storedAcc = state.accounts.find((item) => item.id === userId)
      if (storedAcc) {
        storedAcc.name = target.display_name
        storedAcc.email = target.email
        storedAcc.department = target.department
        if (password) storedAcc.password = password
      } else if (baseAcc) {
        state.accounts.push({
          ...baseAcc,
          name: target.display_name,
          email: target.email,
          department: target.department,
          ...(password ? { password } : {}),
        })
      }
      save()
      onAccounts(demoAccounts())
      return { ...target }
    },
    async removeMember(team, userId) {
      if (membership(team.id)?.role !== 'owner')
        throw new Error('Chỉ trưởng nhóm có thể xóa thành viên.')
      if (userId === user.id)
        throw new Error('Không thể xóa tài khoản trưởng nhóm đang đăng nhập.')
      state.members[team.id] = (state.members[team.id] ?? []).filter(
        (item) => item.user_id !== userId,
      )
      state.accounts = (state.accounts ?? []).filter(
        (item) => item.id !== userId,
      )
      for (const task of state.tasks) {
        if (task.team_id === team.id && task.assignee_ids.includes(userId)) {
          task.assignee_ids = task.assignee_ids.filter((id) => id !== userId)
        }
      }
      save()
      onAccounts(demoAccounts())
    },
    async signOut() {
      setDemoSession(null)
    },
    demoEmails() {
      return state.emails
        .filter((item) => item.recipient === user.id)
        .slice(-40)
        .reverse()
    },
    async listAttachments(task) {
      return listDemoAttachments(attachmentTask(task.id))
    },
    async uploadAttachment(task, attachment) {
      await putDemoAttachment(attachmentTask(task.id, true), attachment)
    },
    async downloadAttachment(task, key) {
      return readDemoAttachment(attachmentTask(task.id), key)
    },
    async removeAttachment(task, key) {
      await removeDemoAttachment(attachmentTask(task.id, true), key)
    },
    async deleteTask(task) {
      const current = checkVersion(task)
      if (!canManage(current))
        throw new Error('Bạn không có quyền xóa công việc này.')
      if (state.tasks.some((item) => item.parent_id === current.id))
        throw new Error('Hãy chuyển hoặc xóa việc con trước khi xóa việc này.')
      if (await hasDemoAttachments(current.id))
        throw new Error('Hãy gỡ tài liệu đính kèm trước khi xóa công việc.')
      taskMail(
        current,
        'deleted',
        'Công việc đã được xóa',
        'Trưởng nhóm đã xóa công việc.',
      )
      state.deletedTasks = [
        ...(state.deletedTasks ?? []),
        {
          ...current,
          status: 'deleted',
          previous_status: current.status,
          deleted_at: todayInVietnam(),
        },
      ]
      state.tasks = state.tasks.filter((item) => item.id !== current.id)
      delete state.childSequences[current.id]
      state.extensions = state.extensions.filter(
        (item) => item.task_id !== current.id,
      )
      state.comments = state.comments.filter(
        (comment) => comment.task_id !== current.id,
      )
      save()
    },
    async createTeam(name) {
      const team = insert(state.teams, { name })
      state.members[team.id] = [
        { user_id: user.id, display_name: user.name, role: 'owner' },
      ]
      save()
      return team
    },
    async listComments(task) {
      return state.comments.filter((comment) => comment.task_id === task.id)
    },
    async addComment(task, body) {
      const comment = insert(state.comments, {
        task_id: task.id,
        author_id: user.id,
        author_name: user.name,
        body,
      })
      taskMail(
        task,
        comment.id + ':comment',
        'Có bình luận mới',
        'Mở công việc để xem bình luận của ' + user.name + '.',
      )
      save()
      return comment
    },
  }
}
