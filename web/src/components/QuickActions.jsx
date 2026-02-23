const styles = {
  container: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  button: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: 'ui-monospace, "SF Mono", Monaco, Consolas, monospace',
    minWidth: '28px',
    cursor: 'pointer',
  },
  escButton: {
    background: '#7f1d1d',
    borderColor: '#991b1b',
    color: '#fca5a5',
  },
  planButton: {
    background: '#1e3a5f',
    borderColor: '#1d4ed8',
    color: '#93c5fd',
  },
  label: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    marginRight: '4px',
  },
}

// Quick actions - raw means send as tmux key without Enter
const QUICK_ACTIONS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: 'y', label: 'Y' },
  { key: 'n', label: 'N' },
  { key: 'Enter', label: '↵', raw: true },
  { key: 'Escape', label: 'Esc', raw: true, style: 'esc' },
  { key: '/plan', label: 'Plan', style: 'plan' },
]

export default function QuickActions({ onSend, onSendRaw, disabled = false }) {
  const handleClick = (action) => {
    if (action.raw && onSendRaw) {
      // Send as raw tmux key (Escape, Enter)
      onSendRaw(action.key)
    } else if (onSend) {
      // Send as text (will auto-press enter)
      onSend(action.key)
    }
  }

  const getButtonStyle = (action) => {
    let style = { ...styles.button }
    if (action.style === 'esc') {
      style = { ...style, ...styles.escButton }
    } else if (action.style === 'plan') {
      style = { ...style, ...styles.planButton }
    }
    return style
  }

  return (
    <div style={styles.container}>
      {QUICK_ACTIONS.map(action => (
        <button
          key={action.key}
          style={getButtonStyle(action)}
          onClick={() => handleClick(action)}
          disabled={disabled}
          title={action.key}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
