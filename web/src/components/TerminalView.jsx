import { useState, useEffect, useRef } from 'react'
import { getOutput } from '../api'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0d0d0d',
    overflow: 'hidden',
  },
  output: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 16px',
    minHeight: 0,
  },
  pre: {
    margin: 0,
    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#d4d4d4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  status: {
    padding: '6px 16px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
}

export default function TerminalView({ workerName }) {
  const [output, setOutput] = useState('')
  const [connected, setConnected] = useState(true)
  const scrollRef = useRef(null)
  const wasAtBottom = useRef(true)

  useEffect(() => {
    let alive = true

    const poll = async () => {
      try {
        const data = await getOutput(workerName, 200)
        if (alive) {
          setOutput(data.output || '')
          setConnected(true)
        }
      } catch {
        if (alive) setConnected(false)
      }
    }

    poll()
    const interval = setInterval(poll, 1000)
    return () => { alive = false; clearInterval(interval) }
  }, [workerName])

  // Track whether user is scrolled to bottom
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  // Auto-scroll to bottom when output changes (if user was at bottom)
  useEffect(() => {
    const el = scrollRef.current
    if (el && wasAtBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [output])

  return (
    <div style={styles.container}>
      <div style={styles.output} ref={scrollRef} onScroll={handleScroll}>
        <pre style={styles.pre}>{output || 'Waiting for output...'}</pre>
      </div>
      <div style={styles.status}>
        {connected ? `● ${workerName}` : `○ ${workerName} — disconnected`}
      </div>
    </div>
  )
}
