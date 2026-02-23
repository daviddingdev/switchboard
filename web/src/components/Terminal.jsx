import { useState, useEffect, useRef } from 'react'
import { getOutput } from '../api'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0d1117',
    borderRadius: '6px',
    overflow: 'hidden',
    minHeight: 0,
    border: '1px solid #30363d',
  },
  output: {
    flex: 1,
    padding: '12px 14px',
    fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Monaco, Consolas, monospace',
    fontSize: '12px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'auto',
    color: '#e6edf3',
    scrollbarWidth: 'thin',
    scrollbarColor: '#30363d #0d1117',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8b949e',
    fontSize: '13px',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8b949e',
    fontSize: '13px',
  },
}

// Basic ANSI color support
function parseAnsi(text) {
  // Strip most ANSI codes but keep basic structure
  return text
    .replace(/\x1b\[[0-9;]*m/g, '') // Remove color codes
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // Remove other ANSI escapes
}

// Extract preview blocks from output
// Format: :::PREVIEW:Title:language::: content :::/PREVIEW:::
const PREVIEW_PATTERN = /:::PREVIEW:([^:]+)(?::([^:]+))?:::([\s\S]*?):::\/PREVIEW:::/

// Global set to track seen previews across all Terminal instances
const globalSeenPreviews = new Set()

function extractPreviews(text) {
  const previews = []
  let remaining = text
  let cleanedText = text

  // Find all preview blocks
  let match
  while ((match = PREVIEW_PATTERN.exec(remaining)) !== null) {
    const fullMatch = match[0]
    previews.push({
      title: match[1],
      language: match[2] || 'markdown',
      content: match[3].trim(),
      key: fullMatch
    })
    // Remove this match from remaining to find next
    remaining = remaining.slice(match.index + fullMatch.length)
    // Replace in cleaned text
    cleanedText = cleanedText.replace(fullMatch, `[Preview: ${match[1]}]`)
  }

  return { previews, cleanedText }
}

export default function Terminal({ workerName, fullHeight = false, onPreview }) {
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(true)
  const outputRef = useRef(null)
  const wasAtBottomRef = useRef(true)

  useEffect(() => {
    if (!workerName) return

    setLoading(true)
    let mounted = true

    const fetchOutput = async () => {
      try {
        const data = await getOutput(workerName, 200)
        if (mounted) {
          if (outputRef.current) {
            const el = outputRef.current
            wasAtBottomRef.current = el.scrollHeight - el.scrollTop <= el.clientHeight + 50
          }

          const rawOutput = parseAnsi(data.output || '')
          const { previews, cleanedText } = extractPreviews(rawOutput)

          // Open preview tabs for new previews (use global set for deduplication)
          if (onPreview) {
            for (const preview of previews) {
              if (!globalSeenPreviews.has(preview.key)) {
                globalSeenPreviews.add(preview.key)
                onPreview(preview.content, preview.title, preview.language)
              }
            }
          }

          setOutput(cleanedText)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setOutput(`Error: ${err.message}`)
          setLoading(false)
        }
      }
    }

    fetchOutput()
    const interval = setInterval(fetchOutput, 500)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [workerName, onPreview])

  useEffect(() => {
    if (outputRef.current && wasAtBottomRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const containerStyle = {
    ...styles.container,
    ...(fullHeight && { height: '100%' }),
  }

  if (!workerName) {
    return (
      <div style={containerStyle}>
        <div style={styles.empty}>Select a worker to view output</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div ref={outputRef} style={styles.output}>
        {output || '(no output)'}
      </div>
    </div>
  )
}
