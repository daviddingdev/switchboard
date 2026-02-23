import { useState, useEffect } from 'react'
import { fetchActivity, updateProposal, deleteProposal } from '../api'

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
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
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
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '2px',
  },
  changeFile: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 0',
    fontSize: '12px',
    color: 'var(--text-primary)',
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
}

function getStatusStyle(status) {
  if (status === 'M' || status === 'MM') return styles.statusM
  if (status === 'A' || status === 'AM') return styles.statusA
  if (status === 'D') return styles.statusD
  if (status === '??' || status === '?') return styles.statusQ
  return styles.statusM // default
}

export default function Activity() {
  const [activity, setActivity] = useState({ pending: [], changes: [], recent: [] })
  const [updating, setUpdating] = useState(null)

  const loadActivity = async () => {
    try {
      const data = await fetchActivity()
      setActivity(data)
    } catch (err) {
      console.error('Failed to load activity:', err)
    }
  }

  useEffect(() => {
    loadActivity()
    const interval = setInterval(loadActivity, 2000)
    return () => clearInterval(interval)
  }, [])

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
          </div>
          {activity.changes?.length === 0 ? (
            <div style={styles.empty}>No uncommitted changes</div>
          ) : (
            activity.changes?.map(project => (
              <div key={project.project} style={{ marginBottom: '8px' }}>
                <div style={styles.changeProject}>{project.project}</div>
                {project.files.map((file, i) => (
                  <div key={i} style={styles.changeFile}>
                    <span style={{ ...styles.changeStatus, ...getStatusStyle(file.status) }}>
                      {file.status}
                    </span>
                    <span>{file.path}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

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
