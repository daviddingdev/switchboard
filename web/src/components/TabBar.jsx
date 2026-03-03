const styles = {
  container: {
    display: 'flex',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    height: '35px',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    cursor: 'pointer',
    borderRight: '1px solid var(--border)',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    maxWidth: '180px',
  },
  tabActive: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--bg-primary)',
    marginBottom: '-1px',
  },
  tabIcon: {
    fontSize: '10px',
    flexShrink: 0,
  },
  tabIconTerminal: {
    color: 'var(--success)',
  },
  tabLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 6px',
    fontSize: '14px',
    lineHeight: 1,
    marginLeft: '4px',
    borderRadius: '3px',
    flexShrink: 0,
    minWidth: '24px',
    minHeight: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

export default function TabBar({ tabs, activeTab, onTabSelect, onTabClose }) {
  return (
    <div style={styles.container}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          style={{
            ...styles.tab,
            ...(activeTab === tab.id ? styles.tabActive : {}),
          }}
          onClick={() => onTabSelect(tab.id)}
        >
          <span style={{
            ...styles.tabIcon,
            ...(tab.type === 'terminal' ? styles.tabIconTerminal : {}),
            ...(tab.type === 'diff' ? { color: 'var(--warning)' } : {}),
            ...(tab.type === 'push' ? { color: 'var(--accent)' } : {}),
            ...(tab.type === 'commit' ? { color: 'var(--success)' } : {}),
            ...(tab.type === 'preview' ? { color: 'var(--accent)' } : {})
          }}>
            {tab.type === 'terminal' ? '●' : tab.type === 'diff' ? '±' : tab.type === 'push' ? '⬆' : tab.type === 'commit' ? '✓' : tab.type === 'history' ? '💬' : tab.type === 'preview' ? '👁' : tab.type === 'monitor' ? '📊' : tab.type === 'usage' ? '📈' : '📄'}
          </span>
          <span style={styles.tabLabel}>{tab.label}</span>
          {(tab.type === 'file' || tab.type === 'diff' || tab.type === 'push' || tab.type === 'commit' || tab.type === 'history' || tab.type === 'preview' || tab.type === 'monitor' || tab.type === 'usage' || tab.type === 'terminal') && (
            <button
              style={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
