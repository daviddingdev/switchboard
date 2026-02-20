import { useState, useEffect, useRef } from 'react'
import { getOutput } from '../api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0d1117',
    borderRadius: '6px',
    overflow: 'hidden',
    minHeight: 0,
  },
  header: {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
  },
  output: {
    flex: 1,
    padding: '12px',
    fontFamily: 'ui-monospace, "SF Mono", Monaco, Consolas, monospace',
    fontSize: '13px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'auto',
    color: '#c9d1d9',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
}

export default function Terminal({ workerName, fullHeight = false }) {
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(true)
  const outputRef = useRef(null)
  const wasAtBottomRef = useRef(true)

  useEffect(() => {
    if (!workerName) return

    setLoading(true)
    let mounted = true

    const fetchOutput = async () => {
      try {
        const data = await getOutput(workerName, 200)
        if (mounted) {
          // Check if user was at bottom before update
          if (outputRef.current) {
            const el = outputRef.current
            wasAtBottomRef.current = el.scrollHeight - el.scrollTop <= el.clientHeight + 50
          }
          setOutput(data.output || '')
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setOutput(`Error: ${err.message}`)
          setLoading(false)
        }
      }
    }

    fetchOutput()
    const interval = setInterval(fetchOutput, 500)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [workerName])

  // Auto-scroll to bottom when new content arrives (if user was at bottom)
  useEffect(() => {
    if (outputRef.current && wasAtBottomRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  if (!workerName) {
    return (
      <div style={{ ...styles.container, ...(fullHeight && { height: '100%' }) }}>
        <div style={styles.empty}>Select a worker to view output</div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.container, ...(fullHeight && { height: '100%' }) }}>
      <div style={styles.header}>{workerName}</div>
      <div ref={outputRef} style={styles.output}>
        {loading ? 'Loading...' : output || '(no output)'}
      </div>
    </div>
  )
}
