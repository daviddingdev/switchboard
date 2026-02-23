import { useState, useEffect } from 'react'
import { fetchProcesses, killProcess } from '../api'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
    padding: '0 8px 8px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    marginBottom: '2px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background 0.1s',
  },
  itemSelected: {
    background: 'var(--accent)',
  },
  itemDefault: {
    background: 'var(--bg-tertiary)',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
    flex: 1,
  },
  status: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  killButton: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    marginLeft: '6px',
  },
  empty: {
    padding: '12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
}

export default function WorkerList({ selectedWorker, onSelect, onRefresh }) {
  const [workers, setWorkers] = useState([])
  const [killing, setKilling] = useState(null)

  const loadWorkers = async () => {
    try {
      const data = await fetchProcesses()
      setWorkers(data)
    } catch (err) {
      console.error('Failed to load workers:', err)
    }
  }

  useEffect(() => {
    loadWorkers()
    const interval = setInterval(loadWorkers, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleKill = async (e, name) => {
    e.stopPropagation()
    if (killing) return

    setKilling(name)
    try {
      await killProcess(name)
      await loadWorkers()
      onRefresh?.()
    } catch (err) {
      alert(`Failed to kill ${name}: ${err.message}`)
    } finally {
      setKilling(null)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>Workers</span>
        <span style={styles.count}>{workers.length}</span>
      </div>

      {workers.length === 0 ? (
        <div style={styles.empty}>No workers</div>
      ) : (
        <ul style={styles.list}>
          {workers.map(worker => (
            <li
              key={worker.name}
              style={{
                ...styles.item,
                ...(selectedWorker === worker.name ? styles.itemSelected : styles.itemDefault),
              }}
              onClick={() => onSelect?.(worker.name)}
            >
              <div style={styles.itemInfo}>
                <div
                  style={{
                    ...styles.status,
                    background: worker.pid ? 'var(--success)' : 'var(--text-secondary)',
                  }}
                />
                <span style={styles.name}>{worker.name}</span>
              </div>
              {worker.name !== 'partner' && (
                <button
                  style={styles.killButton}
                  onClick={(e) => handleKill(e, worker.name)}
                  disabled={killing === worker.name}
                >
                  {killing === worker.name ? '...' : '×'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
