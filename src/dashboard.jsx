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

  const activeTasks = tasks.filter((task) => {
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

function StatusTransitionCell({ fromStatus, toStatus }) {
  const fromItem = statuses[fromStatus] || { label: 'Mới tạo', color: 'gray' }
  const toItem =
    toStatus === 'deleted'
      ? { label: 'Đã xóa', color: 'red-badge' }
      : statuses[toStatus] || { label: toStatus, color: 'gray' }
  return (
    <div className="report-transition">
      <span className={'badge ' + fromItem.color}>
        <span className="status-dot" />
        {fromItem.label}
      </span>
      <ArrowRight size={14} className="report-transition-arrow" />
      <span className={'badge ' + toItem.color}>
        <span className="status-dot" />
        {toItem.label}
      </span>
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

      <section className="panel report-section">
        <div className="report-section-header">
          <div>
            <h2>So sánh số lượng theo trạng thái</h2>
            <p>
              Đối chiếu phân bổ trạng thái công việc giữa{' '}
              <strong>{targetLabel}</strong> và <strong>{compareLabel}</strong>
            </p>
          </div>
        </div>
        <div className="report-status-grid">
          {Object.entries(statuses).map(([key, item]) => {
            const cur = currentReport.statusCounts[key] ?? 0
            const prev = previousReport.statusCounts[key] ?? 0
            const diff = cur - prev
            return (
              <div className={'report-status-card ' + item.color} key={key}>
                <div className="report-status-head">
                  <span className={'badge ' + item.color}>
                    <span className="status-dot" />
                    {item.label}
                  </span>
                  <span
                    className={
                      'report-status-diff' +
                      (diff > 0 ? ' up' : diff < 0 ? ' down' : '')
                    }
                  >
                    {diff > 0 ? '+' + diff : diff === 0 ? '0' : diff} so với{' '}
                    {compareLabel.toLowerCase()}
                  </span>
                </div>
                <div className="report-status-values">
                  <div>
                    <small>{targetLabel}</small>
                    <strong>{cur} việc</strong>
                  </div>
                  <div className="report-status-prev">
                    <small>{compareLabel}</small>
                    <span>{prev} việc</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="report-split-grid">
        <section className="panel report-section">
          <div className="report-section-header">
            <div>
              <h2>
                Công việc thêm mới ({currentReport.added.length} việc)
              </h2>
              <p>
                Các công việc được giao thêm trong{' '}
                <strong>{targetLabel}</strong> ({compareLabel}:{' '}
                {previousReport.added.length} việc) và trạng thái hiện tại
              </p>
            </div>
            <span className="badge purple">
              +{currentReport.added.length} việc thêm
            </span>
          </div>
          {currentReport.added.length === 0 ? (
            <p className="muted report-empty">
              Không có công việc mới nào được thêm trong kỳ này.
            </p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Công việc thêm mới</th>
                    <th>Người được giao</th>
                    <th>Ngày giao</th>
                    <th>Trạng thái hiện tại</th>
                  </tr>
                </thead>
                <tbody>
                  {currentReport.added.map((task) => {
                    const assignees = task.assignee_ids
                      .map((id) => memberMap[id])
                      .filter(Boolean)
                    return (
                      <tr key={task.id}>
                        <td>
                          <button
                            type="button"
                            className="report-task-link"
                            onClick={() => onOpen(task)}
                          >
                            {task.title}
                          </button>
                        </td>
                        <td>
                          <div className="report-people-cell">
                            <People
                              ids={task.assignee_ids}
                              memberMap={memberMap}
                            />
                            <span>
                              {assignees
                                .map((p) => p.display_name)
                                .join(', ') || 'Chưa phân công'}
                            </span>
                          </div>
                        </td>
                        <td className="report-date-cell">
                          {fullDate(task.assigned_on)}
                        </td>
                        <td>
                          {task.previous_status &&
                          task.previous_status !== task.status ? (
                            <StatusTransitionCell
                              fromStatus={task.previous_status}
                              toStatus={task.status}
                            />
                          ) : (
                            <StatusBadge status={task.status} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel report-section">
          <div className="report-section-header">
            <div>
              <h2>
                Công việc bớt đi ({currentReport.removed.length} việc)
              </h2>
              <p>
                Các công việc đã giải quyết xong hoặc đã xóa khỏi danh sách đang
                làm trong <strong>{targetLabel}</strong> ({compareLabel}:{' '}
                {previousReport.removed.length} việc)
              </p>
            </div>
            <span className="badge green">
              -{currentReport.removed.length} việc bớt
            </span>
          </div>
          {currentReport.removed.length === 0 ? (
            <p className="muted report-empty">
              Chưa có công việc nào hoàn thành hoặc xóa trong kỳ này.
            </p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Công việc bớt đi</th>
                    <th>Người thực hiện</th>
                    <th>Ngày xử lý</th>
                    <th>Đã chuyển sang trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {currentReport.removed.map((task) => {
                    const assignees = (task.assignee_ids ?? [])
                      .map((id) => memberMap[id])
                      .filter(Boolean)
                    return (
                      <tr key={task.id}>
                        <td>
                          {task.removalType === 'deleted' ? (
                            <span className="report-task-deleted">
                              {task.title}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="report-task-link"
                              onClick={() => onOpen(task)}
                            >
                              {task.title}
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="report-people-cell">
                            <People
                              ids={task.assignee_ids ?? []}
                              memberMap={memberMap}
                            />
                            <span>
                              {assignees
                                .map((p) => p.display_name)
                                .join(', ') || 'Chưa phân công'}
                            </span>
                          </div>
                        </td>
                        <td className="report-date-cell">
                          {fullDate(task.actionDate)}
                        </td>
                        <td>
                          <StatusTransitionCell
                            fromStatus={task.fromStatus}
                            toStatus={task.toStatus}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="panel report-section">
        <div className="report-section-header">
          <div>
            <h2>
              Chi tiết chuyển đổi trạng thái công việc (
              {currentReport.statusChanged.length} công việc)
            </h2>
            <p>
              Theo dõi cụ thể từng công việc đã chuyển từ trạng thái nào sang
              trạng thái nào trong <strong>{targetLabel}</strong>
            </p>
          </div>
        </div>
        {currentReport.statusChanged.length === 0 ? (
          <p className="muted report-empty">
            Chưa có công việc nào thay đổi trạng thái trong kỳ này.
          </p>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Công việc</th>
                  <th>Người được giao</th>
                  <th>Trạng thái trước → Trạng thái mới</th>
                  <th>Ngày cập nhật</th>
                  <th>Hạn hoàn thành</th>
                </tr>
              </thead>
              <tbody>
                {currentReport.statusChanged.map((task) => {
                  const assignees = (task.assignee_ids ?? [])
                    .map((id) => memberMap[id])
                    .filter(Boolean)
                  return (
                    <tr key={task.id}>
                      <td>
                        {task.isDeleted ? (
                          <span className="report-task-deleted">
                            {task.title}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="report-task-link"
                            onClick={() => onOpen(task)}
                          >
                            {task.title}
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="report-people-cell">
                          <People
                            ids={task.assignee_ids ?? []}
                            memberMap={memberMap}
                          />
                          <span>
                            {assignees.map((p) => p.display_name).join(', ') ||
                              'Chưa phân công'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusTransitionCell
                          fromStatus={task.fromStatus}
                          toStatus={task.toStatus}
                        />
                      </td>
                      <td className="report-date-cell">
                        {fullDate(task.actionDate)}
                      </td>
                      <td className="report-date-cell">
                        {fullDate(task.due_date)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
