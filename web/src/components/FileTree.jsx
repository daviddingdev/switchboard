import { useState, useEffect } from 'react'
import { fetchHome } from '../api'
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
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tree: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  treeMobile: {
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  itemHover: {
    background: 'var(--bg-tertiary)',
  },
  itemProject: {
    fontWeight: 500,
  },
  icon: {
    marginRight: '6px',
    fontSize: '12px',
    width: '16px',
    textAlign: 'center',
    flexShrink: 0,
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  projectBadge: {
    marginLeft: '6px',
    fontSize: '9px',
    padding: '1px 4px',
    borderRadius: '3px',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 500,
  },
  statusIndicator: {
    marginLeft: '6px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  statusM: { color: '#e2c08d' },  // yellow - modified
  statusU: { color: '#73c991' },  // green - untracked
  statusA: { color: '#73c991' },  // green - added
  statusD: { color: '#f14c4c' },  // red - deleted
  folderDot: {
    marginLeft: '4px',
    color: '#e2c08d',
    fontSize: '14px',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
}

function FileItem({ item, depth = 0, onFileSelect, isMobile }) {
  // All folders collapsed by default
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isDir = item.type === 'dir'
  const indent = depth * 14

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded)
    } else if (onFileSelect) {
      onFileSelect(item)
    }
  }

  // Choose icon based on file type
  const getIcon = () => {
    if (isDir) {
      if (item.is_project) return expanded ? '📂' : '📁'
      return expanded ? '📂' : '📁'
    }
    if (item.name === 'CLAUDE.md') return '🤖'
    if (item.name.endsWith('.md')) return '📝'
    if (item.name.endsWith('.py')) return '🐍'
    if (item.name.endsWith('.js') || item.name.endsWith('.jsx')) return '📜'
    if (item.name.endsWith('.yaml') || item.name.endsWith('.yml')) return '⚙️'
    if (item.name.endsWith('.json')) return '📋'
    if (item.name.endsWith('.css')) return '🎨'
    if (item.name.endsWith('.html')) return '🌐'
    return '📄'
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'M': return styles.statusM
      case 'U': return styles.statusU
      case 'A': return styles.statusA
      case 'D': return styles.statusD
      default: return {}
    }
  }

  return (
    <>
      <div
        style={{
          ...styles.item,
          paddingLeft: 8 + indent,
          ...(hovered ? styles.itemHover : {}),
          ...(item.is_project ? styles.itemProject : {}),
          ...(isMobile ? { padding: '10px 14px', paddingLeft: 14 + indent, fontSize: '15px' } : {}),
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={styles.icon}>{getIcon()}</span>
        <span style={{
          ...styles.name,
          ...(item.status ? getStatusStyle(item.status) : {})
        }}>
          {item.name}
        </span>
        {item.status && (
          <span style={{ ...styles.statusIndicator, ...getStatusStyle(item.status) }}>
            {item.status}
          </span>
        )}
        {isDir && item.has_changes && !item.status && (
          <span style={styles.folderDot}>•</span>
        )}
        {item.is_project && <span style={styles.projectBadge}>project</span>}
      </div>
      {isDir && expanded && item.children?.map((child, i) => (
        <FileItem
          key={child.path || i}
          item={child}
          depth={depth + 1}
          onFileSelect={onFileSelect}
          isMobile={isMobile}
        />
      ))}
    </>
  )
}

export default function FileTree({ onFileSelect, isMobile }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadFiles = () => {
    fetchHome()
      .then(data => {
        setFiles(data.files || [])
        setError(null)
      })
      .catch(err => {
        console.error('Failed to load files:', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFiles()

    // No dedicated socket event for files - keep light polling
    // since file tree changes are infrequent
    const interval = setInterval(loadFiles, 10000)

    const onConnect = () => loadFiles()
    socket.on('connect', onConnect)

    return () => {
      clearInterval(interval)
      socket.off('connect', onConnect)
    }
  }, [])

  return (
    <div style={isMobile ? styles.containerMobile : styles.container}>
      <div style={styles.header}>Files</div>

      <div style={isMobile ? styles.treeMobile : styles.tree}>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : error ? (
          <div style={styles.empty}>Error: {error}</div>
        ) : files.length === 0 ? (
          <div style={styles.empty}>No projects found</div>
        ) : (
          files.map((item, i) => (
            <FileItem
              key={item.path || i}
              item={item}
              onFileSelect={onFileSelect}
              isMobile={isMobile}
            />
          ))
        )}
      </div>
    </div>
  )
}
