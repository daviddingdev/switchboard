import { useState, useEffect } from 'react'
import { fetchActivity, updateProposal, deleteProposal, fetchWorkersUsage, resetPartner } from '../api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  section: {
    padding: '8px 12px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  sectionIcon: {
    fontSize: '11px',
  },
  count: {
    background: '#854d0e',
    color: '#fef08a',
    padding: '1px 6px',
    borderRadius: '8px',
    fontSize: '9px',
    fontWeight: 600,
  },
  countPush: {
    background: '#1e3a5f',
    color: '#93c5fd',
    padding: '1px 6px',
    borderRadius: '8px',
    fontSize: '9px',
    fontWeight: 600,
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
  },
  proposal: {
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    padding: '8px 10px',
    marginBottom: '6px',
  },
  proposalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  proposalTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  proposalWorker: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  proposalActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '6px',
  },
  approveBtn: {
    background: 'var(--success)',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 500,
  },
  rejectBtn: {
    background: 'var(--danger)',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 500,
  },
  deleteBtn: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    marginLeft: 'auto',
  },
  changeProject: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
    padding: '4px 6px',
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
  },
  projectIcon: {
    fontSize: '10px',
  },
  changeFile: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 6px',
    marginLeft: '8px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: '3px',
    transition: 'background 0.1s',
  },
  changeFileHover: {
    background: 'var(--bg-tertiary)',
  },
  changeStatus: {
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
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '12px',
  },
  recentTitle: {
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentStatus: {
    fontSize: '10px',
    padding: '1px 6px',
    borderRadius: '8px',
    fontWeight: 500,
  },
  statusApproved: {
    background: '#166534',
    color: '#86efac',
  },
  statusRejected: {
    background: '#991b1b',
    color: '#fca5a5',
  },
  noGit: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    padding: '4px 0',
  },
  commit: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '3px 6px',
    marginLeft: '8px',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
  commitHash: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#93c5fd',
    flexShrink: 0,
  },
  commitMessage: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
  },
  pushBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  usageItem: {
    padding: '4px 6px',
    marginBottom: '6px',
  },
  usageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  usageName: {
    fontWeight: 500,
    color: 'var(--text-primary)',
    flexShrink: 0,
  },
  usageBar: {
    flex: 1,
    height: '6px',
    background: 'var(--bg-tertiary)',
    borderRadius: '3px',
    overflow: 'hidden',
    minWidth: '40px',
  },
  usageFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  usageStats: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    fontFamily: 'ui-monospace, monospace',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  usageActions: {
    display: 'flex',
    gap: '4px',
    marginTop: '4px',
    justifyContent: 'flex-end',
  },
  usageBtn: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '2px 8px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  usageBtnActive: {
    background: 'var(--accent)',
    color: 'white',
    border: '1px solid var(--accent)',
  },
}

function getStatusStyle(status) {
  if (status === 'M' || status === 'MM') return styles.statusM
  if (status === 'A' || status === 'AM') return styles.statusA
  if (status === 'D') return styles.statusD
  if (status === '??' || status === '?') return styles.statusQ
  return styles.statusM // default
}

