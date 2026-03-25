import { useState } from 'react'
import { completeSetup, applyGlobalConfig } from '../api'

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
    width: '520px',
    maxWidth: '100%',
    maxHeight: '90dvh',
    overflowY: 'auto',
  },
  stepIndicator: {
    textAlign: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    letterSpacing: '0.5px',
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
  infoBox: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '16px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginTop: '24px',
    padding: '14px 16px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  },
  checkbox: {
    marginTop: '2px',
    flexShrink: 0,
    accentColor: 'var(--accent)',
  },
  checkboxLabel: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
  },
  checkboxHint: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    lineHeight: '1.4',
  },
  sectionHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--border)',
  },
}

const TOTAL_STEPS = 4

const CLAUDE_PROMPT = `Help me write a SOUL.md working style document. Ask me 5-10 questions about how I like to work with AI coding assistants, then draft a SOUL.md based on my answers.`

const PORTS_CMD = `lsof -iTCP -sTCP:LISTEN -nP | awk '{print $9, $1}' | sort -u`

const SOUL_DEFAULT = `## Session Naming
First message is always the session name in format \`repo_name session_number\`
(e.g., "switchboard 2"). This is just a label \u2014 not a command or question.
Ignore it as content.

## Working Style
Be concise and direct. Push back when I'm overcomplicating things. Default to
simple solutions. When I ask for architecture, give me the tradeoffs honestly
\u2014 don't just agree with my first idea.`

