import { useState, useRef, useCallback } from 'react'
import ProcessTree from './components/ProcessTree'
import SpawnDialog from './components/SpawnDialog'
import ChatArea from './components/ChatArea'
import Terminal from './components/Terminal'
import ChatInput from './components/ChatInput'
import QuickActions from './components/QuickActions'
import { sendToProcess } from './api'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
  },
  spawnButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: 500,
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  dividerV: {
    width: '4px',
    background: 'var(--border)',
    cursor: 'col-resize',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  dividerH: {
    height: '4px',
    background: 'var(--border)',
    cursor: 'row-resize',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  dividerActive: {
    background: 'var(--accent)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
    minWidth: '200px',
    maxWidth: '600px',
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '0 10px 10px',
    overflow: 'hidden',
  },
  sidebarLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  processTreeWrapper: {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  terminalSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '0 10px 10px',
  },
  quickActionsWrapper: {
    paddingTop: '4px',
  },
  inputWrapper: {
    padding: '0 10px 10px',
  },
}

export default function App() {
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedWorker, setSelectedWorker] = useState('partner')
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [processTreeHeight, setProcessTreeHeight] = useState(180)
  const [isDraggingV, setIsDraggingV] = useState(false)
  const [isDraggingH, setIsDraggingH] = useState(false)
  const [sending, setSending] = useState(false)
  const dragRefV = useRef(null)
  const dragRefH = useRef(null)

  const handleSpawned = () => {
    setShowSpawnDialog(false)
    setRefreshKey(k => k + 1)
  }

  // Vertical divider (sidebar width)
  const handleMouseDownV = useCallback((e) => {
    e.preventDefault()
    setIsDraggingV(true)
    dragRefV.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    }
  }, [sidebarWidth])

  const handleMouseMoveV = useCallback((e) => {
    if (!isDraggingV || !dragRefV.current) return
    const delta = dragRefV.current.startX - e.clientX
    const newWidth = Math.min(600, Math.max(200, dragRefV.current.startWidth + delta))
    setSidebarWidth(newWidth)
  }, [isDraggingV])

  const handleMouseUpV = useCallback(() => {
    setIsDraggingV(false)
    dragRefV.current = null
  }, [])

  // Horizontal divider (process tree height)
  const handleMouseDownH = useCallback((e) => {
    e.preventDefault()
    setIsDraggingH(true)
    dragRefH.current = {
      startY: e.clientY,
      startHeight: processTreeHeight,
    }
  }, [processTreeHeight])

  const handleMouseMoveH = useCallback((e) => {
    if (!isDraggingH || !dragRefH.current) return
    const delta = e.clientY - dragRefH.current.startY
    const newHeight = Math.min(400, Math.max(80, dragRefH.current.startHeight + delta))
    setProcessTreeHeight(newHeight)
  }, [isDraggingH])

  const handleMouseUpH = useCallback(() => {
    setIsDraggingH(false)
    dragRefH.current = null
  }, [])

  const isDragging = isDraggingV || isDraggingH

  const handleMouseMove = useCallback((e) => {
    if (isDraggingV) handleMouseMoveV(e)
    if (isDraggingH) handleMouseMoveH(e)
  }, [isDraggingV, isDraggingH, handleMouseMoveV, handleMouseMoveH])

  const handleMouseUp = useCallback(() => {
    handleMouseUpV()
    handleMouseUpH()
  }, [handleMouseUpV, handleMouseUpH])

  const handleSendToWorker = async (text) => {
    if (!selectedWorker) return
    setSending(true)
    try {
      await sendToProcess(selectedWorker, text)
    } catch (err) {
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={styles.container}
      onMouseMove={isDragging ? handleMouseMove : undefined}
      onMouseUp={isDragging ? handleMouseUp : undefined}
      onMouseLeave={isDragging ? handleMouseUp : undefined}
    >
      <header style={styles.header}>
        <h1 style={styles.title}>Orchestrator</h1>
        <button style={styles.spawnButton} onClick={() => setShowSpawnDialog(true)}>
          + Spawn
        </button>
      </header>

      <main style={styles.main}>
        <div style={{ ...styles.content, flex: 1 }}>
          <ChatArea />
        </div>

        <div
          style={{
            ...styles.dividerV,
            ...(isDraggingV ? styles.dividerActive : {}),
          }}
          onMouseDown={handleMouseDownV}
        />

        <aside style={{ ...styles.sidebar, width: sidebarWidth }}>
          <div style={{ ...styles.processTreeWrapper, height: processTreeHeight }}>
            <ProcessTree
              key={refreshKey}
              onRefresh={() => setRefreshKey(k => k + 1)}
              selectedWorker={selectedWorker}
              onSelect={setSelectedWorker}
            />
          </div>

          <div
            style={{
              ...styles.dividerH,
              ...(isDraggingH ? styles.dividerActive : {}),
            }}
            onMouseDown={handleMouseDownH}
          />

          <div style={styles.terminalSection}>
            <div style={styles.sidebarLabel}>
              {selectedWorker === 'partner' ? 'Partner' : selectedWorker}
            </div>
            <Terminal workerName={selectedWorker} />
            <div style={styles.quickActionsWrapper}>
              <QuickActions onSend={handleSendToWorker} disabled={sending} />
            </div>
          </div>

          <div style={styles.inputWrapper}>
            <ChatInput
              onSend={handleSendToWorker}
              disabled={sending}
              placeholder={`Send to ${selectedWorker}...`}
            />
          </div>
        </aside>
      </main>

      {showSpawnDialog && (
        <SpawnDialog
          onClose={() => setShowSpawnDialog(false)}
          onSpawned={handleSpawned}
        />
      )}
    </div>
  )
}
