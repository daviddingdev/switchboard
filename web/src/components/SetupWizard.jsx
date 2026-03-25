import { useState, useRef } from 'react'
import { completeSetup } from '../api'

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100dvh',
    background: 'var(--bg-primary)',
    padding: '16px',
  },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '40px 36px',
    width: '480px',
    maxWidth: '100%',
    maxHeight: '90dvh',
    overflowY: 'auto',
  },
  steps: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '32px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--border)',
    transition: 'background 0.2s',
  },
  dotActive: {
    background: 'var(--accent)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '32px',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '15px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '12px',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '180px',
    lineHeight: '1.5',
    fontFamily: 'inherit',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '28px',
    gap: '12px',
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '10px 16px',
  },
  primaryBtn: {
    padding: '10px 24px',
    fontSize: '15px',
    fontWeight: 600,
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    minWidth: '120px',
  },
  error: {
    fontSize: '13px',
    color: 'var(--danger)',
    marginBottom: '12px',
    textAlign: 'center',
  },
  tipBox: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px 16px',
    marginTop: '16px',
  },
  tipLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tipText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  codeBlock: {
    position: 'relative',
    background: 'var(--bg-primary)',
    borderRadius: '6px',
    padding: '12px 14px',
    fontSize: '12px',
    lineHeight: '1.5',
    color: 'var(--text-primary)',
    fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginTop: '8px',
  },
  copyBtn: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    padding: '3px 8px',
    cursor: 'pointer',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  checkIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  nextSteps: {
    marginTop: '24px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
  },
}

const CLAUDE_PROMPT = `Help me write a SOUL.md working style document. Ask me 5-10 questions about how I like to work with AI coding assistants, then draft a SOUL.md based on my answers.`

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button style={styles.copyBtn} onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [soul, setSoul] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const passwordRef = useRef(null)

  const totalSteps = 3

  // Step 0: Welcome + Password
  const handlePasswordContinue = () => {
    if (password && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setStep(1)
  }

  const handlePasswordSkip = () => {
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setStep(1)
  }

  // Step 1: SOUL.md
  const handleSoulContinue = () => {
    setError(null)
    submitSetup(password, soul)
  }

  const handleSoulSkip = () => {
    setSoul('')
    setError(null)
    submitSetup(password, '')
  }

  const submitSetup = async (pw, soulContent) => {
    setLoading(true)
    setError(null)
    try {
      const res = await completeSetup(pw, soulContent)
      setResult({
        hasPassword: !!pw,
        hasSoul: !!soulContent,
        soulPath: res.soul_path || null,
      })
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderDots = () => (
    <div style={styles.steps}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          style={{ ...styles.dot, ...(i === step ? styles.dotActive : {}) }}
        />
      ))}
    </div>
  )

  if (step === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {renderDots()}
          <div style={styles.title}>Welcome to Switchboard</div>
          <div style={styles.subtitle}>
            Manage AI coding agents across all your projects from one dashboard.
          </div>

          <label style={styles.label}>
            Set a password to protect your dashboard
          </label>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Anyone on your network could access it otherwise.
          </div>

          <input
            ref={passwordRef}
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          <input
            style={styles.input}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordContinue() }}
          />

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.buttonRow}>
            <button style={styles.skipBtn} onClick={handlePasswordSkip}>
              Skip — I'm on a private network
            </button>
            <button style={styles.primaryBtn} onClick={handlePasswordContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {renderDots()}
          <div style={styles.title}>Define Your Working Style</div>
          <div style={styles.subtitle}>
            This creates a SOUL.md file that shapes how Claude Code sessions
            behave — your preferences for tone, detail level, coding style, and
            how Claude should collaborate with you.
          </div>

          <textarea
            style={styles.textarea}
            value={soul}
            onChange={(e) => setSoul(e.target.value)}
            placeholder={'Example: Be concise and direct. Prefer Python. Push back when I\'m overcomplicating things. Default to simple solutions. When I ask for architecture, give me the tradeoffs honestly — don\'t just agree with my first idea.'}
            autoFocus
          />

          <div style={styles.tipBox}>
            <div style={styles.tipLabel}>Tip</div>
            <div style={styles.tipText}>
              Not sure what to write? Start a Claude Code session and paste this prompt:
            </div>
            <div style={styles.codeBlock}>
              <CopyButton text={CLAUDE_PROMPT} />
              {CLAUDE_PROMPT}
            </div>
            <div style={{ ...styles.tipText, marginTop: '8px', marginBottom: 0 }}>
              Paste the result back here.
            </div>
          </div>

          {error && <div style={{ ...styles.error, marginTop: '12px' }}>{error}</div>}

          <div style={styles.buttonRow}>
            <button
              style={styles.skipBtn}
              onClick={handleSoulSkip}
              disabled={loading}
            >
              Skip for now
            </button>
            <button
              style={{ ...styles.primaryBtn, opacity: loading ? 0.5 : 1 }}
              onClick={handleSoulContinue}
              disabled={loading}
            >
              {loading ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Done
  const globalCmd = result?.soulPath
    ? `echo 'Read and follow ${result.soulPath} for working style guidance.' >> ~/.claude/CLAUDE.md`
    : null

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {renderDots()}
        <div style={styles.title}>You're all set!</div>

        <div style={{ marginTop: '24px', marginBottom: '24px' }}>
          <div style={styles.checkItem}>
            <span style={{ ...styles.checkIcon, color: result?.hasPassword ? 'var(--success)' : 'var(--text-secondary)' }}>
              {result?.hasPassword ? '\u2713' : '\u2717'}
            </span>
            {result?.hasPassword ? 'Password configured' : 'No password (open access)'}
          </div>
          <div style={styles.checkItem}>
            <span style={{ ...styles.checkIcon, color: result?.hasSoul ? 'var(--success)' : 'var(--text-secondary)' }}>
              {result?.hasSoul ? '\u2713' : '\u2717'}
            </span>
            {result?.hasSoul ? 'SOUL.md created' : 'No working style (can add later)'}
          </div>
        </div>

        <div style={styles.nextSteps}>
          <strong style={{ color: 'var(--text-primary)' }}>What's next:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>Click <strong>+Spawn</strong> to start your first Claude Code session</li>
            <li>Projects are auto-discovered from folders with CLAUDE.md files</li>
            <li>Browse files, track git changes, and monitor system health from the sidebar</li>
          </ul>
        </div>

        {result?.hasSoul && globalCmd && (
          <div style={{ ...styles.tipBox, marginTop: '20px' }}>
            <div style={styles.tipLabel}>Apply globally</div>
            <div style={styles.tipText}>
              To use your working style in all Claude Code sessions, run this in any terminal:
            </div>
            <div style={styles.codeBlock}>
              <CopyButton text={globalCmd} />
              {globalCmd}
            </div>
            <div style={{ ...styles.tipText, marginTop: '8px', marginBottom: 0 }}>
              Or ask Claude Code: "Add a reference to {result.soulPath} in my global CLAUDE.md so all sessions use my working style."
            </div>
          </div>
        )}

        <div style={{ ...styles.buttonRow, justifyContent: 'flex-end' }}>
          <button style={styles.primaryBtn} onClick={onComplete}>
            Launch Switchboard
          </button>
        </div>
      </div>
    </div>
  )
}
