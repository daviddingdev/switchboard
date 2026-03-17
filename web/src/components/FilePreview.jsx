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
import { fetchFileContent, saveFile } from '../api'

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
    WebkitOverflowScrolling: 'touch',
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
    whiteSpace: 'pre',
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
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px 0',
  },
  toolbarBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  unsaved: {
    fontSize: '11px',
    color: '#f59e0b',
    fontWeight: 500,
  },
  textarea: {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: '13px',
    lineHeight: 1.6,
    padding: '16px',
    boxSizing: 'border-box',
  },
}

export default function FilePreview({ filepath, isMobile }) {
  const [content, setContent] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const codeRef = useRef(null)

  const dirty = editing && editContent !== content

  useEffect(() => {
    if (!filepath) return

    setLoading(true)
    setError(null)
    setEditing(false)

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
    if (codeRef.current && content && language !== 'plaintext' && !editing) {
      try {
        hljs.highlightElement(codeRef.current)
      } catch (e) {
        // Language not supported, leave as plain text
      }
    }
  }, [content, language, editing])

  const handleEdit = () => {
    setEditContent(content)
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
    setEditContent('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveFile(filepath, editContent)
      setContent(editContent)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

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
      <div style={styles.toolbar}>
        {editing ? (
          <>
            {dirty && <span style={styles.unsaved}>Unsaved</span>}
            <button
              style={{ ...styles.saveBtn, opacity: saving ? 0.5 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button style={styles.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button style={styles.toolbarBtn} onClick={handleEdit}>
              Edit
            </button>
            <button style={styles.toolbarBtn} onClick={handleDownload}>
              Download
            </button>
          </>
        )}
      </div>
      {editing ? (
        <textarea
          style={{
            ...styles.textarea,
            ...(isMobile ? { fontSize: '12px' } : {}),
          }}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          spellCheck={false}
        />
      ) : (
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
      )}
    </div>
  )
}