export default function Activity({ onFileClick, onPushClick, onCommitClick, onHistoryClick }) {
  const [activity, setActivity] = useState({ pending: [], changes: [], recent: [] })
  const [usage, setUsage] = useState({ workers: [] })
  const [updating, setUpdating] = useState(null)
  const [hoveredFile, setHoveredFile] = useState(null)
  const [resetting, setResetting] = useState(false)

  const loadActivity = async () => {
    try {
      const data = await fetchActivity()
      setActivity(data)
    } catch (err) {
      console.error('Failed to load activity:', err)
    }
  }

  const loadUsage = async () => {
    try {
      const data = await fetchWorkersUsage()
      setUsage(data)
    } catch (err) {
      console.error('Failed to load usage:', err)
    }
  }

  useEffect(() => {
    loadActivity()
    loadUsage()
    const activityInterval = setInterval(loadActivity, 2000)
    const usageInterval = setInterval(loadUsage, 5000) // Less frequent for usage
    return () => {
      clearInterval(activityInterval)
      clearInterval(usageInterval)
    }
  }, [])

  const handleReset = async () => {
    if (!confirm('Reset partner session? This will interrupt any running operation.')) {
      return
    }
    setResetting(true)
    try {
      await resetPartner()
    } catch (err) {
      alert(`Failed to reset: ${err.message}`)
    } finally {
      setTimeout(() => setResetting(false), 2000)
    }
  }

  const getUsageColor = (pct) => {
    if (pct >= 80) return '#ef4444' // red
    if (pct >= 60) return '#f59e0b' // yellow/amber
    return '#22c55e' // green
  }

  const formatTokens = (tokens) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
    return String(tokens)
  }

  const handleApprove = async (id) => {
    setUpdating(id)
    try {
      await updateProposal(id, 'approved')
      await loadActivity()
    } catch (err) {
      alert(`Failed to approve: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  const handleReject = async (id) => {
    setUpdating(id)
    try {
      await updateProposal(id, 'rejected')
      await loadActivity()
    } catch (err) {
      alert(`Failed to reject: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteProposal(id)
      await loadActivity()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const pendingCount = activity.pending?.length || 0

  return (
    <div style={styles.container}>
      <div style={styles.scrollArea}>
        {/* Context Usage */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>📊</span>
            <span>Context</span>
          </div>
          {usage.workers?.length === 0 ? (
            <div style={styles.empty}>No active workers</div>
          ) : (
            usage.workers?.map(w => (
              <div key={w.name} style={styles.usageItem}>
                <div style={styles.usageRow}>
                  <span style={styles.usageName}>{w.name}</span>
                  <div style={styles.usageBar}>
                    <div
                      style={{
                        ...styles.usageFill,
                        width: `${Math.min(100, w.pct)}%`,
                        background: getUsageColor(w.pct),
                      }}
                    />
                  </div>
                  <span style={{
                    ...styles.usageStats,
                    color: w.pct >= 80 ? '#ef4444' : w.pct >= 70 ? '#f59e0b' : 'var(--text-secondary)',
                    fontWeight: w.pct >= 70 ? 600 : 400,
                  }}>
                    {w.pct >= 80 ? '⚠️' : ''}{formatTokens(w.context)}/{w.pct}%
                  </span>
                </div>
                {w.name === 'partner' && (
                  <div style={styles.usageActions}>
                    <button
                      style={styles.usageBtn}
                      onClick={onHistoryClick}
                      title="View conversation history"
                    >
                      History
                    </button>
                    <button
                      style={{
                        ...styles.usageBtn,
                        ...(resetting ? styles.usageBtnActive : {}),
                      }}
                      onClick={handleReset}
                      disabled={resetting}
                      title="Reset partner session"
                    >
                      {resetting ? '...' : 'Reset'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pending Proposals */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>⏳</span>
            <span>Pending</span>
            {pendingCount > 0 && (
              <span style={styles.count}>{pendingCount}</span>
            )}
          </div>
          {pendingCount === 0 ? (
            <div style={styles.empty}>No pending proposals</div>
          ) : (
            activity.pending.map(p => (
              <div key={p.id} style={styles.proposal}>
                <div style={styles.proposalHeader}>
                  <span style={styles.proposalTitle}>{p.title}</span>
                </div>
                <div style={styles.proposalWorker}>{p.worker}</div>
                <div style={styles.proposalActions}>
                  <button
                    style={styles.approveBtn}
                    onClick={() => handleApprove(p.id)}
                    disabled={updating === p.id}
                  >
                    {updating === p.id ? '...' : 'Approve'}
                  </button>
                  <button
                    style={styles.rejectBtn}
                    onClick={() => handleReject(p.id)}
                    disabled={updating === p.id}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Git Changes */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>📝</span>
            <span>Changes</span>
            {activity.changes?.length > 0 && (
              <button style={styles.pushBtn} onClick={onCommitClick}>
                Commit
              </button>
            )}
          </div>
          {activity.changes?.length === 0 ? (
            <div style={styles.empty}>No uncommitted changes</div>
          ) : (
            activity.changes?.map(project => (
              <div key={project.project} style={{ marginBottom: '10px' }}>
                <div style={styles.changeProject}>
                  <span style={styles.projectIcon}>📁</span>
                  <span>{project.project}</span>
                </div>
                {project.files.map((file, i) => {
                  const fileKey = `${project.project}:${file.path}`
                  const isHovered = hoveredFile === fileKey
                  return (
                    <div
                      key={i}
                      style={{
                        ...styles.changeFile,
                        ...(isHovered ? styles.changeFileHover : {}),
                      }}
                      onMouseEnter={() => setHoveredFile(fileKey)}
                      onMouseLeave={() => setHoveredFile(null)}
                      onClick={() => onFileClick?.(project, file)}
                    >
                      <span style={{ ...styles.changeStatus, ...getStatusStyle(file.status) }}>
                        {file.status}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.path}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Unpushed Commits */}
        {activity.unpushed?.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>⬆</span>
              <span>Unpushed</span>
              <span style={styles.countPush}>
                {activity.unpushed.reduce((sum, p) => sum + p.commits.length, 0)}
              </span>
              <button style={styles.pushBtn} onClick={onPushClick}>
                Push
              </button>
            </div>
            {activity.unpushed.map(project => (
              <div key={project.project} style={{ marginBottom: '10px' }}>
                <div style={styles.changeProject}>
                  <span style={styles.projectIcon}>📁</span>
                  <span>{project.project}</span>
                </div>
                {project.commits.map((commit, i) => (
                  <div key={i} style={styles.commit}>
                    <span style={styles.commitHash}>{commit.hash}</span>
                    <span style={styles.commitMessage}>{commit.message}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Recent Proposals */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>✓</span>
            <span>Recent</span>
          </div>
          {activity.recent?.length === 0 ? (
            <div style={styles.empty}>No recent activity</div>
          ) : (
            activity.recent?.map(p => (
              <div key={p.id} style={styles.recentItem}>
                <span style={styles.recentTitle}>{p.title}</span>
                <span
                  style={{
                    ...styles.recentStatus,
                    ...(p.status === 'approved' ? styles.statusApproved : styles.statusRejected),
                  }}
                >
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
