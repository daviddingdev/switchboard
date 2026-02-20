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
  planList: {
    padding: '16px',
    overflow: 'auto',
    maxHeight: '40%',
    borderBottom: '1px solid var(--border)',
  },
  planHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  noPendingPlans: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  terminalWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '16px',
    paddingBottom: 0,
  },
}

export default function ChatArea() {
  const [plans, setPlans] = useState([])
  const [updating, setUpdating] = useState(null)
  const [sending, setSending] = useState(false)

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

  // Show pending plans first, then others
  const pendingPlans = plans.filter(p => p.status === 'pending')
  const otherPlans = plans.filter(p => p.status !== 'pending')

  return (
    <div style={styles.container}>
      {plans.length > 0 && (
        <div style={styles.planList}>
          <div style={styles.planHeader}>Plans</div>
          {pendingPlans.length === 0 && otherPlans.length > 0 && (
            <div style={styles.noPendingPlans}>No pending plans</div>
          )}
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

      <div style={styles.terminalWrapper}>
        <Terminal workerName="partner" fullHeight />
      </div>

      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}
