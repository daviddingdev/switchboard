import { useState, useEffect, useRef } from 'react'
import { fetchMetrics } from '../api'

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
  const intervalRef = useRef(null)

  const prevJson = useRef('')

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const data = await fetchMetrics()
        if (active) {
          const json = JSON.stringify(data)
          if (json !== prevJson.current) {
            prevJson.current = json
            setMetrics(data)
          }
          setConnected(true)
        }
      } catch {
        if (active) setConnected(false)
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      active = false
      clearInterval(intervalRef.current)
    }
  }, [])

  const m = isMobile
  const gpu = metrics?.gpu || {}
  const ollama = metrics?.ollama || {}
  const cpu = metrics?.cpu || {}
  const memory = metrics?.memory || {}
  const network = metrics?.network || {}
  const disk = metrics?.disk || {}
  const system = metrics?.system || {}

  // Compute RAM percent for bar
  const totalRam = (memory.used_gb || 0) + (memory.available_gb || 0)
  const ramPct = totalRam > 0 ? ((memory.used_gb || 0) / totalRam) * 100 : 0

  // Format uptime
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
        {/* GPU */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>GPU</div>
          <MetricRow name="Utilization" value={gpu.util} unit="%" isMobile={m} />
          <Bar percent={gpu.util} warn={70} crit={95} />
          <MetricRow name="Temperature" value={gpu.temp} unit="°C" isMobile={m} />
          <Bar percent={gpu.temp} warn={70} crit={85} />
          <MetricRow name="Memory" value={gpu.mem} unit="%" isMobile={m} />
          <Bar percent={gpu.mem} warn={80} crit={95} />
        </div>

        {/* Ollama */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Ollama</div>
          <MetricRow name="CPU" value={ollama.cpu} unit="%" isMobile={m} />
          <MetricRow name="RAM" value={ollama.ram_gb} unit="GB" isMobile={m} />
        </div>

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
      </div>
      </div>
    </div>
  )
}
