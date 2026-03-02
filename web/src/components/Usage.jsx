import { useState, useEffect, useRef } from 'react'
import { fetchUsage, refreshUsage } from '../api'

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
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  timestamp: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  refreshBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    cursor: 'pointer',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  gridMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  card: {
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    padding: '14px 16px',
    border: '1px solid var(--border)',
  },
  cardWide: {
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    padding: '14px 16px',
    border: '1px solid var(--border)',
    marginBottom: '12px',
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
  bigNumber: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  bigLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  deltaPositive: {
    fontSize: '11px',
    color: 'var(--success)',
    fontWeight: 600,
  },
  deltaNegative: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  emptyBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}

function formatNum(n) {
  if (n == null) return '--'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(iso) {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`
  return dateStr
}

function MetricRow({ name, value, isMobile }) {
  return (
    <div style={styles.metric}>
      <span style={isMobile ? styles.metricNameMobile : styles.metricName}>{name}</span>
      <span style={isMobile ? styles.metricValueMobile : styles.metricValue}>{value}</span>
    </div>
  )
}

function BarChart({ data, labelKey, valueKey, color = 'var(--accent)', maxItems = 14 }) {
  const items = data.slice(-maxItems)
  const max = Math.max(...items.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {items.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', color: 'var(--text-secondary)',
            width: '50px', flexShrink: 0, textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {typeof d[labelKey] === 'string' ? shortDate(d[labelKey]) : d[labelKey]}
          </span>
          <div style={{
            flex: 1, height: '14px', background: 'var(--bg-tertiary)',
            borderRadius: '3px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${((d[valueKey] || 0) / max) * 100}%`,
              background: color,
              borderRadius: '3px',
              transition: 'width 0.3s ease-out',
              minWidth: d[valueKey] > 0 ? '2px' : '0',
            }} />
          </div>
          <span style={{
            fontSize: '11px', color: 'var(--text-primary)',
            width: '45px', fontVariantNumeric: 'tabular-nums',
            textAlign: 'right',
          }}>
            {formatNum(d[valueKey])}
          </span>
        </div>
      ))}
    </div>
  )
}

