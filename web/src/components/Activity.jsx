import { useState, useEffect } from 'react'
import { fetchActivity, pushProject, updateProposal } from '../api'
import socket from '../socket'
import ConfirmDialog from './ConfirmDialog'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  containerMobile: {
    // No height/overflow — parent handles scroll
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  scrollAreaMobile: {
    padding: '8px',
  },
  section: {
    marginBottom: '16px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    marginBottom: '8px',
    padding: '0 4px',
  },
  countBadge: {
    background: 'var(--status-modified-bg)',
    color: 'var(--status-modified-text)',
    padding: '2px 6px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: 600,
  },
  countPush: {
    background: 'var(--status-untracked-bg)',
    color: 'var(--status-untracked-text)',
    padding: '2px 6px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: 600,
  },
  countPending: {
    background: 'rgba(234, 179, 8, 0.15)',
    color: '#eab308',
    padding: '2px 6px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: 600,
  },
  projectGroup: {
    marginBottom: '10px',
  },
  projectName: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  pushBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.1s',
  },
  fileItemMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 10px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background 0.1s',
  },
  fileItemHover: {
    background: 'var(--bg-tertiary)',
  },
  statusBadge: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10px',
    padding: '1px 4px',
    borderRadius: '3px',
    fontWeight: 600,
  },
  statusM: { background: 'var(--status-modified-bg)', color: 'var(--status-modified-text)' },
  statusA: { background: 'var(--status-added-bg)', color: 'var(--status-added-text)' },
  statusD: { background: 'var(--status-deleted-bg)', color: 'var(--status-deleted-text)' },
  statusQ: { background: 'var(--status-untracked-bg)', color: 'var(--status-untracked-text)' },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  commitItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '4px 8px',
    fontSize: '12px',
  },
  commitHash: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '11px',
    color: 'var(--status-untracked-text)',
    flexShrink: 0,
  },
  commitMessage: {
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    padding: '4px 8px',
  },
  // Proposals
  proposalCard: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '6px',
  },
  proposalTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  proposalWorker: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  proposalSteps: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
    padding: '2px 0',
  },
  proposalStepList: {
    padding: '4px 0 4px 12px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  proposalActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '6px',
  },
  approveBtn: {
    flex: 1,
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '36px',
  },
  rejectBtn: {
    flex: 1,
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '36px',
  },
  proposalStatusBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: '3px',
    marginLeft: '6px',
  },
  // Banner
  banner: {
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    marginBottom: '8px',
    textAlign: 'center',
  },
}

function getStatusStyle(status) {
  if (status === 'M') return styles.statusM
  if (status === 'A') return styles.statusA
  if (status === 'D') return styles.statusD
  if (status === '?') return styles.statusQ
  return styles.statusM
}

