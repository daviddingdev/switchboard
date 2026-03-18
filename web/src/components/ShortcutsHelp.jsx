import { useEffect } from 'react'

const SECTIONS = [
  {
    title: 'Tab Navigation',
    shortcuts: [
      { key: 'Tab', description: 'Next tab' },
      { key: '[ / ]', description: 'Previous / next tab' },
      { key: '1–9', description: 'Jump to tab by position' },
      { key: 'w', description: 'Close active tab' },
    ],
  },
  {
    title: 'Views',
    shortcuts: [
      { key: 'n', description: 'Spawn new worker' },
      { key: 'm', description: 'Monitor view' },
      { key: 'u', description: 'Usage view' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: 'Esc', description: 'Close dialog / tab' },
      { key: '?', description: 'Show this help' },
    ],
  },
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
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '24px 28px',
    minWidth: 300,
    maxWidth: 380,
    color: 'var(--text-primary)',
  }

  const titleStyle = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 20,
  }

  const sectionTitleStyle = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-tertiary)',
    marginTop: 14,
    marginBottom: 6,
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
    fontSize: 14,
  }

  const kbdStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 600,
    borderRadius: 4,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    minWidth: 24,
    textAlign: 'center',
  }

  const descStyle = {
    color: 'var(--text-secondary)',
  }

  const hintStyle = {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid var(--border)',
    lineHeight: 1.5,
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>Keyboard Shortcuts</div>
        {SECTIONS.map((section, si) => (
          <div key={section.title}>
            <div style={{ ...sectionTitleStyle, ...(si === 0 ? { marginTop: 0 } : {}) }}>
              {section.title}
            </div>
            {section.shortcuts.map(({ key, description }) => (
              <div key={key} style={rowStyle}>
                <span style={descStyle}>{description}</span>
                <kbd style={kbdStyle}>{key}</kbd>
              </div>
            ))}
          </div>
        ))}
        <div style={hintStyle}>
          Shortcuts are disabled while typing in the terminal input.
        </div>
      </div>
    </div>
  )
}
