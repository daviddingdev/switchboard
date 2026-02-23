import { useState, useCallback } from 'react'
import FileTree from './components/FileTree'
import Terminal from './components/Terminal'
import WorkerList from './components/WorkerList'
import Activity from './components/Activity'
import SpawnDialog from './components/SpawnDialog'
import QuickActions from './components/QuickActions'
import ChatInput from './components/ChatInput'
import { sendToProcess } from './api'

const styles = {
  layout: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr 280px',
    gridTemplateRows: '1fr auto',
    height: '100vh',
    background: 'var(--bg-primary)',
  },
  filesPanel: {
    gridRow: 1,
    gridColumn: 1,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  terminalPanel: {
    gridRow: 1,
    gridColumn: 2,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  terminalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  terminalTitle: {
    fontSize: '13px',
    fontWeight: 600,
  },
  spawnButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 500,
  },
  terminalContent: {
    flex: 1,
    padding: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    gridRow: 1,
    gridColumn: 3,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  inputBar: {
    gridRow: 2,
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  quickActionsWrapper: {
    flexShrink: 0,
  },
  inputWrapper: {
    flex: 1,
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  sendButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
  },
}

export default function App() {
  const [selectedWorker, setSelectedWorker] = useState('partner')
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sending, setSending] = useState(false)

  const handleFileSelect = useCallback((path) => {
    // For now, just log the selected file
    // Future: open in editor or preview
    console.log('Selected file:', path)
  }, [])

  const handleSpawned = () => {
    setShowSpawnDialog(false)
    setRefreshKey(k => k + 1)
  }

  const handleSend = async (text) => {
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
    <div style={styles.layout}>
      {/* Left Panel: File Tree */}
      <aside style={styles.filesPanel}>
        <FileTree onFileSelect={handleFileSelect} />
      </aside>

      {/* Center: Terminal */}
      <main style={styles.terminalPanel}>
        <div style={styles.terminalHeader}>
          <span style={styles.terminalTitle}>
            {selectedWorker === 'partner' ? 'Partner' : selectedWorker}
          </span>
          <button
            style={styles.spawnButton}
            onClick={() => setShowSpawnDialog(true)}
          >
            + Spawn
          </button>
        </div>
        <div style={styles.terminalContent}>
          <Terminal workerName={selectedWorker} fullHeight />
        </div>
      </main>

      {/* Right Panel: Workers + Activity */}
      <aside style={styles.rightPanel}>
        <WorkerList
          key={refreshKey}
          selectedWorker={selectedWorker}
          onSelect={setSelectedWorker}
          onRefresh={() => setRefreshKey(k => k + 1)}
        />
        <Activity />
      </aside>

      {/* Bottom: Input Bar */}
      <footer style={styles.inputBar}>
        <div style={styles.quickActionsWrapper}>
          <QuickActions onSend={handleSend} disabled={sending} />
        </div>
        <div style={styles.inputWrapper}>
          <ChatInput
            onSend={handleSend}
            disabled={sending}
            placeholder={`Send to ${selectedWorker}...`}
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
