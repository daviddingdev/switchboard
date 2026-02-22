import { useState } from 'react'

const styles = {
  card: {
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    marginBottom: '6px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerExpanded: {
    borderBottom: '1px solid var(--border)',
  },
  badge: {
    padding: '2px 5px',
    borderRadius: '3px',
    fontSize: '9px',
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
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  worker: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    padding: '0 4px',
    lineHeight: 1,
    opacity: 0.6,
  },
  expandIcon: {
    fontSize: '8px',
    color: 'var(--text-secondary)',
    transition: 'transform 0.15s',
  },
  body: {
    padding: '8px 10px',
  },
  steps: {
    margin: '0 0 8px 0',
    paddingLeft: '16px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
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
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: 500,
  },
  rejectButton: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: '4px',
    padding: '5px 10px',
    fontSize: '11px',
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

export default function ProposalCard({ proposal, onApprove, onReject, onDelete, disabled = false }) {
  const [expanded, setExpanded] = useState(proposal.status === 'pending')
  const hasSteps = proposal.steps && proposal.steps.length > 0
  const isPending = proposal.status === 'pending'

  const handleDelete = (e) => {
    e.stopPropagation()
    onDelete?.(proposal.id)
  }

  return (
    <div style={styles.card}>
      <div
        style={{
          ...styles.header,
          ...(expanded && (hasSteps || isPending) ? styles.headerExpanded : {}),
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={getBadgeStyle(proposal.status)}>{proposal.status}</span>
        <span style={styles.title}>{proposal.title}</span>
        <span style={styles.worker}>{proposal.worker}</span>
        {!isPending && onDelete && (
          <button
            style={styles.deleteBtn}
            onClick={handleDelete}
            title="Delete proposal"
          >
            ×
          </button>
        )}
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
              {proposal.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}

          {isPending && (
            <div style={styles.actions}>
              <button
                style={styles.approveButton}
                onClick={(e) => { e.stopPropagation(); onApprove?.(proposal.id) }}
                disabled={disabled}
              >
                Approve
              </button>
              <button
                style={styles.rejectButton}
                onClick={(e) => { e.stopPropagation(); onReject?.(proposal.id) }}
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
