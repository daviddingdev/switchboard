import { useState } from 'react'
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
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
  },
  spawnButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
  },
  sidebar: {
    width: '360px',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: '0 12px 12px',
  },
  sidebarLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
}

export default function App() {
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedWorker, setSelectedWorker] = useState('partner')

  const handleSpawned = () => {
    setShowSpawnDialog(false)
    setRefreshKey(k => k + 1)
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Orchestrator</h1>
        <button style={styles.spawnButton} onClick={() => setShowSpawnDialog(true)}>
          + Spawn
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.content}>
          <ChatArea />
        </div>

        <aside style={styles.sidebar}>
          <ProcessTree
            key={refreshKey}
            onRefresh={() => setRefreshKey(k => k + 1)}
            selectedWorker={selectedWorker}
            onSelect={setSelectedWorker}
          />
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarLabel}>
              {selectedWorker === 'partner' ? 'Partner Output' : selectedWorker}
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
