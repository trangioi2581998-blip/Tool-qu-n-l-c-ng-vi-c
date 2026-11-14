import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crown,
  Ellipsis,
  ExternalLink,
  FolderKanban,
  FolderOpen,
  FolderPlus,
  Layers,
  List,
  ListTree,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRoundPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import {
  Avatar,
  Dialog,
  Dropdown,
  ErrorText,
  PasswordInput,
  readableError,
} from './ui.jsx'

/**
 * Dialog thêm thành viên vào DỰ ÁN (lấy từ Thành viên chung)
 */
export function AddTeamMemberDialog({
  team,
  repo,
  onClose,
  onAdded,
  onOpenCreateDirectoryMember,
  onNavigateToDepartments,
}) {
  const [availableMembers, setAvailableMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    if (typeof repo.listAvailableMembers === 'function') {
      repo
        .listAvailableMembers(team?.id)
        .then((list) => {
          if (!active) return
          setAvailableMembers(Array.isArray(list) ? list : [])
        })
        .catch((err) => {
          console.warn('Lỗi lấy danh sách thành viên khả dụng:', err)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    } else {
      setLoading(false)
    }
    return () => {
      active = false
    }
  }, [repo, team?.id])

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return availableMembers
    const q = search.trim().toLowerCase()
    return availableMembers.filter(
      (m) =>
        (m.display_name && m.display_name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q)),
    )
  }, [availableMembers, search])

  const allSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedIds.has(m.user_id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        filteredMembers.forEach((m) => next.delete(m.user_id))
      } else {
        filteredMembers.forEach((m) => next.add(m.user_id))
      }
      return next
    })
  }

  const toggleMember = (userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (selectedIds.size === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      const toAdd = availableMembers.filter((m) => selectedIds.has(m.user_id))
      const addedList = []
      for (const m of toAdd) {
        const added = await repo.addExistingMember(team, m, role)
        if (added) addedList.push(added)
      }
      onAdded({ members: addedList })
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Thêm thành viên vào dự án "${team?.name || ''}"`}
      description="Chọn nhân sự từ Quản lý phòng ban để thêm vào dự án này."
      wide
      fullMobile
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={submit}>
        <div className="existing-member-header">
          <div className="existing-member-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, phòng ban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch('')}
                title="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </div>
          <div className="existing-member-role-select">
            <label>
              <span>Vai trò:</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Nhân viên</option>
                <option value="deputy">Phó nhóm</option>
              </select>
            </label>
          </div>
        </div>

        <div className="existing-member-toolbar">
          <label className="select-all-label">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={filteredMembers.length === 0}
            />
            <span>
              {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} (
              {filteredMembers.length})
            </span>
          </label>
          <span className="selected-count">
            Đã chọn: <strong>{selectedIds.size}</strong>
          </span>
        </div>

        <div className="existing-member-list">
          {loading ? (
            <div className="existing-member-loading">
              <RefreshCw size={18} className="spin" /> Đang tải danh sách nhân sự...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="existing-member-empty">
              {availableMembers.length === 0 ? (
                <p>Tất cả nhân sự trong các phòng ban đã có mặt trong dự án này.</p>
              ) : (
                <p>Không tìm thấy nhân sự phù hợp với từ khóa "{search}".</p>
              )}
            </div>
          ) : (
            filteredMembers.map((m) => {
              const isSelected = selectedIds.has(m.user_id)
              return (
                <div
                  key={m.user_id}
                  className={'existing-member-row' + (isSelected ? ' selected' : '')}
                  onClick={() => toggleMember(m.user_id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(m.user_id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Avatar name={m.display_name} id={m.user_id} />
                  <div className="existing-member-info">
                    <div className="existing-member-name-row">
                      <span className="existing-member-name">{m.display_name}</span>
                      <span className="existing-member-dept">
                        Phòng ban: {m.department || 'Chưa phân phòng'}
                      </span>
                    </div>
                    <span className="existing-member-email">{m.email}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

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
            type="submit"
            className="button primary"
            disabled={busy || selectedIds.size === 0}
          >
            <UserCheck size={16} />
            {busy ? 'Đang thêm…' : `Thêm vào dự án (${selectedIds.size})`}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Dialog tạo tài khoản mới trong THÀNH VIÊN CHUNG
 */
export function CreateDirectoryMemberDialog({
  repo,
  teams = [],
  currentTeam = null,
  onClose,
  onCreated,
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState(currentTeam?.id || '')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (busy || !name.trim() || !email.trim()) return
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const created = await repo.createDirectoryMember({
        display_name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim(),
        password,
        teamId: selectedTeamId || null,
        role: selectedTeamId ? role : 'member',
      })
      onCreated(created)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Tạo tài khoản thành viên mới"
      description="Tài khoản được tạo sẽ lưu vào Thành viên chung để phân bổ vào bất kỳ dự án nào."
      fullMobile
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
            onChange={(e) => setName(e.target.value)}
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
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Phòng ban
          <input
            maxLength={120}
            placeholder="VD: Product & CX, Kỹ thuật, Kinh doanh…"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </label>
        <label>
          Mật khẩu ban đầu
          <PasswordInput
            required
            minLength={6}
            maxLength={72}
            placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)…"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Xác nhận mật khẩu
          <PasswordInput
            required
            maxLength={72}
            placeholder="Nhập lại mật khẩu…"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>

        {teams.length > 0 && (
          <div className="form-row-group">
            <label>
              Thêm ngay vào dự án (Tùy chọn)
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                <option value="">-- Chưa vào dự án nào --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedTeamId && (
              <label>
                Vai trò
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">Nhân viên</option>
                  <option value="deputy">Phó nhóm</option>
                </select>
              </label>
            )}
          </div>
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
            type="submit"
            className="button primary"
            disabled={busy || !name.trim() || !email.trim() || password.length < 6}
          >
            <UserRoundPlus size={16} />
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Dialog chỉnh sửa thành viên chung
 */
export function EditDirectoryMemberDialog({
  member,
  repo,
  onClose,
  onUpdated,
}) {
  const [name, setName] = useState(member?.display_name || '')
  const [email, setEmail] = useState(member?.email || '')
  const [department, setDepartment] = useState(member?.department || '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (busy || !name.trim() || !email.trim()) return
    if (password && password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const updated = await repo.updateDirectoryMember(member.user_id, {
        display_name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim(),
        password: password.trim() || undefined,
      })
      onUpdated({ ...member, ...updated })
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Chỉnh sửa thông tin thành viên"
      description="Cập nhật thông tin thành viên trong danh bạ chung."
      fullMobile
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
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Phòng ban
          <input
            maxLength={120}
            placeholder="VD: Product & CX, Kỹ thuật…"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </label>
        <label>
          Mật khẩu mới (Để trống nếu giữ nguyên)
          <PasswordInput
            minLength={6}
            maxLength={72}
            placeholder="Nhập mật khẩu mới nếu muốn đổi…"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
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
            type="submit"
            className="button primary"
            disabled={busy || !name.trim() || !email.trim()}
          >
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Dialog gán thành viên vào một dự án
 */
export function AssignToTeamDialog({
  member,
  teams = [],
  repo,
  onClose,
  onAssigned,
}) {
  const currentTeamIds = new Set((member.teams || []).map((t) => t.id))
  const eligibleTeams = teams.filter((t) => !currentTeamIds.has(t.id))
  const [selectedTeamId, setSelectedTeamId] = useState(
    eligibleTeams[0]?.id || '',
  )
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!selectedTeamId || busy) return
    setBusy(true)
    setError('')
    try {
      const targetTeam = teams.find((t) => t.id === selectedTeamId)
      await repo.addExistingMember(targetTeam, member, role)
      const updatedTeams = [
        ...(member.teams || []),
        { id: targetTeam.id, name: targetTeam.name, role },
      ]
      onAssigned({ ...member, teams: updatedTeams })
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Thêm ${member.display_name} vào dự án`}
      description="Chọn dự án để bổ sung thành viên này."
      fullMobile
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={submit}>
        {eligibleTeams.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            Thành viên này đã tham gia tất cả các dự án hiện có.
          </p>
        ) : (
          <>
            <label>
              Chọn dự án
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                {eligibleTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vai trò trong dự án
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Nhân viên</option>
                <option value="deputy">Phó nhóm</option>
              </select>
            </label>
          </>
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
            type="submit"
            className="button primary"
            disabled={busy || !selectedTeamId || eligibleTeams.length === 0}
          >
            <UserCheck size={16} />
            {busy ? 'Đang thêm…' : 'Xác nhận thêm'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Dialog xác nhận xóa thành viên khỏi Thành viên chung
 */
export function DeleteDirectoryMemberDialog({
  member,
  repo,
  onClose,
  onDeleted,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm(e) {
    e?.preventDefault?.()
    setBusy(true)
    setError('')
    try {
      await repo.deleteDirectoryMember(member.user_id)
      onDeleted(member.user_id)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Xóa tài khoản thành viên"
      compact
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={handleConfirm}>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: '#332d46' }}>
          Bạn có chắc chắn muốn xóa tài khoản <strong>"{member.display_name}"</strong> ({member.email}) khỏi hệ thống?
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '9px',
            padding: '12px 14px',
            fontSize: '12.5px',
            lineHeight: '1.55',
            color: '#991b1b',
          }}
        >
          <Trash2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
          <div>
            Tài khoản này sẽ bị xóa khỏi danh bạ chung và gỡ bỏ khỏi tất cả các dự án đang tham gia.
          </div>
        </div>
        <ErrorText message={error} />
        <div className="form-actions" style={{ marginTop: '8px' }}>
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="button danger"
            disabled={busy}
          >
            <Trash2 size={16} />
            {busy ? 'Đang xóa…' : 'Xác nhận xóa'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Trang "Thành viên chung" (Global Members Directory) dạng TREE phân cấp theo Team
 */
export function GlobalMemberPanel({
  repo,
  teams = [],
  currentUserId,
  onOpenCreate,
  onOpenCreateTeam,
  onEditTeam,
  notify,
  onSwitchTeam,
  onNavigateToDepartments,
}) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('tree') // 'tree' | 'flat'

  // Expand / collapse state cho các team trong tree view
  const [expandedTeamIds, setExpandedTeamIds] = useState(new Set())

  // Modals inside GlobalMemberPanel
  const [addingToTeam, setAddingToTeam] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [assigningMember, setAssigningMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)

  const reload = async () => {
    setLoading(true)
    try {
      if (typeof repo.listAllMembers === 'function') {
        const list = await repo.listAllMembers()
        setMembers(Array.isArray(list) ? list : [])
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách Thành viên chung:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [repo])

  // Mặc định mở rộng tất cả các team
  useEffect(() => {
    if (teams && teams.length > 0) {
      setExpandedTeamIds(new Set([...teams.map((t) => t.id), 'unassigned']))
    }
  }, [teams])

  const toggleTeam = (teamId) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  const expandAll = () => {
    setExpandedTeamIds(new Set([...teams.map((t) => t.id), 'unassigned']))
  }

  const collapseAll = () => {
    setExpandedTeamIds(new Set())
  }

  // Thay đổi vai trò của thành viên trong một team
  const handleChangeRole = async (teamId, userId, newRole) => {
    try {
      await repo.setMemberRole(teamId, userId, newRole)
      setMembers((cur) =>
        cur.map((m) => {
          if (m.user_id !== userId) return m
          const updatedTeams = (m.teams || []).map((t) =>
            t.id === teamId ? { ...t, role: newRole } : t,
          )
          return { ...m, teams: updatedTeams }
        }),
      )
      notify('Đã cập nhật vai trò của thành viên trong nhóm.')
    } catch (err) {
      notify(readableError(err), true)
    }
  }

  // Gỡ thành viên khỏi một team
  const handleRemoveFromTeam = async (targetTeam, member) => {
    try {
      await repo.removeMember(targetTeam, member.user_id)
      setMembers((cur) =>
        cur.map((m) => {
          if (m.user_id !== member.user_id) return m
          const updatedTeams = (m.teams || []).filter((t) => t.id !== targetTeam.id)
          return { ...m, teams: updatedTeams }
        }),
      )
      notify(`Đã gỡ "${member.display_name}" khỏi nhóm "${targetTeam.name}".`)
    } catch (err) {
      notify(readableError(err), true)
    }
  }

  // Lọc dữ liệu theo từ khóa tìm kiếm
  const q = search.trim().toLowerCase()

  const getTeamMembers = (teamId) => {
    return members
      .filter((m) => m.teams && m.teams.some((team) => team.id === teamId))
      .map((m) => {
        const teamInfo = m.teams.find((team) => team.id === teamId)
        return {
          ...m,
          role: teamInfo?.role || 'member',
        }
      })
      .sort((a, b) => {
        const roleWeight = { owner: 0, deputy: 1, member: 2 }
        const diff = (roleWeight[a.role] ?? 2) - (roleWeight[b.role] ?? 2)
        if (diff !== 0) return diff
        return a.display_name.localeCompare(b.display_name)
      })
  }

  const unassignedMembers = useMemo(() => {
    return members.filter((m) => !m.teams || m.teams.length === 0)
  }, [members])

  // Lọc cho Tree View:
  // Nếu có tìm kiếm: hiển thị team nếu tên team match hoặc có thành viên trong team match
  const filteredTeams = useMemo(() => {
    if (!q) return teams
    return teams.filter((t) => {
      const matchTeam = t.name.toLowerCase().includes(q)
      const teamMems = getTeamMembers(t.id)
      const matchMember = teamMems.some(
        (m) =>
          (m.display_name && m.display_name.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          (m.department && m.department.toLowerCase().includes(q)),
      )
      return matchTeam || matchMember
    })
  }, [teams, members, q])

  const filteredFlatMembers = useMemo(() => {
    if (!q) return members
    return members.filter(
      (m) =>
        (m.display_name && m.display_name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        (m.teams && m.teams.some((t) => t.name.toLowerCase().includes(q))),
    )
  }, [members, q])

  return (
    <section className="panel global-member-panel">
      {/* Thông tin số lượng */}
      <div className="global-member-count-bar">
        <span>
          Tổng số <strong>{teams.length}</strong> nhóm công việc •{' '}
          <strong>{members.length}</strong> thành viên chung
        </span>
      </div>

      {loading ? (
        <div className="existing-member-loading" style={{ padding: '60px 0' }}>
          <RefreshCw size={24} className="spin" /> Đang tải cây danh bạ thành viên...
        </div>
      ) : viewMode === 'tree' ? (
        /* ===================================================================
           DẠNG TREE: NHÓM (TEAM) -> CÁC THÀNH VIÊN TRONG NHÓM
           =================================================================== */
        <div className="member-tree-container">
          {filteredTeams.map((t) => {
            const teamMems = getTeamMembers(t.id).filter((m) => {
              if (!q) return true
              if (t.name.toLowerCase().includes(q)) return true
              return (
                (m.display_name && m.display_name.toLowerCase().includes(q)) ||
                (m.email && m.email.toLowerCase().includes(q)) ||
                (m.department && m.department.toLowerCase().includes(q))
              )
            })
            const isExpanded = expandedTeamIds.has(t.id) || Boolean(q)

            return (
              <div
                key={t.id}
                className={'member-tree-team-card' + (isExpanded ? ' expanded' : '')}
              >
                {/* Header nhánh Team */}
                <div
                  className="member-tree-team-header"
                  onClick={() => toggleTeam(t.id)}
                >
                  <button
                    type="button"
                    className="tree-collapse-btn"
                    aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTeam(t.id)
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>

                  <div className="member-tree-team-title">
                    <span className="member-tree-team-icon">
                      {isExpanded ? (
                        <FolderOpen size={18} />
                      ) : (
                        <FolderKanban size={18} />
                      )}
                    </span>
                    <h3>{t.name}</h3>
                    {onEditTeam && (
                      <button
                        type="button"
                        className="icon-button edit-team-inline-btn"
                        style={{ width: '24px', height: '24px', padding: 0 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditTeam(t)
                        }}
                        title="Đổi tên dự án"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <span className="member-tree-count-pill">
                      {teamMems.length} thành viên
                    </span>
                  </div>

                  <div
                    className="member-tree-team-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={() => setAddingToTeam(t)}
                      title="Thêm thành viên vào dự án này"
                    >
                      <UserPlus size={14} />
                      <span className="btn-label-desktop">Thêm thành viên</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách thành viên bên trong Team */}
                {isExpanded && (
                  <div className="member-tree-team-body">
                    {teamMems.length === 0 ? (
                      <div className="member-tree-empty-team">
                        <p>Nhóm này hiện chưa có thành viên nào.</p>
                        <button
                          type="button"
                          className="button secondary sm"
                          onClick={() => setAddingToTeam(t)}
                        >
                          <UserPlus size={14} /> Chọn thêm thành viên vào nhóm
                        </button>
                      </div>
                    ) : (
                      <div className="member-tree-list">
                        {teamMems.map((m) => {
                          const role = m.role || 'member'
                          const isCurrentUser = m.user_id === currentUserId
                          return (
                            <div key={m.user_id} className="member-tree-item">
                              <div className="member-tree-item-user">
                                <Avatar name={m.display_name} id={m.user_id} />
                                <div className="member-tree-item-name-group">
                                  <div className="member-tree-item-name">
                                    <strong>{m.display_name}</strong>
                                    {isCurrentUser && (
                                      <small className="member-you-tag">
                                        (Bạn)
                                      </small>
                                    )}
                                  </div>
                                  <span className="member-tree-item-email">
                                    {m.email}
                                  </span>
                                </div>
                              </div>

                              <div className="member-tree-item-dept">
                                {m.department ? (
                                  <span className="member-dept-badge">
                                    Phòng ban: {m.department}
                                  </span>
                                ) : (
                                  <span className="muted text-xs">
                                    Phòng ban: Chưa phân phòng
                                  </span>
                                )}
                              </div>

                              <div className="member-tree-item-role">
                                <span
                                  className={
                                    'badge ' +
                                    (role === 'owner'
                                      ? 'purple'
                                      : role === 'deputy'
                                        ? 'blue'
                                        : 'gray')
                                  }
                                >
                                  {role === 'owner' && (
                                    <Crown size={12} style={{ marginRight: 4 }} />
                                  )}
                                  {role === 'deputy' && (
                                    <ShieldCheck
                                      size={12}
                                      style={{ marginRight: 4 }}
                                    />
                                  )}
                                  Vai trò: {role === 'owner'
                                    ? 'Trưởng nhóm'
                                    : role === 'deputy'
                                      ? 'Phó nhóm'
                                      : 'Nhân viên'}
                                </span>
                              </div>

                              <div className="member-tree-item-actions">
                                {role !== 'owner' && (
                                  <Dropdown
                                    label={`Thao tác với ${m.display_name}`}
                                    className="action-dropdown member-action-dropdown"
                                    trigger={<Ellipsis size={18} />}
                                  >
                                    {(close) => (
                                      <>
                                        {role === 'deputy' ? (
                                          <button
                                            type="button"
                                            className="member-menu-item"
                                            onClick={() => {
                                              close()
                                              handleChangeRole(
                                                t.id,
                                                m.user_id,
                                                'member',
                                              )
                                            }}
                                          >
                                            <UserMinus size={15} /> Gỡ quyền phó
                                            nhóm
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="member-menu-item"
                                            onClick={() => {
                                              close()
                                              handleChangeRole(
                                                t.id,
                                                m.user_id,
                                                'deputy',
                                              )
                                            }}
                                          >
                                            <ShieldCheck size={15} /> Bổ nhiệm
                                            phó nhóm
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          className="member-menu-item text-danger"
                                          onClick={() => {
                                            close()
                                            handleRemoveFromTeam(t, m)
                                          }}
                                        >
                                          <Trash2 size={15} /> Gỡ khỏi nhóm này
                                        </button>
                                      </>
                                    )}
                                  </Dropdown>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Nhánh: Thành viên chưa phân vào nhóm nào */}
          {unassignedMembers.length > 0 && (!q || unassignedMembers.some((m) =>
            (m.display_name && m.display_name.toLowerCase().includes(q)) ||
            (m.email && m.email.toLowerCase().includes(q)),
          )) && (
            <div
              className={
                'member-tree-team-card unassigned-card' +
                (expandedTeamIds.has('unassigned') ? ' expanded' : '')
              }
            >
              <div
                className="member-tree-team-header"
                onClick={() => toggleTeam('unassigned')}
              >
                <button
                  type="button"
                  className="tree-collapse-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTeam('unassigned')
                  }}
                >
                  {expandedTeamIds.has('unassigned') ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
                <div className="member-tree-team-title">
                  <span className="member-tree-team-icon muted">
                    <UsersRound size={18} />
                  </span>
                  <h3>Chưa phân vào nhóm nào</h3>
                  <span className="member-tree-count-pill unassigned">
                    {unassignedMembers.length} thành viên
                  </span>
                </div>
              </div>

              {expandedTeamIds.has('unassigned') && (
                <div className="member-tree-team-body">
                  <div className="member-tree-list">
                    {unassignedMembers.map((m) => (
                      <div key={m.user_id} className="member-tree-item">
                        <div className="member-tree-item-user">
                          <Avatar name={m.display_name} id={m.user_id} />
                          <div className="member-tree-item-name-group">
                            <div className="member-tree-item-name">
                              <strong>{m.display_name}</strong>
                              {m.user_id === currentUserId && (
                                <small className="member-you-tag">(Bạn)</small>
                              )}
                            </div>
                            <span className="member-tree-item-email">
                              {m.email}
                            </span>
                          </div>
                        </div>

                        <div className="member-tree-item-dept">
                          {m.department ? (
                            <span className="member-dept-badge">
                              {m.department}
                            </span>
                          ) : (
                            <span className="muted text-xs">
                              Chưa phân phòng
                            </span>
                          )}
                        </div>

                        <div className="member-tree-item-role">
                          <span className="badge gray">Chưa vào nhóm</span>
                        </div>

                        <div className="member-tree-item-actions">
                          <button
                            type="button"
                            className="button secondary sm"
                            onClick={() => setAssigningMember(m)}
                          >
                            <FolderPlus size={14} /> Gán vào nhóm…
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================
           DẠNG BẢNG (FLAT TABLE)
           =================================================================== */
        <div className="member-table-wrap">
          <table className="member-table" aria-label="Bảng thành viên chung">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Phòng ban</th>
                <th>Dự án đang tham gia</th>
                <th className="member-col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlatMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#777' }}>
                    Không tìm thấy thành viên phù hợp.
                  </td>
                </tr>
              ) : (
                filteredFlatMembers.map((m) => {
                  const isCurrentUser = m.user_id === currentUserId
                  return (
                    <tr key={m.user_id}>
                      <td>
                        <div className="member-name-cell">
                          <Avatar name={m.display_name} id={m.user_id} />
                          <div>
                            <strong>
                              {m.display_name}{' '}
                              {isCurrentUser && <small>(Bạn)</small>}
                            </strong>
                          </div>
                        </div>
                      </td>
                      <td className="member-cell-email">{m.email}</td>
                      <td>
                        {m.department ? (
                          <span className="member-dept-badge">{m.department}</span>
                        ) : (
                          <span className="muted">Chưa phân phòng</span>
                        )}
                      </td>
                      <td>
                        <div className="global-member-teams-cell">
                          {m.teams && m.teams.length > 0 ? (
                            m.teams.map((t) => (
                              <span
                                key={t.id}
                                className="global-team-badge"
                                onClick={() => onSwitchTeam?.(t.id)}
                              >
                                <Briefcase size={12} />
                                {t.name}
                                <small>
                                  (
                                  {t.role === 'owner'
                                    ? 'Trưởng nhóm'
                                    : t.role === 'deputy'
                                      ? 'Phó nhóm'
                                      : 'Nhân viên'}
                                  )
                                </small>
                              </span>
                            ))
                          ) : (
                            <span className="muted text-sm">Chưa vào nhóm nào</span>
                          )}
                        </div>
                      </td>
                      <td className="member-col-actions">
                        <Dropdown
                          label={`Thao tác với ${m.display_name}`}
                          className="action-dropdown member-action-dropdown"
                          trigger={<Ellipsis size={18} />}
                        >
                          {(close) => (
                            <>
                              <button
                                type="button"
                                className="member-menu-item"
                                onClick={() => {
                                  close()
                                  setAssigningMember(m)
                                }}
                              >
                                <FolderPlus size={15} /> Thêm vào nhóm…
                              </button>

                            </>
                          )}
                        </Dropdown>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals con */}
      {addingToTeam && (
        <AddTeamMemberDialog
          team={addingToTeam}
          repo={repo}
          onClose={() => setAddingToTeam(null)}
          onAdded={() => {
            setAddingToTeam(null)
            reload()
            notify(`Đã thêm thành viên vào nhóm "${addingToTeam.name}".`)
          }}
          onNavigateToDepartments={onNavigateToDepartments}
          onOpenCreateDirectoryMember={onNavigateToDepartments || onOpenCreate}
        />
      )}

      {editingMember && (
        <EditDirectoryMemberDialog
          member={editingMember}
          repo={repo}
          onClose={() => setEditingMember(null)}
          onUpdated={(updated) => {
            setMembers((cur) =>
              cur.map((m) =>
                m.user_id === updated.user_id ? { ...m, ...updated } : m,
              ),
            )
            setEditingMember(null)
            notify('Đã cập nhật thông tin thành viên.')
          }}
        />
      )}

      {assigningMember && (
        <AssignToTeamDialog
          member={assigningMember}
          teams={teams}
          repo={repo}
          onClose={() => setAssigningMember(null)}
          onAssigned={(updated) => {
            setMembers((cur) =>
              cur.map((m) => (m.user_id === updated.user_id ? updated : m)),
            )
            setAssigningMember(null)
            notify(`Đã thêm ${updated.display_name} vào nhóm.`)
          }}
        />
      )}

      {deletingMember && (
        <DeleteDirectoryMemberDialog
          member={deletingMember}
          repo={repo}
          onClose={() => setDeletingMember(null)}
          onDeleted={(userId) => {
            setMembers((cur) => cur.filter((m) => m.user_id !== userId))
            setDeletingMember(null)
            notify('Đã xóa tài khoản thành viên khỏi hệ thống.')
          }}
        />
      )}
    </section>
  )
}
