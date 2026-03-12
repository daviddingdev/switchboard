export default function ErrorState({ message, onRetry }) {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    color: 'var(--text-secondary)',
  }

  const iconStyle = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '2px solid #c62828',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#c62828',
    flexShrink: 0,
  }

  const messageStyle = {
    fontSize: 14,
    textAlign: 'center',
    color: 'var(--text-primary)',
    maxWidth: 320,
  }

  const buttonStyle = {
    marginTop: 4,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  }

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>!</div>
      <div style={messageStyle}>{message || 'Something went wrong'}</div>
      {onRetry && (
        <button style={buttonStyle} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
