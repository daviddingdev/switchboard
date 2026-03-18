import { useState, useEffect, useReducer } from 'react'
import { fetchProcesses, killProcess, sendToProcess, fetchWorkersUsage, fetchModels } from '../api'
import socket from '../socket'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'

const styles = {
  container: {
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
  },
  containerMobile: {
    padding: '16px',
    background: 'var(--bg-secondary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  titleMobile: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  spawnBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  spawnBtnMobile: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  headerBtnMobile: {
    background: 'var(--bg-tertiary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  grid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  gridMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px 14px',
    minWidth: '180px',
    maxWidth: '280px',
    flex: '1 1 180px',
  },
  cardMobile: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusDotMobile: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameMobile: {
    fontSize: '17px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  directory: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginBottom: '10px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  directoryMobile: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
  },
  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  contextRowMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
  },
  contextBar: {
    flex: 1,
    height: '8px',
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  contextBarMobile: {
    flex: 1,
    height: '10px',
    background: 'var(--bg-tertiary)',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  contextFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  contextPct: {
    fontSize: '12px',
    fontFamily: 'ui-monospace, monospace',
    fontWeight: 600,
    minWidth: '36px',
    textAlign: 'right',
  },
  contextPctMobile: {
    fontSize: '14px',
    fontFamily: 'ui-monospace, monospace',
    fontWeight: 600,
    minWidth: '40px',
    textAlign: 'right',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  actionsMobile: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: '1 1 auto',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '5px 6px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.1s',
    whiteSpace: 'nowrap',
  },
  actionBtnMobile: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px 10px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '44px',
  },
  actionBtnDanger: {
    color: 'var(--danger)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  // Empty state
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: '16px',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  emptySpawnBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptySpawnBtnMobile: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '18px 40px',
    fontSize: '18px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    maxWidth: '300px',
  },
}

function getUsageColor(pct) {
  if (pct >= 80) return 'var(--danger)'
  if (pct >= 60) return '#f59e0b'
  return 'var(--success)'
}

function formatUptime(spawnTime) {
  if (!spawnTime) return null
  const secs = Math.floor(Date.now() / 1000 - spawnTime)
  if (secs < 60) return '<1m'
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}

