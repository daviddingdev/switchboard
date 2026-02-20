import { useState } from 'react'

const styles = {
  container: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  input: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  sendButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
  },
}

export default function ChatInput({ onSend, disabled = false, placeholder = "Send a message to partner..." }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (text.trim() && onSend) {
      onSend(text)
      setText('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form style={styles.container} onSubmit={handleSubmit}>
      <input
        type="text"
        style={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="submit"
        style={{
          ...styles.sendButton,
          opacity: disabled || !text.trim() ? 0.5 : 1,
        }}
        disabled={disabled || !text.trim()}
      >
        Send
      </button>
    </form>
  )
}
