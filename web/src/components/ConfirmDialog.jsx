const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  dialog: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '24px',
    width: '340px',
    maxWidth: '85vw',
    textAlign: 'center',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  buttons: {
    display: 'flex',
    gap: '12px',
  },
  cancel: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '48px',
  },
  confirm: {
    flex: 1,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
}

export default function ConfirmDialog({ title, description, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false, children }) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <div style={styles.title}>{title}</div>
        {children}
        <div style={styles.description}>{description}</div>
        <div style={styles.buttons}>
          <button style={styles.cancel} onClick={onCancel}>Cancel</button>
          <button
            style={{ ...styles.confirm, background: danger ? '#ef4444' : 'var(--accent)' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