export default function WorkerDashboard({ isMobile, onSpawn, onRefresh, onMonitor, onUsage, onTerminal, onLogs, onThemeToggle, theme, onLogout, notifPermission, onRequestNotifPermission }) {
  const [workers, setWorkers] = useState([])
  const [usage, setUsage] = useState({})
  const [modelLabels, setModelLabels] = useState({})
  const [acting, setActing] = useState(null)
  const [confirming, setConfirming] = useState(null) // { name, action } awaiting confirmation
  const [loading, setLoading] = useState(true)
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  const { addToast } = useToast()

  // Re-render every 60s for uptime display
  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadWorkers = async () => {
    try {
      const data = await fetchProcesses()
      setWorkers(data)
    } catch (err) {
      console.error('Failed to load workers:', err)
    }
  }

  const loadUsage = async () => {
    try {
      const data = await fetchWorkersUsage()
      const map = {}
      for (const w of data.workers || []) {
        map[w.name] = w
      }
      setUsage(map)
    } catch (err) {
      console.error('Failed to load usage:', err)
    }
  }

  useEffect(() => {
    loadWorkers().finally(() => setLoading(false))
    loadUsage()
    fetchModels()
      .then(data => {
        const map = {}
        for (const m of data.models || []) map[m.id] = m.label
        setModelLabels(map)
      })
      .catch(() => {})

    const onWorkersUpdate = (data) => {
      setWorkers(data)
      setLoading(false)
    }
    const onUsageUpdate = (data) => {
      const map = {}
      for (const w of data.workers || []) map[w.name] = w
      setUsage(map)
    }
    const onConnect = () => { loadWorkers(); loadUsage() }

    socket.on('workers:update', onWorkersUpdate)
    socket.on('usage:update', onUsageUpdate)
    socket.on('connect', onConnect)

    return () => {
      socket.off('workers:update', onWorkersUpdate)
      socket.off('usage:update', onUsageUpdate)
      socket.off('connect', onConnect)
    }
  }, [])

  const handleAction = (name, action) => {
    setConfirming({ name, action })
  }

  const executeAction = async () => {
    if (!confirming || acting) return
    const { name, action } = confirming
    const key = `${name}:${action}`
    setConfirming(null)
    setActing(key)
    try {
      switch (action) {
        case 'rc':
          await sendToProcess(name, '/rc')
          addToast(`Sent rc to '${name}'`, 'success')
          break
        case 'compact':
          await sendToProcess(name, '/compact')
          addToast(`Sent compact to '${name}'`, 'success')
          break
        case 'interrupt':
          await sendToProcess(name, '\x03', true)
          addToast(`Sent Ctrl+C to '${name}'`, 'success')
          break
        case 'kill':
          await killProcess(name)
          await loadWorkers()
          onRefresh?.()
          addToast(`Worker '${name}' killed`, 'success')
          break
      }
    } catch (err) {
      addToast(`Failed to ${action} ${name}: ${err.message}`, 'error')
    } finally {
      setActing(null)
    }
  }

  const m = isMobile // shorthand

  return (
    <div style={m ? styles.containerMobile : styles.container}>
      <div style={styles.header}>
        <span style={m ? styles.titleMobile : styles.title}>Workers</span>
        <div style={{ display: 'flex', gap: m ? '6px' : '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!m && onUsage && (
            <button
              style={{ ...styles.spawnBtn, background: 'var(--bg-tertiary)' }}
              onClick={onUsage}
            >
              📈 Usage
            </button>
          )}
          {!m && onMonitor && (
            <button
              style={{ ...styles.spawnBtn, background: 'var(--bg-tertiary)' }}
              onClick={onMonitor}
            >
              📊 Monitor
            </button>
          )}
          {onRequestNotifPermission && (
            <button
              style={m ? styles.headerBtnMobile : { ...styles.spawnBtn, background: 'var(--bg-tertiary)' }}
              onClick={notifPermission === 'granted' ? undefined : onRequestNotifPermission}
              title={notifPermission === 'granted' ? 'Notifications enabled' : notifPermission === 'denied' ? 'Notifications blocked — enable in browser settings' : 'Enable notifications'}
            >
              {notifPermission === 'granted' ? 'Notifs On' : notifPermission === 'denied' ? 'Notifs Off' : 'Notifs'}
            </button>
          )}
          {onLogout && (
            <button
              style={m ? styles.headerBtnMobile : { ...styles.spawnBtn, background: 'var(--bg-tertiary)' }}
              onClick={onLogout}
            >
              Logout
            </button>
          )}
          <button
            style={m ? styles.headerBtnMobile : { ...styles.spawnBtn, background: 'var(--bg-tertiary)' }}
            onClick={onThemeToggle}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {workers.length > 0 && (
            <button style={m ? styles.spawnBtnMobile : styles.spawnBtn} onClick={onSpawn}>
              + Spawn
            </button>
          )}
        </div>
      </div>

      {loading && workers.length === 0 ? (
        <div style={m ? styles.gridMobile : styles.grid}>
          {[0, 1].map(i => (
            <div key={i} style={m ? styles.cardMobile : styles.card}>
              <div style={{ width: '60%', height: 14, background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '80%', height: 10, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : !loading && workers.length === 0 ? (
        <div style={styles.emptyContainer}>
          <span style={styles.emptyText}>No workers running</span>
          <button
            style={m ? styles.emptySpawnBtnMobile : styles.emptySpawnBtn}
            onClick={onSpawn}
          >
            + Start a Session
          </button>
        </div>
      ) : (
        <div style={m ? styles.gridMobile : styles.grid}>
          {workers.map(worker => {
            const u = usage[worker.name]
            const pct = u?.pct || 0
            const color = getUsageColor(pct)

            return (
              <div key={worker.name} style={m ? styles.cardMobile : styles.card}>
                <div style={styles.cardHeader}>
                  <div
                    style={{
                      ...(m ? styles.statusDotMobile : styles.statusDot),
                      background: worker.pid ? 'var(--success)' : 'var(--text-secondary)',
                    }}
                  />
                  <span style={m ? styles.nameMobile : styles.name}>
                    {worker.name}
                    {worker.model && (
                      <span style={{
                        fontSize: m ? '11px' : '10px',
                        color: 'var(--text-secondary)',
                        fontWeight: 400,
                        marginLeft: '6px',
                      }}>
                        ({modelLabels[worker.model] || worker.model})
                      </span>
                    )}
                  </span>
                </div>

                {worker.directory && (
                  <div style={m ? styles.directoryMobile : styles.directory}>
                    {worker.directory}
                  </div>
                )}

                {worker.spawn_time && (
                  <div style={{ fontSize: m ? '11px' : '10px', color: 'var(--text-secondary)', marginBottom: m ? '8px' : '6px' }}>
                    up {formatUptime(worker.spawn_time)}
                  </div>
                )}

                <div style={m ? styles.contextRowMobile : styles.contextRow}>
                  <div style={m ? styles.contextBarMobile : styles.contextBar}>
                    <div
                      style={{
                        ...styles.contextFill,
                        width: `${Math.min(100, pct)}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <span style={{ ...(m ? styles.contextPctMobile : styles.contextPct), color }}>
                    {pct}%
                  </span>
                </div>

                <div style={m ? styles.actionsMobile : styles.actions}>
                  {onTerminal && (
                    <button
                      style={m ? styles.actionBtnMobile : styles.actionBtn}
                      onClick={() => onTerminal(worker.name)}
                    >
                      Term
                    </button>
                  )}
                  {onLogs && (
                    <button
                      style={m ? styles.actionBtnMobile : styles.actionBtn}
                      onClick={() => onLogs(worker.name)}
                    >
                      Logs
                    </button>
                  )}
                  {['rc', 'compact', 'interrupt', 'kill'].map(action => {
                    const key = `${worker.name}:${action}`
                    const isActing = acting === key
                    const isDanger = action === 'kill'
                    const label = { rc: 'Remote', compact: 'Compact', interrupt: 'Interrupt', kill: 'Kill' }[action]

                    return (
                      <button
                        key={action}
                        style={{
                          ...(m ? styles.actionBtnMobile : styles.actionBtn),
                          ...(isDanger ? styles.actionBtnDanger : {}),
                        }}
                        onClick={() => handleAction(worker.name, action)}
                        disabled={isActing}
                      >
                        {isActing ? '...' : label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={{ rc: 'Enable Remote Control', compact: 'Compact Context', interrupt: 'Interrupt Worker', kill: 'Kill Worker' }[confirming.action]}
          description={{ rc: `Send /rc to ${confirming.name}?`, compact: `Compact ${confirming.name}'s context?`, interrupt: `Send Ctrl+C to ${confirming.name}? This cancels the current operation.`, kill: `Kill ${confirming.name}? This cannot be undone.` }[confirming.action]}
          confirmLabel="Yes"
          danger={confirming.action === 'kill'}
          onConfirm={executeAction}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
