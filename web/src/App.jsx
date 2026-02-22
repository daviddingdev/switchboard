import { useState, useRef, useCallback } from 'react'
import ProcessTree from './components/ProcessTree'
import SpawnDialog from './components/SpawnDialog'
import ChatArea from './components/ChatArea'
import Terminal from './components/Terminal'

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
  divider: {
    width: '4px',
    background: 'var(--border)',
    cursor: 'col-resize',
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
    flex: 1,
    minHeight: 0,
    padding: '0 10px 10px',
  },
  sidebarLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
}

export default function App() {
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedWorker, setSelectedWorker] = useState('partner')
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  const handleSpawned = () => {
    setShowSpawnDialog(false)
    setRefreshKey(k => k + 1)
  }

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    }
  }, [sidebarWidth])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragRef.current) return
    const delta = dragRef.current.startX - e.clientX
    const newWidth = Math.min(600, Math.max(200, dragRef.current.startWidth + delta))
    setSidebarWidth(newWidth)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragRef.current = null
  }, [])

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
            ...styles.divider,
            ...(isDragging ? styles.dividerActive : {}),
          }}
          onMouseDown={handleMouseDown}
        />

        <aside style={{ ...styles.sidebar, width: sidebarWidth }}>
          <ProcessTree
            key={refreshKey}
            onRefresh={() => setRefreshKey(k => k + 1)}
            selectedWorker={selectedWorker}
            onSelect={setSelectedWorker}
          />
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarLabel}>
              {selectedWorker === 'partner' ? 'Partner' : selectedWorker}
            </div>
            <Terminal workerName={selectedWorker} />
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
