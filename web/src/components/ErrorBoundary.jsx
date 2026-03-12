import { Component } from 'react'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px 20px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    textAlign: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
  },
  message: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    maxWidth: '400px',
    lineHeight: 1.5,
  },
  button: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '8px',
  },
  details: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
    padding: '12px 16px',
    borderRadius: '8px',
    maxWidth: '500px',
    overflow: 'auto',
    textAlign: 'left',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    marginTop: '8px',
  },
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={styles.container}>
        <div style={styles.title}>Something went wrong</div>
        <div style={styles.message}>
          The UI encountered an error. This usually fixes itself with a reload.
        </div>
        <button
          style={styles.button}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
        {this.state.error && (
          <div style={styles.details}>
            {this.state.error.message || String(this.state.error)}
          </div>
        )}
      </div>
    )
  }
}
