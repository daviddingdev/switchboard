import { useState, useEffect } from 'react'
import { fetchProjects, fetchFiles } from '../api'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  tree: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 0',
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
  icon: {
    marginRight: '6px',
    fontSize: '12px',
    width: '16px',
    textAlign: 'center',
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  const [expanded, setExpanded] = useState(depth < 2)
  const [hovered, setHovered] = useState(false)
  const isDir = item.type === 'dir'
  const indent = depth * 16

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded)
    } else if (onFileSelect) {
      onFileSelect(item.path)
    }
  }

  return (
    <>
      <div
        style={{
          ...styles.item,
          paddingLeft: 12 + indent,
          ...(hovered ? styles.itemHover : {}),
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={styles.icon}>
          {isDir ? (expanded ? '📂' : '📁') : '📄'}
        </span>
        <span style={styles.name}>{item.name}</span>
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
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  // Load projects on mount
  useEffect(() => {
    fetchProjects()
      .then(data => {
        setProjects(data)
        if (data.length > 0) {
          // Default to orchestrator if available, else first project
          const defaultProject = data.find(p => p.name === 'orchestrator') || data[0]
          setSelectedProject(defaultProject.name)
        }
      })
      .catch(err => console.error('Failed to load projects:', err))
      .finally(() => setLoading(false))
  }, [])

  // Load files when project changes
  useEffect(() => {
    if (!selectedProject) {
      setFiles([])
      return
    }

    setLoading(true)
    fetchFiles(selectedProject)
      .then(data => setFiles(data.files || []))
      .catch(err => {
        console.error('Failed to load files:', err)
        setFiles([])
      })
      .finally(() => setLoading(false))
  }, [selectedProject])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <select
          style={styles.select}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.tree}>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : files.length === 0 ? (
          <div style={styles.empty}>No files</div>
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
