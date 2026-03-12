const styles = {
  container: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'stretch',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    padding: '10px 0',
    minHeight: '52px',
  },
  tabActive: {
    color: 'var(--accent)',
  },
  icon: {
    fontSize: '22px',
    lineHeight: 1,
  },
  label: {
    letterSpacing: '0.3px',
  },
}

const sections = [
  { id: 'workers', icon: '⚡', label: 'Workers' },
  { id: 'files', icon: '📁', label: 'Files' },
  { id: 'activity', icon: '●', label: 'Activity' },
  { id: 'monitor', icon: '📊', label: 'Monitor' },
  { id: 'usage', icon: '📈', label: 'Usage' },
]

export default function MobileNav({ activeSection, onSectionChange }) {
  return (
    <nav style={styles.container}>
      {sections.map(s => (
        <button
          key={s.id}
          style={{
            ...styles.tab,
            ...(activeSection === s.id ? styles.tabActive : {}),
          }}
          onClick={() => onSectionChange(s.id)}
        >
          <span style={styles.icon}>{s.icon}</span>
          <span style={styles.label}>{s.label}</span>
        </button>
      ))}
    </nav>
  )
}
