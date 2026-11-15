import React from 'react'
import { Brand, HeroArt } from './ui.jsx'

export function Skeleton({ width, height, radius = 6, style, className = '' }) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        ...style,
      }}
    />
  )
}

export function SkeletonCircle({ size = 32, style, className = '' }) {
  return (
    <div
      className={`skeleton-box skeleton-circle ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

/**
 * Skeleton cho Kanban Board & Task List
 */
export function TaskBoardSkeleton({ layout = 'board' }) {
  if (layout === 'list') {
    return (
      <div className="dashboard-grid">
        <section className="panel tasks-panel task-list-panel skeleton-panel">
          <div className="task-panel-heading" style={{ marginBottom: 20 }}>
            <div>
              <Skeleton width={160} height={20} radius={6} style={{ marginBottom: 6 }} />
              <Skeleton width={80} height={14} radius={4} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton width={110} height={32} radius={8} />
              <Skeleton width={68} height={32} radius={8} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="skeleton-task-list-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  background: '#fcfbfe',
                  borderRadius: 10,
                  border: '1px solid #f0ebff',
                }}
              >
                <SkeletonCircle size={18} />
                <Skeleton width="40%" height={15} />
                <div style={{ flex: 1 }} />
                <Skeleton width={70} height={22} radius={12} />
                <Skeleton width={90} height={14} />
                <SkeletonCircle size={26} />
              </div>
            ))}
          </div>
        </section>
        <DashboardAsideSkeleton />
      </div>
    )
  }

  // Board layout (4 cột Kanban)
  return (
    <div className="dashboard-grid">
      <section className="panel tasks-panel skeleton-panel">
        <div className="task-panel-heading" style={{ marginBottom: 20 }}>
          <div>
            <Skeleton width={150} height={20} radius={6} style={{ marginBottom: 6 }} />
            <Skeleton width={90} height={14} radius={4} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Skeleton width={110} height={32} radius={8} />
            <Skeleton width={68} height={32} radius={8} />
          </div>
        </div>
        <div className="board-lanes skeleton-lanes">
          {[
            { title: 'Cần làm', count: 3 },
            { title: 'Đang làm', count: 2 },
            { title: 'Chờ duyệt', count: 1 },
            { title: 'Hoàn thành', count: 2 },
          ].map((col, idx) => (
            <div key={idx} className="lane skeleton-lane">
              <div className="lane-header" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Skeleton width={80} height={16} radius={4} />
                  <SkeletonCircle size={20} />
                </div>
                <SkeletonCircle size={24} />
              </div>
              <div className="lane-cards" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: col.count }).map((_, cIdx) => (
                  <div
                    key={cIdx}
                    className="task-card skeleton-task-card"
                    style={{
                      background: '#fff',
                      border: '1px solid #ebe8f4',
                      borderRadius: 12,
                      padding: 14,
                      boxShadow: '0 2px 6px rgba(44, 30, 80, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Skeleton width="75%" height={15} radius={4} />
                      <SkeletonCircle size={18} />
                    </div>
                    <Skeleton width="90%" height={12} radius={4} style={{ marginBottom: 12 }} />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <Skeleton width={50} height={18} radius={10} />
                      <Skeleton width={65} height={18} radius={10} />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px dashed #f0edf6',
                      }}
                    >
                      <SkeletonCircle size={24} />
                      <Skeleton width={75} height={12} radius={4} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <DashboardAsideSkeleton />
    </div>
  )
}

function DashboardAsideSkeleton() {
  return (
    <aside className="dashboard-aside skeleton-aside">
      <div
        className="panel"
        style={{
          padding: 18,
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #ebe8f4',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <Skeleton width={120} height={16} radius={4} />
          <Skeleton width={50} height={14} radius={4} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: '#faf8fd',
                borderRadius: 8,
              }}
            >
              <SkeletonCircle size={24} />
              <div style={{ flex: 1 }}>
                <Skeleton width="80%" height={13} style={{ marginBottom: 4 }} />
                <Skeleton width="50%" height={10} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="panel"
        style={{
          padding: 18,
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #ebe8f4',
        }}
      >
        <Skeleton width={140} height={16} radius={4} style={{ marginBottom: 14 }} />
        <Skeleton width="100%" height={120} radius={10} />
      </div>
    </aside>
  )
}

/**
 * Skeleton cho Quản lý phòng ban
 */
export function DepartmentSkeleton() {
  return (
    <section className="panel global-member-panel department-panel skeleton-panel">
      {/* Search toolbar */}
      <div className="global-member-toolbar" style={{ marginBottom: 16 }}>
        <div className="global-member-search" style={{ width: '100%' }}>
          <Skeleton width="100%" height={40} radius={10} />
        </div>
      </div>

      {/* Count bar */}
      <div className="global-member-count-bar" style={{ marginBottom: 16 }}>
        <Skeleton width={260} height={16} radius={4} />
      </div>

      {/* Department Cards */}
      <div className="member-tree-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          { nameW: 130, count: 2, expanded: true },
          { nameW: 170, count: 3, expanded: false },
          { nameW: 110, count: 1, expanded: false },
        ].map((dept, idx) => (
          <div
            key={idx}
            className={'member-tree-team-card' + (dept.expanded ? ' expanded' : '')}
            style={{
              background: '#fff',
              border: '1px solid #ebe8f4',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              className="member-tree-team-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                background: '#faf9fc',
                borderBottom: dept.expanded ? '1px solid #f0edf6' : 'none',
              }}
            >
              <SkeletonCircle size={28} />
              <SkeletonCircle size={28} />
              <Skeleton width={dept.nameW} height={18} radius={4} />
              <Skeleton width={60} height={20} radius={12} />
              <div style={{ flex: 1 }} />
              <Skeleton width={120} height={32} radius={8} />
              <SkeletonCircle size={32} />
              <SkeletonCircle size={32} />
            </div>

            {/* Member list inside expanded card */}
            {dept.expanded && (
              <div className="member-tree-members-list" style={{ padding: '8px 18px' }}>
                {[1, 2].map((mIdx) => (
                  <div
                    key={mIdx}
                    className="dept-member-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(180px, 1fr) minmax(140px, 0.8fr) 48px',
                      alignItems: 'center',
                      gap: 16,
                      padding: '14px 8px',
                      borderBottom: mIdx === 1 ? 'none' : '1px solid #f5f3f8',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <SkeletonCircle size={36} />
                      <div>
                        <Skeleton width={130} height={15} radius={4} style={{ marginBottom: 4 }} />
                        <Skeleton width={180} height={12} radius={4} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Skeleton width={110} height={22} radius={12} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Skeleton width={80} height={22} radius={12} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <SkeletonCircle size={28} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Skeleton cho Quản lý all dự án
 */
export function GlobalMembersSkeleton() {
  return (
    <section className="panel global-member-panel skeleton-panel">
      {/* Count bar */}
      <div className="global-member-count-bar" style={{ marginBottom: 16 }}>
        <Skeleton width={280} height={16} radius={4} />
      </div>

      <div className="member-tree-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          { nameW: 160, count: 3, expanded: true },
          { nameW: 120, count: 2, expanded: false },
        ].map((team, idx) => (
          <div
            key={idx}
            className={'member-tree-team-card' + (team.expanded ? ' expanded' : '')}
            style={{
              background: '#fff',
              border: '1px solid #ebe8f4',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div
              className="member-tree-team-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                background: '#faf9fc',
                borderBottom: team.expanded ? '1px solid #f0edf6' : 'none',
              }}
            >
              <SkeletonCircle size={28} />
              <SkeletonCircle size={28} />
              <Skeleton width={team.nameW} height={18} radius={4} />
              <Skeleton width={60} height={20} radius={12} />
              <div style={{ flex: 1 }} />
              <Skeleton width={130} height={32} radius={8} />
            </div>

            {team.expanded && (
              <div className="member-tree-members-list" style={{ padding: '8px 18px' }}>
                {[1, 2, 3].map((mIdx) => (
                  <div
                    key={mIdx}
                    className="dept-member-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(180px, 1fr) minmax(140px, 0.8fr) 48px',
                      alignItems: 'center',
                      gap: 16,
                      padding: '14px 8px',
                      borderBottom: mIdx === 2 ? 'none' : '1px solid #f5f3f8',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <SkeletonCircle size={36} />
                      <div>
                        <Skeleton width={140} height={15} radius={4} style={{ marginBottom: 4 }} />
                        <Skeleton width={190} height={12} radius={4} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Skeleton width={120} height={22} radius={12} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Skeleton width={90} height={22} radius={12} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <SkeletonCircle size={28} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Skeleton cho Lịch công việc
 */
export function CalendarSkeleton() {
  return (
    <div className="panel calendar-panel skeleton-panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Skeleton width={180} height={24} radius={6} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={36} height={32} radius={6} />
          <Skeleton width={70} height={32} radius={6} />
          <Skeleton width={36} height={32} radius={6} />
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <div key={d} style={{ textAlign: 'center' }}>
            <Skeleton width="60%" height={14} radius={4} />
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(5, 90px)',
          gap: 8,
        }}
      >
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: '#faf9fc',
              border: '1px solid #f0edf6',
              borderRadius: 8,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skeleton width={18} height={14} radius={3} />
              {i % 4 === 1 && <SkeletonCircle size={8} />}
            </div>
            {i % 3 === 0 && <Skeleton width="90%" height={16} radius={4} />}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton cho Báo cáo
 */
export function ReportsSkeleton() {
  return (
    <div className="skeleton-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="panel"
            style={{ padding: 20, background: '#fff', borderRadius: 14, border: '1px solid #ebe8f4' }}
          >
            <Skeleton width={100} height={14} radius={4} style={{ marginBottom: 12 }} />
            <Skeleton width={60} height={28} radius={6} style={{ marginBottom: 8 }} />
            <Skeleton width={140} height={12} radius={4} />
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ebe8f4' }}>
        <Skeleton width={180} height={20} radius={6} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={260} radius={10} />
      </div>
    </div>
  )
}

/**
 * Render Content Skeleton dựa trên view.kind
 */
export function ContentSkeleton({ kind = 'mine', layout = 'board' }) {
  if (kind === 'departments') return <DepartmentSkeleton />
  if (kind === 'allMembers') return <GlobalMembersSkeleton />
  if (kind === 'calendar') return <CalendarSkeleton />
  if (kind === 'reports') return <ReportsSkeleton />
  return <TaskBoardSkeleton layout={layout} />
}

const pageTitlesByKind = {
  mine: 'Việc của tôi',
  today: 'Hôm nay',
  urgent: 'Khẩn cấp',
  team: 'Không gian nhóm',
  calendar: 'Lịch công việc',
  reports: 'Báo cáo công việc',
  chat: 'Chat nhóm',
  members: 'Thành viên dự án',
  allMembers: 'Quản lý all dự án',
  departments: 'Quản lý phòng ban',
}

const pageDescriptionsByKind = {
  mine: 'Tất cả nhiệm vụ được giao cho bạn, sắp xếp theo thời hạn hoàn thành.',
  today: 'Các việc cần xử lý hôm nay để giữ đúng nhịp kế hoạch.',
  urgent: 'Việc quá hạn hoặc đến hạn trong 48 giờ tới, cần ưu tiên xử lý.',
  team: 'Theo dõi tiến độ chung của toàn bộ nhóm.',
  calendar: 'Xem hạn hoàn thành theo ngày để lên kế hoạch tuần và tháng.',
  reports: 'So sánh biến động thêm, bớt công việc và chuyển đổi trạng thái.',
  chat: 'Trao đổi, thảo luận trực tiếp giữa các thành viên trong nhóm.',
  members: 'Xem ai đang làm việc trong dự án và thêm nhân sự từ danh sách chung.',
  allMembers: 'Quản lý toàn bộ danh sách thành viên và nhân sự trong tổ chức.',
  departments: 'Quản lý sơ đồ cơ cấu phòng ban và phân bổ nhân sự theo từng phòng ban trong tổ chức.',
}

/**
 * Skeleton toàn màn hình khi tải trang ban đầu (F5) hoặc chờ Supabase session
 */
export function AppSkeleton({ kind = 'mine' }) {
  const title = pageTitlesByKind[kind] || 'Đang tải…'
  const description = pageDescriptionsByKind[kind] || 'Đang chuẩn bị không gian làm việc của bạn…'
  const isManagement = kind === 'departments' || kind === 'allMembers'

  return (
    <div className="app-shell skeleton-shell">
      {/* Sidebar Skeleton */}
      <aside className="sidebar skeleton-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-header" style={{ marginBottom: 16 }}>
            <Brand />
          </div>

          {/* Workspace selector */}
          <div
            className="workspace-picker skeleton-box"
            style={{ width: '100%', height: 42, borderRadius: 10, marginBottom: 20 }}
          />

          {/* Nav group 1 */}
          <nav className="nav-group" style={{ marginBottom: 20 }}>
            <div className="skeleton-box" style={{ width: 64, height: 11, marginBottom: 10, borderRadius: 3 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Việc của tôi', 'Hôm nay', 'Khẩn cấp', 'Không gian nhóm'].map((name, idx) => (
                <div
                  key={name}
                  className={'nav-item' + (kind === 'mine' && idx === 0 ? ' active' : '')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 8,
                  }}
                >
                  <SkeletonCircle size={18} />
                  <Skeleton width={110} height={14} radius={4} />
                </div>
              ))}
            </div>
          </nav>

          {/* Nav group 2: Quản lý chung */}
          <nav className="nav-group">
            <div className="skeleton-box" style={{ width: 80, height: 11, marginBottom: 10, borderRadius: 3 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { key: 'allMembers', label: 'Quản lý all dự án' },
                { key: 'departments', label: 'Quản lý phòng ban' },
              ].map((item) => (
                <div
                  key={item.key}
                  className={'nav-item' + (kind === item.key ? ' active' : '')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 8,
                  }}
                >
                  <SkeletonCircle size={18} />
                  <Skeleton width={120} height={14} radius={4} />
                </div>
              ))}
            </div>
          </nav>
        </div>

        {/* Sidebar footer user */}
        <div className="sidebar-footer">
          <div
            className="user-block"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#f8f6fc',
            }}
          >
            <SkeletonCircle size={34} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Skeleton width="75%" height={13} radius={4} />
              <Skeleton width="90%" height={10} radius={4} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main shell */}
      <div className="main-shell">
        <header className="topbar skeleton-topbar">
          <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skeleton width={90} height={14} radius={4} />
            <span style={{ opacity: 0.3 }}>/</span>
            <strong style={{ display: 'inline-flex' }}>
              <Skeleton width={120} height={14} radius={4} />
            </strong>
          </div>
          <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Skeleton width={200} height={36} radius={8} />
            <SkeletonCircle size={36} />
            <SkeletonCircle size={36} />
          </div>
        </header>

        <main className="content">
          {/* Hero Banner Shimmer */}
          <section className="hero skeleton-hero">
            <div className="hero-content">
              <div
                className="hero-date"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.18)',
                  marginBottom: 10,
                }}
              >
                <Skeleton width={110} height={14} radius={4} />
              </div>
              <h1 style={{ color: '#fff', margin: '4px 0 8px' }}>{title}</h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.85)', margin: '0 0 16px', maxWidth: 640 }}>
                {description}
              </p>
              <div className="hero-actions" style={{ display: 'flex', gap: 10 }}>
                <Skeleton width={140} height={38} radius={8} />
                {!isManagement && <Skeleton width={100} height={38} radius={8} />}
              </div>
            </div>
            <HeroArt />
          </section>

          {/* Content Area Skeleton */}
          <ContentSkeleton kind={kind} />
        </main>
      </div>
    </div>
  )
}
