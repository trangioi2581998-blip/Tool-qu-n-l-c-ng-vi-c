import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  Crown,
  LockKeyhole,
  MessageCircle,
  Plus,
  Repeat,
  Send,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { DeadlineExtension } from './workflow.jsx'
import { TaskAttachments } from './task-attachments.jsx'
import {
  Avatar,
  DatePicker,
  Dialog,
  ErrorText,
  IconButton,
  readableError,
} from './ui.jsx'
import {
  fullDate,
  normalize,
  parseDay,
  priorities,
  shiftDay,
  shortDateTime,
  statuses,
  taskLevelCode,
  taskCompletionError,
} from './model.js'

function Comments({ task, repo }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    repo
      .listComments(task)
      .then((rows) => {
        if (active) setComments(rows)
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
  }, [task.id, repo])
  async function send(event) {
    event.preventDefault()
    if (!body.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const item = await repo.addComment(task, body.trim())
      setComments((current) => [...current, item])
      setBody('')
    } catch (error) {
      setError(readableError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="comments">
      <div className="comments-list">
        <h3>
          <MessageCircle size={17} /> Trao đổi
        </h3>
        {loading && <p className="muted">Đang tải bình luận…</p>}
        {!loading && !comments.length && !error && (
          <p className="muted">Chưa có bình luận.</p>
        )}
        {comments.map((comment) => (
          <article className="comment" key={comment.id}>
            <Avatar name={comment.author_name} id={comment.author_id} size="sm" />
            <div>
              <strong>{comment.author_name}</strong>{' '}
              <time dateTime={comment.created_at}>
                {shortDateTime.format(new Date(comment.created_at))}
              </time>
              <p>{comment.body}</p>
            </div>
          </article>
        ))}
        <ErrorText message={error} />
      </div>
      <form className="comment-form dialog-footer" onSubmit={send}>
        <input
          aria-label="Bình luận"
          placeholder="Viết bình luận…"
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <button
          className="button secondary"
          disabled={loading || busy || !body.trim()}
        >
          <Send size={15} /> Gửi
        </button>
      </form>
    </section>
  )
}

function AssigneePicker({
  members,
  selected,
  onChange,
  disabled,
  onEdit,
  initiallyOpen,
}) {
  const [query, setQuery] = useState('')
  const names = members
    .filter((member) => selected.includes(member.user_id))
    .map((member) => member.display_name)
  const results = members.filter((member) =>
    normalize(member.display_name).includes(normalize(query.trim())),
  )
  return (
    <div className="assignee-field">
      <p className="field-label">Người thực hiện</p>
      {disabled ? (
        <div className="assignee-readout">
          <p className="assigned-readonly">
            {names.join(', ') || 'Chưa phân công'}
          </p>
          {onEdit && (
            <button type="button" className="link-button" onClick={onEdit}>
              Đổi người thực hiện L1
            </button>
          )}
        </div>
      ) : (
        <details className="assignee-picker" open={initiallyOpen || undefined}>
          <summary>
            <UsersRound size={15} />
            <span>
              {selected.length
                ? 'Đã chọn ' + selected.length + ' người'
                : 'Chọn một hoặc nhiều người'}
            </span>
            <ChevronDown size={15} />
          </summary>
          <div className="assignee-options">
            <input
              aria-label="Tìm thành viên"
              placeholder="Tìm thành viên…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="assignee-results">
              {results.map((member) => (
                <label className="assignee-option" key={member.user_id}>
                  <input
                    type="checkbox"
                    aria-label={member.display_name}
                    checked={selected.includes(member.user_id)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...selected, member.user_id]
                          : selected.filter((id) => id !== member.user_id),
                      )
                    }
                  />
                  <Avatar
                    name={member.display_name}
                    id={member.user_id}
                    size="sm"
                  />
                  <span>{member.display_name}</span>
                </label>
              ))}
              {results.length === 0 && (
                <p className="muted">Không tìm thấy thành viên.</p>
              )}
            </div>
          </div>
        </details>
      )}
      {!disabled && names.length > 0 && (
        <div className="assignee-chips">
          {names.map((name, index) => (
            <span key={index}>{name}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskTree({ root, children }) {
  return (
    <ul className="task-tree" aria-label="Cây công việc">
      <li>
        {root}
        {children && (
          <ul className="task-tree-branches" aria-label="Công việc con">
            {children}
          </ul>
        )}
      </li>
    </ul>
  )
}

function TaskNode({ level, title, actions, children, active = false }) {
  return (
    <section
      className={
        (level === 1 ? 'tree-main-card' : 'tree-child-card') +
        (active ? ' tree-node-active' : '')
      }
      aria-current={active ? 'true' : undefined}
    >
      <div className="task-node-header">
        <div className="task-node-title">{title}</div>
        {actions && <div className="task-node-actions">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function TaskDescription({ code, value, change }) {
  if (!change)
    return (
      <div className="task-description">
        <span className="field-label">Mô tả</span>
        <p className={'task-description-value' + (value ? '' : ' muted')}>
          {value || 'Chưa có mô tả.'}
        </p>
      </div>
    )
  return (
    <label className="task-description">
      <span>
        Mô tả <small className="optional-label">(không bắt buộc)</small>
      </span>
      <textarea
        aria-label={'Mô tả ' + code}
        rows={2}
        maxLength={4000}
        value={value}
        onChange={(event) => change(event.target.value)}
        placeholder="Thêm bối cảnh hoặc kết quả mong đợi…"
      />
    </label>
  )
}

function TaskNodeToggle({ code, expanded, toggle }) {
  return (
    <IconButton
      label={(expanded ? 'Thu gọn ' : 'Mở thuộc tính ') + code}
      aria-expanded={expanded}
      onClick={toggle}
    >
      <ChevronDown size={15} className={expanded ? 'tree-chevron-open' : ''} />
    </IconButton>
  )
}

function RelatedTaskNode({ task, members, user, onOpen, canReassign, repo }) {
  const [expanded, setExpanded] = useState(true)
  const code = taskLevelCode(task)
  const values = {
    assignees: task.assignee_ids,
    status: task.status,
    priority: task.priority,
    assignedOn: task.assigned_on || '',
    assignedTime: task.assigned_time || '09:00',
    due: task.due_date || '',
    dueTime: task.due_time || '17:30',
  }
  return (
    <TaskNode
      level={task.level}
      code={code}
      title={
        <button
          type="button"
          className="task-node-link"
          aria-label={'Mở ' + code + ' ' + task.title}
          onClick={() => onOpen(task)}
        >
          {task.title}
        </button>
      }
      actions={
        <TaskNodeToggle
          code={code}
          expanded={expanded}
          toggle={() => setExpanded(!expanded)}
        />
      }
    >
      {expanded ? (
        <>
          <TaskDescription code={code} value={task.description} />
          <TaskAttributes
            label={'Thông tin ' + code}
            {...{ values, members, user }}
            teamTask={Boolean(task.team_id)}
            editable={false}
            canOrganize={false}
            onEditAssignees={
              canReassign
                ? () => onOpen(task, { focusAssignees: true })
                : undefined
            }
          />
          <TaskAttachments {...{ code, task, repo }} collapsed />
        </>
      ) : (
        <p className="muted tree-summary">
          {statuses[task.status].label} · Ưu tiên{' '}
          {priorities[task.priority].label}
        </p>
      )}
    </TaskNode>
  )
}

function TaskAttributes({
  label,
  values,
  change,
  members,
  user,
  teamTask,
  canOrganize,
  onEditAssignees,
  focusAssignees,
  editable = true,
  pending = false,
  requireDates,
  enforceDateOrder,
  blockDone = false,
  parentDone = false,
}) {
  return (
    <div className="task-attributes" role="group" aria-label={label}>
      {teamTask ? (
        <AssigneePicker
          members={members}
          selected={values.assignees}
          onChange={(people) => change?.('assignees', people)}
          disabled={!canOrganize}
          onEdit={onEditAssignees}
          initiallyOpen={focusAssignees}
        />
      ) : (
        <div className="assignee-field">
          <span className="field-label">Người thực hiện</span>
          <p className="assigned-readonly">{user.name}</p>
        </div>
      )}
      <div className="form-grid">
        <label>
          Trạng thái
          <select
            value={values.status}
            disabled={!editable}
            onChange={(event) => change?.('status', event.target.value)}
          >
            {Object.entries(statuses).map(([key, item]) => (
              <option
                value={key}
                key={key}
                disabled={
                  (key === 'done' && blockDone) ||
                  (key !== 'done' && parentDone)
                }
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ưu tiên
          <select
            value={values.priority}
            disabled={!editable}
            onChange={(event) => change?.('priority', event.target.value)}
          >
            {Object.entries(priorities).map(([key, item]) => (
              <option value={key} key={key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <div className="datepicker-field">
          <span className="field-label">Ngày giao</span>
          <DatePicker
            withTime
            required={requireDates}
            disabled={!canOrganize || pending}
            value={values.assignedOn}
            time={values.assignedTime || '09:00'}
            onChange={(val) => change?.('assignedOn', val)}
            onTimeChange={(val) => change?.('assignedTime', val)}
          />
        </div>
        <div className="datepicker-field">
          <span className="field-label">Ngày hoàn thành (hạn)</span>
          <DatePicker
            withTime
            required={requireDates}
            disabled={!canOrganize || pending}
            value={values.due}
            time={values.dueTime || '17:30'}
            min={enforceDateOrder ? values.assignedOn : ''}
            align="right"
            onChange={(val) => change?.('due', val)}
            onTimeChange={(val) => change?.('dueTime', val)}
          />
        </div>
      </div>
    </div>
  )
}

function buildRecurringCycles({
  title,
  assignedOn,
  due,
  repeatInterval,
  customWeeks,
  repeatRangeType,
  repeatCount,
  repeatUntil,
  repeatNaming,
  startStep = 0,
}) {
  const weeks =
    repeatInterval === 'custom'
      ? Math.max(1, Math.min(52, Number(customWeeks) || 1))
      : Number(repeatInterval) || 0
  if (!weeks || !assignedOn || !due || due < assignedOn) return []

  const baseTitle = title.trim() || 'Công việc định kỳ'
  const startAssigned = parseDay(assignedOn)
  const startDue = parseDay(due)
  const rawList = []

  if (repeatRangeType === 'until' && repeatUntil && repeatUntil >= assignedOn) {
    for (let i = 0; i < 52; i++) {
      const k = startStep + i
      const offsetDays = k * weeks * 7
      const cycleAssigned = shiftDay(offsetDays, startAssigned)
      if (cycleAssigned > repeatUntil) break
      const cycleDue = shiftDay(offsetDays, startDue)
      rawList.push({ k, offsetDays, assignedOn: cycleAssigned, due: cycleDue })
    }
  } else {
    const count = Math.max(1, Math.min(52, Number(repeatCount) || 4))
    for (let i = 0; i < count; i++) {
      const k = startStep + i
      const offsetDays = k * weeks * 7
      rawList.push({
        k,
        offsetDays,
        assignedOn: shiftDay(offsetDays, startAssigned),
        due: shiftDay(offsetDays, startDue),
      })
    }
  }

  return rawList.map((item, idx) => {
    const cycleNo = idx + 1
    const shortDue = fullDate(item.due).slice(0, 5)
    let cycleTitle = baseTitle
    if (repeatNaming === 'cycle_date') {
      cycleTitle = `${baseTitle} (Kỳ ${cycleNo} · ${shortDue})`
    } else if (repeatNaming === 'date') {
      cycleTitle = `${baseTitle} (${fullDate(item.due)})`
    }
    return {
      ...item,
      cycleNo,
      title: cycleTitle.slice(0, 160),
    }
  })
}

function RecurringScheduleSection({
  isExistingTask = false,
  assignedOn,
  assignedTime,
  due,
  dueTime,
  repeatInterval,
  setRepeatInterval,
  customWeeks,
  setCustomWeeks,
  repeatRangeType,
  setRepeatRangeType,
  repeatCount,
  setRepeatCount,
  repeatUntil,
  setRepeatUntil,
  repeatNaming,
  setRepeatNaming,
  cycles,
  excludedCycles,
  setExcludedCycles,
}) {
  const isRepeating = repeatInterval !== '0'
  const activeCount = cycles.filter(
    (c) => !excludedCycles.includes(c.k),
  ).length

  return (
    <section className="task-relations recurring-section">
      <header>
        <h3>
          <Repeat size={15} />{' '}
          {isExistingTask
            ? 'Lặp lại định kỳ (Tạo thêm các kỳ tiếp theo)'
            : 'Lặp lại định kỳ (Tạo nhiều kỳ cùng lúc)'}
        </h3>
        {isRepeating && activeCount > 0 && (
          <span className="badge purple">
            {isExistingTask
              ? `Sẽ tạo thêm ${activeCount} kỳ`
              : `Sẽ tạo ${activeCount} kỳ`}
          </span>
        )}
      </header>
      <div className="recurring-controls">
        <div className="form-grid">
          <label>
            Chu kỳ lặp lại
            <select
              value={repeatInterval}
              onChange={(e) => {
                setRepeatInterval(e.target.value)
                setExcludedCycles([])
              }}
            >
              <option value="0">Không lặp lại (Chỉ tạo 1 lần)</option>
              <option value="1">Hàng tuần (1 tuần/lần)</option>
              <option value="2">2 tuần/lần</option>
              <option value="3">3 tuần/lần</option>
              <option value="4">4 tuần/lần (1 tháng)</option>
              <option value="custom">Tùy chỉnh số tuần…</option>
            </select>
          </label>
          {repeatInterval === 'custom' && (
            <label>
              Số tuần mỗi chu kỳ
              <input
                type="number"
                min={1}
                max={52}
                value={customWeeks}
                onChange={(e) => {
                  setCustomWeeks(e.target.value)
                  setExcludedCycles([])
                }}
              />
            </label>
          )}
          {isRepeating && (
            <label>
              Cách giới hạn kỳ tạo
              <select
                value={repeatRangeType}
                onChange={(e) => {
                  setRepeatRangeType(e.target.value)
                  setExcludedCycles([])
                }}
              >
                <option value="count">Theo tổng số kỳ muốn tạo</option>
                <option value="until">Lặp đến hết ngày kết thúc</option>
              </select>
            </label>
          )}
        </div>

        {isRepeating && (
          <div className="form-grid">
            {repeatRangeType === 'count' ? (
              <label>
                Số lượng kỳ tạo ra (từ 2 đến 52 kỳ)
                <input
                  type="number"
                  min={2}
                  max={52}
                  value={repeatCount}
                  onChange={(e) => {
                    setRepeatCount(e.target.value)
                    setExcludedCycles([])
                  }}
                />
              </label>
            ) : (
              <div className="datepicker-field">
                <span className="field-label">Lặp đến hết ngày</span>
                <DatePicker
                  value={repeatUntil}
                  min={assignedOn}
                  align="right"
                  onChange={(val) => {
                    setRepeatUntil(val)
                    setExcludedCycles([])
                  }}
                />
              </div>
            )}
            <label>
              Cách đánh dấu tên từng kỳ
              <select
                value={repeatNaming}
                onChange={(e) => setRepeatNaming(e.target.value)}
              >
                <option value="cycle_date">
                  Kèm số kỳ & ngày hạn (VD: Tên việc (Kỳ 1 · 16/11))
                </option>
                <option value="date">
                  Kèm ngày hạn (VD: Tên việc (16/11/2026))
                </option>
                <option value="plain">Giữ nguyên tên công việc</option>
              </select>
            </label>
          </div>
        )}

        {isRepeating && (!assignedOn || !due || due < assignedOn) && (
          <p className="muted field-hint">
            Hãy chọn Ngày giao và Ngày hoàn thành (hạn) hợp lệ ở trên để xem
            trước danh sách các kỳ.
          </p>
        )}

        {isRepeating && cycles.length > 0 && (
          <div className="recurring-preview">
            <div className="recurring-preview-head">
              <strong>
                Danh sách các kỳ sẽ tạo ({activeCount}/{cycles.length} kỳ)
              </strong>
              <small className="muted">
                Bỏ tích kỳ nào bạn muốn bỏ qua (VD: tuần nghỉ lễ)
              </small>
            </div>
            <div className="recurring-preview-list">
              {cycles.map((c) => {
                const checked = !excludedCycles.includes(c.k)
                return (
                  <label
                    key={c.k}
                    className={
                      'recurring-preview-item' + (!checked ? ' is-skipped' : '')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setExcludedCycles((prev) =>
                          checked
                            ? [...prev, c.k]
                            : prev.filter((item) => item !== c.k),
                        )
                      }}
                    />
                    <span className="recurring-cycle-badge">
                      Kỳ {c.cycleNo}
                    </span>
                    <span className="recurring-cycle-info">
                      <strong>{c.title}</strong>
                      <small>
                        Giao: {fullDate(c.assignedOn)} {assignedTime} → Hạn:{' '}
                        {fullDate(c.due)} {dueTime}
                      </small>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function requiredSchedule(values, teamTask) {
  if (teamTask && !values.assignees.length)
    return 'Hãy chọn ít nhất một người thực hiện.'
  if (!values.assignedOn || !values.due)
    return 'Hãy nhập ngày giao và ngày hoàn thành.'
  if (values.due < values.assignedOn)
    return 'Ngày hoàn thành phải từ ngày giao trở đi.'
  if (
    values.due === values.assignedOn &&
    values.dueTime &&
    values.assignedTime &&
    values.dueTime < values.assignedTime
  )
    return 'Giờ hoàn thành phải từ giờ giao trở đi.'
  return ''
}

export function TaskDialog({
  config,
  members,
  team,
  repo,
  isOwner,
  tasks,
  taskMap,
  childrenByTask,
  today,
  onUpdated,
  onOpen,
  onCreateChild,
  onClose,
  onSave,
  onDelete,
}) {
  const task = config.task
  const rootTask = task
    ? task.level === 2
      ? (taskMap[task.parent_id] ?? task)
      : (taskMap[task.id] ?? task)
    : null
  const creatingMain = !task && !config.parent
  const [childDrafts, setChildDrafts] = useState([])
  const childKey = useRef(0)
  const children = childrenByTask[rootTask?.id ?? task?.id] ?? []
  const [childEdits, setChildEdits] = useState(() =>
    children.map((child) => ({
      task: child,
      title: child.title,
      description: child.description || '',
      assignees: child.assignee_ids ?? [],
      status: child.status,
      priority: child.priority,
      assignedOn: child.assigned_on || '',
      assignedTime: child.assigned_time || '09:00',
      due: child.due_date || '',
      dueTime: child.due_time || '17:30',
      attachments: [],
      expanded: true,
    })),
  )
  const activeRoot = rootTask ?? task
  const [scope, setScope] = useState(
    activeRoot ? (activeRoot.team_id ? 'team' : 'private') : config.scope,
  )
  const [title, setTitle] = useState(activeRoot?.title || '')
  const [description, setDescription] = useState(activeRoot?.description || '')
  const [attachments, setAttachments] = useState([])
  const [assignees, setAssignees] = useState(
    activeRoot?.assignee_ids ?? config.parent?.assignee_ids ?? [],
  )
  const [level] = useState(activeRoot?.level ?? (config.parent ? 2 : 1))
  const [parent, setParent] = useState(
    activeRoot?.parent_id ?? config.parent?.id ?? '',
  )
  const parentTask = taskMap[parent]
  const parentOptions = tasks.filter(
    (candidate) =>
      candidate.id !== activeRoot?.id &&
      candidate.level === 1 &&
      candidate.team_id === (scope === 'team' ? team.id : null),
  )
  const [status, setStatus] = useState(
    activeRoot?.status || config.status || 'todo',
  )
  const [priority, setPriority] = useState(
    activeRoot?.priority || config.parent?.priority || 'medium',
  )
  const [due, setDue] = useState(
    activeRoot?.due_date || config.parent?.due_date || config.due || '',
  )
  const [dueTime, setDueTime] = useState(
    activeRoot?.due_time || config.parent?.due_time || '17:30',
  )
  const [assignedOn, setAssignedOn] = useState(
    activeRoot?.assigned_on || config.parent?.assigned_on || today,
  )
  const [assignedTime, setAssignedTime] = useState(
    activeRoot?.assigned_time || config.parent?.assigned_time || '09:00',
  )
  const [repeatInterval, setRepeatInterval] = useState('0')
  const [customWeeks, setCustomWeeks] = useState(2)
  const [repeatRangeType, setRepeatRangeType] = useState('count')
  const [repeatCount, setRepeatCount] = useState(4)
  const [repeatUntil, setRepeatUntil] = useState(() =>
    shiftDay(28, parseDay(today)),
  )
  const [repeatNaming, setRepeatNaming] = useState('cycle_date')
  const [excludedCycles, setExcludedCycles] = useState([])
  const allRecurringCycles = buildRecurringCycles({
    title,
    assignedOn,
    due,
    repeatInterval,
    customWeeks,
    repeatRangeType,
    repeatCount,
    repeatUntil,
    repeatNaming,
    startStep: task ? 1 : 0,
  })
  const activeRecurringCycles = allRecurringCycles.filter(
    (c) => !excludedCycles.includes(c.k),
  )
  const [pendingExtension, setPendingExtension] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState('overview')
  const canOrganize =
    !activeRoot ||
    (activeRoot.team_id ? isOwner : activeRoot.created_by === repo.user.id)
  const canEditMain =
    canOrganize ||
    Boolean(
      activeRoot?.team_id && activeRoot.assignee_ids.includes(repo.user.id),
    )
  const canEditAnyChild = childEdits.some((child) =>
    child.task.team_id
      ? isOwner || child.task.assignee_ids.includes(repo.user.id)
      : child.task.created_by === repo.user.id,
  )
  const canEdit = canEditMain || canEditAnyChild
  const teamTask = scope === 'team'
  const values = {
    assignees,
    status,
    priority,
    assignedOn,
    assignedTime,
    due,
    dueTime,
  }
  const setters = {
    assignees: setAssignees,
    status: setStatus,
    priority: setPriority,
    assignedOn: setAssignedOn,
    assignedTime: setAssignedTime,
    due: setDue,
    dueTime: setDueTime,
  }
  const changedDates =
    assignedOn !== activeRoot?.assigned_on ||
    assignedTime !== (activeRoot?.assigned_time || '09:00') ||
    due !== (activeRoot?.due_date || '') ||
    dueTime !== (activeRoot?.due_time || '17:30')
  const draftFields = (child) => ({
    ...values,
    status: 'todo',
    ...child.fields,
  })
  const childStates = [
    ...childEdits,
    ...childDrafts.map(draftFields),
  ]
  const remaining =
    level === 1
      ? childStates.filter((child) => child.status !== 'done').length
      : 0
  const parentDone = false

  function updateChild(id, patch) {
    setChildDrafts((current) => {
      const next = current.map((child) =>
        child.id === id ? { ...child, ...patch } : child,
      )
      const nextStates = [...childEdits, ...next.map(draftFields)]
      if (
        status === 'done' &&
        nextStates.some((child) => child.status !== 'done')
      ) {
        setStatus('doing')
      }
      return next
    })
  }

  function updateExistingChild(id, patch) {
    setChildEdits((current) => {
      const next = current.map((child) =>
        child.task.id === id ? { ...child, ...patch } : child,
      )
      const nextStates = [...next, ...childDrafts.map(draftFields)]
      if (
        status === 'done' &&
        nextStates.some((child) => child.status !== 'done')
      ) {
        setStatus('doing')
      }
      return next
    })
  }

  const activeCode =
    activeRoot?.level === 2 && level === 2 && parent === activeRoot.parent_id
      ? taskLevelCode(activeRoot)
      : 'L' + level
  const activeTitleLabel = level === 1 ? 'Tên công việc chính' : 'Tên việc con'
  const activeNode = (
    <TaskNode
      level={level}
      code={activeCode}
      active={Boolean(task && task.id === activeRoot?.id)}
      title={
        canEditMain ? (
          <label>
            {activeTitleLabel}
            <input
              required
              autoFocus={!task}
              maxLength={160}
              aria-label={
                level === 1
                  ? 'Tên công việc chính · L1'
                  : 'Tên việc con ' + activeCode
              }
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={'Nhập ' + activeTitleLabel.toLowerCase()}
            />
          </label>
        ) : (
          <strong className="task-node-text">{activeRoot.title}</strong>
        )
      }
    >
      <TaskDescription
        code={activeCode}
        value={description}
        change={canEditMain ? setDescription : undefined}
      />
      <TaskAttributes
        label={'Thông tin ' + activeCode}
        {...{ values, members, teamTask, canOrganize, parentDone }}
        user={repo.user}
        editable={canEditMain}
        focusAssignees={config.focusAssignees}
        change={(key, value) => setters[key](value)}
        requireDates={!activeRoot || Boolean(activeRoot.due_date)}
        enforceDateOrder={!activeRoot || changedDates}
        pending={pendingExtension}
        blockDone={remaining > 0}
      />
      {canOrganize && (
        <RecurringScheduleSection
          isExistingTask={Boolean(task)}
          assignedOn={assignedOn}
          assignedTime={assignedTime}
          due={due}
          dueTime={dueTime}
          repeatInterval={repeatInterval}
          setRepeatInterval={setRepeatInterval}
          customWeeks={customWeeks}
          setCustomWeeks={setCustomWeeks}
          repeatRangeType={repeatRangeType}
          setRepeatRangeType={setRepeatRangeType}
          repeatCount={repeatCount}
          setRepeatCount={setRepeatCount}
          repeatUntil={repeatUntil}
          setRepeatUntil={setRepeatUntil}
          repeatNaming={repeatNaming}
          setRepeatNaming={setRepeatNaming}
          cycles={allRecurringCycles}
          excludedCycles={excludedCycles}
          setExcludedCycles={setExcludedCycles}
        />
      )}
      <TaskAttachments
        code={activeCode}
        task={activeRoot}
        repo={repo}
        drafts={attachments}
        change={canEditMain ? setAttachments : undefined}
      />
      {activeRoot && (
        <DeadlineExtension
          task={{ ...activeRoot, due_date: due, status }}
          repo={repo}
          today={today}
          manager={canOrganize}
          members={members}
          onPending={setPendingExtension}
          onUpdated={(updated) => {
            setDue(updated.due_date || '')
            onUpdated(updated)
          }}
        />
      )}
      {remaining > 0 && (
        <p className="field-hint completion-hint">
          Còn {remaining} việc con chưa hoàn thành.
        </p>
      )}
      {pendingExtension && canOrganize && (
        <p className="muted field-hint">
          Xử lý yêu cầu gia hạn đang chờ để cập nhật hạn.
        </p>
      )}
    </TaskNode>
  )

  const relatedTasks = level === 1 ? [] : (childrenByTask[parent] ?? [])
  const activeIsRelated =
    level === 2 && relatedTasks.some((child) => child.id === activeRoot?.id)
  const relatedNode = (item) => (
    <RelatedTaskNode
      task={item}
      members={members}
      user={repo.user}
      onOpen={onOpen}
      repo={repo}
      canReassign={item.level === 1 && Boolean(item.team_id) && isOwner}
    />
  )

  async function commit(event) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Hãy nhập tên công việc.')
      return
    }
    if (busy || !canEdit) return
    if (
      canOrganize &&
      level > 1 &&
      !parentOptions.some((item) => item.id === parent)
    ) {
      setError('Hãy chọn việc cấp trên đúng cấp.')
      return
    }
    const statusError = taskCompletionError(
      status,
      level === 2 ? parentTask : null,
      childStates,
    )
    if (statusError) {
      setError(statusError)
      return
    }
    const peopleChanged =
      assignees.length !== activeRoot?.assignee_ids.length ||
      assignees.some((id) => !activeRoot?.assignee_ids.includes(id))
    if (canOrganize && (!activeRoot || changedDates || peopleChanged)) {
      const issue = requiredSchedule(values, teamTask)
      if (issue) {
        setError(issue)
        return
      }
    }
    const updatedChildren = []
    for (const child of childEdits) {
      const item = child.task
      const childCanOrganize = !item.team_id
        ? item.created_by === repo.user.id
        : isOwner
      const childCanEdit =
        childCanOrganize ||
        Boolean(item.team_id && item.assignee_ids.includes(repo.user.id))
      if (!childCanEdit) continue
      if (!child.title.trim()) {
        updateExistingChild(item.id, { expanded: true })
        setError('Hãy nhập tên việc con.')
        return
      }
      const childDatesChanged =
        child.assignedOn !== (item.assigned_on || '') ||
        child.assignedTime !== (item.assigned_time || '09:00') ||
        child.due !== (item.due_date || '') ||
        child.dueTime !== (item.due_time || '17:30')
      const childPeopleChanged =
        child.assignees.length !== item.assignee_ids.length ||
        child.assignees.some((id) => !item.assignee_ids.includes(id))
      if (childCanOrganize && (childDatesChanged || childPeopleChanged)) {
        const issue = requiredSchedule(child, Boolean(item.team_id))
        if (issue) {
          updateExistingChild(item.id, { expanded: true })
          setError(issue)
          return
        }
      }
      const childChanged =
        child.title.trim() !== item.title ||
        child.description.trim() !== (item.description || '') ||
        child.status !== item.status ||
        child.priority !== item.priority ||
        childDatesChanged ||
        childPeopleChanged
      if (childChanged || child.attachments.length > 0) {
        updatedChildren.push({
          task: item,
          data: childChanged
            ? {
                title: child.title.trim(),
                description: child.description.trim(),
                status: child.status,
                priority: child.priority,
                ...(childCanOrganize
                  ? {
                      due_date: child.due || null,
                      due_time: child.dueTime || '17:30',
                      assigned_on: child.assignedOn,
                      assigned_time: child.assignedTime || '09:00',
                      team_id: item.team_id,
                      assignee_ids: item.team_id
                        ? child.assignees
                        : [repo.user.id],
                      level: 2,
                      parent_id: activeRoot.id,
                    }
                  : {}),
              }
            : null,
          attachments: child.attachments,
        })
      }
    }
    const childTasks = []
    for (const [index, child] of childDrafts.entries()) {
      const fields = draftFields(child)
      const issue = !child.title.trim()
        ? 'Hãy nhập tên việc con.'
        : requiredSchedule(fields, teamTask)
      if (issue) {
        updateChild(child.id, { expanded: true })
        setError('L2.' + (childEdits.length + index + 1) + ' · ' + issue)
        return
      }
      childTasks.push({
        title: child.title.trim(),
        description: child.description.trim(),
        status: fields.status,
        priority: fields.priority,
        assigned_on: fields.assignedOn,
        assigned_time: fields.assignedTime || '09:00',
        due_date: fields.due,
        due_time: fields.dueTime || '17:30',
        assignee_ids: teamTask ? fields.assignees : [repo.user.id],
      })
    }
    setBusy(true)
    setError('')
    try {
      const fields = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
      }
      const dates = canOrganize
        ? {
            due_date: due || null,
            due_time: dueTime || '17:30',
            assigned_on: assignedOn,
            assigned_time: assignedTime || '09:00',
          }
        : {}
      const structure = canOrganize
        ? {
            team_id: scope === 'team' ? team.id : null,
            assignee_ids: scope === 'team' ? assignees : [repo.user.id],
            level,
            parent_id: level === 1 ? null : parent,
          }
        : {}
      if (canOrganize && repeatInterval !== '0') {
        if (!activeRecurringCycles.length) {
          setError('Hãy chọn ít nhất 1 kỳ lặp lại trong danh sách.')
          setBusy(false)
          return
        }
        const existingChildrenTemplates = childEdits.map((c) => ({
          title: c.title.trim(),
          description: c.description.trim(),
          status: 'todo',
          priority: c.priority,
          assigned_on: c.assignedOn || assignedOn,
          assigned_time: c.assignedTime || '09:00',
          due_date: c.due || due,
          due_time: c.dueTime || '17:30',
          assignee_ids: scope === 'team' ? c.assignees : [repo.user.id],
        }))
        const allChildTemplates = [...existingChildrenTemplates, ...childTasks]
        const cyclesPayload = activeRecurringCycles.map((cycle) => ({
          main: {
            ...fields,
            status: task ? 'todo' : fields.status,
            title: cycle.title,
            due_date: cycle.due,
            due_time: dueTime || '17:30',
            assigned_on: cycle.assignedOn,
            assigned_time: assignedTime || '09:00',
            ...structure,
          },
          children: allChildTemplates.map((c) => ({
            ...c,
            assigned_on: c.assigned_on
              ? shiftDay(cycle.offsetDays, parseDay(c.assigned_on))
              : cycle.assignedOn,
            due_date: c.due_date
              ? shiftDay(cycle.offsetDays, parseDay(c.due_date))
              : cycle.due,
          })),
        }))
        await onSave(
          { ...fields, ...dates, ...structure },
          activeRoot,
          childTasks,
          {
            main: attachments,
            children: childDrafts.map((child) => child.attachments),
          },
          updatedChildren,
          cyclesPayload,
        )
        return
      }
      await onSave(
        { ...fields, ...dates, ...structure },
        activeRoot,
        childTasks,
        {
          main: attachments,
          children: childDrafts.map((child) => child.attachments),
        },
        updatedChildren,
      )
    } catch (error) {
      setError(readableError(error))
      setBusy(false)
    }
  }
  async function remove() {
    if (busy) return
    setBusy(true)
    try {
      await onDelete(task)
    } catch (error) {
      setError(readableError(error))
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={
        task
          ? 'Chi tiết công việc'
          : config.parent
            ? 'Tạo việc con L' + level
            : 'Tạo công việc chính'
      }
      tabs={
        task && (
          <div className="dialog-tabs" role="tablist" aria-label="Chi tiết công việc">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'overview'}
              className={tab === 'overview' ? 'active' : ''}
              onClick={() => setTab('overview')}
            >
              Tổng quan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'comments'}
              className={tab === 'comments' ? 'active' : ''}
              onClick={() => setTab('comments')}
            >
              <MessageCircle size={15} /> Trao đổi
            </button>
          </div>
        )
      }
      wide
      autoFocus={!task}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="dialog-tab-panel"
        hidden={Boolean(task && tab !== 'overview')}
      >
        <form id="task-dialog-form" className="dialog-form" onSubmit={commit}>
        <fieldset disabled={busy}>
          {!task && !config.parent && team && isOwner && (
            <div className="scope-switch" aria-label="Phạm vi công việc">
              <button
                type="button"
                className={scope === 'team' ? 'active' : ''}
                aria-pressed={scope === 'team'}
                onClick={() => {
                  if (scope !== 'team') setParent('')
                  setScope('team')
                }}
              >
                <UsersRound size={16} /> Việc của nhóm
              </button>
              <button
                type="button"
                className={scope === 'private' ? 'active' : ''}
                aria-pressed={scope === 'private'}
                onClick={() => {
                  if (scope !== 'private') setParent('')
                  setScope('private')
                }}
              >
                <LockKeyhole size={15} /> Chỉ mình tôi
              </button>
            </div>
          )}
          <TaskTree
            root={
              level === 1 ? (
                activeNode
              ) : parentTask ? (
                relatedNode(parentTask)
              ) : (
                <TaskNode
                  level={1}
                  code="L1"
                  title={<span className="muted">Chọn việc chính L1</span>}
                />
              )
            }
          >
            {childEdits.map((child) => {
              const item = child.task
              const code = taskLevelCode(item)
              const childCanOrganize = !item.team_id
                ? item.created_by === repo.user.id
                : isOwner
              const childCanEdit =
                childCanOrganize ||
                Boolean(
                  item.team_id && item.assignee_ids.includes(repo.user.id),
                )
              const childDatesChanged =
                child.assignedOn !== (item.assigned_on || '') ||
                child.due !== (item.due_date || '')
              return (
                <li key={item.id} className="tree-draft-branch">
                  <TaskNode
                    level={2}
                    code={code}
                    active={task?.id === item.id}
                    title={
                      childCanEdit ? (
                        <label>
                          Tên việc con
                          <input
                            required
                            maxLength={160}
                            aria-label={'Tên việc con ' + code}
                            placeholder="Nhập tên việc con"
                            value={child.title}
                            onChange={(event) =>
                              updateExistingChild(item.id, {
                                title: event.target.value,
                              })
                            }
                          />
                        </label>
                      ) : (
                        <strong className="task-node-text">
                          {child.title}
                        </strong>
                      )
                    }
                    actions={
                      <TaskNodeToggle
                        code={code}
                        expanded={child.expanded}
                        toggle={() =>
                          updateExistingChild(item.id, {
                            expanded: !child.expanded,
                          })
                        }
                      />
                    }
                  >
                    {child.expanded ? (
                      <>
                        <TaskDescription
                          code={code}
                          value={child.description}
                          change={
                            childCanEdit
                              ? (value) =>
                                  updateExistingChild(item.id, {
                                    description: value,
                                  })
                              : undefined
                          }
                        />
                        <TaskAttributes
                          label={'Thông tin ' + code}
                          values={child}
                          change={(key, value) =>
                            updateExistingChild(item.id, { [key]: value })
                          }
                          members={members}
                          user={repo.user}
                          teamTask={Boolean(item.team_id)}
                          editable={childCanEdit}
                          canOrganize={childCanOrganize}
                          pending={Boolean(child.pendingExtension)}
                          requireDates={Boolean(item.due_date)}
                          enforceDateOrder={childDatesChanged}
                        />
                        <TaskAttachments
                          code={code}
                          task={item}
                          repo={repo}
                          drafts={child.attachments}
                          change={
                            childCanEdit
                              ? (files) =>
                                  updateExistingChild(item.id, {
                                    attachments: files,
                                  })
                              : undefined
                          }
                        />
                        <DeadlineExtension
                          task={{
                            ...item,
                            due_date: child.due,
                            status: child.status,
                          }}
                          repo={repo}
                          today={today}
                          manager={childCanOrganize}
                          members={members}
                          onPending={(isPending) =>
                            updateExistingChild(item.id, {
                              pendingExtension: isPending,
                            })
                          }
                          onUpdated={(updated) => {
                            updateExistingChild(item.id, {
                              task: updated,
                              due: updated.due_date || '',
                            })
                            onUpdated(updated)
                          }}
                        />
                      </>
                    ) : (
                      <p className="muted tree-summary">
                        {statuses[child.status].label} · Ưu tiên{' '}
                        {priorities[child.priority].label}
                      </p>
                    )}
                  </TaskNode>
                </li>
              )
            })}
            {relatedTasks.map((child) => (
              <li key={child.id} className="tree-draft-branch">
                {level === 2 && child.id === task?.id
                  ? activeNode
                  : relatedNode(child)}
              </li>
            ))}
            {level === 2 && !activeIsRelated && (
              <li className="tree-draft-branch">{activeNode}</li>
            )}
            {level === 1 &&
              childDrafts.map((child, index) => {
                const code = 'L2.' + (childEdits.length + index + 1)
                const fields = draftFields(child)
                return (
                  <li key={child.id} className="tree-draft-branch">
                    <TaskNode
                      level={2}
                      code={code}
                      title={
                        <label>
                          Tên việc con
                          <input
                            required
                            autoFocus
                            maxLength={160}
                            aria-label={'Tên việc con ' + code}
                            placeholder="Nhập tên việc con"
                            value={child.title}
                            onChange={(event) =>
                              updateChild(child.id, {
                                title: event.target.value,
                              })
                            }
                          />
                        </label>
                      }
                      actions={
                        <>
                          <TaskNodeToggle
                            code={code}
                            expanded={child.expanded}
                            toggle={() =>
                              updateChild(child.id, {
                                expanded: !child.expanded,
                              })
                            }
                          />
                          <IconButton
                            label={'Bỏ việc con ' + code}
                            onClick={() =>
                              setChildDrafts((current) =>
                                current.filter((item) => item.id !== child.id),
                              )
                            }
                          >
                            <X size={16} />
                          </IconButton>
                        </>
                      }
                    >
                      {child.expanded ? (
                        <>
                          <TaskDescription
                            code={code}
                            value={child.description}
                            change={(value) =>
                              updateChild(child.id, { description: value })
                            }
                          />
                          <TaskAttributes
                            label={'Thông tin ' + code}
                            values={fields}
                            change={(key, value) =>
                              updateChild(child.id, {
                                fields: { ...child.fields, [key]: value },
                              })
                            }
                            {...{ members, teamTask }}
                            user={repo.user}
                            canOrganize
                            requireDates
                            enforceDateOrder
                          />
                          <TaskAttachments
                            code={code}
                            drafts={child.attachments}
                            change={(files) =>
                              updateChild(child.id, { attachments: files })
                            }
                          />
                        </>
                      ) : (
                        <p className="muted tree-summary">
                          {statuses[fields.status].label} · Ưu tiên{' '}
                          {priorities[fields.priority].label}
                        </p>
                      )}
                    </TaskNode>
                  </li>
                )
              })}
            {level === 1 && canOrganize && (
              <li>
                <button
                  type="button"
                  className="tree-add-child"
                  onClick={() => {
                    childKey.current += 1
                    const id = childKey.current
                    if (status === 'done') setStatus('doing')
                    setChildDrafts((current) => [
                      ...current,
                      {
                        id,
                        title: '',
                        description: '',
                        attachments: [],
                        fields: {},
                        expanded: true,
                      },
                    ])
                  }}
                >
                  <Plus size={16} /> Thêm việc con
                </button>
              </li>
            )}
          </TaskTree>
          {canOrganize && task?.level === 1 && children.length > 0 && (
            <p className="muted field-hint">
              Xóa việc con trước khi xóa việc chính này.
            </p>
          )}
        </fieldset>
        <ErrorText message={error} />
        </form>
        {confirmDelete ? (
          <div className="form-actions dialog-footer">
            <span className="delete-question">Xóa công việc này?</span>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Giữ lại
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={remove}
            >
              Xác nhận xóa
            </button>
          </div>
        ) : (
          <div className="form-actions dialog-footer">
            {task && canOrganize && (
              <button
                type="button"
                className="button text-danger push-left"
                disabled={busy || (task.level === 1 && children.length > 0)}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} /> Xóa
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={onClose}
            >
              {canEdit ? 'Hủy' : 'Đóng'}
            </button>
            {canEdit && (
              <button
                type="submit"
                form="task-dialog-form"
                className="button primary"
                disabled={busy}
              >
                {busy
                  ? 'Đang lưu…'
                  : task
                    ? canOrganize &&
                      repeatInterval !== '0' &&
                      activeRecurringCycles.length > 0
                      ? `Lưu & Tạo ${activeRecurringCycles.length} kỳ tiếp theo`
                      : 'Lưu thay đổi'
                    : repeatInterval !== '0' && activeRecurringCycles.length > 0
                      ? `Tạo ${activeRecurringCycles.length} kỳ công việc`
                      : childDrafts.length
                        ? 'Lưu công việc'
                        : 'Tạo công việc'}
              </button>
            )}
          </div>
        )}
      </div>
      {task && tab === 'comments' && <Comments task={task} repo={repo} />}
    </Dialog>
  )
}

export function TeamDialog({ team, onClose, onSave }) {
  const [name, setName] = useState(team?.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isEditing = Boolean(team)
  async function save(event) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await onSave(name.trim(), team)
    } catch (error) {
      setError(readableError(error))
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={isEditing ? 'Sửa tên nhóm' : 'Tạo nhóm'}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={save}>
        <label>
          Tên nhóm
          <input
            required
            autoFocus
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="VD: Product & CX"
          />
        </label>
        <ErrorText message={error} />
        <div className="form-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button primary" disabled={busy || !name.trim()}>
            <UsersRound size={16} /> {busy ? 'Đang lưu…' : isEditing ? 'Lưu thay đổi' : 'Tạo nhóm'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function DeleteTeamDialog({ team, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm(team)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Xác nhận xóa nhóm"
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div className="delete-team-modal">
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.5' }}>
          Bạn có chắc chắn muốn xóa nhóm <strong>"{team?.name}"</strong> không?
        </p>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            color: '#b3261e',
            background: '#fdf2f2',
            padding: '10px 12px',
            borderRadius: '6px',
            lineHeight: '1.5',
          }}
        >
          ⚠️ Toàn bộ công việc, dự án và danh sách thành viên thuộc nhóm này sẽ bị xóa vĩnh viễn và không thể khôi phục!
        </p>
        <ErrorText message={error} />
        <div className="form-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="button danger"
            type="button"
            disabled={busy}
            onClick={handleDelete}
          >
            <Trash2 size={16} /> {busy ? 'Đang xóa…' : 'Xác nhận xóa nhóm'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export function TransferOwnerDialog({ team, member, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleTransfer() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm(member)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Chuyển quyền Trưởng nhóm"
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div className="transfer-owner-modal">
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.5' }}>
          Bạn có chắc chắn muốn chuyển quyền <strong>Trưởng nhóm</strong> của nhóm "<strong>{team?.name}</strong>" cho <strong>{member?.display_name}</strong>?
        </p>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            color: '#5533c7',
            background: '#f2edfd',
            padding: '10px 12px',
            borderRadius: '6px',
            lineHeight: '1.5',
          }}
        >
          👑 Sau khi chuyển giao quyền, <strong>{member?.display_name}</strong> sẽ trở thành Trưởng nhóm chính thức. Bạn sẽ tự động trở thành <strong>Phó nhóm</strong>.
        </p>
        <ErrorText message={error} />
        <div className="form-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="button primary"
            type="button"
            disabled={busy}
            onClick={handleTransfer}
          >
            <Crown size={16} /> {busy ? 'Đang chuyển quyền…' : 'Xác nhận chuyển quyền'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export function InviteDialog({ repo, team, onClose }) {
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const isDemo = repo.mode === 'demo'
  async function create(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      setLink(await repo.invite(team.id, email.trim()))
    } catch (error) {
      setError(readableError(error))
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Hãy chọn và sao chép liên kết trong ô bên trên.')
    }
  }
  return (
    <Dialog
      title="Mời thành viên"
      description={
        isDemo
          ? 'Kết nối Supabase để tạo liên kết mời thật.'
          : 'Liên kết dùng một lần, hết hạn sau 7 ngày và chỉ dành cho email được mời.'
      }
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      {isDemo ? (
        <div className="dialog-form">
          <button className="button secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      ) : (
        <form className="dialog-form" onSubmit={create}>
          {!link && (
            <label>
              Email thành viên
              <input
                required
                autoFocus
                type="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ten@congty.com"
              />
            </label>
          )}
          {link && (
            <label>
              Liên kết mời
              <input
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
            </label>
          )}
          <ErrorText message={error} />
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={onClose}
            >
              Đóng
            </button>
            {link ? (
              <button type="button" className="button primary" onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
              </button>
            ) : (
              <button className="button primary" disabled={busy}>
                {busy ? 'Đang tạo…' : 'Tạo liên kết'}
              </button>
            )}
          </div>
        </form>
      )}
    </Dialog>
  )
}
