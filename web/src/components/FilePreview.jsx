import { useEffect, useState, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import css from 'highlight.js/lib/languages/css'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github-dark.css'
import { fetchFileContent } from '../api'

// Register languages
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('css', css)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('html', xml)

const styles = {
  container: {
    height: '100%',
    overflow: 'auto',
    background: 'var(--bg-primary)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--danger)',
    fontSize: '14px',
  },
  pre: {
    margin: 0,
    padding: '16px',
    background: 'transparent',
  },
  code: {
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  lineNumbers: {
    display: 'flex',
  },
  numbers: {
    color: 'var(--text-secondary)',
    textAlign: 'right',
    paddingRight: '16px',
    userSelect: 'none',
    borderRight: '1px solid var(--border)',
    marginRight: '16px',
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
}

export default function FilePreview({ filepath, isMobile }) {
  const [content, setContent] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const codeRef = useRef(null)

  useEffect(() => {
    if (!filepath) return

    setLoading(true)
    setError(null)

    fetchFileContent(filepath)
      .then(data => {
        setContent(data.content)
        setLanguage(data.language || 'plaintext')
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [filepath])

  useEffect(() => {
    if (codeRef.current && content && language !== 'plaintext') {
      try {
        hljs.highlightElement(codeRef.current)
      } catch (e) {
        // Language not supported, leave as plain text
      }
    }
  }, [content, language])

  if (loading) {
    return <div style={styles.loading}>Loading...</div>
  }

  if (error) {
    return <div style={styles.error}>{error}</div>
  }

  // Count actual lines (don't count trailing empty line from final newline)
  const lines = content.split('\n')
  const lineCount = content.endsWith('\n') ? lines.length - 1 : lines.length

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filepath.split('/').pop()
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px 0' }}>
        <button
          onClick={handleDownload}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Download
        </button>
      </div>
      <pre style={styles.pre}>
        <div style={styles.lineNumbers}>
          {!isMobile && (
            <div style={styles.numbers}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <code
            ref={codeRef}
            style={{
              ...styles.code,
              ...(isMobile ? { fontSize: '12px' } : {}),
            }}
            className={`language-${language}`}
          >
            {content}
          </code>
        </div>
      </pre>
    </div>
  )
}
