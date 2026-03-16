import { useState, useEffect, useRef } from 'react'
import { getOutput, sendToProcess } from '../api'
import socket from '../socket'

const QUICK_BUTTONS = [
  { label: 'y', text: 'y', raw: false },
  { label: 'n', text: 'n', raw: false },
  { label: '1', text: '1', raw: false },
  { label: '2', text: '2', raw: false },
  { label: '3', text: '3', raw: false },
  { label: '↵', text: 'Enter', raw: true },
  { label: 'Esc', text: 'Escape', raw: true },
  { label: 'Ctrl+C', text: 'C-c', raw: true, danger: true },
]

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
  commandBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  quickBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    lineHeight: 1.4,
  },
  quickBtnDanger: {
    color: 'var(--danger)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  textInput: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    outline: 'none',
    minWidth: 0,
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
  const [inputText, setInputText] = useState('')
  const [flashIdx, setFlashIdx] = useState(null)
  const scrollRef = useRef(null)
  const wasAtBottom = useRef(true)
  const inputRef = useRef(null)

  const send = (text, raw, idx) => {
    sendToProcess(workerName, text, raw).catch(() => {})
    if (idx != null) {
      setFlashIdx(idx)
      setTimeout(() => setFlashIdx(null), 200)
    }
  }

  const handleInputKey = (e) => {
    if (e.key === 'Enter' && inputText.trim()) {
      sendToProcess(workerName, inputText, false).catch(() => {})
      setInputText('')
    }
  }

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
      <div style={styles.commandBar}>
        {QUICK_BUTTONS.map((btn, i) => (
          <button
            key={btn.label}
            style={{
              ...styles.quickBtn,
              ...(btn.danger ? styles.quickBtnDanger : {}),
              opacity: flashIdx === i ? 0.5 : 1,
            }}
            onClick={() => send(btn.text, btn.raw, i)}
            title={`Send ${btn.raw ? btn.text : `"${btn.text}" + Enter`}`}
          >
            {btn.label}
          </button>
        ))}
        <input
          ref={inputRef}
          style={styles.textInput}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleInputKey}
          placeholder="Send text..."
        />
      </div>
      <div style={styles.status}>
        {connected ? `● ${workerName}` : `○ ${workerName} — disconnected`}
      </div>
    </div>
  )
}
