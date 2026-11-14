import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Crown,
  Ellipsis,
  FileSpreadsheet,
  LayoutGrid,
  List,
  ListTodo,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import {
  Board,
  Calendar,
  DashboardAside,
  ReportPanel,
  Summary,
  TaskList,
} from './dashboard.jsx'
import {
  DeleteTeamDialog,
  InviteDialog,
  TaskDialog,
  TeamDialog,
  TransferOwnerDialog,
} from './dialogs.jsx'
import { AccountDialog, EmailDemoDialog } from './workflow.jsx'
import {
  AddTeamMemberDialog,
  CreateDirectoryMemberDialog,
  GlobalMemberPanel,
} from './global-members.jsx'
import { AttachmentRetryDialog } from './task-attachments.jsx'
import { uploadTaskAttachments } from './attachments.js'
import { TeamChatPanel } from './team-chat.jsx'
import {
  byDeadline,
  capitalize,
  longDay,
  normalize,
  overdue,
  parseDay,
  priorities,
  shiftDay,
  statuses,
  taskLevels,
  taskLevelCode,
  taskCompletionError,
  todayInVietnam,
} from './model.js'
import {
  Avatar,
  Brand,
  Dropdown,
  Empty,
  ErrorText,
  HeroArt,
  IconButton,
  readableError,
} from './ui.jsx'

const defaultFilters = {
  date: 'all',
  status: 'all',
  priority: 'all',
  person: 'all',
  level: 'all',
  privateOnly: false,
  pendingExtension: false,
}
const blank = { tasks: [], members: [], deletedTasks: [] }
const dates = {
  all: 'Tất cả',
  today: 'Hôm nay',
  week: '7 ngày tới',
  late: 'Quá hạn',
  extension: 'Yêu cầu gia hạn',
}
const projectPages = {
  mine: {
    title: 'Việc của tôi',
    Icon: ListTodo,
    description: 'Theo dõi việc được giao và sắp xếp ưu tiên trong ngày.',
  },
  team: {
    title: 'Việc của nhóm',
    Icon: LayoutGrid,
    description: 'Nắm tiến độ và phân công công việc của cả nhóm.',
  },
  calendar: {
    title: 'Lịch công việc',
    Icon: CalendarDays,
    description: 'Xem hạn hoàn thành theo ngày để lên kế hoạch làm việc.',
  },
  reports: {
    title: 'Báo cáo công việc',
    Icon: BarChart3,
    description:
      'So sánh biến động thêm, bớt công việc và chuyển đổi trạng thái theo tuần.',
  },
  chat: {
    title: 'Chat nhóm',
    Icon: MessageSquare,
    description: 'Trao đổi, thảo luận trực tiếp giữa các thành viên trong nhóm.',
  },
  members: {
    title: 'Thành viên dự án',
    Icon: UsersRound,
    description: 'Xem ai đang làm việc trong dự án và thêm nhân sự từ danh sách chung.',
  },
}

const commonPages = {
  allMembers: {
    title: 'Thành viên chung',
    Icon: Users,
    description: 'Quản lý toàn bộ danh sách thành viên và nhân sự trong tổ chức.',
  },
}

const pages = { ...projectPages, ...commonPages }

