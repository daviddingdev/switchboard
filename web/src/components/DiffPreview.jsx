import { useEffect, useState } from 'react'
import { fetchDiff } from '../api'

const styles = {
  container: {
    height: '100%',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    background: 'var(--bg-primary)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--danger)',
    fontSize: '14px',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  headerPath: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
  },
  content: {
    padding: '0',
    margin: '0',
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  line: {
    display: 'flex',
    minHeight: '18px',
  },
  lineNumber: {
    width: '50px',
    textAlign: 'right',
    paddingRight: '12px',
    color: 'var(--text-secondary)',
    userSelect: 'none',
    flexShrink: 0,
    fontSize: '11px',
  },
  lineContent: {
    flex: 1,
    paddingLeft: '12px',
    paddingRight: '16px',
    whiteSpace: 'pre',
  },
  addition: {
    background: 'rgba(46, 160, 67, 0.15)',
    color: '#3fb950',
  },
  deletion: {
    background: 'rgba(248, 81, 73, 0.15)',
    color: '#f85149',
  },
  hunk: {
    background: 'rgba(56, 139, 253, 0.1)',
    color: '#58a6ff',
  },
  meta: {
    color: 'var(--text-secondary)',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
}

function getLineStyle(line) {
  if (line.startsWith('+') && !line.startsWith('+++')) return styles.addition
  if (line.startsWith('-') && !line.startsWith('---')) return styles.deletion
  if (line.startsWith('@@')) return styles.hunk
  if (line.startsWith('diff ') || line.startsWith('index ') ||
      line.startsWith('---') || line.startsWith('+++') ||
      line.startsWith('new file') || line.startsWith('deleted file')) {
    return styles.meta
  }
  return {}
}

export default function DiffPreview({ project, filepath, isMobile }) {
  const [diff, setDiff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!project || !filepath) return

    setLoading(true)
    setError(null)

    fetchDiff(project, filepath)
      .then(data => {
        setDiff(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [project, filepath])

  if (loading) {
    return <div style={styles.loading}>Loading diff...</div>
  }

  if (error) {
    return <div style={styles.error}>{error}</div>
  }

  if (!diff?.diff) {
    return <div style={styles.empty}>No changes</div>
  }

  const lines = diff.diff.split('\n')

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>{project}</div>
        <div style={styles.headerPath}>{filepath}</div>
      </div>
      <pre style={styles.content}>
        {lines.map((line, i) => (
          <div key={i} style={styles.line}>
            {!isMobile && (
              <span style={styles.lineNumber}>{i + 1}</span>
            )}
            <span style={{
              ...styles.lineContent,
              ...getLineStyle(line),
              ...(isMobile ? { fontSize: '11px', paddingLeft: '8px' } : {}),
            }}>
              {line || ' '}
            </span>
          </div>
        ))}
      </pre>
    </div>
  )
}
