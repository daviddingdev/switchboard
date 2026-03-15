import { useState, useEffect } from 'react'
import { fetchActivity } from '../api'
import socket from '../socket'

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
  projectGroup: {
    marginBottom: '10px',
  },
  projectName: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    marginBottom: '4px',
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
}

function getStatusStyle(status) {
  if (status === 'M' || status === 'MM') return styles.statusM
  if (status === 'A' || status === 'AM') return styles.statusA
  if (status === 'D') return styles.statusD
  if (status === '??' || status === '?') return styles.statusQ
  return styles.statusM
}

export default function Activity({ onFileClick, onCollapse, isMobile }) {
  const [activity, setActivity] = useState({ changes: [], unpushed: [] })
  const [loading, setLoading] = useState(true)
  const [hoveredFile, setHoveredFile] = useState(null)

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

  const changesCount = activity.changes?.reduce((sum, p) => sum + p.files.length, 0) || 0
  const unpushedCount = activity.unpushed?.reduce((sum, p) => sum + p.commits.length, 0) || 0

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
        {loading && changesCount === 0 && unpushedCount === 0 ? (
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
                    <div style={styles.projectName}>{project.project}</div>
                    {project.commits.map((commit, i) => (
                      <div key={i} style={styles.commitItem}>
                        <span style={styles.commitHash}>{commit.hash}</span>
                        <span style={styles.commitMessage}>{commit.message}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
