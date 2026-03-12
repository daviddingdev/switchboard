import { useState, useCallback, useRef } from 'react'
import { useIsMobile } from './hooks/useMediaQuery'
import FileTree from './components/FileTree'
import TabBar from './components/TabBar'
import FilePreview from './components/FilePreview'
import DiffPreview from './components/DiffPreview'
import WorkerDashboard from './components/WorkerDashboard'
import Activity from './components/Activity'
import SpawnDialog from './components/SpawnDialog'
import MobileNav from './components/MobileNav'
import Monitor from './components/Monitor'
import Usage from './components/Usage'
import TerminalView from './components/TerminalView'

// Desktop panel constraints
const MIN_FILES = 140
const MAX_FILES = 600
const DEFAULT_FILES = 260
const MIN_ACTIVITY = 140
const MAX_ACTIVITY = 500
const DEFAULT_ACTIVITY = 260
const MIN_CENTER = 200
const MIN_TOP = 60
const DEFAULT_TOP = null // auto height

const desktopStyles = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: 'var(--bg-primary)',
    userSelect: 'none',
    overflow: 'hidden',
  },
  layoutNoSelect: {
    userSelect: 'none',
    cursor: 'col-resize',
  },
  layoutNoSelectRow: {
    userSelect: 'none',
    cursor: 'row-resize',
  },
  topSection: {
    flexShrink: 0,
    borderBottom: '1px solid var(--border)',
    overflow: 'hidden',
  },
  hDivider: {
    height: '4px',
    background: 'var(--border)',
    cursor: 'row-resize',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  bottomSection: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  filesPanel: {
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  filesPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  filesPanelTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  vDivider: {
    width: '4px',
    background: 'var(--border)',
    cursor: 'col-resize',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  dividerActive: {
    background: 'var(--accent)',
  },
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: MIN_CENTER,
  },
  previewContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewEmpty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  activityPanel: {
    flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
}

const mobileStyles = {
  layout: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    minHeight: 0,
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
  },
  previewBody: {
    flex: 1,
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  previewTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}

export default function App() {
  const isMobile = useIsMobile()

  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Tab state
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)

  // Desktop panel sizes
  const [filesPanelWidth, setFilesPanelWidth] = useState(DEFAULT_FILES)
  const [activityPanelWidth, setActivityPanelWidth] = useState(DEFAULT_ACTIVITY)
  const [topHeight, setTopHeight] = useState(DEFAULT_TOP) // null = auto
  const [filesPanelCollapsed, setFilesPanelCollapsed] = useState(false)
  const [activityPanelCollapsed, setActivityPanelCollapsed] = useState(false)

  // Drag state: which divider is being dragged
  const [dragging, setDragging] = useState(null) // 'files' | 'activity' | 'top' | null
  const dragStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Mobile state
  const [mobileSection, setMobileSection] = useState('workers')
  const [mobilePreview, setMobilePreview] = useState(null)

  // --- Tab management ---

  const openTab = useCallback((type, path, project) => {
    const id = type === 'monitor' ? 'monitor' : type === 'usage' ? 'usage' : type === 'terminal' ? `terminal:${path}` : type === 'diff' ? `diff:${project}:${path}` : `file:${path}`
    const label = type === 'monitor' ? 'Monitor' : type === 'usage' ? 'Usage' : type === 'terminal' ? path : path.split('/').pop()

    setTabs(prev => {
      if (prev.find(t => t.id === id)) return prev
      return [...prev, { id, type, label, path, project }]
    })
    setActiveTabId(id)
  }, [])

  const closeTab = useCallback((id) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      // Update active tab if we're closing the active one
      setActiveTabId(activeId => {
        if (activeId !== id) return activeId
        return next.length > 0 ? next[next.length - 1].id : null
      })
      return next
    })
  }, [])

  // --- File/diff opening ---

  const handleFileSelect = useCallback((file) => {
    if (file.type === 'dir') return
    if (isMobile) {
      setMobilePreview({ type: 'file', path: file.path })
    } else {
      openTab('file', file.path)
    }
  }, [isMobile, openTab])

  const handleChangeFileClick = useCallback((project, file) => {
    if (isMobile) {
      setMobilePreview({ type: 'diff', path: file.path, project: project.project })
    } else {
      openTab('diff', file.path, project.project)
    }
  }, [isMobile, openTab])

  // --- Unified drag resize ---

  const handleDragStart = useCallback((which) => (e) => {
    e.preventDefault()
    setDragging(which)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: which === 'files' ? filesPanelWidth : activityPanelWidth,
      height: topHeight || 0,
    }
    // Capture initial auto height for top section
    if (which === 'top' && topHeight === null) {
      const topEl = document.getElementById('top-section')
      if (topEl) dragStart.current.height = topEl.offsetHeight
    }
  }, [filesPanelWidth, activityPanelWidth, topHeight])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y

    if (dragging === 'files') {
      setFilesPanelWidth(Math.min(MAX_FILES, Math.max(MIN_FILES, dragStart.current.width + dx)))
    } else if (dragging === 'activity') {
      // Activity is on the right, so dragging left increases width
      setActivityPanelWidth(Math.min(MAX_ACTIVITY, Math.max(MIN_ACTIVITY, dragStart.current.width - dx)))
    } else if (dragging === 'top') {
      const maxTop = window.innerHeight * 0.6
      const newHeight = Math.min(maxTop, Math.max(MIN_TOP, dragStart.current.height + dy))
      setTopHeight(newHeight)
    }
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  const handleSpawned = () => {
    setShowSpawnDialog(false)
    setRefreshKey(k => k + 1)
  }

  // --- Active tab data ---
  const activeTab = tabs.find(t => t.id === activeTabId)

  // --- Cursor style during drag ---
  const layoutDragStyle = dragging === 'top'
    ? desktopStyles.layoutNoSelectRow
    : dragging ? desktopStyles.layoutNoSelect : {}

  // --- Render ---

  if (isMobile) {
    return (
      <div style={mobileStyles.layout}>
        <div style={mobileStyles.content}>
          {mobileSection === 'workers' && (
            <WorkerDashboard
              key={refreshKey}
              isMobile
              onSpawn={() => setShowSpawnDialog(true)}
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
          )}
          {mobileSection === 'files' && (
            <FileTree onFileSelect={handleFileSelect} isMobile />
          )}
          {mobileSection === 'activity' && (
            <Activity onFileClick={handleChangeFileClick} isMobile />
          )}
          {mobileSection === 'monitor' && (
            <Monitor isMobile />
          )}
          {mobileSection === 'usage' && (
            <Usage isMobile />
          )}
        </div>

        {mobilePreview && (
          <div style={mobileStyles.previewOverlay}>
            <div style={mobileStyles.previewHeader}>
              <button
                style={mobileStyles.backBtn}
                onClick={() => setMobilePreview(null)}
              >
                ← Back
              </button>
              <span style={mobileStyles.previewTitle}>
                {mobilePreview.path.split('/').pop()}
              </span>
            </div>
            <div style={mobileStyles.previewBody}>
              {mobilePreview.type === 'file' ? (
                <FilePreview filepath={mobilePreview.path} isMobile />
              ) : (
                <DiffPreview
                  project={mobilePreview.project}
                  filepath={mobilePreview.path}
                  isMobile
                />
              )}
            </div>
          </div>
        )}

        <MobileNav
          activeSection={mobileSection}
          onSectionChange={(s) => {
            setMobilePreview(null)
            setMobileSection(s)
          }}
        />

        {showSpawnDialog && (
          <SpawnDialog
            isMobile
            onClose={() => setShowSpawnDialog(false)}
            onSpawned={handleSpawned}
          />
        )}
      </div>
    )
  }

  // Desktop layout
  return (
    <div
      style={{ ...desktopStyles.layout, ...layoutDragStyle }}
      onMouseMove={dragging ? handleMouseMove : undefined}
      onMouseUp={dragging ? handleMouseUp : undefined}
      onMouseLeave={dragging ? handleMouseUp : undefined}
    >
      {/* Top: Workers */}
      <div
        id="top-section"
        style={{
          ...desktopStyles.topSection,
          ...(topHeight !== null ? { height: topHeight, overflow: 'auto' } : {}),
        }}
      >
        <WorkerDashboard
          key={refreshKey}
          onSpawn={() => setShowSpawnDialog(true)}
          onRefresh={() => setRefreshKey(k => k + 1)}
          onTerminal={(name) => openTab('terminal', name)}
          onMonitor={() => openTab('monitor')}
          onUsage={() => openTab('usage')}
        />
      </div>

      {/* Horizontal divider between workers and content */}
      <div
        style={{
          ...desktopStyles.hDivider,
          ...(dragging === 'top' ? desktopStyles.dividerActive : {}),
        }}
        onMouseDown={handleDragStart('top')}
      />

      {/* Bottom: Files | Preview | Activity */}
      <div style={desktopStyles.bottomSection}>
        {/* Files panel */}
        {!filesPanelCollapsed && (
          <aside style={{ ...desktopStyles.filesPanel, width: filesPanelWidth }}>
            <div style={desktopStyles.filesPanelHeader}>
              <span style={desktopStyles.filesPanelTitle}>Files</span>
              <button
                style={desktopStyles.collapseBtn}
                onClick={() => setFilesPanelCollapsed(true)}
                title="Collapse files"
              >
                ◀
              </button>
            </div>
            <FileTree onFileSelect={handleFileSelect} />
          </aside>
        )}

        {/* Left divider / expand button */}
        {filesPanelCollapsed ? (
          <button
            style={{
              ...desktopStyles.collapseBtn,
              padding: '8px 4px',
              borderRight: '1px solid var(--border)',
              borderRadius: 0,
              background: 'var(--bg-secondary)',
            }}
            onClick={() => setFilesPanelCollapsed(false)}
            title="Show files"
          >
            ▶
          </button>
        ) : (
          <div
            style={{
              ...desktopStyles.vDivider,
              ...(dragging === 'files' ? desktopStyles.dividerActive : {}),
            }}
            onMouseDown={handleDragStart('files')}
          />
        )}

        {/* Center: Tabs + Preview */}
        <main style={desktopStyles.centerPanel}>
          {tabs.length > 0 && (
            <TabBar
              tabs={tabs}
              activeTab={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={closeTab}
            />
          )}
          <div style={desktopStyles.previewContent}>
            {activeTab ? (
              activeTab.type === 'terminal' ? (
                <TerminalView workerName={activeTab.path} />
              ) : activeTab.type === 'usage' ? (
                <Usage />
              ) : activeTab.type === 'monitor' ? (
                <Monitor />
              ) : activeTab.type === 'file' ? (
                <FilePreview filepath={activeTab.path} />
              ) : (
                <DiffPreview project={activeTab.project} filepath={activeTab.path} />
              )
            ) : (
              <div style={desktopStyles.previewEmpty}>
                Select a file to preview
              </div>
            )}
          </div>
        </main>

        {/* Right divider / expand button */}
        {activityPanelCollapsed ? (
          <button
            style={{
              ...desktopStyles.collapseBtn,
              padding: '8px 4px',
              borderLeft: '1px solid var(--border)',
              borderRadius: 0,
              background: 'var(--bg-secondary)',
            }}
            onClick={() => setActivityPanelCollapsed(false)}
            title="Show activity"
          >
            ◀
          </button>
        ) : (
          <div
            style={{
              ...desktopStyles.vDivider,
              ...(dragging === 'activity' ? desktopStyles.dividerActive : {}),
            }}
            onMouseDown={handleDragStart('activity')}
          />
        )}

        {/* Activity panel */}
        {!activityPanelCollapsed && (
          <aside style={{ ...desktopStyles.activityPanel, width: activityPanelWidth }}>
            <Activity
              onFileClick={handleChangeFileClick}
              onCollapse={() => setActivityPanelCollapsed(true)}
            />
          </aside>
        )}
      </div>

      {showSpawnDialog && (
        <SpawnDialog
          onClose={() => setShowSpawnDialog(false)}
          onSpawned={handleSpawned}
        />
      )}
    </div>
  )
}
