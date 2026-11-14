import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Check,
  FolderPlus,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UserRoundPlus,
  Users,
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
      description="Chọn thành viên từ danh sách Thành viên chung để thêm vào dự án này."
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
              <span>Vai trò trong dự án:</span>
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
              <RefreshCw size={18} className="spin" /> Đang tải danh sách thành viên...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="existing-member-empty">
              {availableMembers.length === 0 ? (
                <>
                  <p>Tất cả thành viên trong hệ thống đã có mặt trong dự án này.</p>
                  {onOpenCreateDirectoryMember && (
                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={() => {
                        onClose()
                        onOpenCreateDirectoryMember()
                      }}
                    >
                      <UserPlus size={14} /> Tạo thêm tài khoản ở Thành viên chung
                    </button>
                  )}
                </>
              ) : (
                <p>Không tìm thấy thành viên phù hợp với từ khóa "{search}".</p>
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
                      {m.department && (
                        <span className="existing-member-dept">{m.department}</span>
                      )}
                    </div>
                    <span className="existing-member-email">{m.email}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {onOpenCreateDirectoryMember && (
          <div className="existing-member-footer-hint">
            <span>Chưa có tài khoản trong danh sách? </span>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                onClose()
                onOpenCreateDirectoryMember()
              }}
            >
              + Tạo tài khoản ở Thành viên chung
            </button>
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

  async function handleConfirm() {
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
      <div className="dialog-body">
        <p>
          Bạn có chắc chắn muốn xóa tài khoản <strong>"{member.display_name}"</strong> ({member.email}) khỏi hệ thống?
        </p>
        <div className="callout callout-danger" style={{ marginTop: 12 }}>
          <p>
            Tài khoản này sẽ bị xóa khỏi danh bạ chung và gỡ bỏ khỏi tất cả các dự án đang tham gia.
          </p>
        </div>
        <ErrorText message={error} />
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </button>
          <button
            type="button"
            className="button danger"
            onClick={handleConfirm}
            disabled={busy}
          >
            <Trash2 size={16} />
            {busy ? 'Đang xóa…' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

/**
 * Trang "Thành viên chung" (Global Members Directory)
 */
export function GlobalMemberPanel({
  repo,
  teams = [],
  currentUserId,
  onOpenCreate,
  notify,
  onSwitchTeam,
}) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')

  // Modals inside GlobalMemberPanel
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

  // Lấy danh sách các phòng ban duy nhất để lọc
  const departments = useMemo(() => {
    const set = new Set()
    for (const m of members) {
      if (m.department && m.department.trim()) set.add(m.department.trim())
    }
    return Array.from(set).sort()
  }, [members])

  // Lọc thành viên
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // 1. Tìm kiếm
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = m.display_name && m.display_name.toLowerCase().includes(q)
        const matchEmail = m.email && m.email.toLowerCase().includes(q)
        const matchDept = m.department && m.department.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchDept) return false
      }
      // 2. Lọc phòng ban
      if (deptFilter !== 'all') {
        if ((m.department || '').trim() !== deptFilter) return false
      }
      // 3. Lọc dự án
      if (teamFilter !== 'all') {
        if (teamFilter === 'none') {
          if (m.teams && m.teams.length > 0) return false
        } else {
          if (!m.teams || !m.teams.some((t) => t.id === teamFilter)) return false
        }
      }
      return true
    })
  }, [members, search, deptFilter, teamFilter])

  return (
    <section className="panel global-member-panel">
      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="global-member-toolbar">
        <div className="global-member-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm thành viên theo họ tên, email, phòng ban..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearch('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="global-member-filters">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            title="Lọc theo phòng ban"
          >
            <option value="all">Tất cả phòng ban</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                Phòng: {dept}
              </option>
            ))}
          </select>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            title="Lọc theo dự án"
          >
            <option value="all">Tất cả dự án</option>
            <option value="none">Chưa vào dự án nào</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Dự án: {t.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="button secondary sm icon-only-mobile"
            onClick={reload}
            title="Làm mới"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span className="btn-label-desktop">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Thông tin số lượng */}
      <div className="global-member-count-bar">
        <span>
          Hiển thị <strong>{filteredMembers.length}</strong> / {members.length} thành viên chung
        </span>
      </div>

      {/* Bảng danh sách thành viên Desktop */}
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
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div className="existing-member-loading">
                    <RefreshCw size={20} className="spin" /> Đang tải danh sách thành viên...
                  </div>
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#777' }}>
                  {members.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <p>Chưa có thành viên nào trong danh bạ chung.</p>
                      <button
                        type="button"
                        className="button primary sm"
                        onClick={onOpenCreate}
                      >
                        <UserRoundPlus size={15} /> Tạo tài khoản thành viên đầu tiên
                      </button>
                    </div>
                  ) : (
                    <p>Không tìm thấy thành viên phù hợp với bộ lọc.</p>
                  )}
                </td>
              </tr>
            ) : (
              filteredMembers.map((m) => {
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
                              title={`Vai trò: ${
                                t.role === 'owner'
                                  ? 'Trưởng nhóm'
                                  : t.role === 'deputy'
                                    ? 'Phó nhóm'
                                    : 'Nhân viên'
                              }`}
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
                          <span className="muted text-sm">Chưa vào dự án nào</span>
                        )}
                      </div>
                    </td>
                    <td className="member-col-actions">
                      <Dropdown
                        trigger={
                          <button
                            type="button"
                            className="member-action-trigger"
                            aria-label={`Thao tác với ${m.display_name}`}
                          >
                            <MoreVertical size={16} />
                          </button>
                        }
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
                              <FolderPlus size={15} /> Thêm vào dự án…
                            </button>
                            <button
                              type="button"
                              className="member-menu-item"
                              onClick={() => {
                                close()
                                setEditingMember(m)
                              }}
                            >
                              <Pencil size={15} /> Sửa thông tin
                            </button>
                            {!isCurrentUser && (
                              <button
                                type="button"
                                className="member-menu-item member-menu-danger"
                                onClick={() => {
                                  close()
                                  setDeletingMember(m)
                                }}
                              >
                                <Trash2 size={15} /> Xóa tài khoản
                              </button>
                            )}
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

      {/* Danh sách thẻ Mobile */}
      <div className="member-cards-mobile" role="list" aria-label="Danh sách thành viên chung">
        {filteredMembers.map((m) => {
          const isCurrentUser = m.user_id === currentUserId
          return (
            <div key={m.user_id} className="member-card-item" role="listitem">
              <div className="member-card-header">
                <div className="member-card-user">
                  <Avatar name={m.display_name} id={m.user_id} />
                  <div className="member-card-name-group">
                    <div className="member-card-name">
                      <strong>{m.display_name}</strong>
                      {isCurrentUser && (
                        <small className="member-you-tag">(Bạn)</small>
                      )}
                    </div>
                    {m.department && (
                      <span className="member-dept-badge">{m.department}</span>
                    )}
                  </div>
                </div>
                <div className="member-card-actions">
                  <Dropdown
                    trigger={
                      <button
                        type="button"
                        className="member-action-trigger"
                        aria-label="Thao tác"
                      >
                        <MoreVertical size={16} />
                      </button>
                    }
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
                          <FolderPlus size={15} /> Thêm vào dự án…
                        </button>
                        <button
                          type="button"
                          className="member-menu-item"
                          onClick={() => {
                            close()
                            setEditingMember(m)
                          }}
                        >
                          <Pencil size={15} /> Sửa thông tin
                        </button>
                        {!isCurrentUser && (
                          <button
                            type="button"
                            className="member-menu-item member-menu-danger"
                            onClick={() => {
                              close()
                              setDeletingMember(m)
                            }}
                          >
                            <Trash2 size={15} /> Xóa tài khoản
                          </button>
                        )}
                      </>
                    )}
                  </Dropdown>
                </div>
              </div>
              <div className="member-card-meta">
                <div className="member-card-meta-row">
                  <span className="member-meta-label">Email:</span>
                  <span className="member-meta-value">{m.email}</span>
                </div>
                <div className="member-card-meta-row">
                  <span className="member-meta-label">Dự án:</span>
                  <div className="member-meta-value global-member-teams-cell">
                    {m.teams && m.teams.length > 0 ? (
                      m.teams.map((t) => (
                        <span key={t.id} className="global-team-badge">
                          {t.name}
                        </span>
                      ))
                    ) : (
                      <span className="muted">Chưa vào dự án nào</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals con */}
      {editingMember && (
        <EditDirectoryMemberDialog
          member={editingMember}
          repo={repo}
          onClose={() => setEditingMember(null)}
          onUpdated={(updated) => {
            setMembers((cur) =>
              cur.map((m) => (m.user_id === updated.user_id ? { ...m, ...updated } : m)),
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
            notify(`Đã thêm ${updated.display_name} vào dự án.`)
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
