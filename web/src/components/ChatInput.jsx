import { useState } from 'react'

const styles = {
  container: {
    display: 'flex',
    gap: '8px',
    flex: 1,
    height: '100%',
    alignItems: 'stretch',
  },
  textarea: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    overflow: 'auto',
  },
  sendButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    height: '36px',
    flexShrink: 0,
    alignSelf: 'flex-end',
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
    // Enter sends, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form style={styles.container} onSubmit={handleSubmit}>
      <textarea
        style={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
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
