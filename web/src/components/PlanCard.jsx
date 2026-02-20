const styles = {
  card: {
    background: 'var(--bg-tertiary)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  badgePending: {
    background: '#854d0e',
    color: '#fef08a',
  },
  badgeApproved: {
    background: '#166534',
    color: '#86efac',
  },
  badgeRejected: {
    background: '#991b1b',
    color: '#fca5a5',
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  worker: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  steps: {
    margin: '0 0 16px 0',
    paddingLeft: '20px',
  },
  step: {
    marginBottom: '6px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  approveButton: {
    background: 'var(--success)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
  },
  rejectButton: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
  },
}

function getBadgeStyle(status) {
  switch (status) {
    case 'approved':
      return { ...styles.badge, ...styles.badgeApproved }
    case 'rejected':
      return { ...styles.badge, ...styles.badgeRejected }
    default:
      return { ...styles.badge, ...styles.badgePending }
  }
}

export default function PlanCard({ plan, onApprove, onReject, disabled = false }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={getBadgeStyle(plan.status)}>{plan.status}</span>
        <div style={styles.titleRow}>
          <h3 style={styles.title}>{plan.title}</h3>
          <span style={styles.worker}>from {plan.worker}</span>
        </div>
      </div>

      {plan.steps && plan.steps.length > 0 && (
        <ol style={styles.steps}>
          {plan.steps.map((step, i) => (
            <li key={i} style={styles.step}>{step}</li>
          ))}
        </ol>
      )}

      {plan.status === 'pending' && (
        <div style={styles.actions}>
          <button
            style={styles.approveButton}
            onClick={() => onApprove?.(plan.id)}
            disabled={disabled}
          >
            Approve
          </button>
          <button
            style={styles.rejectButton}
            onClick={() => onReject?.(plan.id)}
            disabled={disabled}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