function Sidebar({
  repo,
  teams,
  team,
  view,
  members,
  onNav,
  onSwitch,
  onCreate,
  onInvite,
  isOwner,
  onEditTeam,
  onDeleteTeam,
  open,
  onClose,
  onSignOut,
}) {
  return (
    <>
      {open && (
        <button
          className="nav-scrim"
          onClick={onClose}
          aria-label="Đóng điều hướng"
        />
      )}
      <aside className={'sidebar' + (open ? ' mobile-open' : '')}>
        <div className="sidebar-top">
          <Brand />
          <IconButton label="Đóng điều hướng" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <Dropdown
          label="Chọn nhóm"
          className="workspace-dropdown"
          trigger={
            <>
              <span className="workspace-icon">
                {(team?.name || 'C').slice(0, 1).toUpperCase()}
              </span>
              <span className="workspace-name">
                <strong>{team?.name || 'Cá nhân'}</strong>
                <small>Không gian làm việc</small>
              </span>
            </>
          }
        >
          {(close) => (
            <>
              <button
                type="button"
                className="workspace-menu-item"
                onClick={() => {
                  onSwitch(null)
                  close()
                }}
              >
                <LockKeyhole size={15} /> <span>Cá nhân</span>{' '}
                {!team && <Check size={15} className="menu-check" />}
              </button>
              {teams.map((item) => (
                <div key={item.id} className="workspace-menu-item-group">
                  <button
                    type="button"
                    className="workspace-menu-select"
                    onClick={() => {
                      onSwitch(item.id)
                      close()
                    }}
                  >
                    <UsersRound size={15} />
                    <span title={item.name}>{item.name}</span>
                    {team?.id === item.id && (
                      <Check size={15} className="menu-check" />
                    )}
                  </button>
                  <div className="workspace-menu-item-actions">
                    <button
                      type="button"
                      className="workspace-icon-action"
                      title="Sửa tên nhóm"
                      aria-label="Sửa tên nhóm"
                      onClick={(e) => {
                        e.stopPropagation()
                        close()
                        onEditTeam?.(item)
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="workspace-icon-action danger"
                      title="Xóa nhóm"
                      aria-label="Xóa nhóm"
                      onClick={(e) => {
                        e.stopPropagation()
                        close()
                        onDeleteTeam?.(item)
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="menu-divider"
                onClick={() => {
                  close()
                  onCreate('team')
                }}
              >
                <Plus size={16} /> Tạo nhóm mới
              </button>
            </>
          )}
        </Dropdown>
        <nav aria-label="Điều hướng chính">
          <div className="sidebar-section">
            <p>{team ? `DỰ ÁN • ${team.name}` : 'KHÔNG GIAN CÁ NHÂN'}</p>
            {Object.entries(projectPages).map(([key, { title, Icon }]) => (
              <button
                className={'nav-item' + (view.kind === key ? ' active' : '')}
                key={key}
                onClick={() => onNav(key)}
                aria-current={view.kind === key ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{title}</span>
              </button>
            ))}
          </div>
          {isOwner && (
            <div className="sidebar-section">
              <p>QUẢN LÝ CHUNG</p>
              {Object.entries(commonPages).map(([key, { title, Icon }]) => (
                <button
                  className={'nav-item' + (view.kind === key ? ' active' : '')}
                  key={key}
                  onClick={() => onNav(key)}
                  aria-current={view.kind === key ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{title}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          {team && isOwner && (
            <button className="nav-item invite-nav" onClick={onInvite}>
              <UserRoundPlus size={18} /> Mời thành viên
            </button>
          )}
          <div className="account">
            <Avatar name={repo.user.name} id={repo.user.id} />
            <span>
              <strong>{repo.user.name}</strong>
              <small>
                {team
                  ? isOwner
                    ? 'Trưởng nhóm'
                    : members.find((m) => m.user_id === repo.user.id)?.role ===
                        'deputy'
                      ? 'Phó nhóm'
                      : members.length
                        ? 'Nhân viên'
                        : 'Tài khoản cá nhân'
                  : 'Tài khoản cá nhân'}
              </small>
            </span>
            <IconButton label="Đăng xuất" onClick={onSignOut}>
              <LogOut size={17} />
            </IconButton>
          </div>
        </div>
      </aside>
    </>
  )
}

function Filters({ filters, setFilters, members, isMine }) {
  const selected =
    Number(filters.status !== 'all') +
    Number(filters.priority !== 'all') +
    Number(filters.person !== 'all') +
    Number(filters.level !== 'all') +
    Number(filters.privateOnly) +
    Number(filters.pendingExtension)
  function field(key, label, values) {
    return (
      <label key={key}>
        {label}
        <select
          value={filters[key]}
          onChange={(event) =>
            setFilters({ ...filters, [key]: event.target.value })
          }
        >
          <option value="all">Tất cả</option>
          {values.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <Dropdown
      label="Bộ lọc"
      className="filter-dropdown"
      trigger={
        <>
          <SlidersHorizontal size={16} />
          <span>Bộ lọc</span>
          {selected > 0 && <small>{selected}</small>}
        </>
      }
    >
      {(close) => (
        <>
          {field(
            'status',
            'Trạng thái',
            Object.entries(statuses).map(([key, item]) => [key, item.label]),
          )}
          {field(
            'priority',
            'Ưu tiên',
            Object.entries(priorities).map(([key, item]) => [key, item.label]),
          )}
          {field('level', 'Cấp công việc', Object.entries(taskLevels))}
          {!isMine &&
            members.length > 0 &&
            field('person', 'Người thực hiện', [
              ['unassigned', 'Chưa phân công'],
              ...members.map((item) => [item.user_id, item.display_name]),
            ])}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.pendingExtension}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  pendingExtension: event.target.checked,
                })
              }
            />{' '}
            Chờ duyệt gia hạn
          </label>
          {isMine && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.privateOnly}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    privateOnly: event.target.checked,
                  })
                }
              />{' '}
              Chỉ xem việc riêng
            </label>
          )}
          <button
            className="filter-clear"
            onClick={() => {
              setFilters({ ...defaultFilters, date: filters.date })
              close()
            }}
          >
            Đặt lại bộ lọc
          </button>
        </>
      )}
    </Dropdown>
  )
}

function MemberPanel({
  team,
  members,
  onCreate,
  onInvite,
  onCreateAccount,
  onEditMember,
  onDeleteMember,
  onEditTeam,
  onDeleteTeam,
  onTransferOwner,
  onSetRole,
  isOwner,
  isDeputy,
  userId,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const renderActions = (member) => {
    if (!isOwner && !isDeputy) return null
    if (confirmDeleteId === member.user_id) {
      return (
        <div className="member-row-tools">
          <button
            type="button"
            className="button secondary member-btn-sm"
            onClick={() => setConfirmDeleteId(null)}
          >
            Hủy
          </button>
          <button
            type="button"
            className="button danger member-btn-sm"
            onClick={() => {
              setConfirmDeleteId(null)
              onDeleteMember(member)
            }}
          >
            Xác nhận xóa
          </button>
        </div>
      )
    }
    return (
      <div className="member-row-tools">
        <Dropdown
          label={'Thao tác với ' + member.display_name}
          className="action-dropdown"
          trigger={<Ellipsis size={18} />}
        >
          {(close) => (
            <>
              {isOwner && member.user_id !== userId && (
                <>
                  {member.role === 'deputy' ? (
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        onSetRole?.(member, 'member')
                      }}
                    >
                      <UserMinus size={15} /> Gỡ quyền phó nhóm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        onSetRole?.(member, 'deputy')
                      }}
                    >
                      <ShieldCheck size={15} /> Bổ nhiệm phó nhóm
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      onTransferOwner?.(member)
                    }}
                  >
                    <Crown size={15} /> Chuyển quyền trưởng nhóm
                  </button>
                </>
              )}
              {(isOwner || member.user_id === userId) && (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    onEditMember(member)
                  }}
                >
                  <Pencil size={15} /> Sửa thông tin
                </button>
              )}
              {isOwner && member.user_id !== userId && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    close()
                    setConfirmDeleteId(member.user_id)
                  }}
                >
                  <Trash2 size={15} /> Xóa thành viên
                </button>
              )}
            </>
          )}
        </Dropdown>
      </div>
    )
  }

  if (!team)
    return (
      <div className="panel">
        <Empty
          title="Bạn chưa chọn nhóm"
          detail="Chọn một nhóm ở thanh điều hướng hoặc tạo nhóm mới để mời đồng đội."
          onAdd={onCreate}
          action="Tạo nhóm"
        />
      </div>
    )
  return (
    <section className="panel member-panel">
      <div className="member-heading">
        <div>
          <h2>{team.name}</h2>
          <p>{members.length} thành viên</p>
        </div>
        {isOwner && (
          <div className="member-actions">
            <button
              className="button secondary member-header-action"
              type="button"
              title="Sửa tên nhóm"
              aria-label="Sửa tên nhóm"
              onClick={() => onEditTeam?.(team)}
            >
              <Pencil size={15} /> <span className="btn-label-desktop">Sửa tên nhóm</span>
            </button>
            <button
              className="button secondary text-danger member-header-action"
              type="button"
              title="Xóa nhóm"
              aria-label="Xóa nhóm"
              onClick={() => onDeleteTeam?.(team)}
            >
              <Trash2 size={15} /> <span className="btn-label-desktop">Xóa nhóm</span>
            </button>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="member-table-wrap">
        <table className="member-table" aria-label="Bảng thành viên">
          <thead>
            <tr>
              <th>Họ và tên</th>
              <th>Email</th>
              <th>Phòng ban</th>
              {(isOwner || isDeputy) && <th className="member-col-actions">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.user_id}>
                <td>
                  <div className="member-name-cell">
                    <Avatar name={member.display_name} id={member.user_id} />
                    <div>
                      <strong>
                        {member.display_name}{' '}
                        {member.user_id === userId && <small>(Bạn)</small>}
                      </strong>
                      <span
                        className={
                          'badge ' +
                          (member.role === 'owner'
                            ? 'purple'
                            : member.role === 'deputy'
                              ? 'blue'
                              : 'gray')
                        }
                      >
                        {member.role === 'owner'
                          ? 'Trưởng nhóm'
                          : member.role === 'deputy'
                            ? 'Phó nhóm'
                            : 'Nhân viên'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="member-cell-email">
                  {member.email || <span className="muted">Chưa cập nhật</span>}
                </td>
                <td>
                  {member.department ? (
                    <span className="member-dept-badge">
                      {member.department}
                    </span>
                  ) : (
                    <span className="muted">Chưa phân phòng ban</span>
                  )}
                </td>
                {(isOwner || isDeputy) && (
                  <td className="member-col-actions">
                    {renderActions(member)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="member-cards-mobile" role="list" aria-label="Danh sách thành viên">
        {members.map((member) => (
          <div key={member.user_id} className="member-card-item" role="listitem">
            <div className="member-card-header">
              <div className="member-card-user">
                <Avatar name={member.display_name} id={member.user_id} />
                <div className="member-card-name-group">
                  <div className="member-card-name">
                    <strong>{member.display_name}</strong>
                    {member.user_id === userId && (
                      <small className="member-you-tag">(Bạn)</small>
                    )}
                  </div>
                  <span
                    className={
                      'badge ' +
                      (member.role === 'owner'
                        ? 'purple'
                        : member.role === 'deputy'
                          ? 'blue'
                          : 'gray')
                    }
                  >
                    {member.role === 'owner'
                      ? 'Trưởng nhóm'
                      : member.role === 'deputy'
                        ? 'Phó nhóm'
                        : 'Nhân viên'}
                  </span>
                </div>
              </div>
              {(isOwner || isDeputy) && (
                <div className="member-card-actions">
                  {renderActions(member)}
                </div>
              )}
            </div>
            <div className="member-card-meta">
              <div className="member-card-meta-row">
                <span className="member-meta-label">Email:</span>
                <span className="member-meta-value">
                  {member.email || <span className="muted">Chưa cập nhật</span>}
                </span>
              </div>
              <div className="member-card-meta-row">
                <span className="member-meta-label">Phòng ban:</span>
                <span className="member-meta-value">
                  {member.department ? (
                    <span className="member-dept-badge">{member.department}</span>
                  ) : (
                    <span className="muted">Chưa phân phòng ban</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function storedTeam(user) {
  try {
    return localStorage.getItem('nhip-viec.workspace.' + user)
  } catch {
    return null
  }
}
export default function App({
  repo,
  inviteToken = '',
  demoAccounts,
  onDemoAccount,
}) {
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState(null)
  const [teamsReady, setTeamsReady] = useState(false)
  const [teamsError, setTeamsError] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const [view, setView] = useState({ kind: 'mine' })
  const [filters, setFilters] = useState(defaultFilters)
  const [layout, setLayout] = useState('board')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState(null)
  const [pendingInvite, setPendingInvite] = useState(inviteToken)
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [busyIds, setBusyIds] = useState(new Set())
  const [today, setToday] = useState(todayInVietnam)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mailLink, setMailLink] = useState(() => {
    if (repo.mode !== 'live') return null
    const params = new URLSearchParams(location.search)
    const team = params.get('team')
    return team ? { team, task: params.get('task') } : null
  })
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const locks = useRef(new Set())
  const reportActionRef = useRef(null)
  const {
    tasks,
    members,
    deletedTasks = [],
  } = snapshot?.team === teamId ? snapshot : blank
  const team = teams.find((item) => item.id === teamId)
  const isOwner = members.some(
    (item) => item.user_id === repo.user.id && item.role === 'owner',
  )
  const isDeputy = members.some(
    (item) => item.user_id === repo.user.id && item.role === 'deputy',
  )
  const isManager = isOwner || isDeputy
  const taskMap = Object.fromEntries(tasks.map((task) => [task.id, task]))
  const childrenByTask = {}
  for (const task of tasks) {
    if (task.parent_id) (childrenByTask[task.parent_id] ||= []).push(task)
  }
  for (const siblings of Object.values(childrenByTask)) {
    siblings.sort(
      (a, b) =>
        (a.sibling_no ?? 0) - (b.sibling_no ?? 0) ||
        a.created_at.localeCompare(b.created_at),
    )
  }
  const memberMap = Object.fromEntries(
    members.map((member) => [member.user_id, member]),
  )
  memberMap[repo.user.id] ||= {
    user_id: repo.user.id,
    display_name: repo.user.name,
  }
  const isMine = view.kind === 'mine'
  const hasTaskPanel = isMine || view.kind === 'team'
  const { title: pageTitle, description } = pages[view.kind]

  useEffect(() => {
    if (teamsReady) return
    let active = true
    repo
      .listTeams()
      .then((rows) => {
        if (!active) return
        const saved = storedTeam(repo.user.id)
        setTeams(rows)
        const linkedTeam = rows.find((row) => row.id === mailLink?.team)?.id
        setTeamId(
          linkedTeam ??
            (saved === 'personal'
              ? null
              : (rows.find((row) => row.id === saved)?.id ??
                rows[0]?.id ??
                null)),
        )
        setTeamsReady(true)
      })
      .catch((error) => {
        if (active) {
          setTeamsError(readableError(error))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [repo, loadKey, teamsReady, mailLink])
  function refreshUnread() {
    repo
      .listNotifications?.()
      .then((res) => {
        if (typeof res?.unread_count === 'number') {
          setUnreadCount(res.unread_count)
        }
      })
      .catch(() => null)
  }
  useEffect(() => {
    if (!teamsReady) return
    let active = true
    setLoading(true)
    setLoadError('')
    repo
      .load(teamId)
      .then((data) => {
        if (active) {
          setSnapshot({ team: teamId, ...data })
          refreshUnread()
        }
      })
      .catch((error) => {
        if (active) setLoadError(readableError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [repo, teamId, loadKey, teamsReady])
  useEffect(() => {
    if (!mailLink || loading || !teamsReady || loadError || !snapshot) return
    const linkedTask =
      mailLink.team === teamId &&
      snapshot.tasks.find((task) => task.id === mailLink.task)
    if (linkedTask) {
      setView({ kind: 'team' })
      setModal({ type: 'task', task: linkedTask })
    } else if (mailLink.team === teamId && !mailLink.task) {
      setView({ kind: 'members' })
    } else {
      setNotice({
        message: 'Công việc hoặc nhóm trong liên kết không còn khả dụng.',
        error: true,
      })
    }
    const url = new URL(location.href)
    url.searchParams.delete('task')
    url.searchParams.delete('team')
    history.replaceState(null, '', url)
    setMailLink(null)
  }, [mailLink, teamsReady, snapshot, teamId, loading, loadError])
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 3600)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const handle = (event) => {
      if (event.key === 'Escape') setMobileNav(false)
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !modal
      ) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    const interval = setInterval(() => setToday(todayInVietnam()), 30_000)
    window.addEventListener('keydown', handle)
    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handle)
    }
  }, [modal])

  function go(kind) {
    setView({ kind })
    setFilters(defaultFilters)
    setQuery('')
    setMobileNav(false)
  }
  function switchTeam(id) {
    if (id !== teamId) setLoading(true)
    setTeamId(id)
    try {
      localStorage.setItem(
        'nhip-viec.workspace.' + repo.user.id,
        id ?? 'personal',
      )
    } catch {
      /* Storage may be unavailable. */
    }
    go('mine')
  }
  function refresh() {
    setTeamsError('')
    setLoading(true)
    setLoadKey((key) => key + 1)
  }
  function patchSnapshot(fn) {
    setSnapshot((current) => (current?.team === teamId ? fn(current) : current))
  }
  function canEdit(task) {
    return task.team_id
      ? isOwner || task.assignee_ids.includes(repo.user.id)
      : task.created_by === repo.user.id
  }
  function notify(message, error = false) {
    setNotice({ message, error })
    if (!error) refreshUnread()
  }
  function openNew(options = {}) {
    setModal({
      type: 'task',
      scope: isOwner && team ? 'team' : 'private',
      ...options,
    })
  }
  const openTask = (task, options = {}) =>
    setModal({ type: 'task', task, ...options })
  const onCreate = (type) => {
    setMobileNav(false)
    if (type === 'account') {
      if (view.kind === 'members') {
        setModal({ type: 'add-team-member' })
      } else {
        setModal({ type: 'create-directory-member' })
      }
      return
    }
    setModal({ type })
  }
  const onInvite = () => onCreate('invite')
  const onCreateAccount = () => onCreate('account')
  const onEditMember = (member) => setModal({ type: 'account', member })
  function memberCreated(res) {
    if (!res) return
    const newMembers = res.members || (res.member ? [res.member] : [])
    if (newMembers.length > 0) {
      patchSnapshot((current) => {
        let updatedList = [...current.members]
        for (const m of newMembers) {
          const idx = updatedList.findIndex((item) => item.user_id === m.user_id)
          if (idx >= 0) {
            updatedList[idx] = m
          } else {
            updatedList.push(m)
          }
        }
        return { ...current, members: updatedList }
      })
    }
    setModal(null)
    if (res.confirmation === 'failed') {
      notify(
        'Tài khoản đã có trong nhóm. Chưa gửi được email xác nhận. Hãy thử lại với cùng email.',
        true,
      )
    } else if (res.confirmation === 'sent') {
      notify('Đã gửi email xác nhận tài khoản cho thành viên.')
    } else if (res.members && res.members.length > 1) {
      notify(`Đã thêm ${res.members.length} thành viên vào nhóm.`)
    } else {
      notify(
        res.accountCreated
          ? 'Đã thêm thành viên mới.'
          : 'Đã thêm thành viên vào nhóm.',
      )
    }
  }
  function memberUpdated(updated) {
    patchSnapshot((current) => ({
      ...current,
      members: current.members.map((item) =>
        item.user_id === updated.user_id ? updated : item,
      ),
    }))
    setModal(null)
    notify('Đã cập nhật thông tin thành viên.')
  }
  async function deleteMember(member) {
    try {
      await repo.removeMember(team, member.user_id)
      patchSnapshot((current) => ({
        ...current,
        members: current.members.filter(
          (item) => item.user_id !== member.user_id,
        ),
        tasks: current.tasks.map((task) =>
          task.team_id === team.id && task.assignee_ids.includes(member.user_id)
            ? {
                ...task,
                assignee_ids: task.assignee_ids.filter(
                  (id) => id !== member.user_id,
                ),
              }
            : task,
        ),
      }))
      notify('Đã xóa thành viên ' + member.display_name + '.')
    } catch (error) {
      notify(readableError(error), true)
    }
  }
  function extensionUpdated(updated) {
    patchSnapshot((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }))
    setModal((current) =>
      current?.task?.id === updated.id
        ? { ...current, task: updated }
        : current,
    )
  }
  async function saveTask(
    data,
    previous,
    childTasks,
    files,
    updatedChildren = [],
    recurringCycles = null,
  ) {
    if (!previous && recurringCycles?.length > 0) {
      let batches = []
      try {
        batches = await repo.createRecurringTasks(recurringCycles)
      } catch (error) {
        if (error.code === 'TASK_CONFLICT') refresh()
        throw error
      }
      const createdAll = batches.flatMap((b) => [
        b.task,
        ...(b.children || []),
      ])
      patchSnapshot((current) => ({
        ...current,
        tasks: [...current.tasks, ...createdAll],
      }))
      const jobs = batches.flatMap((b) => [
        ...files.main.map((attachment) => ({ task: b.task, attachment })),
        ...(b.children || []).flatMap((childTask, index) =>
          (files.children[index] ?? []).map((attachment) => ({
            task: childTask,
            attachment,
          })),
        ),
      ])
      const failed = jobs.length ? await uploadTaskAttachments(repo, jobs) : []
      setModal(failed.length ? { type: 'attachment-retry', jobs: failed } : null)
      if (!failed.length) {
        notify(`Đã tạo ${batches.length} kỳ công việc định kỳ.`)
      }
      const firstSaved = batches[0]?.task
      if (firstSaved) {
        const visible =
          view.kind === 'mine'
            ? firstSaved.assignee_ids.includes(repo.user.id)
            : view.kind === 'team'
              ? firstSaved.team_id === teamId
              : true
        if (!visible) go(firstSaved.team_id ? 'team' : 'mine')
        else {
          setFilters(defaultFilters)
          setQuery('')
        }
      }
      return
    }
    let saved
    let children = []
    const savedChildrenMap = new Map()
    try {
      if (!previous && childTasks.length) {
        const batch = await repo.createTaskWithChildren(data, childTasks)
        saved = batch.task
        children = batch.children
      } else if (!previous) {
        saved = await repo.saveTask(data, null)
      } else {
        for (const item of updatedChildren) {
          if (item.data && item.data.status === 'done') {
            const updatedChild = await repo.saveTask(item.data, item.task)
            savedChildrenMap.set(updatedChild.id, updatedChild)
          }
        }
        saved = await repo.saveTask(data, previous)
        for (const item of updatedChildren) {
          if (item.data && item.data.status !== 'done') {
            const updatedChild = await repo.saveTask(item.data, item.task)
            savedChildrenMap.set(updatedChild.id, updatedChild)
          }
        }
        for (const childData of childTasks) {
          const createdChild = await repo.saveTask(
            {
              ...childData,
              team_id: saved.team_id,
              level: 2,
              parent_id: saved.id,
            },
            null,
          )
          children.push(createdChild)
        }
      }
      if (previous && recurringCycles?.length > 0) {
        const batches = await repo.createRecurringTasks(recurringCycles)
        const extraTasks = batches.flatMap((b) => [
          b.task,
          ...(b.children || []),
        ])
        children.push(...extraTasks)
      }
    } catch (error) {
      if (error.code === 'TASK_CONFLICT') refresh()
      throw error
    }
    patchSnapshot((current) => ({
      ...current,
      tasks: previous
        ? [
            ...current.tasks.map((item) => {
              if (item.id === saved.id) return saved
              if (savedChildrenMap.has(item.id))
                return savedChildrenMap.get(item.id)
              return item
            }),
            ...children,
          ]
        : [...current.tasks, saved, ...children],
    }))
    const jobs = [
      ...files.main.map((attachment) => ({ task: saved, attachment })),
      ...updatedChildren.flatMap((item) =>
        (item.attachments ?? []).map((attachment) => ({
          task: savedChildrenMap.get(item.task.id) ?? item.task,
          attachment,
        })),
      ),
      ...children.flatMap((task, index) =>
        (files.children[index] ?? []).map((attachment) => ({
          task,
          attachment,
        })),
      ),
    ]
    const failed = jobs.length ? await uploadTaskAttachments(repo, jobs) : []
    setModal(failed.length ? { type: 'attachment-retry', jobs: failed } : null)
    if (!failed.length) {
      notify(
        previous
          ? recurringCycles?.length > 0
            ? `Đã lưu công việc và tạo thêm ${recurringCycles.length} kỳ lặp lại.`
            : 'Đã cập nhật công việc.'
          : children.length
            ? 'Đã tạo công việc chính và ' + children.length + ' việc con.'
            : 'Đã tạo công việc.',
      )
    }
    if (!previous) {
      const visible =
        view.kind === 'mine'
          ? saved.assignee_ids.includes(repo.user.id)
          : view.kind === 'team'
            ? saved.team_id === teamId
            : true
      if (!visible) go(saved.team_id ? 'team' : 'mine')
      else {
        setFilters(defaultFilters)
        setQuery('')
      }
    }
  }
  async function deleteTask(task) {
    try {
      await repo.deleteTask(task)
    } catch (error) {
      if (error.code === 'TASK_CONFLICT') refresh()
      throw error
    }
    patchSnapshot((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== task.id),
      deletedTasks: [
        ...(current.deletedTasks ?? []),
        {
          ...task,
          status: 'deleted',
          previous_status: task.status,
          deleted_at: today,
        },
      ],
    }))
    setModal(null)
    notify('Đã xóa công việc.')
  }
  async function changeStatus(task, status) {
    if (locks.current.has(task.id)) return
    const blocked = taskCompletionError(
      status,
      taskMap[task.parent_id],
      childrenByTask[task.id],
    )
    if (blocked) {
      notify(blocked, true)
      return
    }
    locks.current.add(task.id)
    setBusyIds(new Set(locks.current))
    try {
      const parent = taskMap[task.parent_id]
      let reopenedParent = null
      if (parent?.status === 'done' && status !== 'done') {
        reopenedParent = await repo.saveTask({ status: 'doing' }, parent)
      }
      const updated = await repo.saveTask({ status }, task)
      patchSnapshot((current) => ({
        ...current,
        tasks: current.tasks.map((item) => {
          if (item.id === updated.id) return updated
          if (reopenedParent && item.id === reopenedParent.id)
            return reopenedParent
          return item
        }),
      }))
      notify(
        status === 'done'
          ? 'Đã hoàn thành công việc.'
          : 'Đã cập nhật trạng thái.',
      )
    } catch (error) {
      notify(readableError(error), true)
      refresh()
    } finally {
      locks.current.delete(task.id)
      setBusyIds(new Set(locks.current))
    }
  }
  async function changeAssignees(task, assigneeIds) {
    if (locks.current.has(task.id)) return
    if (task.team_id && !assigneeIds.length) {
      notify('Hãy chọn ít nhất một người được giao.', true)
      return
    }
    locks.current.add(task.id)
    setBusyIds(new Set(locks.current))
    try {
      const updated = await repo.saveTask({ assignee_ids: assigneeIds }, task)
      patchSnapshot((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }))
      notify('Đã cập nhật người được giao.')
    } catch (error) {
      notify(readableError(error), true)
      refresh()
    } finally {
      locks.current.delete(task.id)
      setBusyIds(new Set(locks.current))
    }
  }
  async function saveTeam(name, targetTeam) {
    if (targetTeam) {
      await repo.renameTeam(targetTeam.id, name)
      setTeams((current) =>
        current.map((t) => (t.id === targetTeam.id ? { ...t, name } : t)),
      )
      notify(`Đã đổi tên nhóm thành "${name}".`)
      setModal(null)
      return
    }
    const newTeam = await repo.createTeam(name)
    setTeams((current) => [...current, newTeam])
    switchTeam(newTeam.id)
    notify('Đã tạo nhóm.')
    setModal(null)
  }
  async function deleteTeam(targetTeam) {
    await repo.deleteTeam(targetTeam.id)
    setTeams((current) => current.filter((t) => t.id !== targetTeam.id))
    if (teamId === targetTeam.id) {
      switchTeam(null)
    }
    notify(`Đã xóa nhóm "${targetTeam.name}".`)
    setModal(null)
  }
  const onEditTeam = (targetTeam) => {
    setMobileNav(false)
    setModal({ type: 'team', team: targetTeam })
  }
  const onDeleteTeam = (targetTeam) => {
    setMobileNav(false)
    setModal({ type: 'delete-team', team: targetTeam })
  }
  async function transferOwner(newOwner) {
    if (!team) return
    await repo.transferOwner(team.id, newOwner.user_id)
    patchSnapshot((current) => ({
      ...current,
      members: current.members.map((m) => {
        if (m.user_id === newOwner.user_id) return { ...m, role: 'owner' }
        if (m.role === 'owner') return { ...m, role: 'deputy' }
        return m
      }),
    }))
    notify(`Đã chuyển quyền Trưởng nhóm cho ${newOwner.display_name}.`)
    setModal(null)
  }
  async function setMemberRole(targetMember, newRole) {
    if (!team) return
    await repo.setMemberRole(team.id, targetMember.user_id, newRole)
    patchSnapshot((current) => ({
      ...current,
      members: current.members.map((m) =>
        m.user_id === targetMember.user_id ? { ...m, role: newRole } : m,
      ),
    }))
    const roleLabel = newRole === 'deputy' ? 'Phó nhóm' : 'Nhân viên'
    notify(`Đã cập nhật vai trò của ${targetMember.display_name} thành ${roleLabel}.`)
  }
  const onTransferOwner = (targetMember) => {
    setModal({ type: 'transfer-owner', member: targetMember })
  }
  function clearInvite() {
    setPendingInvite('')
    const url = new URL(location.href)
    url.searchParams.delete('invite')
    history.replaceState(null, '', url)
  }
  async function acceptInvite() {
    if (inviting) return
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(pendingInvite)) {
      setInviteError('Liên kết mời không hợp lệ.')
      return
    }
    setInviting(true)
    setInviteError('')
    try {
      const joined = await repo.acceptInvite(pendingInvite)
      setTeams((current) =>
        current.some((item) => item.id === joined.id)
          ? current
          : [...current, joined],
      )
      switchTeam(joined.id)
      clearInvite()
      notify('Đã tham gia nhóm ' + joined.name + '.')
    } catch (error) {
      setInviteError(readableError(error))
    } finally {
      setInviting(false)
    }
  }
  async function signOut() {
    try {
      await repo.signOut()
      if (onDemoAccount) onDemoAccount(null)
    } catch (error) {
      notify(readableError(error), true)
    }
  }

  const baseTasks = tasks.filter((task) => {
    if (view.kind === 'team') return Boolean(task.team_id)
    if (view.kind === 'calendar') return true
    return task.assignee_ids.includes(repo.user.id)
  })
  const normalizedQuery = normalize(query.trim())
  const filteredTasks = baseTasks
    .filter((task) => {
      if (
        normalizedQuery &&
        !normalize(
          [
            task.title,
            task.description,
            taskMap[task.parent_id]?.title,
            taskLevelCode(task),
            ...task.assignee_ids.map((id) => memberMap[id]?.display_name),
          ].join(' '),
        ).includes(normalizedQuery)
      )
        return false
      if (filters.status !== 'all' && task.status !== filters.status)
        return false
      if (filters.priority !== 'all' && task.priority !== filters.priority)
        return false
      if (filters.privateOnly && task.team_id) return false
      if (filters.pendingExtension && !task.extension_pending) return false
      if (filters.level !== 'all' && task.level !== Number(filters.level))
        return false
      if (filters.person === 'unassigned' && task.assignee_ids.length)
        return false
      if (
        filters.person !== 'all' &&
        filters.person !== 'unassigned' &&
        !task.assignee_ids.includes(filters.person)
      )
        return false
      if (filters.date === 'today') return task.due_date === today
      if (filters.date === 'week')
        return (
          task.due_date &&
          task.due_date >= today &&
          task.due_date <= shiftDay(6, parseDay(today))
        )
      if (filters.date === 'late') return overdue(task, today)
      if (filters.date === 'extension')
        return (
          Boolean(task.extension_pending) ||
          (childrenByTask[task.id]?.some((child) => child.extension_pending) ??
            false)
        )
      return true
    })
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        byDeadline(a, b),
    )
  const isFiltered =
    Object.keys(defaultFilters).some(
      (key) => filters[key] !== defaultFilters[key],
    ) || Boolean(normalizedQuery)
  const metric =
    filters.date === 'late'
      ? 'late'
      : filters.date === 'all'
        ? filters.status
        : ''
  const isTeamMissing = !team && view.kind === 'team'
  const canShowTasks =
    hasTaskPanel && !isTeamMissing && !loading && !loadError && !teamsError
  const canAdd = !loading && !loadError && !teamsError
  const canCreateInView = isMine || view.kind === 'calendar' || isOwner
  function metricFilter(key) {
    setFilters({
      ...defaultFilters,
      status: ['doing', 'done'].includes(key) ? key : 'all',
      date: key === 'late' ? 'late' : 'all',
    })
    setQuery('')
    listRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  const taskProps = {
    tasks: filteredTasks,
    members,
    memberMap,
    today,
    onOpen: openTask,
    onAdd: canCreateInView ? openNew : undefined,
    taskMap,
    childrenByTask,
    onStatus: changeStatus,
    onAssignees: changeAssignees,
    canEdit,
    busyIds,
    filtered: isFiltered,
  }

  return (
    <div className="app-shell">
      <Sidebar
        {...{
          repo,
          teams,
          team,
          view,
          members,
          isOwner,
          onEditTeam,
          onDeleteTeam,
        }}
        onNav={go}
        onSwitch={switchTeam}
        onCreate={onCreate}
        onInvite={onInvite}
        open={mobileNav}
        onClose={() => setMobileNav(false)}
        onSignOut={signOut}
      />
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="Mở điều hướng"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </IconButton>
            <span>
              {view.kind === 'allMembers'
                ? 'Quản lý chung'
                : team?.name || 'Không gian cá nhân'}
            </span>
            <ChevronRight size={15} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="top-actions">
            {view.kind !== 'members' &&
              view.kind !== 'chat' &&
              view.kind !== 'allMembers' && (
              <div className="search-box">
                <Search size={17} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm công việc…"
                  aria-label="Tìm công việc"
                />
                {query ? (
                  <IconButton
                    label="Xóa tìm kiếm"
                    onClick={() => {
                      setQuery('')
                      searchRef.current?.focus()
                    }}
                  >
                    <X size={15} />
                  </IconButton>
                ) : (
                  <kbd>Ctrl K</kbd>
                )}
              </div>
            )}
            <button
              type="button"
              className="icon-button bell-button"
              aria-label="Thông báo & Email"
              title="Thông báo & Cấu hình Email"
              onClick={() => onCreate('mail')}
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="bell-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {repo.mode === 'demo' ? (
              <Dropdown
                label="Đổi vai trò demo"
                className="demo-dropdown"
                trigger={
                  <span className="demo-label">
                    <i /> Bản demo
                  </span>
                }
              >
                {(close) => (
                  <>
                    {demoAccounts.map((account) => (
                      <button
                        key={account.id}
                        aria-label={account.name + ' · ' + account.roleLabel}
                        onClick={() => {
                          close()
                          onDemoAccount(account.id)
                        }}
                      >
                        <span>
                          {account.name} · {account.roleLabel}
                        </span>
                        {repo.user.id === account.id && (
                          <Check className="menu-check" size={15} />
                        )}
                      </button>
                    ))}
                    <button
                      className="menu-divider"
                      onClick={() => {
                        close()
                        signOut()
                      }}
                    >
                      <LogOut size={15} />
                      <span>Đăng xuất</span>
                    </button>
                  </>
                )}
              </Dropdown>
            ) : (
              <IconButton label="Tải lại dữ liệu" onClick={refresh}>
                <RefreshCw size={17} />
              </IconButton>
            )}
          </div>
        </header>
        <main className="main-content">
          {pendingInvite && (
            <section className="panel invite-banner">
              <div>
                <strong>Bạn có lời mời tham gia nhóm</strong>
                <p>Dùng đúng email đã nhận lời mời để tham gia.</p>
                <ErrorText message={inviteError} />
              </div>
              <button
                className="button secondary"
                disabled={inviting}
                onClick={clearInvite}
              >
                Bỏ qua
              </button>
              <button
                className="button primary"
                disabled={inviting}
                onClick={acceptInvite}
              >
                {inviting ? 'Đang xác nhận…' : 'Tham gia nhóm'}
              </button>
            </section>
          )}
          <section className="hero">
            <div className="hero-content">
              <div className="hero-date">
                <CalendarDays size={16} />
                {capitalize(longDay.format(parseDay(today)))}
              </div>
              <h1>{pageTitle}</h1>
              <p>{description}</p>
              {view.kind !== 'chat' && (
                <div className="hero-actions">
                  {view.kind === 'members' ? (
                    isOwner && (
                      <button
                        className="button hero-primary"
                        onClick={() => setModal({ type: 'add-team-member' })}
                      >
                        <UserPlus size={18} /> Thêm thành viên vào dự án
                      </button>
                    )
                  ) : view.kind === 'allMembers' ? (
                    isOwner && (
                      <button
                        className="button hero-primary"
                        onClick={() =>
                          setModal({ type: 'create-directory-member' })
                        }
                      >
                        <UserRoundPlus size={18} /> Tạo tài khoản mới
                      </button>
                    )
                  ) : view.kind === 'reports' ? (
                    <>
                      <button
                        className="button hero-secondary"
                        onClick={() => reportActionRef.current?.exportExcel?.()}
                      >
                        <FileSpreadsheet size={18} /> Xuất báo cáo
                      </button>
                      <button
                        className="button hero-primary"
                        onClick={() => reportActionRef.current?.openSendDialog?.()}
                      >
                        <Send size={18} /> Gửi báo cáo
                      </button>
                    </>
                  ) : isTeamMissing ? (
                    <button
                      className="button hero-primary"
                      onClick={() => onCreate('team')}
                    >
                      <Plus size={18} /> Tạo nhóm
                    </button>
                  ) : (
                    canCreateInView && (
                      <button
                        className="button hero-primary"
                        disabled={!canAdd}
                        onClick={() => openNew()}
                      >
                        <Plus size={19} strokeWidth={2.2} /> Tạo công việc
                      </button>
                    )
                  )}
                  {isMine && (
                    <button
                      className="button hero-secondary"
                      onClick={() => go('calendar')}
                    >
                      <CalendarDays size={17} /> Xem lịch
                    </button>
                  )}
                  {view.kind === 'calendar' && (
                    <button
                      className="button hero-secondary"
                      onClick={() => go('mine')}
                    >
                      <ArrowLeft size={17} /> Việc của tôi
                    </button>
                  )}
                </div>
              )}
            </div>
            <HeroArt />
          </section>
          {(loadError || teamsError) && (
            <section className="panel load-state">
              <ErrorText message={loadError || teamsError} />
              <button className="button secondary" onClick={refresh}>
                Thử lại
              </button>
            </section>
          )}
          {loading && (
            <div className="panel load-state" role="status">
              Đang tải công việc…
            </div>
          )}
          {isTeamMissing && !loading && (
            <div className="panel">
              <Empty
                title="Bạn chưa chọn nhóm"
                detail="Chọn nhóm ở thanh điều hướng hoặc tạo nhóm để bắt đầu phân công công việc."
                onAdd={() => onCreate('team')}
                action="Tạo nhóm"
              />
            </div>
          )}
          {canShowTasks && (
            <div className="dashboard-grid">
                <section
                  className={
                    'panel tasks-panel' +
                    (layout === 'list' ? ' task-list-panel' : '')
                  }
                  ref={listRef}
                >
                  <div className="task-panel-heading">
                    <div>
                      <h2>
                        {layout === 'list'
                          ? 'Danh sách công việc'
                          : 'Bảng công việc'}
                      </h2>
                      <p>
                        {isFiltered
                          ? filteredTasks.length + '/' + baseTasks.length
                          : baseTasks.length}{' '}
                        công việc
                      </p>
                    </div>
                    <div className="task-tools">
                      <Filters {...{ filters, setFilters, members, isMine }} />
                      <div className="layout-switch" aria-label="Kiểu hiển thị">
                        <button
                          aria-label="Bảng Kanban"
                          aria-pressed={layout === 'board'}
                          title="Bảng Kanban"
                          onClick={() => setLayout('board')}
                        >
                          <LayoutGrid size={16} />
                        </button>
                        <button
                          aria-label="Danh sách"
                          aria-pressed={layout === 'list'}
                          title="Danh sách"
                          onClick={() => setLayout('list')}
                        >
                          <List size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div
                    className="date-tabs"
                    aria-label="Lọc theo hạn hoàn thành"
                  >
                    {Object.entries(dates).map(([key, label]) => {
                      const extCount =
                        key === 'extension'
                          ? baseTasks.filter((t) => t.extension_pending).length
                          : 0
                      return (
                        <button
                          key={key}
                          aria-pressed={filters.date === key}
                          onClick={() => setFilters({ ...filters, date: key })}
                        >
                          {label}
                          {extCount > 0 && (
                            <span className="date-tab-badge">{extCount}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {layout === 'list' ? (
                    <TaskList
                      key={JSON.stringify([
                        view.kind,
                        teamId,
                        filters,
                        normalizedQuery,
                      ])}
                      {...taskProps}
                    />
                  ) : (
                    <Board {...taskProps} />
                  )}
                </section>
                <DashboardAside
                  tasks={baseTasks}
                  today={today}
                  onOpen={openTask}
                  onUpcoming={() => {
                    setFilters({ ...defaultFilters, date: 'week' })
                    setQuery('')
                    listRef.current?.scrollIntoView({
                      block: 'nearest',
                      behavior: 'smooth',
                    })
                  }}
                />
              </div>
          )}
          {view.kind === 'calendar' && canAdd && (
            <Calendar
              tasks={filteredTasks}
              today={today}
              onOpen={openTask}
              onAdd={openNew}
            />
          )}
          {view.kind === 'reports' && canAdd && (
            <ReportPanel
              tasks={tasks}
              deletedTasks={deletedTasks}
              members={members}
              memberMap={memberMap}
              today={today}
              onOpen={openTask}
              team={team}
              actionRef={reportActionRef}
              repo={repo}
              notify={notify}
            />
          )}
          {view.kind === 'chat' && canAdd && (
            <TeamChatPanel
              team={team}
              members={members}
              memberMap={memberMap}
              userId={repo.user.id}
              userName={repo.user.name}
              repo={repo}
            />
          )}
          {view.kind === 'members' && canAdd && (
            <MemberPanel
              {...{
                team,
                members,
                isOwner,
                isDeputy,
                onEditTeam,
                onDeleteTeam,
                onTransferOwner,
                onSetRole: setMemberRole,
              }}
              onEditMember={onEditMember}
              onDeleteMember={deleteMember}
              userId={repo.user.id}
              onCreate={() => onCreate('team')}
            />
          )}
          {view.kind === 'allMembers' &&
            (isOwner ? (
              <GlobalMemberPanel
                repo={repo}
                teams={teams}
                currentUserId={repo.user.id}
                onOpenCreate={() =>
                  setModal({ type: 'create-directory-member' })
                }
                onOpenCreateTeam={() => onCreate('team')}
                notify={notify}
                onSwitchTeam={switchTeam}
              />
            ) : (
              <div
                className="panel"
                style={{
                  padding: 48,
                  textAlign: 'center',
                  background: 'white',
                  borderRadius: 14,
                }}
              >
                <h3>Giới hạn quyền truy cập</h3>
                <p className="muted" style={{ margin: '10px 0 20px' }}>
                  Chỉ có tài khoản trưởng nhóm mới xem được menu Thành viên chung này.
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => go('mine')}
                >
                  Quay lại Việc của tôi
                </button>
              </div>
            ))}
        </main>
      </div>
      {modal?.type === 'task' && (
        <TaskDialog
          key={
            modal.task
              ? 'edit:' + modal.task.id
              : 'new:' + (modal.parent?.id ?? '')
          }
          config={modal}
          {...{
            members,
            team,
            repo,
            isOwner,
            tasks,
            taskMap,
            childrenByTask,
            today,
          }}
          onUpdated={extensionUpdated}
          onOpen={openTask}
          onCreateChild={(parent) =>
            openNew({
              parent,
              scope: parent.team_id ? 'team' : 'private',
            })
          }
          onClose={() => setModal(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
      {modal?.type === 'team' && (
        <TeamDialog
          team={modal.team}
          onClose={() => setModal(null)}
          onSave={saveTeam}
        />
      )}
      {modal?.type === 'delete-team' && (
        <DeleteTeamDialog
          team={modal.team}
          onClose={() => setModal(null)}
          onConfirm={deleteTeam}
        />
      )}
      {modal?.type === 'transfer-owner' && (
        <TransferOwnerDialog
          team={team}
          member={modal.member}
          onClose={() => setModal(null)}
          onConfirm={transferOwner}
        />
      )}
      {modal?.type === 'attachment-retry' && (
        <AttachmentRetryDialog
          repo={repo}
          jobs={modal.jobs}
          onClose={() => setModal(null)}
          onComplete={() => {
            setModal(null)
            notify('Đã tải lên các tài liệu đính kèm.')
          }}
        />
      )}
      {modal?.type === 'invite' && team && (
        <InviteDialog {...{ repo, team }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'add-team-member' && team && (
        <AddTeamMemberDialog
          team={team}
          repo={repo}
          onClose={() => setModal(null)}
          onAdded={memberCreated}
          onOpenCreateDirectoryMember={() =>
            setModal({ type: 'create-directory-member' })
          }
        />
      )}
      {modal?.type === 'create-directory-member' && (
        <CreateDirectoryMemberDialog
          repo={repo}
          teams={teams}
          currentTeam={team}
          onClose={() => setModal(null)}
          onCreated={(created) => {
            setModal(null)
            notify(`Đã tạo tài khoản cho "${created.display_name}".`)
            if (
              created.initial_team === team?.id ||
              (created.teamId && created.teamId === team?.id) ||
              (created.teams && created.teams.some((t) => t.id === team?.id))
            ) {
              patchSnapshot((cur) => ({
                ...cur,
                members: [...cur.members, created],
              }))
            }
          }}
        />
      )}
      {modal?.type === 'account' && team && isOwner && (
        <AccountDialog
          key={modal.member?.user_id || 'new-member'}
          {...{ repo, team }}
          member={modal.member}
          onClose={() => setModal(null)}
          onCreated={memberCreated}
          onUpdated={memberUpdated}
        />
      )}
      {modal?.type === 'mail' && (
        <EmailDemoDialog
          repo={repo}
          tasks={tasks}
          onOpenTask={(t) => setModal({ type: 'task', task: t })}
          onReadAll={() => setUnreadCount(0)}
          onClose={() => setModal(null)}
        />
      )}
      {notice && (
        <div
          className={'toast' + (notice.error ? ' toast-error' : '')}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{notice.message}</span>
          <IconButton label="Đóng thông báo" onClick={() => setNotice(null)}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  )
}
