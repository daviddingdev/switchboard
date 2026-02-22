import { useState } from 'react'

const styles = {
  card: {
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    marginBottom: '8px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerExpanded: {
    borderBottom: '1px solid var(--border)',
  },
  badge: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
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
  title: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  worker: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  expandIcon: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    transition: 'transform 0.15s',
  },
  body: {
    padding: '10px 12px',
  },
  steps: {
    margin: '0 0 10px 0',
    paddingLeft: '18px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  actions: {
    display: 'flex',
    gap: '6px',
  },
  approveButton: {
    background: 'var(--success)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  rejectButton: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
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
  const [expanded, setExpanded] = useState(plan.status === 'pending')
  const hasSteps = plan.steps && plan.steps.length > 0
  const isPending = plan.status === 'pending'

  return (
    <div style={styles.card}>
      <div
        style={{
          ...styles.header,
          ...(expanded && (hasSteps || isPending) ? styles.headerExpanded : {}),
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={getBadgeStyle(plan.status)}>{plan.status}</span>
        <span style={styles.title}>{plan.title}</span>
        <span style={styles.worker}>{plan.worker}</span>
        {(hasSteps || isPending) && (
          <span style={{
            ...styles.expandIcon,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>▶</span>
        )}
      </div>

      {expanded && (hasSteps || isPending) && (
        <div style={styles.body}>
          {hasSteps && (
            <ol style={styles.steps}>
              {plan.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}

          {isPending && (
            <div style={styles.actions}>
              <button
                style={styles.approveButton}
                onClick={(e) => { e.stopPropagation(); onApprove?.(plan.id) }}
                disabled={disabled}
              >
                Approve
              </button>
              <button
                style={styles.rejectButton}
                onClick={(e) => { e.stopPropagation(); onReject?.(plan.id) }}
                disabled={disabled}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
