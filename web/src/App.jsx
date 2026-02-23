import { useState, useCallback, useRef } from 'react'
import FileTree from './components/FileTree'
import Terminal from './components/Terminal'
import TabBar from './components/TabBar'
import FilePreview from './components/FilePreview'
import DiffPreview from './components/DiffPreview'
import PushPanel from './components/PushPanel'
import PartnerHistory from './components/PartnerHistory'
import WorkerList from './components/WorkerList'
import Activity from './components/Activity'
import SpawnDialog from './components/SpawnDialog'
import QuickActions from './components/QuickActions'
import ChatInput from './components/ChatInput'
import { sendToProcess } from './api'

// Panel constraints
const MIN_LEFT = 120
const MIN_RIGHT = 150
const MIN_CENTER = 300
const MIN_INPUT_HEIGHT = 50
const MIN_MAIN_HEIGHT = 200
const DIVIDER_HEIGHT = 4
const DEFAULT_LEFT = 220
const DEFAULT_RIGHT = 280
const DEFAULT_INPUT_HEIGHT = 70

const styles = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg-primary)',
  },
  mainRow: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: MIN_MAIN_HEIGHT,
  },
  filesPanel: {
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 200,
  },
  divider: {
    width: '4px',
    background: 'var(--border)',
    cursor: 'col-resize',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  dividerHover: {
    background: 'var(--accent)',
  },
  centerContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  terminalWrapper: {
    flex: 1,
    padding: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  hDivider: {
    height: '4px',
    background: 'var(--border)',
    cursor: 'row-resize',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  inputBar: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '8px',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  quickActionsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  inputWrapper: {
    flex: 1,
    display: 'flex',
    minWidth: 0,
  },
  spawnButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}

export default function App() {
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sending, setSending] = useState(false)

  // Panel sizes (resizable)
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT)
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT)
  const [inputHeight, setInputHeight] = useState(DEFAULT_INPUT_HEIGHT)
  const [dragging, setDragging] = useState(null) // 'left' | 'right' | 'bottom' | null
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)
  const dragStartWidth = useRef(0)
  const dragStartHeight = useRef(0)

  // Tab state - terminals and files
  const [tabs, setTabs] = useState([
    { id: 'terminal:partner', label: 'partner', type: 'terminal', workerName: 'partner' }
  ])
  const [activeTab, setActiveTab] = useState('terminal:partner')

  // Drag handlers for resizable panels
  const handleMouseDown = useCallback((side) => (e) => {
    e.preventDefault()
    setDragging(side)
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    if (side === 'left') dragStartWidth.current = leftWidth
    else if (side === 'right') dragStartWidth.current = rightWidth
    else if (side === 'bottom') dragStartHeight.current = inputHeight
  }, [leftWidth, rightWidth, inputHeight])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return

    if (dragging === 'left' || dragging === 'right') {
      const viewportWidth = window.innerWidth
      const delta = e.clientX - dragStartX.current

      if (dragging === 'left') {
        const maxLeft = viewportWidth - MIN_CENTER - rightWidth - 16
        const newWidth = Math.min(maxLeft, Math.max(MIN_LEFT, dragStartWidth.current + delta))
        setLeftWidth(newWidth)
      } else if (dragging === 'right') {
        const maxRight = viewportWidth - MIN_CENTER - leftWidth - 16
        const newWidth = Math.min(maxRight, Math.max(MIN_RIGHT, dragStartWidth.current - delta))
        setRightWidth(newWidth)
      }
    } else if (dragging === 'bottom') {
      // Dragging up = larger input area
      const delta = dragStartY.current - e.clientY
      // Dynamic max: viewport - min main content - divider
      const maxInputHeight = window.innerHeight - MIN_MAIN_HEIGHT - DIVIDER_HEIGHT
      const newHeight = Math.min(maxInputHeight, Math.max(MIN_INPUT_HEIGHT, dragStartHeight.current + delta))
      setInputHeight(newHeight)
    }
  }, [dragging, leftWidth, rightWidth])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // Get current worker from active terminal tab
  const activeTerminalTab = tabs.find(t => t.id === activeTab && t.type === 'terminal')
  const currentWorker = activeTerminalTab?.workerName || 'partner'

  const handleFileSelect = useCallback((file) => {
    if (file.type === 'dir') return

    const tabId = `file:${file.path}`

    if (!tabs.find(t => t.id === tabId)) {
      setTabs(prev => [...prev, {
        id: tabId,
        label: file.name,
        type: 'file',
        filepath: file.path
      }])
    }

    setActiveTab(tabId)
  }, [tabs])

  const handleWorkerSelect = useCallback((workerName) => {
    const tabId = `terminal:${workerName}`

    // Check if terminal tab already exists
    if (!tabs.find(t => t.id === tabId)) {
      setTabs(prev => [...prev, {
        id: tabId,
        label: workerName,
        type: 'terminal',
        workerName: workerName
      }])
    }

    setActiveTab(tabId)
  }, [tabs])

  const handleTabClose = useCallback((tabId) => {
    // Don't allow closing partner terminal
    if (tabId === 'terminal:partner') return

    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTab === tabId) {
      setActiveTab('terminal:partner')
    }
  }, [activeTab])

  // Handle clicking a changed file in Activity panel
  const handleChangeFileClick = useCallback((project, file) => {
    const tabId = `diff:${project.project}:${file.path}`

    if (!tabs.find(t => t.id === tabId)) {
      setTabs(prev => [...prev, {
        id: tabId,
        label: `${file.path.split('/').pop()} (diff)`,
        type: 'diff',
        project: project.project,
        filepath: file.path
      }])
    }

    setActiveTab(tabId)
  }, [tabs])

  const handlePushClick = useCallback(() => {
    const tabId = 'push'

    if (!tabs.find(t => t.id === tabId)) {
      setTabs(prev => [...prev, {
        id: tabId,
        label: 'Push',
        type: 'push'
      }])
    }

    setActiveTab(tabId)
  }, [tabs])

  const handleHistoryClick = useCallback(() => {
    const tabId = 'history'

    if (!tabs.find(t => t.id === tabId)) {
      setTabs(prev => [...prev, {
        id: tabId,
        label: 'History',
        type: 'history'
      }])
    }

    setActiveTab(tabId)
  }, [tabs])

  const handleSpawned = () => {
    setShowSpawnDialog(false)
    setRefreshKey(k => k + 1)
  }

  const handleSend = async (text) => {
    if (!currentWorker) return
    setSending(true)
    try {
      await sendToProcess(currentWorker, text, false)
    } catch (err) {
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const handleSendRaw = async (key) => {
    if (!currentWorker) return
    setSending(true)
    try {
      await sendToProcess(currentWorker, key, true)
    } catch (err) {
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const activeFileTab = tabs.find(t => t.id === activeTab && t.type === 'file')
  const activeDiffTab = tabs.find(t => t.id === activeTab && t.type === 'diff')
  const activePushTab = tabs.find(t => t.id === activeTab && t.type === 'push')
  const activeHistoryTab = tabs.find(t => t.id === activeTab && t.type === 'history')

  return (
    <div
      style={styles.layout}
      onMouseMove={dragging ? handleMouseMove : undefined}
      onMouseUp={dragging ? handleMouseUp : undefined}
      onMouseLeave={dragging ? handleMouseUp : undefined}
    >
      {/* Main content row */}
      <div style={styles.mainRow}>
        {/* Left Panel: File Tree */}
        <aside style={{ ...styles.filesPanel, width: leftWidth }}>
          <FileTree onFileSelect={handleFileSelect} />
        </aside>

        {/* Left divider */}
        <div
          style={{
            ...styles.divider,
            ...(dragging === 'left' ? styles.dividerHover : {})
          }}
          onMouseDown={handleMouseDown('left')}
        />

        {/* Center: Tabs + Terminal/Preview */}
        <main style={styles.centerPanel}>
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            onTabClose={handleTabClose}
          />
          <div style={styles.centerContent}>
            {activeTerminalTab && (
              <div style={styles.terminalWrapper}>
                <Terminal workerName={activeTerminalTab.workerName} fullHeight />
              </div>
            )}
            {activeFileTab && (
              <FilePreview filepath={activeFileTab.filepath} />
            )}
            {activeDiffTab && (
              <DiffPreview project={activeDiffTab.project} filepath={activeDiffTab.filepath} />
            )}
            {/* Keep PushPanel mounted to preserve state during tab switches */}
            {tabs.find(t => t.type === 'push') && (
              <div style={{ display: activePushTab ? 'contents' : 'none' }}>
                <PushPanel />
              </div>
            )}
            {activeHistoryTab && (
              <PartnerHistory />
            )}
          </div>
        </main>

        {/* Right divider */}
        <div
          style={{
            ...styles.divider,
            ...(dragging === 'right' ? styles.dividerHover : {})
          }}
          onMouseDown={handleMouseDown('right')}
        />

        {/* Right Panel: Workers + Activity */}
        <aside style={{ ...styles.rightPanel, width: rightWidth }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <button
              style={styles.spawnButton}
              onClick={() => setShowSpawnDialog(true)}
            >
              + Spawn
            </button>
          </div>
          <WorkerList
            key={refreshKey}
            selectedWorker={currentWorker}
            onSelect={handleWorkerSelect}
            onRefresh={() => setRefreshKey(k => k + 1)}
          />
          <Activity onFileClick={handleChangeFileClick} onPushClick={handlePushClick} onHistoryClick={handleHistoryClick} />
        </aside>
      </div>

      {/* Horizontal divider for vertical resize */}
      <div
        style={{
          ...styles.hDivider,
          ...(dragging === 'bottom' ? { background: 'var(--accent)' } : {})
        }}
        onMouseDown={handleMouseDown('bottom')}
      />

      {/* Bottom: Input Bar */}
      <footer style={{ ...styles.inputBar, height: inputHeight }}>
        <div style={styles.quickActionsWrapper}>
          <QuickActions onSend={handleSend} onSendRaw={handleSendRaw} disabled={sending} />
        </div>
        <div style={styles.inputWrapper}>
          <ChatInput
            onSend={handleSend}
            disabled={sending}
            placeholder={`Send to ${currentWorker}...`}
          />
        </div>
      </footer>

      {/* Spawn Dialog */}
      {showSpawnDialog && (
        <SpawnDialog
          onClose={() => setShowSpawnDialog(false)}
          onSpawned={handleSpawned}
        />
      )}
    </div>
  )
}
