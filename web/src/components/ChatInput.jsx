import { useState } from 'react'

const styles = {
  container: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  input: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  sendButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
  },
}

export default function ChatInput({ onSend, disabled = false, placeholder = "Message partner..." }) {
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
        autoFocus
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
