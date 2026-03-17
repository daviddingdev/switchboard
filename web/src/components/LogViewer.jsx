import { useState, useEffect } from 'react'
import { fetchWorkerLogs, fetchLogFile } from '../api'

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  sidebar: {
    width: '200px',
    borderRight: '1px solid var(--border)',
    overflow: 'auto',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  sidebarHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
  },
  fileBtn: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '12px',
    padding: '6px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
  },
  fileBtnActive: {
    background: 'var(--bg-tertiary)',
  },
  fileSize: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  contentTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  loadMoreBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  pre: {
    flex: 1,
    overflow: 'auto',
    margin: 0,
    padding: '12px 16px',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  info: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function LogViewer({ workerName }) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [content, setContent] = useState('')
  const [logInfo, setLogInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tail, setTail] = useState(500)

  useEffect(() => {
    setLoading(true)
    fetchWorkerLogs(workerName)
      .then(data => {
        setFiles(data.files || [])
        if (data.files?.length > 0) {
          setSelectedFile(data.files[0].filename)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workerName])

  useEffect(() => {
    if (!selectedFile) return
    setContent('')
    fetchLogFile(workerName, selectedFile, tail)
      .then(data => {
        setContent(data.content || '')
        setLogInfo(data)
      })
      .catch(err => setContent(`Error: ${err.message}`))
  }, [workerName, selectedFile, tail])

  const handleLoadMore = () => {
    setTail(prev => Math.min(prev + 1000, 5000))
  }

  if (loading) return <div style={styles.empty}>Loading...</div>
  if (files.length === 0) return <div style={styles.empty}>No log files found</div>

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>Log Files</div>
        {files.map(f => (
          <button
            key={f.filename}
            style={{
              ...styles.fileBtn,
              ...(selectedFile === f.filename ? styles.fileBtnActive : {}),
            }}
            onClick={() => { setSelectedFile(f.filename); setTail(500) }}
          >
            {f.filename}
            <div style={styles.fileSize}>{formatBytes(f.size)}</div>
          </button>
        ))}
      </div>
      <div style={styles.content}>
        {selectedFile && (
          <div style={styles.contentHeader}>
            <span style={styles.contentTitle}>{selectedFile}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {logInfo && (
                <span style={styles.info}>
                  {logInfo.showing}/{logInfo.total_lines} lines
                </span>
              )}
              {logInfo && logInfo.showing < logInfo.total_lines && (
                <button style={styles.loadMoreBtn} onClick={handleLoadMore}>
                  Load More
                </button>
              )}
            </div>
          </div>
        )}
        <pre style={styles.pre}>{content || 'Empty log file'}</pre>
      </div>
    </div>
  )
}
