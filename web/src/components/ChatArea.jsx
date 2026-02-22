import { useState, useEffect } from 'react'
import Terminal from './Terminal'
import ChatInput from './ChatInput'
import PlanCard from './PlanCard'
import { fetchPlans, updatePlan, sendToProcess } from '../api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  planSection: {
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  planHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  planHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  planTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  planCount: {
    background: '#854d0e',
    color: '#fef08a',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
  },
  expandIcon: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    transition: 'transform 0.15s',
  },
  planList: {
    padding: '0 12px 12px',
    maxHeight: '200px',
    overflow: 'auto',
  },
  terminalWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '12px',
    paddingBottom: 0,
  },
  terminalLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
}

export default function ChatArea() {
  const [plans, setPlans] = useState([])
  const [updating, setUpdating] = useState(null)
  const [sending, setSending] = useState(false)
  const [plansExpanded, setPlansExpanded] = useState(true)

  const loadPlans = async () => {
    try {
      const data = await fetchPlans()
      setPlans(data)
    } catch (err) {
      console.error('Failed to load plans:', err)
    }
  }

  useEffect(() => {
    loadPlans()
    const interval = setInterval(loadPlans, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (id) => {
    setUpdating(id)
    try {
      await updatePlan(id, 'approved')
      await loadPlans()
    } catch (err) {
      alert(`Failed to approve: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  const handleReject = async (id) => {
    setUpdating(id)
    try {
      await updatePlan(id, 'rejected')
      await loadPlans()
    } catch (err) {
      alert(`Failed to reject: ${err.message}`)
    } finally {
      setUpdating(null)
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

  const pendingPlans = plans.filter(p => p.status === 'pending')
  const otherPlans = plans.filter(p => p.status !== 'pending')
  const pendingCount = pendingPlans.length

  return (
    <div style={styles.container}>
      {plans.length > 0 && (
        <div style={styles.planSection}>
          <div style={styles.planHeader} onClick={() => setPlansExpanded(!plansExpanded)}>
            <div style={styles.planHeaderLeft}>
              <span style={styles.planTitle}>Plans</span>
              {pendingCount > 0 && (
                <span style={styles.planCount}>{pendingCount} pending</span>
              )}
            </div>
            <span style={{
              ...styles.expandIcon,
              transform: plansExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>▶</span>
          </div>

          {plansExpanded && (
            <div style={styles.planList}>
              {pendingPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  disabled={updating === plan.id}
                />
              ))}
              {otherPlans.slice(0, 3).map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  disabled
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={styles.terminalWrapper}>
        <div style={styles.terminalLabel}>Partner</div>
        <Terminal workerName="partner" fullHeight />
      </div>

      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}
