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
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
  },
  spawnButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
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
  },
  sidebar: {
    width: '320px',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarTerminal: {
    flex: 1,
    padding: '0 16px 16px',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
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
          <div style={styles.sidebarTerminal}>
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
