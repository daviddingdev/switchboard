import { useState, useEffect } from 'react'
import { fetchHome } from '../api'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
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

function FileItem({ item, depth = 0, onFileSelect }) {
  // Auto-expand projects and root level, collapse deep directories
  const [expanded, setExpanded] = useState(item.is_project || depth < 1)
  const [hovered, setHovered] = useState(false)
  const isDir = item.type === 'dir'
  const indent = depth * 14

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded)
    } else if (onFileSelect) {
      onFileSelect(item.path)
    }
  }

  // Choose icon based on file type
  const getIcon = () => {
    if (isDir) {
      if (item.is_project) return expanded ? '📂' : '📁'
      return expanded ? '📂' : '📁'
    }
    // Special icons for known files
    if (item.name === 'SOUL.md') return '✨'
    if (item.name === 'INFRASTRUCTURE.md') return '🏗️'
    if (item.name === 'WORKER.md') return '👷'
    if (item.name === 'CLAUDE.md') return '🤖'
    if (item.name.endsWith('.md')) return '📝'
    if (item.name.endsWith('.py')) return '🐍'
    if (item.name.endsWith('.js') || item.name.endsWith('.jsx')) return '📜'
    if (item.name.endsWith('.yaml') || item.name.endsWith('.yml')) return '⚙️'
    return '📄'
  }

  return (
    <>
      <div
        style={{
          ...styles.item,
          paddingLeft: 8 + indent,
          ...(hovered ? styles.itemHover : {}),
          ...(item.is_project ? styles.itemProject : {}),
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={styles.icon}>{getIcon()}</span>
        <span style={styles.name}>{item.name}</span>
        {item.is_project && <span style={styles.projectBadge}>project</span>}
      </div>
      {isDir && expanded && item.children?.map((child, i) => (
        <FileItem
          key={child.path || i}
          item={child}
          depth={depth + 1}
          onFileSelect={onFileSelect}
        />
      ))}
    </>
  )
}

export default function FileTree({ onFileSelect }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.header}>Files</div>

      <div style={styles.tree}>
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
            />
          ))
        )}
      </div>
    </div>
  )
}
