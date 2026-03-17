import { useState, useEffect, useRef } from 'react'
import { fetchUsage, refreshUsage } from '../api'

const TIME_RANGES = [
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '6m', label: '6m', days: 183 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null },
]

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
    gap: '10px',
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
  },
  rangePills: {
    display: 'flex',
    gap: '2px',
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    padding: '2px',
  },
  rangePill: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  rangePillActive: {
    background: 'var(--accent)',
    color: 'white',
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
  allTimeSummary: {
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    padding: '10px 16px',
    border: '1px solid var(--border)',
    marginBottom: '12px',
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    flexWrap: 'wrap',
  },
}

function formatNum(n) {
  if (n == null) return '--'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n) {
  if (n == null || n === 0) return '$0'
  if (n < 0.01) return '<$0.01'
  if (n < 1) return '$' + n.toFixed(2)
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
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
  if (parts.length === 2) return `${parts[0].slice(2)}/${parts[1]}`
  return dateStr
}

function fillDailyGaps(daily) {
  if (!daily || daily.length < 2) return daily || []
  const filled = []
  const first = new Date(daily[0].date + 'T00:00:00')
  const last = new Date(daily[daily.length - 1].date + 'T00:00:00')
  const byDate = {}
  for (const d of daily) byDate[d.date] = d
  for (let dt = new Date(first); dt <= last; dt.setDate(dt.getDate() + 1)) {
    const key = dt.toISOString().slice(0, 10)
    filled.push(byDate[key] || { date: key, sessions: 0, messages: 0, tool_calls: 0, cost: 0, tokens: { input: 0, output: 0, cache_read: 0, cache_creation: 0 } })
  }
  return filled
}

function filterDailyByRange(daily, rangeKey) {
  if (!daily || rangeKey === 'all') return daily || []
  const range = TIME_RANGES.find(r => r.key === rangeKey)
  if (!range || !range.days) return daily || []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - range.days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return daily.filter(d => d.date >= cutoffStr)
}

function computeOverviewFromDaily(filteredDaily) {
  let sessions = 0, messages = 0, tool_calls = 0, cost = 0
  const tokens = { input: 0, output: 0, cache_read: 0, cache_creation: 0 }
  for (const d of filteredDaily) {
    sessions += d.sessions || 0
    messages += d.messages || 0
    tool_calls += d.tool_calls || 0
    cost += d.cost || 0
    if (d.tokens) {
      tokens.input += d.tokens.input || 0
      tokens.output += d.tokens.output || 0
      tokens.cache_read += d.tokens.cache_read || 0
      tokens.cache_creation += d.tokens.cache_creation || 0
    }
  }
  return { total_sessions: sessions, total_messages: messages, total_tool_calls: tool_calls, total_tokens: tokens, total_cost: cost, days_active: filteredDaily.length }
}

function aggregateToWeekly(dailyData) {
  const weeks = {}
  for (const d of dailyData) {
    const dt = new Date(d.date + 'T00:00:00')
    const day = dt.getDay()
    const monday = new Date(dt)
    monday.setDate(dt.getDate() - ((day + 6) % 7))
    const weekKey = monday.toISOString().slice(0, 10)
    if (!weeks[weekKey]) weeks[weekKey] = { date: weekKey, sessions: 0, messages: 0, tool_calls: 0, cost: 0 }
    weeks[weekKey].sessions += d.sessions || 0
    weeks[weekKey].messages += d.messages || 0
    weeks[weekKey].tool_calls += d.tool_calls || 0
    weeks[weekKey].cost += d.cost || 0
  }
  return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date))
}

function aggregateToMonthly(dailyData) {
  const months = {}
  for (const d of dailyData) {
    const monthKey = d.date.slice(0, 7)
    if (!months[monthKey]) months[monthKey] = { date: monthKey, sessions: 0, messages: 0, tool_calls: 0, cost: 0 }
    months[monthKey].sessions += d.sessions || 0
    months[monthKey].messages += d.messages || 0
    months[monthKey].tool_calls += d.tool_calls || 0
    months[monthKey].cost += d.cost || 0
  }
  return Object.values(months).sort((a, b) => a.date.localeCompare(b.date))
}

function MetricRow({ name, value, isMobile }) {
  return (
    <div style={styles.metric}>
      <span style={isMobile ? styles.metricNameMobile : styles.metricName}>{name}</span>
      <span style={isMobile ? styles.metricValueMobile : styles.metricValue}>{value}</span>
    </div>
  )
}