function HourHeatmap({ hourCounts }) {
  const values = Array.from({ length: 24 }, (_, h) => hourCounts[String(h)] || 0)
  const max = Math.max(...values, 1)
  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
        {values.map((count, h) => {
          const intensity = count / max
          return (
            <div key={h} title={`${h}:00 — ${formatNum(count)} events`} style={{
              flex: 1, height: '24px', borderRadius: '2px',
              background: intensity > 0
                ? `rgba(59, 130, 246, ${0.12 + intensity * 0.88})`
                : 'var(--bg-tertiary)',
              cursor: 'default',
            }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 1px' }}>
        {[0, 6, 12, 18, 23].map(h => (
          <span key={h} style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
            {h}:00
          </span>
        ))}
      </div>
    </div>
  )
}

function ComparisonCard({ comparison, isMobile }) {
  if (!comparison) return null
  const { this_week, last_week, change_pct } = comparison
  const m = isMobile

  const rows = [
    { label: 'Messages', thisVal: this_week.messages, lastVal: last_week.messages, pct: change_pct.messages },
    { label: 'Sessions', thisVal: this_week.sessions, lastVal: last_week.sessions, pct: change_pct.sessions },
    { label: 'Tool Calls', thisVal: this_week.tool_calls, lastVal: last_week.tool_calls, pct: change_pct.tool_calls },
    { label: 'Output Tokens', thisVal: this_week.tokens_output, lastVal: last_week.tokens_output, pct: change_pct.tokens_output },
  ]

  return (
    <div style={styles.cardWide}>
      <div style={styles.cardTitle}>This Week vs Last Week</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', fontSize: m ? '13px' : '11px' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}></span>
        <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>This</span>
        <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>Last</span>
        <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>Change</span>
        {rows.map(r => (
          <>
            <span key={`l-${r.label}`} style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
            <span key={`t-${r.label}`} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatNum(r.thisVal)}</span>
            <span key={`p-${r.label}`} style={{ textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatNum(r.lastVal)}</span>
            <span key={`c-${r.label}`} style={{
              textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              color: r.pct > 0 ? 'var(--success)' : r.pct < 0 ? 'var(--text-secondary)' : 'var(--text-secondary)',
            }}>
              {r.pct > 0 ? '+' : ''}{r.pct}%
            </span>
          </>
        ))}
      </div>
    </div>
  )
}

export default function Usage({ isMobile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const prevJson = useRef('')

  const load = async () => {
    try {
      const result = await fetchUsage()
      if (result) {
        const json = JSON.stringify(result)
        if (json !== prevJson.current) {
          prevJson.current = json
          setData(result)
        }
      }
    } catch {
      // 404 = no stats yet
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshUsage()
      // Poll for completion (check every 2s, up to 60s)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const result = await fetchUsage()
          if (result && result.computed_at !== data?.computed_at) {
            clearInterval(poll)
            setData(result)
            prevJson.current = JSON.stringify(result)
            setRefreshing(false)
          }
        } catch { /* keep polling */ }
        if (attempts > 30) {
          clearInterval(poll)
          setRefreshing(false)
        }
      }, 2000)
    } catch {
      setRefreshing(false)
    }
  }

  const m = isMobile

  if (loading) {
    return (
      <div style={m ? styles.containerMobile : styles.container}>
        <div style={styles.header}>
          <span style={m ? styles.titleMobile : styles.title}>Usage Analytics</span>
        </div>
        <div style={styles.empty}>Loading...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={m ? styles.containerMobile : styles.container}>
        <div style={styles.header}>
          <span style={m ? styles.titleMobile : styles.title}>Usage Analytics</span>
        </div>
        <div style={styles.empty}>
          <span>No usage data computed yet</span>
          <button style={styles.emptyBtn} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Computing...' : 'Compute Now'}
          </button>
        </div>
      </div>
    )
  }

  const { overview, daily, weekly, by_project, by_model, by_hour, comparison } = data

  return (
    <div style={m ? styles.containerMobile : styles.container}>
      <div style={styles.header}>
        <span style={m ? styles.titleMobile : styles.title}>Usage Analytics</span>
        <div style={styles.headerRight}>
          <span style={styles.timestamp}>{formatDate(data.computed_at)}</span>
          <button
            style={{ ...styles.refreshBtn, opacity: refreshing ? 0.5 : 1 }}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Computing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={m ? styles.scrollAreaMobile : styles.scrollArea}>
        {/* Overview cards */}
        <div style={m ? styles.gridMobile : styles.grid}>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(overview.total_sessions)}</div>
            <div style={styles.bigLabel}>Total Sessions</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(overview.total_messages)}</div>
            <div style={styles.bigLabel}>Total Messages</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(overview.total_tool_calls)}</div>
            <div style={styles.bigLabel}>Tool Calls</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(overview.total_tokens?.output)}</div>
            <div style={styles.bigLabel}>Output Tokens</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{overview.days_active}</div>
            <div style={styles.bigLabel}>Days Active</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{overview.projects_count}</div>
            <div style={styles.bigLabel}>Projects</div>
          </div>
        </div>

        {/* This week vs last week */}
        <ComparisonCard comparison={comparison} isMobile={m} />

        {/* Daily activity */}
        {daily && daily.length > 0 && (
          <div style={styles.cardWide}>
            <div style={styles.cardTitle}>Daily Activity (Messages)</div>
            <BarChart data={daily} labelKey="date" valueKey="messages" maxItems={14} />
          </div>
        )}

        {/* Weekly trends */}
        {weekly && weekly.length > 0 && (
          <div style={styles.cardWide}>
            <div style={styles.cardTitle}>Weekly Trends (Messages)</div>
            <BarChart data={weekly} labelKey="week" valueKey="messages" color="#8b5cf6" />
          </div>
        )}

        {/* By project and By model side by side */}
        <div style={m ? styles.gridMobile : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {/* By project */}
          {by_project && by_project.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>By Project</div>
              <BarChart data={by_project} labelKey="name" valueKey="messages" color="#22c55e" maxItems={10} />
            </div>
          )}

          {/* By model */}
          {by_model && Object.keys(by_model).length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>By Model</div>
              {Object.entries(by_model).map(([model, info]) => {
                const shortModel = model.replace('claude-', '').replace(/-\d{8}$/, '')
                return (
                  <div key={model} style={{ marginBottom: '8px' }}>
                    <MetricRow name={shortModel} value={formatNum(info.messages) + ' msgs'} isMobile={m} />
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span>In: {formatNum(info.tokens?.input)}</span>
                      <span>Out: {formatNum(info.tokens?.output)}</span>
                      <span>Cache: {formatNum(info.tokens?.cache_read)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Hourly heatmap */}
        {by_hour && (
          <div style={styles.cardWide}>
            <div style={styles.cardTitle}>Activity by Hour (Local Time)</div>
            <HourHeatmap hourCounts={by_hour} />
          </div>
        )}

        {/* Token breakdown */}
        <div style={styles.cardWide}>
          <div style={styles.cardTitle}>All-Time Token Breakdown</div>
          <MetricRow name="Input Tokens" value={formatNum(overview.total_tokens?.input)} isMobile={m} />
          <MetricRow name="Output Tokens" value={formatNum(overview.total_tokens?.output)} isMobile={m} />
          <MetricRow name="Cache Read" value={formatNum(overview.total_tokens?.cache_read)} isMobile={m} />
          <MetricRow name="Cache Creation" value={formatNum(overview.total_tokens?.cache_creation)} isMobile={m} />
          <MetricRow name="Since" value={overview.first_session || '--'} isMobile={m} />
        </div>
      </div>
    </div>
  )
}
