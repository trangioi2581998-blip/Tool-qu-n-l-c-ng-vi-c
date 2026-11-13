import { useState } from 'react'
import {
  AlarmClock,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  CornerDownRight,
  Ellipsis,
  Layers3,
  ListTodo,
  LockKeyhole,
  Plus,
  UsersRound,
  Workflow,
} from 'lucide-react'
import {
  byDeadline,
  dateKey,
  dueLabel,
  fullDate,
  overdue,
  parseDay,
  priorities,
  shiftDay,
  statuses,
} from './model.js'
import {
  Avatar,
  Dropdown,
  Empty,
  IconButton,
  Priority,
  StatusBadge,
} from './ui.jsx'

export function Summary({ tasks, today, filters, onFilter }) {
  const items = [
    {
      label: 'Tổng công việc',
      count: tasks.length,
      Icon: Layers3,
      color: 'purple',
      key: 'all',
    },
    {
      label: 'Đang thực hiện',
      count: tasks.filter((t) => t.status === 'doing').length,
      Icon: Clock3,
      color: 'blue',
      key: 'doing',
    },
    {
      label: 'Quá hạn',
      count: tasks.filter((t) => overdue(t, today)).length,
      Icon: AlarmClock,
      color: 'peach',
      key: 'late',
    },
    {
      label: 'Đã hoàn thành',
      count: tasks.filter((t) => t.status === 'done').length,
      Icon: CircleCheck,
      color: 'mint',
      key: 'done',
    },
  ]
  return (
    <section className="summary" aria-label="Tóm tắt công việc">
      {items.map(({ label, count, Icon, color, key }) => (
        <button
          className="metric"
          key={key}
          type="button"
          aria-pressed={filters === key}
          onClick={() => onFilter(key)}
        >
          <span className={'metric-icon ' + color}>
            <Icon size={19} strokeWidth={1.9} />
          </span>
          <span className="metric-value">
            <strong>{count}</strong>
            <span>{label}</span>
          </span>
        </button>
      ))}
    </section>
  )
}

function Deadline({ task, today }) {
  const late = overdue(task, today)
  return (
    <span
      className={'deadline' + (late ? ' is-late' : '')}
      title={late ? 'Đã quá hạn' : 'Hạn hoàn thành'}
    >
      <CalendarDays size={14} />
      <span>
        {task.due_date
          ? 'Hạn: ' +
            dueLabel(task.due_date, today) +
            (task.due_time ? ' · ' + task.due_time : '')
          : '—'}
      </span>
    </span>
  )
}
function People({ ids, memberMap }) {
  const people = ids.map((id) => memberMap[id]).filter(Boolean)
  if (!people.length)
    return (
      <span className="unassigned" title="Chưa phân công">
        —
      </span>
    )
  const extra = people.length - 2
  const names = people.map((person) => person.display_name).join(', ')
  return (
    <span
      className="people-stack"
      aria-label={'Người thực hiện: ' + names}
      title={names}
    >
      {people.slice(0, 2).map((person) => (
        <Avatar
          key={person.user_id}
          name={person.display_name}
          id={person.user_id}
          size="sm"
        />
      ))}
      {extra > 0 && <span className="people-extra">+{extra}</span>}
    </span>
  )
}

function TaskMeta({ task, childrenTasks }) {
  const totalChildren = childrenTasks?.length ?? 0
  const doneChildren =
    totalChildren > 0
      ? childrenTasks.filter((item) => item.status === 'done').length
      : 0
  const isPrivate = !task.team_id
  const hasExtension = Boolean(task.extension_pending)
  if (!totalChildren && !isPrivate && !hasExtension) return null
  return (
    <span className="task-meta">
      {totalChildren > 0 && (
        <span
          className={
            'subtask-progress-badge' +
            (doneChildren === totalChildren ? ' all-done' : '')
          }
          title={
            'Đã hoàn thành ' + doneChildren + '/' + totalChildren + ' việc con'
          }
        >
          <Workflow size={11} /> {doneChildren}/{totalChildren} việc con
        </span>
      )}
      {isPrivate && (
        <span className="private-task-label">
          <LockKeyhole size={12} /> Chỉ mình tôi
        </span>
      )}
      {hasExtension && <span className="badge amber">Chờ duyệt gia hạn</span>}
    </span>
  )
}

function TaskParent({ parent }) {
  if (!parent) return null
  return (
    <span className="parent-note" title={parent.title}>
      <CornerDownRight size={13} />
      <span>{parent.title}</span>
    </span>
  )
}

function AssignerCell({ task, memberMap }) {
  const assignerId = task.assigned_by ?? task.created_by
  const person = memberMap[assignerId]
  return (
    <div className="row-assignment row-assigner" role="cell">
      <span className="row-assignment-label">Người giao</span>
      {person ? (
        <span
          className="person-pill"
          title={
            !task.assigned_by
              ? person.display_name + ' (Người tạo công việc)'
              : person.display_name
          }
        >
          <Avatar name={person.display_name} id={person.user_id} size="sm" />
          <span className="person-pill-name">{person.display_name}</span>
        </span>
      ) : (
        <span className="muted">Chưa giao</span>
      )}
    </div>
  )
}

