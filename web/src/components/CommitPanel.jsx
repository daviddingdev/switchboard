import { useState, useEffect } from 'react'
import { fetchActivity, commitProject } from '../api'

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  project: {
    marginBottom: '20px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  projectHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  projectName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  badge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 500,
  },
  badgeCount: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
  },
  badgeCommitting: {
    background: '#1e3a5f',
    color: '#93c5fd',
  },
  badgeDone: {
    background: '#166534',
    color: '#86efac',
  },
  badgeError: {
    background: '#7f1d1d',
    color: '#fca5a5',
  },
  projectBody: {
    padding: '12px 14px',
  },
  files: {
    marginBottom: '12px',
  },
  file: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    fontSize: '12px',
  },
  fileStatus: {
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '1px 4px',
    borderRadius: '2px',
    fontWeight: 600,
  },
  statusM: {
    background: '#854d0e',
    color: '#fef08a',
  },
  statusA: {
    background: '#166534',
    color: '#86efac',
  },
  statusD: {
    background: '#991b1b',
    color: '#fca5a5',
  },
  statusQ: {
    background: '#1e3a5f',
    color: '#93c5fd',
  },
  filePath: {
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  messageSection: {
    marginTop: '12px',
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  messageLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  messageInput: {
    width: '100%',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
  },
  commitBtn: {
    marginTop: '10px',
    padding: '8px 16px',
    background: 'var(--success)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    padding: '40px 20px',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    padding: '40px 20px',
  },
}

function getStatusStyle(status) {
  if (status === 'M' || status === 'MM') return styles.statusM
  if (status === 'A' || status === 'AM') return styles.statusA
  if (status === 'D') return styles.statusD
  if (status === '??' || status === '?') return styles.statusQ
  return styles.statusM
}

export default function CommitPanel() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [messages, setMessages] = useState({})
  const [status, setStatus] = useState({})

  useEffect(() => {
    loadChanges()
  }, [])

  const loadChanges = async () => {
    try {
      const data = await fetchActivity()
      setProjects(data.changes || [])
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async (projectName) => {
    const message = messages[projectName]?.trim()
    if (!message) {
      alert('Please enter a commit message')
      return
    }

    setStatus(prev => ({
      ...prev,
      [projectName]: { state: 'committing', message: 'Committing...' }
    }))

    try {
      const result = await commitProject(projectName, message)
      if (result.success) {
        setStatus(prev => ({
          ...prev,
          [projectName]: { state: 'done', message: 'Committed' }
        }))
        // Remove from list after short delay
        setTimeout(() => {
          setProjects(prev => prev.filter(p => p.project !== projectName))
          setStatus(prev => {
            const next = { ...prev }
            delete next[projectName]
            return next
          })
        }, 1500)
      } else {
        setStatus(prev => ({
          ...prev,
          [projectName]: { state: 'error', message: result.error || 'Failed' }
        }))
      }
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        [projectName]: { state: 'error', message: err.message }
      }))
    }
  }

  const getBadgeStyle = (state) => {
    if (state === 'committing') return styles.badgeCommitting
    if (state === 'done') return styles.badgeDone
    if (state === 'error') return styles.badgeError
    return styles.badgeCount
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>No uncommitted changes across any projects.</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Commit Changes</span>
      </div>

      <div style={styles.content}>
        {projects.map(p => (
          <div key={p.project} style={styles.project}>
            <div style={styles.projectHeader}>
              <span style={styles.projectName}>{p.project}</span>
              {status[p.project] ? (
                <span style={{ ...styles.badge, ...getBadgeStyle(status[p.project].state) }}>
                  {status[p.project].message}
                </span>
              ) : (
                <span style={{ ...styles.badge, ...styles.badgeCount }}>
                  {p.files.length} file{p.files.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={styles.projectBody}>
              <div style={styles.files}>
                {p.files.map((file, i) => (
                  <div key={i} style={styles.file}>
                    <span style={{ ...styles.fileStatus, ...getStatusStyle(file.status) }}>
                      {file.status}
                    </span>
                    <span style={styles.filePath}>{file.path}</span>
                  </div>
                ))}
              </div>

              {!status[p.project]?.state && (
                <div style={styles.messageSection}>
                  <div style={styles.messageLabel}>Commit message</div>
                  <textarea
                    style={styles.messageInput}
                    placeholder="Describe your changes..."
                    value={messages[p.project] || ''}
                    onChange={e => setMessages(prev => ({
                      ...prev,
                      [p.project]: e.target.value
                    }))}
                  />
                  <button
                    style={{
                      ...styles.commitBtn,
                      ...(!messages[p.project]?.trim() ? styles.btnDisabled : {})
                    }}
                    onClick={() => handleCommit(p.project)}
                    disabled={!messages[p.project]?.trim()}
                  >
                    Commit All Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
