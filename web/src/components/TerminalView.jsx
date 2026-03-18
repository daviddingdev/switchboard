import { useState, useEffect, useRef, useMemo } from 'react'
import { getOutput, sendToProcess } from '../api'
import socket from '../socket'

const QUICK_BUTTONS = [
  { label: 'y', text: 'y', raw: true },
  { label: 'n', text: 'n', raw: true },
  { label: '1', text: '1', raw: true },
  { label: '2', text: '2', raw: true },
  { label: '3', text: '3', raw: true },
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
    WebkitOverflowScrolling: 'touch',
  },
  pre: {
    margin: 0,
    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--terminal-text, #d4d4d4)',
    whiteSpace: 'pre',
    userSelect: 'text',
    WebkitUserSelect: 'text',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '12px',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 0,
  },
  searchInfo: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  searchBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    cursor: 'pointer',
    lineHeight: 1,
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
  commandBarMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px 10px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  quickRow: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
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
  quickBtnMobile: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '14px',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    lineHeight: 1.4,
    minHeight: '36px',
    flexShrink: 0,
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
  textInputMobile: {
    flex: 'none',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '14px',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    outline: 'none',
    minWidth: 0,
    minHeight: '36px',
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

// XSS prevention: HTML-escape MUST happen BEFORE inserting <mark> tags.
// If reversed, terminal output containing HTML would be rendered as HTML.
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function TerminalView({ workerName, isMobile }) {
  const [output, setOutput] = useState('')
  const [connected, setConnected] = useState(true)
  const [inputText, setInputText] = useState('')
  const [flashIdx, setFlashIdx] = useState(null)
  const [lineCount, setLineCount] = useState(200)
  const [historicalOutput, setHistoricalOutput] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const scrollRef = useRef(null)
  const wasAtBottom = useRef(true)
  const inputRef = useRef(null)
  const searchInputRef = useRef(null)

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
    // Reset to match 1 when output changes while search is open
    if (searchOpen && searchQuery) {
      setCurrentMatch(0)
    }
  }, [output])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  const handleLoadMore = () => {
    const newCount = lineCount + 200
    setLineCount(newCount)
    getOutput(workerName, newCount)
      .then(data => {
        if (data.output) {
          setHistoricalOutput(data.output)
        }
      })
      .catch(() => {})
  }

  // Use historical output if available and longer, otherwise use live output
  const fullOutput = historicalOutput && historicalOutput.length > output.length
    ? historicalOutput : output

  // Compute search results
  const { highlightedHtml, matchCount } = useMemo(() => {
    if (!searchQuery || !searchOpen) {
      return { highlightedHtml: null, matchCount: 0 }
    }
    // Step 1: HTML-escape the raw output
    const escaped = escapeHtml(fullOutput || '')
    // Step 2: Apply search regex on the escaped string to insert <mark> tags
    const pattern = new RegExp(escapeRegex(searchQuery), 'gi')
    let count = 0
    let matchIdx = 0
    const html = escaped.replace(pattern, (match) => {
      const isCurrent = matchIdx === currentMatch
      matchIdx++
      count++
      return isCurrent
        ? `<mark style="background:rgba(234,179,8,0.7);color:inherit;border-radius:2px">${match}</mark>`
        : `<mark style="background:rgba(234,179,8,0.25);color:inherit;border-radius:2px">${match}</mark>`
    })
    return { highlightedHtml: html, matchCount: count }
  }, [fullOutput, searchQuery, searchOpen, currentMatch])

  // Auto-scroll to current match
  useEffect(() => {
    if (!searchOpen || matchCount === 0) return
    const el = scrollRef.current
    if (!el) return
    const marks = el.querySelectorAll('mark')
    if (marks[currentMatch]) {
      marks[currentMatch].scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [currentMatch, matchCount, highlightedHtml])

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setSearchOpen(false)
      setSearchQuery('')
      setCurrentMatch(0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        setCurrentMatch(prev => (prev - 1 + matchCount) % Math.max(matchCount, 1))
      } else {
        setCurrentMatch(prev => (prev + 1) % Math.max(matchCount, 1))
      }
    }
  }

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false)
      setSearchQuery('')
      setCurrentMatch(0)
    } else {
      setSearchOpen(true)
    }
  }

  // Step 3: Render via dangerouslySetInnerHTML when search is active
  const useHighlightedOutput = searchOpen && searchQuery && highlightedHtml !== null

  return (
    <div style={styles.container}>
      <div style={styles.output} ref={scrollRef} onScroll={handleScroll}>
        {lineCount <= 1000 && (
          <div style={{ textAlign: 'center', padding: '4px 0 8px', flexShrink: 0 }}>
            <button
              style={{ ...styles.quickBtn, fontSize: '10px', padding: '2px 10px' }}
              onClick={handleLoadMore}
            >
              Load more
            </button>
          </div>
        )}
        {useHighlightedOutput ? (
          <pre style={styles.pre} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre style={styles.pre}>{fullOutput || 'Waiting for output...'}</pre>
        )}
      </div>
      {searchOpen && (
        <div style={styles.searchBar}>
          <input
            ref={searchInputRef}
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatch(0) }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
          />
          <span style={styles.searchInfo}>
            {searchQuery ? `${matchCount > 0 ? currentMatch + 1 : 0}/${matchCount}` : ''}
          </span>
          <button style={styles.searchBtn} onClick={() => setCurrentMatch(prev => (prev - 1 + matchCount) % Math.max(matchCount, 1))}>▲</button>
          <button style={styles.searchBtn} onClick={() => setCurrentMatch(prev => (prev + 1) % Math.max(matchCount, 1))}>▼</button>
          <button style={styles.searchBtn} onClick={toggleSearch}>✕</button>
        </div>
      )}
      {isMobile ? (
        <div style={styles.commandBarMobile}>
          <div style={styles.quickRow}>
            {QUICK_BUTTONS.map((btn, i) => (
              <button
                key={btn.label}
                style={{
                  ...styles.quickBtnMobile,
                  ...(btn.danger ? styles.quickBtnDanger : {}),
                  opacity: flashIdx === i ? 0.5 : 1,
                }}
                onClick={() => send(btn.text, btn.raw, i)}
              >
                {btn.label}
              </button>
            ))}
            <button
              style={styles.quickBtnMobile}
              onClick={toggleSearch}
            >
              Search
            </button>
          </div>
          <input
            ref={inputRef}
            style={styles.textInputMobile}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKey}
            placeholder="Send text..."
          />
        </div>
      ) : (
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
          <button
            style={styles.quickBtn}
            onClick={toggleSearch}
            title="Search output"
          >
            🔍
          </button>
          <input
            ref={inputRef}
            style={styles.textInput}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKey}
            placeholder="Send text..."
          />
        </div>
      )}
      <div style={styles.status}>
        {connected ? `● ${workerName}` : `○ ${workerName} — disconnected`}
      </div>
    </div>
  )
}
