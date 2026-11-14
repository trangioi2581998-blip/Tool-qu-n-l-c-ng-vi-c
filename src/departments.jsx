import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Ellipsis,
  ExternalLink,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Avatar, Dialog, Dropdown, ErrorText, readableError } from './ui.jsx'
import { EditDirectoryMemberDialog } from './global-members.jsx'

/**
 * Dialog tạo hoặc sửa phòng ban
 */
export function DepartmentFormDialog({
  department,
  repo,
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(department)
  const [name, setName] = useState(department?.name || '')
  const [description, setDescription] = useState(department?.description || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      let saved
      if (isEditing) {
        saved = await repo.renameDepartment(department.name, name.trim(), description.trim())
      } else {
        saved = await repo.createDepartment(name.trim(), description.trim())
      }
      onSaved(saved)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={isEditing ? 'Sửa tên phòng ban' : 'Thêm phòng ban mới'}
      description={
        isEditing
          ? 'Đổi tên phòng ban (hệ thống sẽ tự động cập nhật cho các nhân sự thuộc phòng ban này).'
          : 'Tạo phòng ban mới để phân bổ và quản lý nhân sự.'
      }
      compact
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={submit}>
        <label>
          Tên phòng ban
          <input
            required
            autoFocus
            maxLength={120}
            placeholder="VD: Product & CX, Kỹ thuật, Marketing…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Mô tả phòng ban (Không bắt buộc)
          <input
            maxLength={200}
            placeholder="Mô tả chức năng hoặc nhiệm vụ…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            disabled={busy || !name.trim()}
          >
            {busy ? 'Đang lưu…' : isEditing ? 'Lưu thay đổi' : 'Tạo phòng ban'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Dialog xác nhận xóa phòng ban
 */
export function DeleteDepartmentDialog({
  department,
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
      await repo.deleteDepartment(department.name)
      onDeleted(department.name)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Xóa phòng ban"
      compact
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div className="dialog-body">
        <p>
          Bạn có chắc chắn muốn xóa phòng ban <strong>"{department.name}"</strong>?
        </p>
        <div className="callout callout-danger" style={{ marginTop: 12 }}>
          <p>
            Các nhân sự đang thuộc phòng ban này sẽ được chuyển về trạng thái <strong>Chưa phân phòng ban</strong> (không xóa tài khoản nhân sự).
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
 * Dialog gán hoặc chuyển phòng ban cho 1 nhân sự
 */
export function AssignDepartmentDialog({
  member,
  departments = [],
  repo,
  onClose,
  onAssigned,
}) {
  const [selectedDept, setSelectedDept] = useState(member?.department || '')
  const [customDept, setCustomDept] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const targetDept = selectedDept === '__custom__' ? customDept.trim() : selectedDept
    setBusy(true)
    setError('')
    try {
      await repo.assignMemberDepartment(member.user_id, targetDept)
      onAssigned(member.user_id, targetDept)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Chuyển phòng ban: ${member.display_name}`}
      description="Chọn phòng ban phân bổ cho nhân sự này."
      compact
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={submit}>
        <label>
          Phòng ban
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="">-- Chưa phân phòng ban --</option>
            {departments.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
            <option value="__custom__">+ Nhập phòng ban mới…</option>
          </select>
        </label>

        {selectedDept === '__custom__' && (
          <label>
            Tên phòng ban mới
            <input
              required
              autoFocus
              maxLength={120}
              placeholder="Nhập tên phòng ban mới…"
              value={customDept}
              onChange={(e) => setCustomDept(e.target.value)}
            />
          </label>
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
            disabled={busy || (selectedDept === '__custom__' && !customDept.trim())}
          >
            {busy ? 'Đang lưu…' : 'Xác nhận chuyển'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Dialog chọn nhiều nhân sự để thêm vào phòng ban
 */
export function AddMembersToDepartmentDialog({
  department,
  members = [],
  repo,
  onClose,
  onAdded,
}) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Các nhân sự hiện chưa thuộc phòng ban này
  const candidateMembers = useMemo(() => {
    return members.filter((m) => (m.department || '').trim() !== department.name)
  }, [members, department.name])

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return candidateMembers
    const q = search.trim().toLowerCase()
    return candidateMembers.filter(
      (m) =>
        (m.display_name && m.display_name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q)),
    )
  }, [candidateMembers, search])

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
      for (const userId of selectedIds) {
        await repo.assignMemberDepartment(userId, department.name)
      }
      onAdded(Array.from(selectedIds), department.name)
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Thêm nhân sự vào "${department.name}"`}
      description="Chọn các nhân sự từ danh bạ chung để phân bổ vào phòng ban này."
      wide
      fullMobile
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="dialog-form" onSubmit={submit}>
        <div className="existing-member-header">
          <div className="existing-member-search" style={{ width: '100%' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, phòng ban hiện tại..."
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
          {filteredMembers.length === 0 ? (
            <div className="existing-member-empty">
              {candidateMembers.length === 0 ? (
                <p>Tất cả nhân sự trong hệ thống đã thuộc phòng ban này.</p>
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
                      {m.department ? (
                        <span className="existing-member-dept">
                          Hiện tại: {m.department}
                        </span>
                      ) : (
                        <span className="muted text-xs">Chưa có phòng</span>
                      )}
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
            {busy ? 'Đang thêm…' : `Thêm vào phòng ban (${selectedIds.size})`}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Trang "Quản lý phòng ban" (Department Management Panel)
 */
export function DepartmentPanel({
  repo,
  currentUserId,
  notify,
  onOpenCreateDept,
  onSwitchTeam,
}) {
  const [departments, setDepartments] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Expand / collapse state cho các phòng ban
  const [expandedDeptNames, setExpandedDeptNames] = useState(new Set())

  // Modals state
  const [editingDept, setEditingDept] = useState(null)
  const [deletingDept, setDeletingDept] = useState(null)
  const [addingToDept, setAddingToDept] = useState(null)
  const [assigningMember, setAssigningMember] = useState(null)
  const [editingMember, setEditingMember] = useState(null)

  const reload = async () => {
    setLoading(true)
    try {
      const [deptList, memList] = await Promise.all([
        typeof repo.listDepartments === 'function'
          ? repo.listDepartments()
          : Promise.resolve([]),
        typeof repo.listAllMembers === 'function'
          ? repo.listAllMembers()
          : Promise.resolve([]),
      ])
      const safeDepts = Array.isArray(deptList) ? deptList : []
      const safeMems = Array.isArray(memList) ? memList : []

      // Bổ sung các phòng ban từ nhân sự nếu chưa có
      const deptMap = new Map(safeDepts.map((d) => [d.name, d]))
      for (const m of safeMems) {
        const dName = (m.department || '').trim()
        if (dName && !deptMap.has(dName)) {
          deptMap.set(dName, { id: dName, name: dName, description: '' })
        }
      }

      const mergedDepts = Array.from(deptMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      setDepartments(mergedDepts)
      setMembers(safeMems)

      // Mặc định mở rộng tất cả các phòng ban
      setExpandedDeptNames(new Set([...mergedDepts.map((d) => d.name), '__unassigned__']))
    } catch (err) {
      console.warn('Lỗi tải dữ liệu phòng ban:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [repo])

  const toggleDept = (deptName) => {
    setExpandedDeptNames((prev) => {
      const next = new Set(prev)
      if (next.has(deptName)) next.delete(deptName)
      else next.add(deptName)
      return next
    })
  }

  const expandAll = () => {
    setExpandedDeptNames(new Set([...departments.map((d) => d.name), '__unassigned__']))
  }

  const collapseAll = () => {
    setExpandedDeptNames(new Set())
  }

  // Gỡ 1 nhân sự khỏi phòng ban
  const handleRemoveFromDept = async (member) => {
    try {
      await repo.assignMemberDepartment(member.user_id, '')
      setMembers((cur) =>
        cur.map((m) => (m.user_id === member.user_id ? { ...m, department: '' } : m)),
      )
      notify(`Đã gỡ "${member.display_name}" khỏi phòng ban.`)
    } catch (err) {
      notify(readableError(err), true)
    }
  }

  const q = search.trim().toLowerCase()

  // Lấy danh sách nhân sự của một phòng ban
  const getDeptMembers = (deptName) => {
    return members
      .filter((m) => (m.department || '').trim() === deptName)
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
  }

  // Nhân sự chưa phân phòng ban
  const unassignedMembers = useMemo(() => {
    return members.filter((m) => !(m.department || '').trim())
  }, [members])

  // Lọc theo tìm kiếm
  const filteredDepartments = useMemo(() => {
    if (!q) return departments
    return departments.filter((d) => {
      const matchDept = d.name.toLowerCase().includes(q)
      const deptMems = getDeptMembers(d.name)
      const matchMember = deptMems.some(
        (m) =>
          (m.display_name && m.display_name.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)),
      )
      return matchDept || matchMember
    })
  }, [departments, members, q])

  return (
    <section className="panel global-member-panel department-panel">
      {/* Toolbar tìm kiếm và điều khiển */}
      <div className="global-member-toolbar">
        <div className="global-member-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên phòng ban, tên nhân viên hoặc email..."
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

        <div className="global-member-controls">
          <div className="tree-toggle-actions">
            <button
              type="button"
              className="button secondary sm icon-only-mobile"
              onClick={expandAll}
              title="Mở rộng tất cả các phòng ban"
            >
              <ChevronsUpDown size={14} />
              <span className="btn-label-desktop">Mở tất cả</span>
            </button>
            <button
              type="button"
              className="button secondary sm icon-only-mobile"
              onClick={collapseAll}
              title="Thu gọn tất cả các phòng ban"
            >
              <ChevronsDownUp size={14} />
              <span className="btn-label-desktop">Thu gọn</span>
            </button>
          </div>

          <button
            type="button"
            className="button secondary sm icon-only-mobile"
            onClick={reload}
            title="Tải lại danh sách"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span className="btn-label-desktop">Làm mới</span>
          </button>

          {onOpenCreateDept && (
            <button
              type="button"
              className="button secondary sm icon-only-mobile"
              onClick={onOpenCreateDept}
              title="Thêm phòng ban mới"
            >
              <Plus size={15} />
              <span className="btn-label-desktop">Thêm phòng ban</span>
            </button>
          )}
        </div>
      </div>

      {/* Thông tin số lượng */}
      <div className="global-member-count-bar">
        <span>
          Tổng số <strong>{departments.length}</strong> phòng ban •{' '}
          <strong>{members.length}</strong> nhân sự trong hệ thống
        </span>
      </div>

      {loading ? (
        <div className="existing-member-loading" style={{ padding: '60px 0' }}>
          <RefreshCw size={24} className="spin" /> Đang tải cơ cấu phòng ban...
        </div>
      ) : (
        /* Cây phòng ban -> Nhân sự */
        <div className="member-tree-container">
          {filteredDepartments.map((d) => {
            const deptMems = getDeptMembers(d.name).filter((m) => {
              if (!q) return true
              if (d.name.toLowerCase().includes(q)) return true
              return (
                (m.display_name && m.display_name.toLowerCase().includes(q)) ||
                (m.email && m.email.toLowerCase().includes(q))
              )
            })
            const isExpanded = expandedDeptNames.has(d.name) || Boolean(q)

            return (
              <div
                key={d.name}
                className={'member-tree-team-card' + (isExpanded ? ' expanded' : '')}
              >
                {/* Header phòng ban */}
                <div
                  className="member-tree-team-header"
                  onClick={() => toggleDept(d.name)}
                >
                  <button
                    type="button"
                    className="tree-collapse-btn"
                    aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDept(d.name)
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>

                  <div className="member-tree-team-title">
                    <span className="member-tree-team-icon dept-icon">
                      <Building2 size={18} />
                    </span>
                    <div>
                      <h3>{d.name}</h3>
                      {d.description && (
                        <p className="dept-desc-text">{d.description}</p>
                      )}
                    </div>
                    <span className="member-tree-count-pill">
                      {deptMems.length} nhân sự
                    </span>
                  </div>

                  <div
                    className="member-tree-team-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={() => setAddingToDept(d)}
                      title="Thêm nhân sự vào phòng ban này"
                    >
                      <UserPlus size={14} />
                      <span className="btn-label-desktop">Thêm nhân sự</span>
                    </button>

                    <button
                      type="button"
                      className="button ghost sm"
                      onClick={() => setEditingDept(d)}
                      title="Sửa tên phòng ban"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      type="button"
                      className="button ghost sm text-danger"
                      onClick={() => setDeletingDept(d)}
                      title="Xóa phòng ban"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Danh sách nhân sự trong phòng ban */}
                {isExpanded && (
                  <div className="member-tree-team-body">
                    {deptMems.length === 0 ? (
                      <div className="member-tree-empty-team">
                        <p>Phòng ban này hiện chưa có nhân sự nào.</p>
                        <button
                          type="button"
                          className="button secondary sm"
                          onClick={() => setAddingToDept(d)}
                        >
                          <UserPlus size={14} /> Phân bổ nhân sự vào phòng ban
                        </button>
                      </div>
                    ) : (
                      <div className="member-tree-list">
                        {deptMems.map((m) => {
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

                              <div className="member-tree-item-actions">
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
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setAssigningMember(m)
                                          close()
                                        }}
                                      >
                                        <Building2 size={15} /> Chuyển phòng ban khác…
                                      </button>
                                      <button
                                        type="button"
                                        className="member-menu-item"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingMember(m)
                                          close()
                                        }}
                                      >
                                        <Pencil size={15} /> Sửa thông tin tài khoản
                                      </button>
                                      <button
                                        type="button"
                                        className="member-menu-item text-danger"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveFromDept(m)
                                          close()
                                        }}
                                      >
                                        <UserMinus size={15} /> Gỡ khỏi phòng ban này
                                      </button>
                                    </>
                                  )}
                                </Dropdown>
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

          {/* Nhánh: Nhân sự chưa phân phòng ban */}
          {unassignedMembers.length > 0 &&
            (!q ||
              unassignedMembers.some(
                (m) =>
                  (m.display_name && m.display_name.toLowerCase().includes(q)) ||
                  (m.email && m.email.toLowerCase().includes(q)),
              )) && (
              <div
                className={
                  'member-tree-team-card unassigned-card' +
                  (expandedDeptNames.has('__unassigned__') ? ' expanded' : '')
                }
              >
                <div
                  className="member-tree-team-header"
                  onClick={() => toggleDept('__unassigned__')}
                >
                  <button
                    type="button"
                    className="tree-collapse-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDept('__unassigned__')
                    }}
                  >
                    {expandedDeptNames.has('__unassigned__') ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                  <div className="member-tree-team-title">
                    <span className="member-tree-team-icon muted">
                      <Users size={18} />
                    </span>
                    <h3>Chưa phân phòng ban</h3>
                    <span className="member-tree-count-pill unassigned">
                      {unassignedMembers.length} nhân sự
                    </span>
                  </div>
                </div>

                {expandedDeptNames.has('__unassigned__') && (
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

                          <div className="member-tree-item-actions">
                            <button
                              type="button"
                              className="button secondary sm"
                              onClick={() => setAssigningMember(m)}
                            >
                              <Building2 size={14} /> Gán phòng ban…
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
      )}

      {/* Modals con */}
      {editingDept && (
        <DepartmentFormDialog
          department={editingDept}
          repo={repo}
          onClose={() => setEditingDept(null)}
          onSaved={() => {
            setEditingDept(null)
            reload()
            notify('Đã cập nhật phòng ban thành công.')
          }}
        />
      )}

      {deletingDept && (
        <DeleteDepartmentDialog
          department={deletingDept}
          repo={repo}
          onClose={() => setDeletingDept(null)}
          onDeleted={() => {
            setDeletingDept(null)
            reload()
            notify('Đã xóa phòng ban thành công.')
          }}
        />
      )}

      {addingToDept && (
        <AddMembersToDepartmentDialog
          department={addingToDept}
          members={members}
          repo={repo}
          onClose={() => setAddingToDept(null)}
          onAdded={(userIds, deptName) => {
            setAddingToDept(null)
            setMembers((cur) =>
              cur.map((m) => (userIds.includes(m.user_id) ? { ...m, department: deptName } : m)),
            )
            notify(`Đã thêm ${userIds.length} nhân sự vào phòng ban "${deptName}".`)
          }}
        />
      )}

      {assigningMember && (
        <AssignDepartmentDialog
          member={assigningMember}
          departments={departments}
          repo={repo}
          onClose={() => setAssigningMember(null)}
          onAssigned={(userId, targetDept) => {
            setAssigningMember(null)
            setMembers((cur) =>
              cur.map((m) => (m.user_id === userId ? { ...m, department: targetDept } : m)),
            )
            setTimeout(() => {
              reload()
            }, 350)
            notify('Đã cập nhật phòng ban cho nhân sự.')
          }}
        />
      )}

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
            notify('Đã cập nhật thông tin nhân sự.')
          }}
        />
      )}
    </section>
  )
}