function BarChart({ data, labelKey, valueKey, color = 'var(--accent)', maxItems }) {
  const items = maxItems ? data.slice(-maxItems) : data
  const max = Math.max(...items.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {items.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span title={typeof d[labelKey] === 'string' ? d[labelKey] : undefined} style={{
            fontSize: '11px', color: 'var(--text-secondary)',
            width: '100px', flexShrink: 0, textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {d[labelKey]}
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

function LineChart({ data, labelKey, valueKey, color = 'var(--accent)', height = 160, formatFn = formatNum }) {
  const [hover, setHover] = useState(null)
  if (!data || data.length === 0) return null

  const values = data.map(d => d[valueKey] || 0)
  const max = Math.max(...values, 1)
  const pad = { top: 20, right: 12, bottom: 28, left: 44 }

  // Pick ~5 evenly spaced x-axis labels
  const labelCount = Math.min(data.length, 6)
  const labelIndices = data.length <= labelCount
    ? data.map((_, i) => i)
    : Array.from({ length: labelCount }, (_, i) => Math.round(i * (data.length - 1) / (labelCount - 1)))

  // Y-axis: 4 ticks
  const yTicks = Array.from({ length: 4 }, (_, i) => Math.round(max * (1 - i / 3)))

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 500 ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {yTicks.map((v, i) => {
          const y = pad.top + ((max - v) / max) * (height - pad.top - pad.bottom)
          return (
            <g key={i}>
              <line x1={pad.left} x2={500 - pad.right} y1={y} y2={y}
                stroke="var(--border)" strokeWidth="0.5" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end"
                fill="var(--text-secondary)" fontSize="9" fontFamily="inherit">
                {formatNum(v)}
              </text>
            </g>
          )
        })}

        {/* Area fill */}
        {data.length > 1 && (
          <path
            d={(() => {
              const w = 500 - pad.left - pad.right
              const h = height - pad.top - pad.bottom
              const points = data.map((d, i) => {
                const x = pad.left + (i / (data.length - 1)) * w
                const y = pad.top + ((max - (d[valueKey] || 0)) / max) * h
                return `${x},${y}`
              })
              return `M${points.join(' L')} L${pad.left + w},${pad.top + h} L${pad.left},${pad.top + h} Z`
            })()}
            fill={color}
            opacity="0.08"
          />
        )}

        {/* Line */}
        {data.length > 1 && (
          <polyline
            points={data.map((d, i) => {
              const w = 500 - pad.left - pad.right
              const h = height - pad.top - pad.bottom
              const x = pad.left + (i / (data.length - 1)) * w
              const y = pad.top + ((max - (d[valueKey] || 0)) / max) * h
              return `${x},${y}`
            }).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Data points (dots) */}
        {data.map((d, i) => {
          const w = 500 - pad.left - pad.right
          const h = height - pad.top - pad.bottom
          const x = pad.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w)
          const y = pad.top + ((max - (d[valueKey] || 0)) / max) * h
          return (
            <circle key={i} cx={x} cy={y}
              r={hover === i ? 4 : (data.length <= 14 ? 2.5 : 0)}
              fill={color} stroke="var(--bg-primary)" strokeWidth="1.5"
            />
          )
        })}

        {/* Hover zones (invisible rects for mouse detection) */}
        {data.map((d, i) => {
          const w = 500 - pad.left - pad.right
          const slotW = w / data.length
          const x = pad.left + i * slotW
          return (
            <rect key={`h${i}`} x={x} y={pad.top} width={slotW} height={height - pad.top - pad.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          )
        })}

        {/* Hover indicator */}
        {hover !== null && (() => {
          const w = 500 - pad.left - pad.right
          const h = height - pad.top - pad.bottom
          const x = pad.left + (data.length === 1 ? w / 2 : (hover / (data.length - 1)) * w)
          const y = pad.top + ((max - (data[hover][valueKey] || 0)) / max) * h
          return (
            <g>
              <line x1={x} x2={x} y1={pad.top} y2={pad.top + h}
                stroke="var(--text-secondary)" strokeWidth="0.5" strokeDasharray="3,3" />
              <circle cx={x} cy={y} r="4" fill={color} stroke="var(--bg-primary)" strokeWidth="2" />
            </g>
          )
        })()}

        {/* X-axis labels */}
        {labelIndices.map(i => {
          const w = 500 - pad.left - pad.right
          const x = pad.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w)
          return (
            <text key={`x${i}`} x={x} y={height - 6} textAnchor="middle"
              fill="var(--text-secondary)" fontSize="9" fontFamily="inherit">
              {shortDate(data[i][labelKey])}
            </text>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hover !== null && (
        <div style={{
          position: 'absolute', top: '4px',
          right: '8px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '11px',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>{data[hover][labelKey]}</span>
          {' '}
          <strong>{formatFn(data[hover][valueKey])}</strong>
        </div>
      )}
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
    { label: 'Est. Cost', thisVal: this_week.cost, lastVal: last_week.cost, pct: change_pct.cost, isCost: true },
  ]

  return (
    <div style={styles.cardWide}>
      <div style={styles.cardTitle}>This Week vs Last Week</div>
      <div style={{ display: 'grid', gridTemplateColumns: m ? '2fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr', gap: m ? '6px 4px' : '4px', fontSize: m ? '13px' : '11px' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}></span>
        <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>This</span>
        <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>Last</span>
        <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>Change</span>
        {rows.map(r => (
          <>
            <span key={`l-${r.label}`} style={{ color: r.isCost ? '#f59e0b' : 'var(--text-secondary)' }}>{r.label}</span>
            <span key={`t-${r.label}`} style={{ textAlign: 'right', fontWeight: 600, color: r.isCost ? '#f59e0b' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{r.isCost ? formatCost(r.thisVal) : formatNum(r.thisVal)}</span>
            <span key={`p-${r.label}`} style={{ textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{r.isCost ? formatCost(r.lastVal) : formatNum(r.lastVal)}</span>
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
  const [timeRange, setTimeRange] = useState('all')
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

  const { overview: allTimeOverview, daily, by_project, by_model, by_hour, comparison } = data
  const rangeConfig = TIME_RANGES.find(r => r.key === timeRange)

  // Filter and aggregate based on selected time range
  const filteredDaily = filterDailyByRange(daily, timeRange)

  const handleExportCSV = () => {
    const rows = filteredDaily.map(d => [
      d.date,
      d.sessions || 0,
      d.messages || 0,
      d.tool_calls || 0,
      (d.cost || 0).toFixed(4),
      d.tokens?.input || 0,
      d.tokens?.output || 0,
      d.tokens?.cache_read || 0,
      d.tokens?.cache_creation || 0,
    ])
    const header = 'date,sessions,messages,tool_calls,cost,tokens_input,tokens_output,tokens_cache_read,tokens_cache_creation'
    const csv = header + '\n' + rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `switchboard-usage-${timeRange}-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  // Always compute from daily data for consistency across ranges
  // (backend overview counts files; daily sums count session-days which can differ)
  const rangeOverview = computeOverviewFromDaily(filteredDaily)

  // Adaptive chart granularity (fill date gaps for daily views)
  let chartData, chartLabel
  if (timeRange === '7d' || timeRange === '30d') {
    chartData = fillDailyGaps(filteredDaily)
    chartLabel = 'Daily Activity'
  } else if (timeRange === '90d') {
    chartData = aggregateToWeekly(filteredDaily)
    chartLabel = 'Weekly Activity'
  } else {
    chartData = fillDailyGaps(filteredDaily)
    chartLabel = 'Daily Activity'
  }

  const chartColor = (timeRange === '7d' || timeRange === '30d') ? 'var(--accent)' : '#8b5cf6'

  return (
    <div style={m ? styles.containerMobile : styles.container}>
      <div style={styles.header}>
        <span style={m ? styles.titleMobile : styles.title}>Usage Analytics</span>
        <div style={styles.headerRight}>
          <div style={styles.rangePills}>
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                style={{
                  ...styles.rangePill,
                  ...(timeRange === r.key ? styles.rangePillActive : {}),
                }}
                onClick={() => setTimeRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span style={styles.timestamp}>{formatDate(data.computed_at)}</span>
          <button style={styles.refreshBtn} onClick={handleExportCSV}>
            Export CSV
          </button>
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
            <div style={styles.bigNumber}>{formatNum(rangeOverview.total_sessions)}</div>
            <div style={styles.bigLabel}>{timeRange === 'all' ? 'Total Sessions' : `Sessions (${rangeConfig.label})`}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(rangeOverview.total_messages)}</div>
            <div style={styles.bigLabel}>{timeRange === 'all' ? 'Total Messages' : `Messages (${rangeConfig.label})`}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(rangeOverview.total_tool_calls)}</div>
            <div style={styles.bigLabel}>{timeRange === 'all' ? 'Tool Calls' : `Tool Calls (${rangeConfig.label})`}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{formatNum(rangeOverview.total_tokens?.output)}</div>
            <div style={styles.bigLabel}>{timeRange === 'all' ? 'Output Tokens' : `Output Tokens (${rangeConfig.label})`}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.bigNumber}>{rangeOverview.days_active}</div>
            <div style={styles.bigLabel}>Days Active</div>
          </div>
          <div style={styles.card}>
            <div style={{ ...styles.bigNumber, color: '#f59e0b' }}>{formatCost(rangeOverview.total_cost)}</div>
            <div style={styles.bigLabel}>
              {timeRange === 'all' ? 'Est. API Cost' : `Est. API Cost (${rangeConfig.label})`}
            </div>
            {data.pricing?.subscription && timeRange === '30d' && rangeOverview.total_cost > data.pricing.subscription && (
              <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                Saving {formatCost(rangeOverview.total_cost - data.pricing.subscription)} vs API
              </div>
            )}
          </div>
        </div>

        {/* All-time summary when viewing a sub-range */}
        {timeRange !== 'all' && (
          <div style={styles.allTimeSummary}>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>All Time</span>
            <span>{formatNum(allTimeOverview.total_sessions)} sessions</span>
            <span>{formatNum(allTimeOverview.total_messages)} messages</span>
            <span>{formatNum(allTimeOverview.total_tokens?.output)} output tokens</span>
            <span>{allTimeOverview.days_active} days</span>
            <span style={{ color: '#f59e0b' }}>{formatCost(allTimeOverview.total_cost)} est. cost</span>
          </div>
        )}

        {/* This week vs last week */}
        <ComparisonCard comparison={comparison} isMobile={m} />

        {/* Activity + Cost charts side by side */}
        {chartData && chartData.length > 0 && (
          <div style={m ? styles.gridMobile : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>{chartLabel}</div>
              <LineChart data={chartData} labelKey="date" valueKey="messages" color={chartColor} />
            </div>
            {chartData.some(d => d.cost > 0) && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  {chartLabel.replace('Activity', 'Cost')}
                </div>
                <LineChart data={chartData} labelKey="date" valueKey="cost" color="#f59e0b" formatFn={formatCost} />
              </div>
            )}
          </div>
        )}

        {/* By project and By model side by side */}
        <div style={m ? styles.gridMobile : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {by_project && by_project.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>By Project{timeRange !== 'all' ? ' (All Time)' : ''}</div>
              <BarChart data={by_project} labelKey="name" valueKey="messages" color="#22c55e" maxItems={10} />
            </div>
          )}

          {by_model && Object.keys(by_model).length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>By Model{timeRange !== 'all' ? ' (All Time)' : ''}</div>
              {Object.entries(by_model).map(([model, info]) => {
                const shortModel = model.replace('claude-', '').replace(/-\d{8}$/, '')
                return (
                  <div key={model} style={{ marginBottom: '8px' }}>
                    <MetricRow name={shortModel} value={formatNum(info.messages) + ' msgs'} isMobile={m} />
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span>In: {formatNum(info.tokens?.input)}</span>
                      <span>Out: {formatNum(info.tokens?.output)}</span>
                      <span>Cache: {formatNum(info.tokens?.cache_read)}</span>
                      {info.cost > 0 && <span style={{ color: '#f59e0b' }}>{formatCost(info.cost)}</span>}
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
            <div style={styles.cardTitle}>Activity by Hour (Local Time){timeRange !== 'all' ? ' — All Time' : ''}</div>
            <HourHeatmap hourCounts={by_hour} />
          </div>
        )}

        {/* Token breakdown */}
        <div style={styles.cardWide}>
          <div style={styles.cardTitle}>
            {timeRange === 'all' ? 'All-Time Token Breakdown' : `Token Breakdown (${rangeConfig.label})`}
          </div>
          <MetricRow name="Input Tokens" value={formatNum(rangeOverview.total_tokens?.input)} isMobile={m} />
          <MetricRow name="Output Tokens" value={formatNum(rangeOverview.total_tokens?.output)} isMobile={m} />
          <MetricRow name="Cache Read" value={formatNum(rangeOverview.total_tokens?.cache_read)} isMobile={m} />
          <MetricRow name="Cache Creation" value={formatNum(rangeOverview.total_tokens?.cache_creation)} isMobile={m} />
          {timeRange === 'all' && (
            <MetricRow name="Since" value={allTimeOverview.first_session || '--'} isMobile={m} />
          )}
        </div>
      </div>
    </div>
  )
}