const INFRA_DEFAULT = `## Ports
- 5001: Switchboard
- 3000: Switchboard dev server (when running npm run dev)

## Services
- Switchboard: manages Claude Code sessions

## Machine
- OS: `

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
  const [contributor, setContributor] = useState(false)
  const [soul, setSoul] = useState(SOUL_DEFAULT)
  const [infrastructure, setInfrastructure] = useState(INFRA_DEFAULT)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  // Track whether user explicitly skipped (vs Continue with content)
  const [soulSkipped, setSoulSkipped] = useState(false)
  const [infraSkipped, setInfraSkipped] = useState(false)
  const [scanOutput, setScanOutput] = useState('')
  // Global config apply state
  const [soulApplied, setSoulApplied] = useState(false)
  const [infraApplied, setInfraApplied] = useState(false)
  const [applyError, setApplyError] = useState(null)

  const renderStepIndicator = () => (
    <div style={styles.stepIndicator}>
      Step {step + 1} of {TOTAL_STEPS}
    </div>
  )

  // Step 0: Password
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

  // Step 1: SOUL.md — Continue saves content, Skip creates nothing
  const handleSoulContinue = () => {
    setSoulSkipped(false)
    setError(null)
    setStep(2)
  }

  const handleSoulSkip = () => {
    setSoulSkipped(true)
    setError(null)
    setStep(2)
  }

  // Step 2: INFRASTRUCTURE.md — Continue saves content, Skip creates nothing
  const handleInfraContinue = () => {
    setInfraSkipped(false)
    setError(null)
    submitSetup(false)
  }

  const handleInfraSkip = () => {
    setInfraSkipped(true)
    setError(null)
    submitSetup(true)
  }

  const submitSetup = async (skipInfra) => {
    setLoading(true)
    setError(null)
    const sendSoul = soulSkipped ? '' : soul
    let sendInfra = skipInfra ? '' : infrastructure
    // Append scan output if provided
    if (sendInfra && scanOutput.trim()) {
      sendInfra += '\n\n## Port Scan Output\n```\n' + scanOutput.trim() + '\n```'
    }
    try {
      const res = await completeSetup(password, sendSoul, sendInfra, contributor)
      setResult({
        hasPassword: !!password,
        hasSoul: !!sendSoul,
        hasInfra: !!sendInfra,
        soulPath: res.soul_path || null,
        infrastructurePath: res.infrastructure_path || null,
        projectRoot: res.project_root || null,
      })
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 0: Password + Contributor
  if (step === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {renderStepIndicator()}
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

          <div style={styles.checkboxRow}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={contributor}
              onChange={(e) => setContributor(e.target.checked)}
              id="contributor-check"
            />
            <label htmlFor="contributor-check" style={{ cursor: 'pointer' }}>
              <div style={styles.checkboxLabel}>
                Yes, I'm a contributor to Switchboard
              </div>
              <div style={styles.checkboxHint}>
                Shows Switchboard in the project list so you can spawn Claude Code sessions
                to work on its codebase. Most users should leave this unchecked.
              </div>
            </label>
          </div>

          {error && <div style={{ ...styles.error, marginTop: '12px' }}>{error}</div>}

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

  // Step 1: SOUL.md — pre-filled with defaults
  if (step === 1) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {renderStepIndicator()}
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
            autoFocus
          />

          <div style={styles.tipBox}>
            <div style={styles.tipLabel}>Tip</div>
            <div style={styles.tipText}>
              Edit the defaults above, or start fresh. Want help? Start a Claude Code session and paste this prompt:
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
            <button style={styles.skipBtn} onClick={handleSoulSkip}>
              Skip — don't create SOUL.md
            </button>
            <button style={styles.primaryBtn} onClick={handleSoulContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: INFRASTRUCTURE.md — pre-filled with defaults + scan paste
  if (step === 2) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {renderStepIndicator()}
          <div style={styles.title}>Infrastructure Map</div>
          <div style={styles.subtitle}>
            This creates an INFRASTRUCTURE.md file that documents your development
            environment — ports in use, services running, machine details. Claude Code
            sessions reference this to avoid port conflicts and understand your setup.
          </div>

          <div style={styles.sectionHeader}>Current Template</div>
          <textarea
            style={styles.textarea}
            value={infrastructure}
            onChange={(e) => setInfrastructure(e.target.value)}
            autoFocus
          />

          <div style={{ ...styles.sectionHeader, marginTop: '20px' }}>Quick Scan (optional)</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
            Paste the output of a port scan to help fill in your infrastructure:
          </div>
          <div style={styles.codeBlock}>
            <CopyButton text={PORTS_CMD} />
            {PORTS_CMD}
          </div>
          <textarea
            style={{ ...styles.textarea, minHeight: '80px', marginTop: '8px' }}
            value={scanOutput}
            onChange={(e) => setScanOutput(e.target.value)}
            placeholder="Paste command output here..."
          />
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
            When you paste output here, it gets appended to your Infrastructure file under a "Port Scan" section. You can edit everything in the template above.
          </div>

          <div style={styles.tipBox}>
            <div style={styles.tipText}>
              Or ask Claude Code: "Scan my system for listening ports and services,
              then help me write an INFRASTRUCTURE.md documenting what's running."
            </div>
          </div>

          {error && <div style={{ ...styles.error, marginTop: '12px' }}>{error}</div>}

          <div style={styles.buttonRow}>
            <button
              style={styles.skipBtn}
              onClick={handleInfraSkip}
              disabled={loading}
            >
              Skip — don't create file
            </button>
            <button
              style={{ ...styles.primaryBtn, opacity: loading ? 0.5 : 1 }}
              onClick={handleInfraContinue}
              disabled={loading}
            >
              {loading ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Done
  const handleApplyGlobal = async (type) => {
    setApplyError(null)
    try {
      const res = await applyGlobalConfig(
        type === 'soul' || type === 'both' ? result.soulPath : null,
        type === 'infrastructure' || type === 'both' ? result.infrastructurePath : null,
      )
      if (res.applied.includes('soul')) setSoulApplied(true)
      if (res.applied.includes('infrastructure')) setInfraApplied(true)
      // If nothing was applied (already existed), still mark as done
      if (type === 'soul' && !res.applied.includes('soul')) setSoulApplied(true)
      if (type === 'infrastructure' && !res.applied.includes('infrastructure')) setInfraApplied(true)
      if (type === 'both') {
        setSoulApplied(true)
        setInfraApplied(true)
      }
    } catch (err) {
      setApplyError(err.message)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {renderStepIndicator()}
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
          <div style={styles.checkItem}>
            <span style={{ ...styles.checkIcon, color: result?.hasInfra ? 'var(--success)' : 'var(--text-secondary)' }}>
              {result?.hasInfra ? '\u2713' : '\u2717'}
            </span>
            {result?.hasInfra ? 'INFRASTRUCTURE.md created' : 'No infrastructure map (can add later)'}
          </div>
        </div>

        {result?.hasSoul && result.soulPath && (
          <div style={{ ...styles.tipBox, marginTop: '20px' }}>
            <div style={styles.sectionHeader}>Apply Working Style Globally</div>
            {soulApplied ? (
              <div style={{ ...styles.checkItem, marginTop: '8px', marginBottom: 0 }}>
                <span style={{ ...styles.checkIcon, color: 'var(--success)' }}>{'\u2713'}</span>
                Reference added to ~/.claude/CLAUDE.md
              </div>
            ) : (
              <>
                <div style={styles.tipText}>
                  To make all Claude Code sessions use your working style, add a reference to your global Claude config.
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                  This will append to ~/.claude/CLAUDE.md:{'\n'}
                  Read and follow {result.soulPath} for working style guidance.
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button style={{ ...styles.primaryBtn, fontSize: '13px', padding: '8px 16px' }} onClick={() => handleApplyGlobal('soul')}>
                    Apply to Global Config
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>or skip — do this manually later</span>
                </div>
              </>
            )}
          </div>
        )}

        {result?.hasInfra && result.infrastructurePath && (
          <div style={{ ...styles.tipBox, marginTop: '12px' }}>
            <div style={styles.sectionHeader}>Apply Infrastructure Globally</div>
            {infraApplied ? (
              <div style={{ ...styles.checkItem, marginTop: '8px', marginBottom: 0 }}>
                <span style={{ ...styles.checkIcon, color: 'var(--success)' }}>{'\u2713'}</span>
                Reference added to ~/.claude/CLAUDE.md
              </div>
            ) : (
              <>
                <div style={styles.tipText}>
                  To make all sessions aware of your environment, add a reference to your global Claude config.
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                  This will append to ~/.claude/CLAUDE.md:{'\n'}
                  Read {result.infrastructurePath} for environment details.
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button style={{ ...styles.primaryBtn, fontSize: '13px', padding: '8px 16px' }} onClick={() => handleApplyGlobal('infrastructure')}>
                    Apply to Global Config
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>or skip — do this manually later</span>
                </div>
              </>
            )}
          </div>
        )}

        {applyError && <div style={{ ...styles.error, marginTop: '12px' }}>{applyError}</div>}

        <div style={styles.nextSteps}>
          <strong style={{ color: 'var(--text-primary)' }}>What's next:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>Click <strong>+Spawn</strong> to start your first Claude Code session</li>
            <li>Projects are auto-discovered from folders with CLAUDE.md files</li>
            <li>Browse files, track git changes, and monitor system health from the sidebar</li>
          </ul>
        </div>

        <div style={styles.infoBox}>
          <strong style={{ color: 'var(--text-primary)' }}>Git & GitHub:</strong> Switchboard
          reads git status from each project's own repository. The Activity panel shows changes
          and unpushed commits for any project that has a git remote configured. No additional
          GitHub setup is needed — if your projects can <code>git push</code>, the Push button works.
        </div>

        <div style={{ ...styles.buttonRow, justifyContent: 'flex-end' }}>
          <button style={styles.primaryBtn} onClick={onComplete}>
            Launch Switchboard
          </button>
        </div>
      </div>
    </div>
  )
}
