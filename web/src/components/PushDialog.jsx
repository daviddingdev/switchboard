import { useState, useEffect } from 'react'
import { fetchDocContext, updateDocs, pushProject } from '../api'

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    width: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },
  project: {
    marginBottom: '16px',
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    padding: '12px',
  },
  projectHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  projectName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  commitCount: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-primary)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  commit: {
    display: 'flex',
    gap: '8px',
    padding: '4px 0',
    fontSize: '12px',
  },
  commitHash: {
    fontFamily: 'monospace',
    color: '#93c5fd',
  },
  commitMsg: {
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: '5px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
  },
  btnSecondary: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: 'white',
  },
  btnSuccess: {
    background: 'var(--success)',
    color: 'white',
  },
  status: {
    marginTop: '8px',
    padding: '8px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  statusUpdating: {
    background: '#1e3a5f',
    color: '#93c5fd',
  },
  statusDone: {
    background: '#14532d',
    color: '#86efac',
  },
  statusError: {
    background: '#7f1d1d',
    color: '#fca5a5',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    padding: '40px 20px',
    fontSize: '14px',
  },
  stepIndicator: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginLeft: '8px',
  },
  diffPreview: {
    marginTop: '8px',
    padding: '8px',
    background: 'var(--bg-primary)',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    maxHeight: '100px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    color: 'var(--text-secondary)',
  },
}

export default function PushDialog({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [updateDocs_, setUpdateDocs] = useState({})  // project -> boolean
  const [status, setStatus] = useState({})           // project -> {state, message}
  const [step, setStep] = useState(1)                // 1=select, 2=review, 3=pushing

  useEffect(() => {
    loadContext()
  }, [])

  const loadContext = async () => {
    try {
      const data = await fetchDocContext()
      setProjects(data)
      // Default: update docs for all projects that have CHANGELOG or TODO
      const defaults = {}
      data.forEach(p => {
        defaults[p.project] = p.has_changelog || p.has_todo
      })
      setUpdateDocs(defaults)
    } catch (err) {
      console.error('Failed to load context:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDocs = async () => {
    const toUpdate = projects.filter(p => updateDocs_[p.project])
    if (toUpdate.length === 0) {
      setStep(2)
      return
    }

    setStep(2)

    for (const p of toUpdate) {
      setStatus(prev => ({
        ...prev,
        [p.project]: { state: 'updating', message: 'Updating docs...' }
      }))

      try {
        const result = await updateDocs(p.project)
        if (result.success) {
          setStatus(prev => ({
            ...prev,
            [p.project]: {
              state: 'done',
              message: result.git_status || 'Docs updated',
              output: result.output
            }
          }))
        } else {
          setStatus(prev => ({
            ...prev,
            [p.project]: {
              state: 'error',
              message: result.error || 'Failed to update docs'
            }
          }))
        }
      } catch (err) {
        setStatus(prev => ({
          ...prev,
          [p.project]: { state: 'error', message: err.message }
        }))
      }
    }
  }

  const handlePush = async () => {
    setStep(3)

    for (const p of projects) {
      const needsCommit = status[p.project]?.state === 'done'

      setStatus(prev => ({
        ...prev,
        [p.project]: {
          ...prev[p.project],
          state: 'pushing',
          message: 'Pushing...'
        }
      }))

      try {
        const result = await pushProject(p.project, needsCommit)
        if (result.success) {
          setStatus(prev => ({
            ...prev,
            [p.project]: {
              state: 'pushed',
              message: 'Pushed successfully'
            }
          }))
        } else {
          setStatus(prev => ({
            ...prev,
            [p.project]: {
              state: 'error',
              message: result.error || 'Push failed'
            }
          }))
        }
      } catch (err) {
        setStatus(prev => ({
          ...prev,
          [p.project]: { state: 'error', message: err.message }
        }))
      }
    }
  }

  const allPushed = projects.length > 0 &&
    projects.every(p => status[p.project]?.state === 'pushed')

  const getStatusStyle = (state) => {
    if (state === 'updating' || state === 'pushing') return styles.statusUpdating
    if (state === 'done' || state === 'pushed') return styles.statusDone
    if (state === 'error') return styles.statusError
    return {}
  }

  if (loading) {
    return (
      <div style={styles.overlay}>
        <div style={styles.dialog}>
          <div style={styles.content}>
            <div style={styles.empty}>Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>
            Push Changes
            <span style={styles.stepIndicator}>
              Step {step} of 3
            </span>
          </span>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div style={styles.content}>
          {projects.length === 0 ? (
            <div style={styles.empty}>
              No unpushed commits across any projects.
            </div>
          ) : (
            projects.map(p => (
              <div key={p.project} style={styles.project}>
                <div style={styles.projectHeader}>
                  <span style={styles.projectName}>{p.project}</span>
                  <span style={styles.commitCount}>
                    {p.commits.length} commit{p.commits.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {p.commits.map((c, i) => (
                  <div key={i} style={styles.commit}>
                    <span style={styles.commitHash}>{c.hash}</span>
                    <span style={styles.commitMsg}>{c.message}</span>
                  </div>
                ))}

                {step === 1 && (p.has_changelog || p.has_todo) && (
                  <label style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={updateDocs_[p.project] || false}
                      onChange={e => setUpdateDocs(prev => ({
                        ...prev,
                        [p.project]: e.target.checked
                      }))}
                    />
                    Update CHANGELOG.md / TODO.md / USAGE.md
                  </label>
                )}

                {status[p.project] && (
                  <div style={{
                    ...styles.status,
                    ...getStatusStyle(status[p.project].state)
                  }}>
                    {status[p.project].state === 'updating' && '⏳ '}
                    {status[p.project].state === 'pushing' && '⬆️ '}
                    {status[p.project].state === 'done' && '✓ '}
                    {status[p.project].state === 'pushed' && '✓ '}
                    {status[p.project].state === 'error' && '✗ '}
                    {status[p.project].message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={onClose}
          >
            {allPushed ? 'Done' : 'Cancel'}
          </button>

          {step === 1 && projects.length > 0 && (
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleUpdateDocs}
            >
              {Object.values(updateDocs_).some(v => v)
                ? 'Update Docs & Review'
                : 'Skip to Review'}
            </button>
          )}

          {step === 2 && !allPushed && (
            <button
              style={{ ...styles.btn, ...styles.btnSuccess }}
              onClick={handlePush}
            >
              Push All
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
