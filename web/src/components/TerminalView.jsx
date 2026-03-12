import { useState, useEffect, useRef } from 'react'
import { getOutput } from '../api'
import socket from '../socket'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--terminal-bg, #0d0d0d)',
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
    color: 'var(--terminal-text, #d4d4d4)',
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

    // Initial REST fetch for immediate data
    getOutput(workerName, 200)
      .then(data => { if (alive) { setOutput(data.output || ''); setConnected(true) } })
      .catch(() => { if (alive) setConnected(false) })

    // Subscribe to terminal updates via WebSocket
    socket.emit('terminal:subscribe', { name: workerName })

    const handler = (data) => {
      if (data.name === workerName && alive) {
        setOutput(data.output)
        setConnected(true)
      }
    }

    const reconnectHandler = () => {
      socket.emit('terminal:subscribe', { name: workerName })
      getOutput(workerName, 200)
        .then(data => { if (alive) { setOutput(data.output || ''); setConnected(true) } })
        .catch(() => {})
    }

    const disconnectHandler = () => { if (alive) setConnected(false) }

    socket.on('worker:output', handler)
    socket.on('connect', reconnectHandler)
    socket.on('disconnect', disconnectHandler)

    return () => {
      alive = false
      socket.emit('terminal:unsubscribe', { name: workerName })
      socket.off('worker:output', handler)
      socket.off('connect', reconnectHandler)
      socket.off('disconnect', disconnectHandler)
    }
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
