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
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react'
import { Avatar, Dialog, Dropdown, ErrorText, PasswordInput, readableError } from './ui.jsx'
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

  async function handleConfirm(e) {
    e?.preventDefault?.()
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
      <form className="dialog-form" onSubmit={handleConfirm}>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: '#332d46' }}>
          Bạn có chắc chắn muốn xóa phòng ban <strong>"{department.name}"</strong>?
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
            Các nhân sự đang thuộc phòng ban này sẽ được chuyển về trạng thái <strong>Chưa phân phòng ban</strong> (không xóa tài khoản nhân sự).
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
 * Dialog tạo tài khoản nhân sự mới và thêm trực tiếp vào phòng ban
 */
export function AddMembersToDepartmentDialog({
  department,
  repo,
  onClose,
  onCreated,
  onAdded,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

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
        department: department.name,
        password,
      })
      if (onCreated) {
        onCreated(created)
      } else if (onAdded) {
        onAdded([created.user_id], department.name)
      }
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Thêm nhân sự vào "${department.name}"`}
      description={`Tạo tài khoản mới và thêm trực tiếp vào phòng ban "${department.name}".`}
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
            placeholder="Nhập họ và tên nhân sự…"
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
            {busy ? 'Đang tạo…' : 'Tạo tài khoản & Thêm'}
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
          onCreated={(created) => {
            const deptName = addingToDept.name
            setAddingToDept(null)
            setMembers((cur) => {
              const idx = cur.findIndex((m) => m.user_id === created.user_id)
              if (idx >= 0) {
                const next = [...cur]
                next[idx] = { ...created, department: deptName }
                return next
              }
              return [...cur, { ...created, department: deptName }]
            })
            setTimeout(() => {
              reload()
            }, 300)
            notify(
              `Đã tạo tài khoản và thêm nhân sự "${created.display_name}" vào phòng ban "${deptName}".`,
            )
          }}
          onAdded={(userIds, deptName) => {
            setAddingToDept(null)
            setMembers((cur) =>
              cur.map((m) => (userIds.includes(m.user_id) ? { ...m, department: deptName } : m)),
            )
            setTimeout(() => {
              reload()
            }, 300)
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
            if (targetDept) {
              setDepartments((cur) => {
                if (cur.some((d) => d.name === targetDept)) return cur
                return [...cur, { id: targetDept, name: targetDept, description: '' }].sort((a, b) =>
                  a.name.localeCompare(b.name),
                )
              })
              setExpandedDeptNames((cur) => new Set([...cur, targetDept]))
            }
            setTimeout(() => {
              reload()
            }, 400)
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

