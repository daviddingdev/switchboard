import { useState, useEffect, useCallback } from 'react'
import { fetchMetrics, fetchSystemUpdates, triggerSystemUpdate } from '../api'
import socket from '../socket'
import { useToast } from './Toast'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
    height: '100%',
    overflow: 'hidden',
  },
  containerMobile: {
    background: 'var(--bg-secondary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    flexShrink: 0,
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    padding: '0 16px 16px',
    minHeight: 0,
  },
  scrollAreaMobile: {
    padding: '0 16px 16px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  titleMobile: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  pulse: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--success)',
  },
  pulseError: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--danger)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  gridMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    padding: '14px 16px',
    border: '1px solid var(--border)',
  },
  cardTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
  },
  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  metricName: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  metricNameMobile: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  metricValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  metricValueMobile: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  unit: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    marginLeft: '2px',
  },
  barContainer: {
    height: '4px',
    background: 'var(--bg-tertiary)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '4px',
    marginBottom: '8px',
  },
  bar: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease-out',
    willChange: 'width',
  },
  // Updates card — spans full width
  updatesCard: {
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    padding: '14px 16px',
    border: '1px solid var(--border)',
    gridColumn: '1 / -1',
  },
  updateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  updateRowLast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
  },
  updateCheckbox: {
    width: '16px',
    height: '16px',
    accentColor: 'var(--accent)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  updateName: {
    flex: 1,
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  updateCount: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  },
  rebootBadge: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#eab308',
    background: 'rgba(234, 179, 8, 0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  updateActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  updateBtn: {
    flex: 1,
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'var(--accent)',
    color: 'white',
  },
  updateBtnAll: {
    flex: 1,
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text-primary)',
  },
  updateBtnDisabled: {
    flex: 1,
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '6px',
    cursor: 'not-allowed',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
  },
  updateStatusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  updateError: {
    fontSize: '12px',
    color: 'var(--danger)',
    padding: '8px 0',
  },
  allGood: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    padding: '4px 0',
  },
  allGoodDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--success)',
    flexShrink: 0,
  },
  // Confirmation dialog — matches WorkerDashboard pattern
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  confirmDialog: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '24px',
    width: '340px',
    maxWidth: '85vw',
    textAlign: 'center',
  },
  confirmTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  confirmDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  confirmButtons: {
    display: 'flex',
    gap: '12px',
  },
  confirmCancel: {
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
  confirmYes: {
    flex: 1,
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
  confirmYesDanger: {
    flex: 1,
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
  confirmList: {
    textAlign: 'left',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
    lineHeight: 1.6,
  },
}

function getBarColor(pct, warn = 70, crit = 90) {
  if (pct >= crit) return 'var(--danger)'
  if (pct >= warn) return '#eab308'
  return 'var(--success)'
}

function MetricRow({ name, value, unit, isMobile }) {
  const display = value !== null && value !== undefined ? value : '--'
  return (
    <div style={styles.metric}>
      <span style={isMobile ? styles.metricNameMobile : styles.metricName}>{name}</span>
      <span style={isMobile ? styles.metricValueMobile : styles.metricValue}>
        {display}
        {unit && value !== null && <span style={styles.unit}>{unit}</span>}
      </span>
    </div>
  )
}

function Bar({ percent, warn, crit }) {
  const pct = Math.min(100, Math.max(0, percent || 0))
  return (
    <div style={styles.barContainer}>
      <div style={{
        ...styles.bar,
        width: `${pct}%`,
        background: getBarColor(pct, warn, crit),
      }} />
    </div>
  )
}

export default function Monitor({ isMobile }) {
  const [metrics, setMetrics] = useState(null)
  const [connected, setConnected] = useState(false)
  const [updates, setUpdates] = useState(null)
  const [selected, setSelected] = useState({})
  const [confirming, setConfirming] = useState(null) // { categories, needsReboot }
  const { addToast } = useToast()

  useEffect(() => {
    let active = true
    async function initialFetch() {
      try {
        const data = await fetchMetrics()
        if (active) { setMetrics(data); setConnected(true) }
      } catch {
        if (active) setConnected(false)
      }
    }
    initialFetch()

    const onMetrics = (data) => {
      if (active) { setMetrics(data); setConnected(true) }
    }
    const onConnect = () => initialFetch()
    const onDisconnect = () => { if (active) setConnected(false) }

    socket.on('metrics:update', onMetrics)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      active = false
      socket.off('metrics:update', onMetrics)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function initialFetch() {
      try {
        const data = await fetchSystemUpdates()
        if (active) setUpdates(data)
      } catch { /* ignore */ }
    }
    initialFetch()

    // Keep polling for system updates since they're less frequent
    // and not pushed via socket (adaptive interval)
    const interval = updates?.update_status?.running ? 5000 : 60000
    const updatesInterval = setInterval(async () => {
      try {
        const data = await fetchSystemUpdates()
        if (active) setUpdates(data)
      } catch { /* ignore */ }
    }, interval)

    return () => { active = false; clearInterval(updatesInterval) }
  }, [updates?.update_status?.running])

  const categories = updates?.categories?.filter(c =>
    c.count > 0 || (c.id === 'platform' && c.available)
  ) || []
  const totalUpdates = categories.reduce((sum, c) => sum + (c.count || 0), 0)
  const isRunning = updates?.update_status?.running
  const updateError = updates?.update_status?.error

  const toggleCategory = useCallback((id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const selectedCategories = categories.filter(c => selected[c.id])
  const selectedNeedsReboot = selectedCategories.some(c => c.requires_reboot)
  const allCategoryIds = categories.map(c => c.id)

  const handleUpdateSelected = useCallback(() => {
    const cats = selectedCategories
    if (!cats.length) return
    setConfirming({
      categories: cats.map(c => c.id),
      names: cats.map(c => c.name),
      needsReboot: selectedNeedsReboot,
    })
  }, [selectedCategories, selectedNeedsReboot])

  const handleUpdateAll = useCallback(() => {
    const needsReboot = categories.some(c => c.requires_reboot)
    setConfirming({
      categories: allCategoryIds,
      names: categories.map(c => c.name),
      needsReboot,
    })
  }, [categories, allCategoryIds])

  const executeUpdate = useCallback(async () => {
    if (!confirming) return
    const cats = confirming.categories
    setConfirming(null)
    try {
      await triggerSystemUpdate(cats)
      // Re-poll immediately
      const data = await fetchSystemUpdates()
      setUpdates(data)
    } catch (err) {
      addToast('Update failed: ' + err.message, 'error')
    }
  }, [confirming])

  const m = isMobile
  const gpu = metrics?.gpu
  const services = metrics?.services || {}
  const cpu = metrics?.cpu || {}
  const memory = metrics?.memory || {}
  const network = metrics?.network || {}
  const disk = metrics?.disk || {}
  const system = metrics?.system || {}

  // GPU card: only show if gpu object exists and has at least one non-null value
  const hasGpu = gpu && (gpu.util != null || gpu.temp != null || gpu.mem != null)

  const totalRam = (memory.used_gb || 0) + (memory.available_gb || 0)
  const ramPct = totalRam > 0 ? ((memory.used_gb || 0) / totalRam) * 100 : 0

  const uptimeStr = system.uptime_secs != null
    ? `${Math.floor(system.uptime_secs / 86400)}d ${Math.floor((system.uptime_secs % 86400) / 3600)}h`
    : null

  return (
    <div style={m ? styles.containerMobile : styles.container}>
      <div style={styles.header}>
        <span style={m ? styles.titleMobile : styles.title}>System Monitor</span>
        <div style={styles.status}>
          <span style={connected ? styles.pulse : styles.pulseError} />
          {connected ? 'Live' : 'Disconnected'}
        </div>
      </div>

      <div style={m ? styles.scrollAreaMobile : styles.scrollArea}>
      <div style={m ? styles.gridMobile : styles.grid}>
        {/* GPU — hidden if no GPU detected */}
        {hasGpu && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>GPU</div>
            <MetricRow name="Utilization" value={gpu.util} unit="%" isMobile={m} />
            <Bar percent={gpu.util} warn={70} crit={95} />
            <MetricRow name="Temperature" value={gpu.temp} unit="°C" isMobile={m} />
            <Bar percent={gpu.temp} warn={70} crit={85} />
            <MetricRow name="Memory" value={gpu.mem} unit="%" isMobile={m} />
            <Bar percent={gpu.mem} warn={80} crit={95} />
          </div>
        )}

        {/* Configured services */}
        {Object.entries(services).map(([name, svc]) => (
          <div key={name} style={styles.card}>
            <div style={styles.cardTitle}>{name}</div>
            <MetricRow name="CPU" value={svc.cpu} unit="%" isMobile={m} />
            <MetricRow name="RAM" value={svc.ram_gb} unit="GB" isMobile={m} />
          </div>
        ))}

        {/* CPU */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>CPU</div>
          <MetricRow name="Usage" value={cpu.usage} unit="%" isMobile={m} />
          <Bar percent={cpu.usage} warn={70} crit={90} />
          <MetricRow name="Load Average" value={cpu.load} isMobile={m} />
        </div>

        {/* Memory */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Memory</div>
          <MetricRow name="Used" value={memory.used_gb} unit="GB" isMobile={m} />
          <Bar percent={ramPct} warn={70} crit={90} />
          <MetricRow name="Available" value={memory.available_gb} unit="GB" isMobile={m} />
        </div>

        {/* Network */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Network</div>
          <MetricRow name="Download" value={network.down_mbps} unit="Mb/s" isMobile={m} />
          <MetricRow name="Upload" value={network.up_mbps} unit="Mb/s" isMobile={m} />
        </div>

        {/* Disk */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Disk</div>
          <MetricRow name="Read" value={disk.read_mbs} unit="MB/s" isMobile={m} />
          <MetricRow name="Write" value={disk.write_mbs} unit="MB/s" isMobile={m} />
          <MetricRow name="Space Used" value={disk.space_pct} unit="%" isMobile={m} />
          {disk.space_pct != null && <Bar percent={disk.space_pct} warn={70} crit={90} />}
        </div>

        {/* System */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>System</div>
          <MetricRow name="Uptime" value={uptimeStr} isMobile={m} />
          <MetricRow name="Processes" value={system.processes} isMobile={m} />
        </div>

        {/* System Updates — full width (hidden on unsupported platforms) */}
        {updates?.supported !== false && <div style={m ? styles.card : styles.updatesCard}>
          <div style={styles.cardTitle}>
            System Updates
            {totalUpdates > 0 && !isRunning && (
              <span style={{ color: '#eab308', marginLeft: '8px', textTransform: 'none' }}>
                {totalUpdates} available
              </span>
            )}
          </div>

          {isRunning ? (
            <div style={styles.updateStatusBar}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', flexShrink: 0 }} />
              Updating {updates.update_status.category || ''}...
            </div>
          ) : updateError ? (
            <div style={styles.updateError}>{updateError}</div>
          ) : categories.length === 0 ? (
            <div style={styles.allGood}>
              <span style={styles.allGoodDot} />
              System is up to date
            </div>
          ) : (
            <>
              {categories.map((cat, i) => (
                <div key={cat.id} style={i < categories.length - 1 ? styles.updateRow : styles.updateRowLast}>
                  <input
                    type="checkbox"
                    style={styles.updateCheckbox}
                    checked={!!selected[cat.id]}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span style={styles.updateName}>{cat.name}</span>
                  <span style={styles.updateCount}>
                    {cat.id === 'platform' ? '' : `${cat.count} pkg${cat.count !== 1 ? 's' : ''}`}
                  </span>
                  {cat.requires_reboot && (
                    <span style={styles.rebootBadge}>Restart</span>
                  )}
                </div>
              ))}

              {!updates?.sudo_configured && (
                <div style={{ fontSize: '11px', color: '#eab308', marginTop: '8px' }}>
                  Passwordless sudo not configured. See docs/SETUP.md for instructions.
                </div>
              )}

              <div style={styles.updateActions}>
                <button
                  style={selectedCategories.length > 0 ? styles.updateBtn : styles.updateBtnDisabled}
                  disabled={selectedCategories.length === 0}
                  onClick={handleUpdateSelected}
                >
                  Update Selected
                </button>
                <button style={styles.updateBtnAll} onClick={handleUpdateAll}>
                  Update All
                </button>
              </div>
            </>
          )}
        </div>}
      </div>
      </div>

      {/* Confirmation dialog — matches WorkerDashboard pattern */}
      {confirming && (
        <div style={styles.confirmOverlay} onClick={() => setConfirming(null)}>
          <div style={styles.confirmDialog} onClick={e => e.stopPropagation()}>
            <div style={styles.confirmTitle}>
              {confirming.needsReboot ? 'Update & Restart' : 'Update Packages'}
            </div>
            <div style={styles.confirmList}>
              {confirming.names.map(n => (
                <div key={n}>{n}</div>
              ))}
            </div>
            <div style={styles.confirmDesc}>
              {confirming.needsReboot
                ? 'This will restart the system. Save all work before proceeding.'
                : 'Update selected packages?'}
            </div>
            <div style={styles.confirmButtons}>
              <button style={styles.confirmCancel} onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button
                style={confirming.needsReboot ? styles.confirmYesDanger : styles.confirmYes}
                onClick={executeUpdate}
              >
                {confirming.needsReboot ? 'Update & Restart' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
