import { useState, useEffect } from 'react'
import Terminal from './Terminal'
import ChatInput from './ChatInput'
import ProposalCard from './ProposalCard'
import { fetchProposals, updateProposal, deleteProposal, sendToProcess } from '../api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  proposalSection: {
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  proposalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  proposalHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  proposalTitle: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  proposalCount: {
    background: '#854d0e',
    color: '#fef08a',
    padding: '1px 5px',
    borderRadius: '8px',
    fontSize: '9px',
    fontWeight: 600,
  },
  expandIcon: {
    fontSize: '8px',
    color: 'var(--text-secondary)',
    transition: 'transform 0.15s',
  },
  proposalList: {
    padding: '0 12px 8px',
    maxHeight: '150px',
    overflow: 'auto',
  },
  terminalWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '8px 12px',
    paddingBottom: 0,
  },
  terminalLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  noProposals: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
    padding: '4px 0',
  },
}

export default function ChatArea() {
  const [proposals, setProposals] = useState([])
  const [updating, setUpdating] = useState(null)
  const [sending, setSending] = useState(false)
  const [proposalsExpanded, setProposalsExpanded] = useState(true)

  const loadProposals = async () => {
    try {
      const data = await fetchProposals()
      setProposals(data)
    } catch (err) {
      console.error('Failed to load proposals:', err)
    }
  }

  useEffect(() => {
    loadProposals()
    const interval = setInterval(loadProposals, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (id) => {
    setUpdating(id)
    try {
      await updateProposal(id, 'approved')
      await loadProposals()
    } catch (err) {
      alert(`Failed to approve: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  const handleReject = async (id) => {
    setUpdating(id)
    try {
      await updateProposal(id, 'rejected')
      await loadProposals()
    } catch (err) {
      alert(`Failed to reject: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteProposal(id)
      await loadProposals()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleSend = async (text) => {
    setSending(true)
    try {
      await sendToProcess('partner', text)
    } catch (err) {
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const otherProposals = proposals.filter(p => p.status !== 'pending')
  const pendingCount = pendingProposals.length

  return (
    <div style={styles.container}>
      <div style={styles.proposalSection}>
        <div style={styles.proposalHeader} onClick={() => setProposalsExpanded(!proposalsExpanded)}>
          <div style={styles.proposalHeaderLeft}>
            <span style={styles.proposalTitle}>Proposals</span>
            {pendingCount > 0 && (
              <span style={styles.proposalCount}>{pendingCount}</span>
            )}
          </div>
          <span style={{
            ...styles.expandIcon,
            transform: proposalsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>▶</span>
        </div>

        {proposalsExpanded && (
          <div style={styles.proposalList}>
            {proposals.length === 0 && (
              <div style={styles.noProposals}>No proposals</div>
            )}
            {pendingProposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                disabled={updating === proposal.id}
              />
            ))}
            {otherProposals.slice(0, 5).map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <div style={styles.terminalWrapper}>
        <div style={styles.terminalLabel}>Partner</div>
        <Terminal workerName="partner" fullHeight />
      </div>

      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}
