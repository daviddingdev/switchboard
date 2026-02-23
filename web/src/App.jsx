import { useState, useCallback } from 'react'
import FileTree from './components/FileTree'
import Terminal from './components/Terminal'
import TabBar from './components/TabBar'
import FilePreview from './components/FilePreview'
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
  centerPanel: {
    gridRow: 1,
    gridColumn: 2,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
  const [selectedWorker, setSelectedWorker] = useState('partner')
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sending, setSending] = useState(false)

  // Tab state
  const [tabs, setTabs] = useState([
    { id: 'terminal', label: 'Terminal', type: 'terminal' }
  ])
  const [activeTab, setActiveTab] = useState('terminal')

  const handleFileSelect = useCallback((file) => {
    if (file.type === 'dir') return  // Don't open directories

    const tabId = file.path

    // Check if already open
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

  const handleTabClose = useCallback((tabId) => {
    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTab === tabId) {
      setActiveTab('terminal')
    }
  }, [activeTab])

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

  const activeFileTab = tabs.find(t => t.id === activeTab && t.type === 'file')

  return (
    <div style={styles.layout}>
      {/* Left Panel: File Tree */}
      <aside style={styles.filesPanel}>
        <FileTree onFileSelect={handleFileSelect} />
      </aside>

      {/* Center: Tabs + Terminal/Preview */}
      <main style={styles.centerPanel}>
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          onTabClose={handleTabClose}
        />
        <div style={styles.centerContent}>
          {activeTab === 'terminal' ? (
            <div style={styles.terminalWrapper}>
              <Terminal workerName={selectedWorker} fullHeight />
            </div>
          ) : activeFileTab ? (
            <FilePreview filepath={activeFileTab.filepath} />
          ) : null}
        </div>
      </main>

      {/* Right Panel: Workers + Activity */}
      <aside style={styles.rightPanel}>
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
