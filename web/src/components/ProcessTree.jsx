import { useState, useEffect } from 'react'
import { fetchProcesses, killProcess } from '../api'

const styles = {
  container: {
    padding: '16px',
    flex: 1,
    overflow: 'auto',
  },
  header: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    marginBottom: '4px',
    borderRadius: '6px',
    background: 'var(--bg-tertiary)',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
  },
  status: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  directory: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  killButton: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    flexShrink: 0,
  },
  loading: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px',
  },
  empty: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px',
  },
}

export default function ProcessTree({ onRefresh }) {
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

  const handleKill = async (name) => {
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
        <div style={styles.header}>Processes</div>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Processes</div>
        <div style={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Processes</div>
      {processes.length === 0 ? (
        <div style={styles.empty}>No processes running</div>
      ) : (
        <ul style={styles.list}>
          {processes.map(proc => (
            <li key={proc.name} style={styles.item}>
              <div style={styles.itemInfo}>
                <div
                  style={{
                    ...styles.status,
                    background: proc.running ? 'var(--success)' : 'var(--text-secondary)',
                  }}
                />
                <div>
                  <div style={styles.name}>{proc.name}</div>
                  <div style={styles.directory}>{proc.directory}</div>
                </div>
              </div>
              {proc.name !== 'partner' && (
                <button
                  style={styles.killButton}
                  onClick={() => handleKill(proc.name)}
                  disabled={killing === proc.name}
                >
                  {killing === proc.name ? '...' : 'Kill'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
