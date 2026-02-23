const styles = {
  container: {
    display: 'flex',
    gap: '6px',
    padding: '6px 0',
    flexWrap: 'wrap',
  },
  button: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'ui-monospace, "SF Mono", Monaco, Consolas, monospace',
    minWidth: '32px',
  },
  label: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    marginRight: '8px',
  },
}

const QUICK_ACTIONS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: 'y', label: 'Y' },
  { key: 'n', label: 'N' },
  { key: 'Enter', label: '↵', sendRaw: true },
  { key: 'Escape', label: 'Esc', sendRaw: true },
]

export default function QuickActions({ onSend, disabled = false }) {
  const handleClick = (action) => {
    if (onSend) {
      // For Enter/Escape, we send them as raw keys
      // For others, we send the character which will auto-press enter
      onSend(action.sendRaw ? action.key : action.key)
    }
  }

  return (
    <div style={styles.container}>
      <span style={styles.label}>Quick:</span>
      {QUICK_ACTIONS.map(action => (
        <button
          key={action.key}
          style={styles.button}
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
