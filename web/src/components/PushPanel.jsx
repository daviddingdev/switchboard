import { useState, useEffect } from 'react'
import { fetchDocContext, updateDocs, pushProject, fetchDiff } from '../api'

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
  actions: {
    display: 'flex',
    gap: '8px',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: 'white',
  },
  btnSuccess: {
    background: 'var(--success)',
    color: 'white',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
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
  badgeUpdating: {
    background: '#1e3a5f',
    color: '#93c5fd',
  },
  badgeDone: {
    background: '#14532d',
    color: '#86efac',
  },
  badgePushed: {
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
  commits: {
    marginBottom: '12px',
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
    flexShrink: 0,
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
    fontSize: '12px',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  diffSection: {
    marginTop: '12px',
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  diffHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  diffFile: {
    marginBottom: '12px',
  },
  diffFileName: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '4px',
    fontFamily: 'monospace',
  },
  diffContent: {
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '11px',
    fontFamily: 'monospace',
    maxHeight: '200px',
    overflow: 'auto',
    lineHeight: 1.4,
  },
  diffLine: {
    whiteSpace: 'pre',
  },
  diffAdd: {
    color: '#3fb950',
    background: 'rgba(46, 160, 67, 0.15)',
  },
  diffDel: {
    color: '#f85149',
    background: 'rgba(248, 81, 73, 0.15)',
  },
  diffMeta: {
    color: '#58a6ff',
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

function DiffLines({ diff }) {
  if (!diff) return null

  const lines = diff.split('\n')
  return (
    <div style={styles.diffContent}>
      {lines.map((line, i) => {
        let lineStyle = styles.diffLine
        if (line.startsWith('+') && !line.startsWith('+++')) {
          lineStyle = { ...lineStyle, ...styles.diffAdd }
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          lineStyle = { ...lineStyle, ...styles.diffDel }
        } else if (line.startsWith('@@') || line.startsWith('diff ')) {
          lineStyle = { ...lineStyle, ...styles.diffMeta }
        }
        return <div key={i} style={lineStyle}>{line || ' '}</div>
      })}
    </div>
  )
}

export default function PushPanel() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [updateDocsFor, setUpdateDocsFor] = useState({})
  const [status, setStatus] = useState({})
  const [diffs, setDiffs] = useState({})  // project -> {file: diffContent}

  useEffect(() => {
    loadContext()
  }, [])

  const loadContext = async () => {
    try {
      const data = await fetchDocContext()
      setProjects(data)
      const defaults = {}
      data.forEach(p => {
        defaults[p.project] = p.has_changelog || p.has_todo
      })
      setUpdateDocsFor(defaults)
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadDiffs = async (project, directory) => {
    const docFiles = ['CHANGELOG.md', 'TODO.md', 'USAGE.md']
    const projectDiffs = {}

    for (const file of docFiles) {
      try {
        const result = await fetchDiff(project, file)
        if (result.diff) {
          projectDiffs[file] = result.diff
        }
      } catch {
        // File doesn't exist or no changes
      }
    }

    setDiffs(prev => ({ ...prev, [project]: projectDiffs }))
  }

  const handleUpdateDocs = async () => {
    const toUpdate = projects.filter(p => updateDocsFor[p.project])

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
            [p.project]: { state: 'done', message: 'Docs updated' }
          }))
          // Load diffs to show what changed
          await loadDiffs(p.project, p.directory)
        } else {
          setStatus(prev => ({
            ...prev,
            [p.project]: { state: 'error', message: result.error || 'Failed' }
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

  const handlePushAll = async () => {
    for (const p of projects) {
      setStatus(prev => ({
        ...prev,
        [p.project]: { state: 'pushing', message: 'Pushing...' }
      }))

      try {
        // Always commits any staged doc changes before pushing
        const result = await pushProject(p.project)
        if (result.success) {
          setStatus(prev => ({
            ...prev,
            [p.project]: { state: 'pushed', message: 'Pushed' }
          }))
        } else {
          setStatus(prev => ({
            ...prev,
            [p.project]: { state: 'error', message: result.error || 'Failed' }
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

  const getBadgeStyle = (state) => {
    if (state === 'updating' || state === 'pushing') return styles.badgeUpdating
    if (state === 'done') return styles.badgeDone
    if (state === 'pushed') return styles.badgePushed
    if (state === 'error') return styles.badgeError
    return styles.badgeCount
  }

  const allPushed = projects.length > 0 &&
    projects.every(p => status[p.project]?.state === 'pushed')

  const anyUpdating = projects.some(p =>
    status[p.project]?.state === 'updating' || status[p.project]?.state === 'pushing'
  )

  const hasDocsToUpdate = Object.values(updateDocsFor).some(v => v)
  const docsUpdated = projects.some(p => status[p.project]?.state === 'done')

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
        <div style={styles.empty}>No unpushed commits across any projects.</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Push Changes</span>
        <div style={styles.actions}>
          {!docsUpdated && !allPushed && (
            <button
              style={{
                ...styles.btn,
                ...styles.btnPrimary,
                ...(anyUpdating ? styles.btnDisabled : {})
              }}
              onClick={handleUpdateDocs}
              disabled={anyUpdating}
            >
              {hasDocsToUpdate ? 'Update Docs' : 'Skip Docs'}
            </button>
          )}
          {(docsUpdated || !hasDocsToUpdate) && !allPushed && (
            <button
              style={{
                ...styles.btn,
                ...styles.btnSuccess,
                ...(anyUpdating ? styles.btnDisabled : {})
              }}
              onClick={handlePushAll}
              disabled={anyUpdating}
            >
              Push All
            </button>
          )}
          {allPushed && (
            <span style={{ ...styles.badge, ...styles.badgePushed }}>
              All pushed
            </span>
          )}
        </div>
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
                  {p.commits.length} commit{p.commits.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={styles.projectBody}>
              <div style={styles.commits}>
                {p.commits.map((c, i) => (
                  <div key={i} style={styles.commit}>
                    <span style={styles.commitHash}>{c.hash}</span>
                    <span style={styles.commitMsg}>{c.message}</span>
                  </div>
                ))}
              </div>

              {!status[p.project] && (p.has_changelog || p.has_todo) && (
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={updateDocsFor[p.project] || false}
                    onChange={e => setUpdateDocsFor(prev => ({
                      ...prev,
                      [p.project]: e.target.checked
                    }))}
                  />
                  Update CHANGELOG / TODO / USAGE
                </label>
              )}

              {diffs[p.project] && Object.keys(diffs[p.project]).length > 0 && (
                <div style={styles.diffSection}>
                  <div style={styles.diffHeader}>Doc Changes (review before pushing)</div>
                  {Object.entries(diffs[p.project]).map(([file, diff]) => (
                    <div key={file} style={styles.diffFile}>
                      <div style={styles.diffFileName}>{file}</div>
                      <DiffLines diff={diff} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
