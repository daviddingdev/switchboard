import { useState, useEffect } from 'react'
import { fetchProcesses, killProcess } from '../api'

const styles = {
  container: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    flex: 1,
    overflow: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    marginBottom: '2px',
    borderRadius: '4px',
    background: 'var(--bg-tertiary)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  itemSelected: {
    background: 'var(--accent)',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
    flex: 1,
    minWidth: 0,
  },
  status: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  killButton: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    flexShrink: 0,
    marginLeft: '8px',
  },
  loading: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '12px',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '12px',
  },
  empty: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '12px',
  },
}

export default function ProcessTree({ onRefresh, selectedWorker, onSelect }) {
  const [processes, setProcesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [killing, setKilling] = useState(null)

  const loadProcesses = async () => {
    try {
      const data = await fetchProcesses()
      setProcesses(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProcesses()
    const interval = setInterval(loadProcesses, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleKill = async (e, name) => {
    e.stopPropagation()
    if (killing) return
    setKilling(name)
    try {
      await killProcess(name)
      await loadProcesses()
      onRefresh?.()
    } catch (err) {
      alert(`Failed to kill ${name}: ${err.message}`)
    } finally {
      setKilling(null)
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Workers</div>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Workers</div>
        <div style={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Workers ({processes.length})</div>
      {processes.length === 0 ? (
        <div style={styles.empty}>No workers running</div>
      ) : (
        <ul style={styles.list}>
          {processes.map(proc => (
            <li
              key={proc.name}
              style={{
                ...styles.item,
                ...(selectedWorker === proc.name ? styles.itemSelected : {}),
              }}
              onClick={() => onSelect?.(proc.name)}
            >
              <div style={styles.itemInfo}>
                <div
                  style={{
                    ...styles.status,
                    background: proc.pid ? 'var(--success)' : 'var(--text-secondary)',
                  }}
                />
                <span style={styles.name}>{proc.name}</span>
              </div>
              {proc.name !== 'partner' && (
                <button
                  style={styles.killButton}
                  onClick={(e) => handleKill(e, proc.name)}
                  disabled={killing === proc.name}
                >
                  {killing === proc.name ? '...' : '×'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