function InlineAssigneePicker({
  task,
  members = [],
  memberMap,
  editable,
  busy,
  onAssignees,
}) {
  const people = task.assignee_ids.map((id) => memberMap[id]).filter(Boolean)
  const names = people.map((person) => person.display_name).join(', ')
  const triggerContent = people.length ? (
    <span className="inline-assignees-summary" title={names}>
      <span className="people-stack">
        {people.slice(0, 2).map((person) => (
          <Avatar
            key={person.user_id}
            name={person.display_name}
            id={person.user_id}
            size="sm"
          />
        ))}
        {people.length > 2 && (
          <span className="people-extra">+{people.length - 2}</span>
        )}
      </span>
      <span className="inline-assignees-names">{names}</span>
    </span>
  ) : (
    <span className="inline-assignees-empty">
      <UsersRound size={13} />
      <span>Chọn người nhận</span>
    </span>
  )

  if (!task.team_id || !editable || busy || !onAssignees || !members.length) {
    return (
      <div className="row-assignment row-assignees" role="cell">
        <span className="row-assignment-label">Người được giao</span>
        <div className="inline-assignees-readonly">{triggerContent}</div>
      </div>
    )
  }

  return (
    <div className="row-assignment row-assignees" role="cell">
      <span className="row-assignment-label">Người được giao</span>
      <Dropdown
        label={'Đổi người được giao cho ' + task.title}
        className="inline-assignee-dropdown"
        trigger={triggerContent}
      >
        {() => (
          <div className="inline-assignee-menu">
            <div className="inline-menu-header">Người được giao</div>
            {members.map((member) => {
              const selected = task.assignee_ids.includes(member.user_id)
              return (
                <button
                  key={member.user_id}
                  type="button"
                  className={
                    'inline-assignee-option' + (selected ? ' is-selected' : '')
                  }
                  onClick={() => {
                    const nextIds = selected
                      ? task.assignee_ids.filter((id) => id !== member.user_id)
                      : [...task.assignee_ids, member.user_id]
                    onAssignees(task, nextIds)
                  }}
                >
                  <span
                    className={
                      'inline-check-box' + (selected ? ' checked' : '')
                    }
                  >
                    {selected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <Avatar
                    name={member.display_name}
                    id={member.user_id}
                    size="sm"
                  />
                  <span className="inline-assignee-meta">
                    <strong>{member.display_name}</strong>
                    {member.department && <small>{member.department}</small>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Dropdown>
    </div>
  )
}

function InlineStatusPicker({ task, editable, busy, onStatus }) {
  const current = statuses[task.status]
  if (!editable || busy || !onStatus) {
    return (
      <div className="row-status" role="cell">
        <StatusBadge status={task.status} />
      </div>
    )
  }
  return (
    <div className="row-status" role="cell">
      <Dropdown
        label={'Đổi trạng thái ' + task.title}
        className={'inline-status-dropdown ' + current.color}
        trigger={
          <span className="inline-status-trigger">
            <span className="status-dot" />
            <span>{current.label}</span>
          </span>
        }
      >
        {(close) => (
          <div className="inline-status-menu">
            <div className="inline-menu-header">Đổi trạng thái</div>
            {Object.entries(statuses).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className={
                  'inline-status-option' +
                  (task.status === key ? ' is-selected' : '')
                }
                onClick={() => {
                  close()
                  if (task.status !== key) onStatus(task, key)
                }}
              >
                <span className={'badge ' + item.color}>
                  <span className="status-dot" />
                  {item.label}
                </span>
                {task.status === key && (
                  <Check className="menu-check" size={14} />
                )}
              </button>
            ))}
          </div>
        )}
      </Dropdown>
    </div>
  )
}

function TaskListRow({
  task,
  members,
  memberMap,
  childrenTasks,
  today,
  onOpen,
  onStatus,
  onAssignees,
  canEdit,
  busyIds,
  child = false,
  context = false,
  toggle,
  expanded,
  childrenId,
}) {
  const editable = canEdit ? canEdit(task) : false
  const busy = busyIds?.has(task.id) ?? false
  return (
    <div
      className={
        'task-row task-grid' +
        (child ? ' task-row-child' : ' task-row-root') +
        (context ? ' task-row-context' : '') +
        (task.status === 'done' ? ' is-done' : '')
      }
      role="row"
    >
      <div
        className="task-first"
        role="cell"
        aria-colspan={context ? 7 : undefined}
      >
        {toggle && (
          <IconButton
            className="icon-button task-tree-toggle"
            label={
              (expanded ? 'Thu gọn việc con của ' : 'Mở việc con của ') +
              task.title
            }
            aria-expanded={expanded}
            aria-controls={childrenId}
            onClick={toggle}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </IconButton>
        )}
        <button
          type="button"
          className="task-title"
          onClick={() => onOpen(task)}
        >
          <strong title={task.title}>{task.title}</strong>
          {context ? (
            <span className="task-meta">
              <span className="muted">Việc chính liên quan</span>
            </span>
          ) : (
            <TaskMeta task={task} childrenTasks={childrenTasks} />
          )}
        </button>
      </div>
      {!context && (
        <>
          <AssignerCell task={task} memberMap={memberMap} />
          <InlineAssigneePicker
            task={task}
            members={members}
            memberMap={memberMap}
            editable={editable}
            busy={busy}
            onAssignees={onAssignees}
          />
          <InlineStatusPicker
            task={task}
            editable={editable}
            busy={busy}
            onStatus={onStatus}
          />
          <div className="row-priority" role="cell">
            <Priority priority={task.priority} />
          </div>
          <div className="row-due" role="cell">
            {task.assigned_on && (
              <div className="date-item assigned">
                <span className="date-label">Giao:</span>
                <span className="date-val">
                  {fullDate(task.assigned_on).slice(0, 5)}
                  {task.assigned_time ? ' ' + task.assigned_time : ''}
                </span>
              </div>
            )}
            {task.due_date && (
              <div className={'date-item due' + (overdue(task, today) ? ' is-late' : '')}>
                <span className="date-label">Hạn:</span>
                <span className="date-val">
                  {dueLabel(task.due_date, today)}
                  {task.due_time ? ' ' + task.due_time : ''}
                </span>
              </div>
            )}
          </div>
          <div className="row-tools" role="cell">
            <IconButton label={'Mở ' + task.title} onClick={() => onOpen(task)}>
              <Ellipsis size={18} />
            </IconButton>
          </div>
        </>
      )}
    </div>
  )
}

export function TaskList({
  tasks,
  taskMap,
  childrenByTask,
  members,
  memberMap,
  today,
  onOpen,
  onAdd,
  onStatus,
  onAssignees,
  canEdit,
  busyIds,
  filtered,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set())

  function toggleBranch(id) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!tasks.length)
    return (
      <Empty
        title={filtered ? 'Không tìm thấy công việc' : 'Chưa có công việc'}
        detail={
          filtered
            ? 'Hãy đổi từ khóa hoặc bộ lọc để xem thêm kết quả.'
            : 'Tạo công việc đầu tiên để bắt đầu theo dõi tiến độ.'
        }
        onAdd={filtered || !onAdd ? undefined : () => onAdd()}
      />
    )

  const visible = new Set(tasks.map((task) => task.id))
  const roots = new Map()
  for (const task of tasks) {
    const root = taskMap[task.parent_id] ?? task
    roots.set(root.id, root)
  }

  return (
    <div className="task-table" role="table" aria-label="Danh sách công việc">
      <div className="task-table-head task-grid" role="row">
        <span role="columnheader">Công việc</span>
        <span role="columnheader">Người giao</span>
        <span role="columnheader">Người được giao</span>
        <span role="columnheader">Trạng thái</span>
        <span role="columnheader">Ưu tiên</span>
        <span role="columnheader">Hạn</span>
        <span role="columnheader" className="sr-only">
          Chi tiết
        </span>
      </div>
      <div className="task-table-body">
        {[...roots.values()].map((task) => {
          const allChildren = childrenByTask[task.id] ?? []
          const children = allChildren.filter((child) => visible.has(child.id))
          const expanded = !collapsed.has(task.id)
          const childrenId = 'task-list-children-' + task.id
          return (
            <div className="task-branch" role="rowgroup" key={task.id}>
              <TaskListRow
                {...{
                  task,
                  members,
                  memberMap,
                  today,
                  onOpen,
                  onStatus,
                  onAssignees,
                  canEdit,
                  busyIds,
                  expanded,
                  childrenId,
                }}
                childrenTasks={allChildren}
                context={!visible.has(task.id)}
                toggle={
                  children.length ? () => toggleBranch(task.id) : undefined
                }
              />
              {children.length > 0 && (
                <div
                  id={childrenId}
                  className="task-branch-children"
                  role="presentation"
                  hidden={!expanded}
                >
                  {expanded &&
                    children.map((child) => (
                      <TaskListRow
                        key={child.id}
                        task={child}
                        {...{
                          members,
                          memberMap,
                          today,
                          onOpen,
                          onStatus,
                          onAssignees,
                          canEdit,
                          busyIds,
                        }}
                        child
                      />
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Board({
  tasks,
  today,
  memberMap,
  taskMap,
  childrenByTask,
  filtered,
  onOpen,
  onAdd,
  onStatus,
  canEdit,
  busyIds,
}) {
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState('')
  function drop(event, status) {
    event.preventDefault()
    const task = tasks.find((task) => task.id === drag)
    if (
      task &&
      task.status !== status &&
      canEdit(task) &&
      !busyIds.has(task.id)
    )
      onStatus(task, status)
    setDrag(null)
    setOver('')
  }
  if (!tasks.length && filtered)
    return (
      <Empty
        title="Không tìm thấy công việc"
        detail="Hãy đổi từ khóa hoặc bộ lọc để xem thêm kết quả."
      />
    )
  return (
    <div className="board" aria-label="Bảng Kanban">
      {Object.entries(statuses).map(([status, item]) => {
        const inColumn = tasks.filter((task) => task.status === status)
        return (
          <section
            className={'board-column' + (over === status ? ' drop-over' : '')}
            key={status}
            onDragOver={(event) => {
              if (drag) {
                event.preventDefault()
                setOver(status)
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setOver('')
            }}
            onDrop={(event) => drop(event, status)}
          >
            <header className={'board-header ' + item.color}>
              <span className={'board-dot ' + item.color} />
              <h3>{item.label}</h3>
              <span className="board-count">{inColumn.length}</span>
              {onAdd && (
                <IconButton
                  label={'Thêm việc vào ' + item.label}
                  onClick={() => onAdd({ status })}
                >
                  <Plus size={16} />
                </IconButton>
              )}
            </header>
            {inColumn.map((task) => (
              <article
                className="board-card"
                key={task.id}
                draggable={canEdit(task) && !busyIds.has(task.id)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', task.id)
                  setDrag(task.id)
                }}
                onDragEnd={() => {
                  setDrag(null)
                  setOver('')
                }}
              >
                <button onClick={() => onOpen(task)} className="task-title">
                  <TaskMeta task={task} />
                  <strong>{task.title}</strong>
                  <TaskParent parent={taskMap[task.parent_id]} />
                </button>
                <div className="board-dates">
                  {task.assigned_on && (
                    <div className="date-item assigned">
                      <span className="date-label">Giao:</span>
                      <span className="date-val">
                        {fullDate(task.assigned_on).slice(0, 5)}
                        {task.assigned_time ? ' ' + task.assigned_time : ''}
                      </span>
                    </div>
                  )}
                  {task.due_date && (
                    <div className={'date-item due' + (overdue(task, today) ? ' is-late' : '')}>
                      <span className="date-label">Hạn:</span>
                      <span className="date-val">
                        {dueLabel(task.due_date, today)}
                        {task.due_time ? ' ' + task.due_time : ''}
                      </span>
                    </div>
                  )}
                  {task.extension_pending && (
                    <span className="badge amber">Chờ duyệt gia hạn</span>
                  )}
                </div>
                <div className="board-card-footer">
                  <Priority priority={task.priority} />
                  {childrenByTask[task.id]?.length > 0 && (
                    <span
                      className="board-children"
                      title={childrenByTask[task.id].length + ' việc con'}
                    >
                      <Workflow size={13} />
                      {childrenByTask[task.id].length}
                    </span>
                  )}
                  <People ids={task.assignee_ids} memberMap={memberMap} />
                </div>
              </article>
            ))}
            {onAdd && (
              <button className="board-add" onClick={() => onAdd({ status })}>
                <Plus size={15} /> Thêm công việc
              </button>
            )}
            {!onAdd && !inColumn.length && (
              <p className="muted board-empty">Chưa có công việc</p>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function DashboardAside({ tasks, today, onOpen, onUpcoming }) {
  const completed = tasks.filter((t) => t.status === 'done').length
  const percent = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0
  const upcoming = tasks
    .filter(
      (t) =>
        t.status !== 'done' &&
        t.due_date &&
        t.due_date >= today &&
        t.due_date <= shiftDay(6, parseDay(today)),
    )
    .sort(byDeadline)
  return (
    <aside className="dashboard-aside">
      <section className="panel progress-panel">
        <div className="aside-heading">
          <span className="aside-icon purple">
            <ListTodo size={17} />
          </span>
          <h2>Tiến độ công việc</h2>
        </div>
        <div className="progress-detail">
          <strong>
            {percent}
            <span>%</span>
          </strong>
          <span>
            {completed}/{tasks.length} công việc
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Tiến độ công việc"
          aria-valuenow={percent}
        >
          <span style={{ width: percent + '%' }} />
        </div>
      </section>
      <section className="panel upcoming-panel">
        <div className="aside-heading">
          <span className="aside-icon peach">
            <CalendarDays size={17} />
          </span>
          <h2>Sắp đến hạn</h2>
        </div>
        {upcoming.length === 0 && (
          <p className="muted upcoming-empty">
            Không có việc đến hạn trong 7 ngày tới.
          </p>
        )}
        {upcoming.slice(0, 3).map((task) => (
          <button
            className="upcoming-row"
            key={task.id}
            onClick={() => onOpen(task)}
          >
            <span>
              <strong>{task.title}</strong>
              <span>{dueLabel(task.due_date, today)}</span>
            </span>
          </button>
        ))}
        {upcoming.length > 0 && (
          <button className="link-button" onClick={onUpcoming}>
            Xem 7 ngày tới <ArrowRight size={15} />
          </button>
        )}
      </section>
    </aside>
  )
}

const monthFormat = new Intl.DateTimeFormat('vi-VN', {
  month: 'long',
  year: 'numeric',
})
export function Calendar({ tasks, today, onOpen, onAdd }) {
  const [month, setMonth] = useState(() => {
    const now = parseDay(today)
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const lead = (month.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const weeks = Math.ceil((lead + count) / 7)
  const byDate = {}
  for (const task of tasks) {
    if (task.due_date) (byDate[task.due_date] ||= []).push(task)
  }
  const [selected, select] = useState(today)
  const shownDate =
    selected.slice(0, 7) === dateKey(month).slice(0, 7)
      ? selected
      : dateKey(month)
  const shownTasks = byDate[shownDate] || []
  function navigate(offset) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1))
  }
  function chooseDay(day, inMonth) {
    if (!inMonth) {
      const date = parseDay(day)
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
    select(day)
  }
  return (
    <section className="panel calendar-panel">
      <div className="calendar-toolbar">
        <h2>{monthFormat.format(month)}</h2>
        <div>
          <IconButton label="Tháng trước" onClick={() => navigate(-1)}>
            <ChevronLeft size={19} />
          </IconButton>
          <button
            className="button secondary"
            onClick={() => {
              const now = parseDay(today)
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
              select(today)
            }}
          >
            Hôm nay
          </button>
          <IconButton label="Tháng sau" onClick={() => navigate(1)}>
            <ChevronRight size={19} />
          </IconButton>
        </div>
      </div>
      <div className="calendar-grid">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(
          (day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ),
        )}
        {Array.from({ length: weeks * 7 }, (_, index) => {
          const day = shiftDay(index - lead, month)
          const inMonth = day.slice(0, 7) === dateKey(month).slice(0, 7)
          const entries = byDate[day] || []
          return (
            <div
              className={
                'calendar-cell' +
                (!inMonth ? ' off-month' : '') +
                (day === shownDate ? ' selected' : '')
              }
              key={day}
            >
              <button
                type="button"
                className={
                  'calendar-day' + (day === today ? ' current-day' : '')
                }
                aria-label={day + ', ' + entries.length + ' công việc'}
                aria-pressed={day === shownDate}
                onClick={() => chooseDay(day, inMonth)}
              >
                {Number(day.slice(-2))}
                {entries.length > 0 && <small>{entries.length}</small>}
              </button>
              {entries.slice(0, 2).map((task) => (
                <button
                  key={task.id}
                  className={
                    'calendar-entry ' + priorities[task.priority].color
                  }
                  onClick={() => onOpen(task)}
                  title={task.title}
                >
                  {task.title}
                </button>
              ))}
              {entries.length > 2 && (
                <button className="calendar-more" onClick={() => select(day)}>
                  +{entries.length - 2} việc
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="calendar-agenda">
        <div>
          <h3>{dueLabel(shownDate, today)}</h3>
          <button
            className="button secondary"
            onClick={() => onAdd({ due: shownDate })}
          >
            <Plus size={16} /> Tạo việc ngày này
          </button>
        </div>
        {shownTasks.length ? (
          shownTasks.map((task) => (
            <button
              className="agenda-row"
              key={task.id}
              onClick={() => onOpen(task)}
            >
              <strong>{task.title}</strong>
              <StatusBadge status={task.status} />
            </button>
          ))
        ) : (
          <p className="muted">Không có việc đến hạn trong ngày này.</p>
        )}
      </div>
    </section>
  )
}

function getTaskPace(task, today) {
  const isDone = task.status === 'done'
  const isExtension = Boolean(task.extension_pending)
  const dueDate = task.due_date || ''
  const assignedDate = task.assigned_on || (task.created_at ? task.created_at.slice(0, 10) : '')
  const doneDate = task.status_updated_at ? task.status_updated_at.slice(0, 10) : (task.updated_at ? task.updated_at.slice(0, 10) : today)

  if (isExtension) {
    if (dueDate && dueDate < today) return 'late'
    return 'on_time'
  }

  if (isDone) {
    if (!dueDate) return 'on_time'
    if (doneDate < dueDate) return 'early'
    if (doneDate === dueDate) return 'on_time'
    return 'late'
  }

  if (!dueDate) return 'on_time'
  if (dueDate < today) return 'late'
  return 'on_time'
}

function getTaskEffectiveStatusKey(task) {
  if (task.extension_pending) return 'extension'
  if (task.status === 'todo') return 'todo'
  if (task.status === 'doing') return 'doing'
  if (task.status === 'review') return 'review'
  if (task.status === 'done') return 'done'
  return 'todo'
}

const REPORT_SECTIONS = [
  {
    key: 'todo',
    label: 'Chưa thực hiện',
    levels: [
      { key: 'on_time', label: 'Đúng tiến độ' },
      { key: 'late', label: 'Chậm tiến độ' },
    ],
  },
  {
    key: 'doing',
    label: 'Đang thực hiện',
    levels: [
      { key: 'on_time', label: 'Đúng tiến độ' },
      { key: 'late', label: 'Chậm tiến độ' },
    ],
  },
  {
    key: 'review',
    label: 'Chờ duyệt',
    levels: [
      { key: 'on_time', label: 'Đúng tiến độ' },
      { key: 'late', label: 'Chậm tiến độ' },
    ],
  },
  {
    key: 'extension',
    label: 'Yêu cầu gia hạn',
    levels: [
      { key: 'on_time', label: 'Đúng tiến độ' },
      { key: 'late', label: 'Chậm tiến độ' },
    ],
  },
  {
    key: 'done',
    label: 'Hoàn thành',
    levels: [
      { key: 'late', label: 'Chậm tiến độ' },
      { key: 'on_time', label: 'Đúng tiến độ' },
      { key: 'early', label: 'Vượt tiến độ' },
    ],
  },
  {
    key: 'deleted',
    label: 'Đã xóa',
    levels: [
      { key: 'all', label: null },
    ],
  },
]

function buildStructuredMatrix(tasks, deletedTasks, bounds, cutoffDate, isCurrent) {
  const activeTasks = isCurrent
    ? tasks
    : tasks.filter((task) => {
        const assignedDate =
          task.assigned_on || (task.created_at ? task.created_at.slice(0, 10) : '')
        return !assignedDate || assignedDate <= cutoffDate
      })

  const deletedList = deletedTasks.filter((task) => {
    const delDate = task.deleted_at ? task.deleted_at.slice(0, 10) : ''
    return inBounds(delDate, bounds)
  })

  const matrix = {}
  for (const sec of REPORT_SECTIONS) {
    matrix[sec.key] = {}
    for (const lev of sec.levels) {
      matrix[sec.key][lev.key] = []
    }
  }

  for (const task of activeTasks) {
    const effectiveStatus =
      !isCurrent &&
      task.status_updated_at &&
      task.status_updated_at > bounds.end &&
      task.previous_status
        ? task.previous_status
        : task.status
    const statusKey = getTaskEffectiveStatusKey({ ...task, status: effectiveStatus })
    const paceKey = getTaskPace(task, cutoffDate)
    if (matrix[statusKey] && matrix[statusKey][paceKey]) {
      matrix[statusKey][paceKey].push(task)
    } else if (matrix[statusKey] && matrix[statusKey]['on_time']) {
      matrix[statusKey]['on_time'].push(task)
    }
  }

  matrix['deleted']['all'] = deletedList

  let totalActive = 0
  for (const sec of REPORT_SECTIONS) {
    if (sec.key === 'deleted') continue
    for (const lev of sec.levels) {
      totalActive += matrix[sec.key][lev.key]?.length || 0
    }
  }

  const total = totalActive + (matrix['deleted']?.['all']?.length || 0)

  return { matrix, total, totalActive }
}

function getWeekBounds(todayStr, offsetWeeks = 0) {
  const d = parseDay(todayStr)
  const dayOfWeek = (d.getDay() + 6) % 7
  const start = shiftDay(offsetWeeks * 7 - dayOfWeek, d)
  const end = shiftDay(offsetWeeks * 7 - dayOfWeek + 6, d)
  return {
    start,
    end,
    rangeLabel:
      fullDate(start).slice(0, 5) + ' – ' + fullDate(end).slice(0, 5),
  }
}

function inBounds(dateStr, bounds) {
  return Boolean(dateStr && dateStr >= bounds.start && dateStr <= bounds.end)
}

function buildWeekReport(tasks, deletedTasks, bounds, isCurrentSelection) {
  const added = tasks.filter((task) => {
    const assignedDate =
      task.assigned_on || (task.created_at ? task.created_at.slice(0, 10) : '')
    return inBounds(assignedDate, bounds)
  })

  const completedInWeek = tasks
    .filter((task) => {
      if (task.status !== 'done') return false
      const updatedDate = task.status_updated_at || task.due_date || ''
      return inBounds(updatedDate, bounds)
    })
    .map((task) => ({
      ...task,
      removalType: 'completed',
      fromStatus: task.previous_status || 'doing',
      toStatus: 'done',
      actionDate: task.status_updated_at || task.due_date,
    }))

  const deletedInWeek = deletedTasks
    .filter((task) => inBounds(task.deleted_at, bounds))
    .map((task) => ({
      ...task,
      removalType: 'deleted',
      fromStatus: task.previous_status || 'todo',
      toStatus: 'deleted',
      actionDate: task.deleted_at,
    }))

  const removed = [...completedInWeek, ...deletedInWeek].sort((a, b) =>
    (b.actionDate || '').localeCompare(a.actionDate || ''),
  )

  const statusChanged = [
    ...tasks
      .filter((task) => {
        const updatedDate = task.status_updated_at || ''
        return (
          inBounds(updatedDate, bounds) &&
          task.previous_status &&
          task.previous_status !== task.status
        )
      })
      .map((task) => ({
        ...task,
        fromStatus: task.previous_status,
        toStatus: task.status,
        actionDate: task.status_updated_at,
        isDeleted: false,
      })),
    ...deletedInWeek.map((task) => ({
      ...task,
      isDeleted: true,
    })),
  ].sort((a, b) => (b.actionDate || '').localeCompare(a.actionDate || ''))

  const activeTasks = isCurrentSelection
    ? tasks
    : tasks.filter((task) => {
        const assignedDate =
          task.assigned_on || (task.created_at ? task.created_at.slice(0, 10) : '')
        return !assignedDate || assignedDate <= bounds.end
      })

  const statusCounts = { todo: 0, doing: 0, review: 0, done: 0 }
  for (const task of activeTasks) {
    const effectiveStatus =
      !isCurrentSelection &&
      task.status_updated_at &&
      task.status_updated_at > bounds.end &&
      task.previous_status
        ? task.previous_status
        : task.status
    if (statusCounts[effectiveStatus] !== undefined) {
      statusCounts[effectiveStatus] += 1
    }
  }

  return {
    bounds,
    added,
    removed,
    completedInWeek,
    deletedInWeek,
    statusChanged,
    totalActive: activeTasks.length,
    statusCounts,
  }
}

function MatrixDetailCell({ items = [], onOpen }) {
  const [expanded, setExpanded] = useState(false)
  if (!items.length) return null

  const visibleItems = expanded || items.length <= 3 ? items : items.slice(0, 3)
  const remaining = items.length - 3

  return (
    <div className="matrix-detail-cell-content">
      <ul className="matrix-detail-list">
        {visibleItems.map((t) => {
          const toLabel =
            t.toStatus === 'deleted'
              ? 'Đã xóa'
              : statuses[t.toStatus]?.label || t.toStatus
          const fromLabel =
            statuses[t.fromStatus]?.label || t.fromStatus

          const transText =
            t.fromStatus && t.toStatus && t.fromStatus !== t.toStatus
              ? ` "${t.title}" ${fromLabel} => ${toLabel}`
              : ` "${t.title}"`
          return (
            <li key={t.id}>
              <button
                type="button"
                className="matrix-task-bullet-btn"
                onClick={() => onOpen(t)}
              >
                • {transText}
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > 3 && (
        <button
          type="button"
          className="matrix-toggle-btn"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? '▲ Thu gọn' : `▼ Xem thêm (+${remaining} công việc)`}
        </button>
      )}
    </div>
  )
}

const weekOptions = [
  { offset: 0, label: 'Tuần hiện tại' },
  { offset: -1, label: 'Tuần trước' },
  { offset: -2, label: '2 tuần trước' },
]

const compareOptions = [
  { offset: -1, label: 'Tuần trước' },
  { offset: -2, label: '2 tuần trước' },
  { offset: -3, label: '3 tuần trước' },
]

export function ReportPanel({
  tasks,
  deletedTasks = [],
  members = [],
  memberMap,
  today,
  onOpen,
}) {
  const [targetWeek, setTargetWeek] = useState(0)
  const [compareWeek, setCompareWeek] = useState(-1)
  const [memberFilter, setMemberFilter] = useState('all')

  const effectiveCompare =
    compareWeek >= targetWeek ? targetWeek - 1 : compareWeek

  const scopedTasks =
    memberFilter === 'all'
      ? tasks
      : tasks.filter((task) => task.assignee_ids.includes(memberFilter))
  const scopedDeleted =
    memberFilter === 'all'
      ? deletedTasks
      : deletedTasks.filter((task) =>
          task.assignee_ids?.includes(memberFilter),
        )

  const targetBounds = getWeekBounds(today, targetWeek)
  const compareBounds = getWeekBounds(today, effectiveCompare)

  const targetCutoff = targetWeek === 0 ? today : targetBounds.end
  const compareCutoff = compareBounds.end

  const targetMatrix = buildStructuredMatrix(
    scopedTasks,
    scopedDeleted,
    targetBounds,
    targetCutoff,
    targetWeek === 0,
  )
  const compareMatrix = buildStructuredMatrix(
    scopedTasks,
    scopedDeleted,
    compareBounds,
    compareCutoff,
    false,
  )

  const currentReport = buildWeekReport(
    scopedTasks,
    scopedDeleted,
    targetBounds,
    targetWeek === 0,
  )
  const previousReport = buildWeekReport(
    scopedTasks,
    scopedDeleted,
    compareBounds,
    false,
  )

  const targetLabel =
    weekOptions.find((w) => w.offset === targetWeek)?.label || 'Tuần đang chọn'
  const compareLabel =
    compareOptions.find((w) => w.offset === effectiveCompare)?.label ||
    'Tuần trước'

  const cutoffDateLabel = fullDate(targetCutoff).slice(0, 5)

  return (
    <div className="report-page">
      <section className="panel report-toolbar">
        <div className="report-toolbar-group">
          <div className="report-filter-item">
            <label htmlFor="report-target-week">Kỳ báo cáo</label>
            <select
              id="report-target-week"
              value={targetWeek}
              onChange={(event) => {
                const next = Number(event.target.value)
                setTargetWeek(next)
                if (compareWeek >= next) setCompareWeek(next - 1)
              }}
            >
              {weekOptions.map((item) => {
                const b = getWeekBounds(today, item.offset)
                return (
                  <option key={item.offset} value={item.offset}>
                    {item.label} ({b.rangeLabel})
                  </option>
                )
              })}
            </select>
          </div>
          <div className="report-filter-item">
            <label htmlFor="report-compare-week">So sánh với</label>
            <select
              id="report-compare-week"
              value={effectiveCompare}
              onChange={(event) => setCompareWeek(Number(event.target.value))}
            >
              {compareOptions
                .filter((item) => item.offset < targetWeek)
                .map((item) => {
                  const b = getWeekBounds(today, item.offset)
                  return (
                    <option key={item.offset} value={item.offset}>
                      {item.label} ({b.rangeLabel})
                    </option>
                  )
                })}
            </select>
          </div>
          {members.length > 0 && (
            <div className="report-filter-item">
              <label htmlFor="report-member-filter">Nhân sự</label>
              <select
                id="report-member-filter"
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
              >
                <option value="all">Tất cả thành viên</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="report-period-summary">
          <span>
            Đang so sánh <strong>{targetLabel}</strong> (
            {targetBounds.rangeLabel}) với <strong>{compareLabel}</strong> (
            {compareBounds.rangeLabel})
          </span>
        </div>
      </section>

      {/* Bảng báo cáo tiến độ theo mẫu chuẩn */}
      <section className="panel report-section">
        <div className="report-section-header">
          <div>
            <h2>Báo cáo trạng thái & tiến độ công việc</h2>
            <p>
              Đánh giá tiến độ dựa vào Ngày giao và Hạn hoàn thành lũy kế đến ngày{' '}
              <strong>{cutoffDateLabel}</strong>, đối chiếu với{' '}
              <strong>{compareLabel.toLowerCase()}</strong>
            </p>
          </div>
        </div>

        {/* Bảng ma trận hiển thị trên Desktop / Tablet */}
        <div className="report-table-wrap report-table-desktop">
          <table className="report-matrix-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Trạng thái công việc</th>
                <th style={{ width: '18%' }}>Mức độ hoàn thành</th>
                <th style={{ width: '14%', textAlign: 'center' }}>
                  Số lượng lũy kế đến {cutoffDateLabel}
                </th>
                <th style={{ width: '14%', textAlign: 'center' }}>
                  So sánh với {compareLabel}
                </th>
                <th style={{ width: '36%' }}>
                  Chi tiết Đầu mục công việc thay đổi trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {REPORT_SECTIONS.map((sec) => {
                return sec.levels.map((lev, levIdx) => {
                  const curTasks = targetMatrix.matrix[sec.key]?.[lev.key] || []
                  const curCount = curTasks.length
                  const prevCount = compareMatrix.matrix[sec.key]?.[lev.key]?.length || 0
                  const diff = curCount - prevCount

                  // Lọc công việc trong nhóm này có thay đổi trạng thái hoặc mới cập nhật trong kỳ
                  const changedInGroup = currentReport.statusChanged.filter((t) => {
                    if (t.isDeleted) return sec.key === 'deleted'
                    if (sec.key === 'deleted') return false
                    const statusKey = getTaskEffectiveStatusKey(t)
                    if (statusKey !== sec.key) return false
                    const pace = getTaskPace(t, targetCutoff)
                    return pace === lev.key
                  })

                  // Nếu không có statusChanged khớp riêng, nhưng có công việc trong nhóm, hiển thị bullet đầu mục
                  const itemsToShow = changedInGroup.length > 0 ? changedInGroup : curTasks

                  return (
                    <tr key={sec.key + '-' + lev.key}>
                      {levIdx === 0 && (
                        <td
                          rowSpan={sec.levels.length}
                          className="matrix-status-cell"
                        >
                          <strong>{sec.label}</strong>
                        </td>
                      )}
                      <td className="matrix-pace-cell">
                        {lev.label || '—'}
                      </td>
                      <td className="matrix-count-cell">
                        <strong>{curCount}</strong>
                      </td>
                      <td
                        className={
                          'matrix-diff-cell ' +
                          (diff > 0 ? 'up' : diff < 0 ? 'down' : 'zero')
                        }
                      >
                        {diff > 0 ? '+' + diff : diff}
                      </td>
                      <td className="matrix-detail-cell">
                        <MatrixDetailCell items={itemsToShow} onOpen={onOpen} />
                      </td>
                    </tr>
                  )
                })
              })}
              <tr className="matrix-total-row">
                <td colSpan={2}>
                  <strong>Tổng công việc</strong>
                </td>
                <td className="matrix-count-cell">
                  <strong>{targetMatrix.totalActive}</strong>
                </td>
                <td
                  className={
                    'matrix-diff-cell ' +
                    (targetMatrix.totalActive - compareMatrix.totalActive > 0
                      ? 'up'
                      : targetMatrix.totalActive - compareMatrix.totalActive < 0
                        ? 'down'
                        : 'zero')
                  }
                >
                  <strong>
                    {targetMatrix.totalActive - compareMatrix.totalActive > 0
                      ? '+' + (targetMatrix.totalActive - compareMatrix.totalActive)
                      : targetMatrix.totalActive - compareMatrix.totalActive}
                  </strong>
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Giao diện Thẻ (Card) tối ưu riêng cho Mobile theo đúng mẫu chuẩn trực quan */}
        <div className="report-matrix-cards-wrap">
          {/* Card Tổng quan */}
          <div className="matrix-mobile-summary-card">
            <h3 className="m-card-title">Tổng công việc</h3>
            <div className="m-field-line">
              <span className="m-label">
                Số lượng lũy kế đến {cutoffDateLabel}:
              </span>
              <strong className="m-val">{targetMatrix.totalActive}</strong>
            </div>
            <div className="m-field-line">
              <span className="m-label">
                So sánh với {compareLabel}:
              </span>
              <strong
                className={
                  'm-val ' +
                  (targetMatrix.totalActive - compareMatrix.totalActive > 0
                    ? 'up'
                    : targetMatrix.totalActive - compareMatrix.totalActive < 0
                      ? 'down'
                      : 'zero')
                }
              >
                {targetMatrix.totalActive - compareMatrix.totalActive > 0
                  ? '+' + (targetMatrix.totalActive - compareMatrix.totalActive)
                  : targetMatrix.totalActive - compareMatrix.totalActive}
              </strong>
            </div>
          </div>

          {/* Các Thẻ trạng thái */}
          {REPORT_SECTIONS.map((sec) => {
            const secTotal = sec.levels.reduce(
              (acc, lev) => acc + (targetMatrix.matrix[sec.key]?.[lev.key]?.length || 0),
              0,
            )

            return (
              <div key={'mcard-' + sec.key} className={'matrix-status-card card-' + sec.key}>
                <div className="matrix-card-header-simple">
                  <span className={'status-dot-indicator dot-' + sec.key}></span>
                  <h3 className="m-card-title">{sec.label}</h3>
                  <span className="m-card-count-badge">{secTotal} việc</span>
                </div>

                <div className="matrix-status-card-body-simple">
                  {sec.levels.map((lev, levIdx) => {
                    const curTasks = targetMatrix.matrix[sec.key]?.[lev.key] || []
                    const curCount = curTasks.length
                    const prevCount = compareMatrix.matrix[sec.key]?.[lev.key]?.length || 0
                    const diff = curCount - prevCount

                    const changedInGroup = currentReport.statusChanged.filter((t) => {
                      if (t.isDeleted) return sec.key === 'deleted'
                      if (sec.key === 'deleted') return false
                      const statusKey = getTaskEffectiveStatusKey(t)
                      if (statusKey !== sec.key) return false
                      const pace = getTaskPace(t, targetCutoff)
                      return pace === lev.key
                    })

                    const itemsToShow = changedInGroup.length > 0 ? changedInGroup : curTasks

                    return (
                      <div
                        key={'mlevel-' + sec.key + '-' + lev.key}
                        className={'matrix-pace-block ' + (levIdx > 0 ? 'has-divider' : '')}
                      >
                        {lev.label && (
                          <div className="m-pace-heading">
                            <span className={'m-pace-tag pace-' + lev.key}>
                              {lev.label}
                            </span>
                          </div>
                        )}

                        <div className="m-field-line">
                          <span className="m-label">
                            Số lượng lũy kế đến {cutoffDateLabel}:
                          </span>
                          <strong className="m-val">{curCount}</strong>
                        </div>

                        <div className="m-field-line">
                          <span className="m-label">
                            So sánh với {compareLabel}:
                          </span>
                          <strong
                            className={
                              'm-val ' +
                              (diff > 0 ? 'up' : diff < 0 ? 'down' : 'zero')
                            }
                          >
                            {diff > 0 ? '+' + diff : diff}
                          </strong>
                        </div>

                        <div className="m-detail-section">
                          <span className="m-detail-label">
                            Chi tiết Đầu mục công việc thay đổi trạng thái:
                          </span>
                          {itemsToShow.length > 0 ? (
                            <MatrixDetailCell items={itemsToShow} onOpen={onOpen} />
                          ) : (
                            <span className="m-empty-text">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