export default function Activity({ onFileClick, onCollapse, isMobile }) {
  const [activity, setActivity] = useState({ changes: [], unpushed: [], pending: [], recent: [] })
  const [loading, setLoading] = useState(true)
  const [hoveredFile, setHoveredFile] = useState(null)
  const [pushConfirm, setPushConfirm] = useState(null) // project name
  const [pushing, setPushing] = useState(null)
  const [banner, setBanner] = useState(null) // { type, message }
  const [expandedSteps, setExpandedSteps] = useState({})
  const [expandedCommits, setExpandedCommits] = useState({})
  const [actingProposal, setActingProposal] = useState(null)

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const data = await fetchActivity()
        setActivity(data)
      } catch (err) {
        console.error('Failed to load activity:', err)
      } finally {
        setLoading(false)
      }
    }

    loadActivity()

    const onUpdate = (data) => {
      setActivity(data)
      setLoading(false)
    }
    const onConnect = () => loadActivity()

    socket.on('activity:update', onUpdate)
    socket.on('connect', onConnect)
    return () => {
      socket.off('activity:update', onUpdate)
      socket.off('connect', onConnect)
    }
  }, [])

  const showBanner = (type, message) => {
    setBanner({ type, message })
    setTimeout(() => setBanner(null), 4000)
  }

  const handlePush = async (project) => {
    setPushConfirm(null)
    setPushing(project)
    try {
      const result = await pushProject(project)
      if (result.success) {
        showBanner('success', `Pushed ${project}`)
      } else {
        showBanner('error', result.error || `Push failed for ${project}`)
      }
    } catch (err) {
      showBanner('error', err.message)
    } finally {
      setPushing(null)
    }
  }

  const handleProposalAction = async (id, status) => {
    setActingProposal(id)
    try {
      await updateProposal(id, status)
    } catch (err) {
      showBanner('error', err.message)
    } finally {
      setActingProposal(null)
    }
  }

  const toggleSteps = (id) => {
    setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleCommit = (hash) => {
    setExpandedCommits(prev => ({ ...prev, [hash]: !prev[hash] }))
  }

  const changesCount = activity.changes?.reduce((sum, p) => sum + p.files.length, 0) || 0
  const unpushedCount = activity.unpushed?.reduce((sum, p) => sum + p.commits.length, 0) || 0
  const pendingCount = activity.pending?.length || 0

  return (
    <div style={isMobile ? styles.containerMobile : styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Activity</span>
        {onCollapse && (
          <button style={styles.collapseBtn} onClick={onCollapse} title="Collapse activity">
            ▶
          </button>
        )}
      </div>

      <div style={isMobile ? styles.scrollAreaMobile : styles.scrollArea}>
        {banner && (
          <div style={{
            ...styles.banner,
            background: banner.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: banner.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}>
            {banner.message}
          </div>
        )}

        {loading && changesCount === 0 && unpushedCount === 0 && pendingCount === 0 ? (
          <div style={{ padding: '8px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: '6px 8px', marginBottom: 8 }}>
                <div style={{ width: '40%', height: 10, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: '70%', height: 10, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Pending Proposals */}
            {pendingCount > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span>Proposals</span>
                  <span style={styles.countPending}>{pendingCount}</span>
                </div>
                {activity.pending.map(p => (
                  <div key={p.id} style={styles.proposalCard}>
                    <div style={styles.proposalTitle}>{p.title}</div>
                    <div style={styles.proposalWorker}>from {p.worker}</div>
                    {p.steps?.length > 0 && (
                      <>
                        <div
                          style={styles.proposalSteps}
                          onClick={() => toggleSteps(p.id)}
                        >
                          {expandedSteps[p.id] ? '▾' : '▸'} {p.steps.length} step{p.steps.length !== 1 ? 's' : ''}
                        </div>
                        {expandedSteps[p.id] && (
                          <div style={styles.proposalStepList}>
                            {p.steps.map((s, i) => <div key={i}>{typeof s === 'string' ? s : s.description || JSON.stringify(s)}</div>)}
                          </div>
                        )}
                      </>
                    )}
                    <div style={styles.proposalActions}>
                      <button
                        style={styles.approveBtn}
                        onClick={() => handleProposalAction(p.id, 'approved')}
                        disabled={actingProposal === p.id}
                      >
                        {actingProposal === p.id ? '...' : 'Approve'}
                      </button>
                      <button
                        style={styles.rejectBtn}
                        onClick={() => handleProposalAction(p.id, 'rejected')}
                        disabled={actingProposal === p.id}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Git Changes */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span>Changes</span>
                {changesCount > 0 && (
                  <span style={styles.countBadge}>{changesCount}</span>
                )}
              </div>
              {changesCount === 0 ? (
                <div style={styles.empty}>No uncommitted changes</div>
              ) : (
                activity.changes?.map(project => (
                  <div key={project.project} style={styles.projectGroup}>
                    <div style={styles.projectName}>{project.project}</div>
                    {project.files.map((file, i) => {
                      const fileKey = `${project.project}:${file.path}`
                      const isHovered = hoveredFile === fileKey
                      return (
                        <div
                          key={i}
                          style={{
                            ...(isMobile ? styles.fileItemMobile : styles.fileItem),
                            ...(isHovered ? styles.fileItemHover : {}),
                          }}
                          onMouseEnter={() => setHoveredFile(fileKey)}
                          onMouseLeave={() => setHoveredFile(null)}
                          onClick={() => onFileClick?.(project, file)}
                        >
                          <span style={{ ...styles.statusBadge, ...getStatusStyle(file.status) }}>
                            {file.status}
                          </span>
                          <span style={styles.fileName}>{file.path}</span>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Unpushed Commits */}
            {unpushedCount > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span>Unpushed</span>
                  <span style={styles.countPush}>{unpushedCount}</span>
                </div>
                {activity.unpushed.map(project => (
                  <div key={project.project} style={styles.projectGroup}>
                    <div style={styles.projectName}>
                      <span>{project.project}</span>
                      <button
                        style={{ ...styles.pushBtn, opacity: pushing === project.project ? 0.5 : 1 }}
                        onClick={() => setPushConfirm(project.project)}
                        disabled={!!pushing}
                      >
                        {pushing === project.project ? '...' : 'Push'}
                      </button>
                    </div>
                    {project.commits.map((commit, i) => (
                      <div key={i}>
                        <div
                          style={{ ...styles.commitItem, cursor: commit.files?.length ? 'pointer' : 'default' }}
                          onClick={() => commit.files?.length && toggleCommit(commit.hash)}
                        >
                          <span style={styles.commitHash}>
                            {commit.files?.length ? (expandedCommits[commit.hash] ? '▾' : '▸') : ' '} {commit.hash}
                          </span>
                          <span style={styles.commitMessage}>{commit.message}</span>
                        </div>
                        {expandedCommits[commit.hash] && commit.files?.map((file, j) => (
                          <div key={j} style={{ ...styles.fileItem, paddingLeft: '24px' }}>
                            <span style={{ ...styles.statusBadge, ...getStatusStyle(file.status) }}>
                              {file.status}
                            </span>
                            <span style={styles.fileName}>{file.path}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Recent Proposals */}
            {activity.recent?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span>Recent Proposals</span>
                </div>
                {activity.recent.map(p => (
                  <div key={p.id} style={{ ...styles.proposalCard, opacity: 0.6 }}>
                    <div style={styles.proposalTitle}>
                      {p.title}
                      <span style={{
                        ...styles.proposalStatusBadge,
                        background: p.status === 'approved' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: p.status === 'approved' ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {p.status}
                      </span>
                    </div>
                    <div style={styles.proposalWorker}>from {p.worker}</div>
                    {p.steps?.length > 0 && (
                      <>
                        <div
                          style={styles.proposalSteps}
                          onClick={() => toggleSteps(p.id)}
                        >
                          {expandedSteps[p.id] ? '▾' : '▸'} {p.steps.length} step{p.steps.length !== 1 ? 's' : ''}
                        </div>
                        {expandedSteps[p.id] && (
                          <div style={styles.proposalStepList}>
                            {p.steps.map((s, i) => <div key={i}>{typeof s === 'string' ? s : s.description || JSON.stringify(s)}</div>)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {pushConfirm && (
        <ConfirmDialog
          title="Push to Remote"
          description={`Push all unpushed commits in ${pushConfirm}?`}
          confirmLabel="Push"
          onConfirm={() => handlePush(pushConfirm)}
          onCancel={() => setPushConfirm(null)}
        />
      )}
    </div>
  )
}
