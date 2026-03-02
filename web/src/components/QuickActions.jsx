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
// Numbers and Y/N send as text+Enter for Claude Code prompts
// Shift+click any button to populate chat input instead
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

export default function QuickActions({ onSend, onSendRaw, onPopulate, disabled = false }) {
  const handleClick = (action, e) => {
    // Shift+click populates chat input instead of sending
    if (e.shiftKey && onPopulate) {
      onPopulate(action.key)
      return
    }

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
          onClick={(e) => handleClick(action, e)}
          disabled={disabled}
          title={`${action.key} (shift+click to edit)`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
