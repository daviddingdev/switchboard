import { useState, useEffect } from 'react'
import { fetchPartnerHistory } from '../api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  sessionInfo: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  refreshBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  messagesArea: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  },
  message: {
    marginBottom: '16px',
    padding: '10px 12px',
    borderRadius: '6px',
  },
  userMessage: {
    background: 'var(--bg-tertiary)',
    borderLeft: '3px solid var(--accent)',
  },
  assistantMessage: {
    background: 'var(--bg-secondary)',
    borderLeft: '3px solid #22c55e',
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  role: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  userRole: {
    color: 'var(--accent)',
  },
  assistantRole: {
    color: '#22c55e',
  },
  timestamp: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
  },
  content: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: 'var(--text-secondary)',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
}

function formatTimestamp(ts) {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function PartnerHistory() {
  const [messages, setMessages] = useState([])
  const [sessionFile, setSessionFile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadHistory = async () => {
    try {
      const data = await fetchPartnerHistory(0) // 0 = no limit, get all
      setMessages(data.messages || [])
      setSessionFile(data.session_file)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
    // Auto-refresh every 5 seconds while tab is open
    const interval = setInterval(loadHistory, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    loadHistory()
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading conversation history...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.title}>Partner Conversation History</span>
          {sessionFile && (
            <span style={styles.sessionInfo}> - {sessionFile}</span>
          )}
        </div>
        <button style={styles.refreshBtn} onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div style={styles.messagesArea}>
        {messages.length === 0 ? (
          <div style={styles.empty}>No messages in this session</div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.message,
                ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
              }}
            >
              <div style={styles.messageHeader}>
                <span
                  style={{
                    ...styles.role,
                    ...(msg.role === 'user' ? styles.userRole : styles.assistantRole),
                  }}
                >
                  {msg.role}
                </span>
                <span style={styles.timestamp}>{formatTimestamp(msg.timestamp)}</span>
              </div>
              <div style={styles.content}>{msg.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
