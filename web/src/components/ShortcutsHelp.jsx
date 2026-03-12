import { useEffect } from 'react'

const SHORTCUTS = [
  { key: 'n', description: 'Spawn new worker' },
  { key: 'm', description: 'Monitor view' },
  { key: 'u', description: 'Usage view' },
  { key: '?', description: 'Show this help' },
  { key: 'Esc', description: 'Close dialog' },
]

export default function ShortcutsHelp({ onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 12,
    padding: '24px 28px',
    minWidth: 280,
    maxWidth: 360,
    color: 'var(--text-primary)',
  }

  const titleStyle = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 14,
  }

  const kbdStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 600,
    borderRadius: 4,
    border: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    minWidth: 24,
    textAlign: 'center',
  }

  const descStyle = {
    color: 'var(--text-secondary)',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>Keyboard Shortcuts</div>
        {SHORTCUTS.map(({ key, description }) => (
          <div key={key} style={rowStyle}>
            <span style={descStyle}>{description}</span>
            <kbd style={kbdStyle}>{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  )
}
