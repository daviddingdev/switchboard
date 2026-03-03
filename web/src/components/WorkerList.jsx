import { useState, useEffect } from 'react'
import { fetchProcesses, killProcess, sendToProcess, fetchWorkersUsage } from '../api'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid var(--border)',
  },
  count: {
    background: 'var(--bg-tertiary)',
    padding: '1px 6px',
    borderRadius: '8px',
    fontSize: '9px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '8px',
    flex: 1,
    overflow: 'auto',
  },
  card: {
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background 0.1s, border-color 0.1s',
    border: '1px solid transparent',
  },
  cardSelected: {
    background: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'var(--accent)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  status: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  project: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  contextBar: {
    flex: 1,
    height: '6px',
    background: 'var(--bg-primary)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  contextFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  contextPct: {
    fontSize: '11px',
    fontFamily: 'ui-monospace, monospace',
    color: 'var(--text-secondary)',
    minWidth: '32px',
    textAlign: 'right',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s',
  },
  actionBtnDanger: {
    color: '#ef4444',
    borderColor: '#ef4444',
  },
  empty: {
    padding: '24px 12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
}

function getUsageColor(pct) {
  if (pct >= 80) return '#ef4444'
  if (pct >= 60) return '#f59e0b'
  return '#22c55e'
}

export default function WorkerList({ selectedWorker, onSelect, onRefresh }) {
  const [workers, setWorkers] = useState([])
  const [usage, setUsage] = useState({})
  const [acting, setActing] = useState(null)

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
    loadWorkers()
    loadUsage()
    const workerInterval = setInterval(loadWorkers, 2000)
    const usageInterval = setInterval(loadUsage, 5000)
    return () => {
      clearInterval(workerInterval)
      clearInterval(usageInterval)
    }
  }, [])

  const handleAction = async (e, name, action) => {
    e.stopPropagation()
    if (acting) return

    setActing(`${name}:${action}`)
    try {
      switch (action) {
        case 'rc':
          await sendToProcess(name, '/rc')
          break
        case 'compact':
          await sendToProcess(name, '/compact')
          break
        case 'kill':
          await killProcess(name)
          await loadWorkers()
          onRefresh?.()
          break
      }
    } catch (err) {
      alert(`Failed to ${action} ${name}: ${err.message}`)
    } finally {
      setActing(null)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>Workers</span>
        <span style={styles.count}>{workers.length}</span>
      </div>

      {workers.length === 0 ? (
        <div style={styles.empty}>No workers running</div>
      ) : (
        <ul style={styles.list}>
          {workers.map(worker => {
            const u = usage[worker.name]
            const pct = u?.pct || 0
            const isSelected = selectedWorker === worker.name

            return (
              <li
                key={worker.name}
                style={{
                  ...styles.card,
                  ...(isSelected ? styles.cardSelected : {}),
                }}
                onClick={() => onSelect?.(worker.name)}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.nameRow}>
                    <div
                      style={{
                        ...styles.status,
                        background: worker.pid ? 'var(--success)' : 'var(--text-secondary)',
                      }}
                    />
                    <span style={styles.name}>{worker.name}</span>
                  </div>
                </div>

                {worker.directory && (
                  <div style={styles.project}>{worker.directory}</div>
                )}

                <div style={styles.contextRow}>
                  <div style={styles.contextBar}>
                    <div
                      style={{
                        ...styles.contextFill,
                        width: `${Math.min(100, pct)}%`,
                        background: getUsageColor(pct),
                      }}
                    />
                  </div>
                  <span style={{
                    ...styles.contextPct,
                    color: pct >= 80 ? '#ef4444' : pct >= 60 ? '#f59e0b' : 'var(--text-secondary)',
                    fontWeight: pct >= 60 ? 600 : 400,
                  }}>
                    {pct}%
                  </span>
                </div>

                <div style={styles.actions}>
                  <button
                    style={styles.actionBtn}
                    onClick={(e) => handleAction(e, worker.name, 'rc')}
                    disabled={acting === `${worker.name}:rc`}
                    title="Enable remote control"
                  >
                    {acting === `${worker.name}:rc` ? '...' : 'RC'}
                  </button>
                  <button
                    style={styles.actionBtn}
                    onClick={(e) => handleAction(e, worker.name, 'compact')}
                    disabled={acting === `${worker.name}:compact`}
                    title="Compact context"
                  >
                    {acting === `${worker.name}:compact` ? '...' : 'Compact'}
                  </button>
                  <button
                    style={{ ...styles.actionBtn, ...styles.actionBtnDanger }}
                    onClick={(e) => handleAction(e, worker.name, 'kill')}
                    disabled={acting === `${worker.name}:kill`}
                    title="Kill worker"
                  >
                    {acting === `${worker.name}:kill` ? '...' : 'Kill'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
