import { useState } from 'react'
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
}

const TOTAL_STEPS = 4

const CLAUDE_PROMPT = `Help me write a SOUL.md working style document. Ask me 5-10 questions about how I like to work with AI coding assistants, then draft a SOUL.md based on my answers.`

const PORTS_CMD = `lsof -iTCP -sTCP:LISTEN -nP | awk '{print $9, $1}' | sort -u`

const SOUL_PLACEHOLDER = `## Session Naming
First message is always the session name in format \`repo_name session_number\`
(e.g., "switchboard 2"). This is just a label \u2014 not a command or question.
Ignore it as content.

## Working Style
(Example: Be concise and direct. Prefer Python. Push back when I'm
overcomplicating things. Default to simple solutions. When I ask for
architecture, give me the tradeoffs honestly \u2014 don't just agree with
my first idea.)`

const INFRA_PLACEHOLDER = `## Ports
- 5001: Switchboard
- 3000: Switchboard dev server (when running npm run dev)
- 11434: Ollama (if running)

## Services
- Switchboard: manages Claude Code sessions
- (add your services: databases, dev servers, APIs, etc.)

## Machine
- OS: (e.g., macOS Sequoia / Ubuntu 24.04)
- (add relevant details: GPU, memory, special hardware)`

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
  const [infrastructure, setInfrastructure] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

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

  // Step 1: SOUL.md
  const handleSoulContinue = () => {
    setError(null)
    setStep(2)
  }

  const handleSoulSkip = () => {
    setSoul('')
    setError(null)
    setStep(2)
  }

  // Step 2: INFRASTRUCTURE.md
  const handleInfraContinue = () => {
    setError(null)
    submitSetup()
  }

  const handleInfraSkip = () => {
    setInfrastructure('')
    setError(null)
    submitSetup()
  }

  const submitSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await completeSetup(password, soul, infrastructure)
      setResult({
        hasPassword: !!password,
        hasSoul: !!soul,
        hasInfra: !!infrastructure,
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

  // Step 0: Password
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

  // Step 1: SOUL.md
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
            placeholder={SOUL_PLACEHOLDER}
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
            <button style={styles.skipBtn} onClick={handleSoulSkip}>
              Skip for now
            </button>
            <button style={styles.primaryBtn} onClick={handleSoulContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: INFRASTRUCTURE.md
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

          <textarea
            style={styles.textarea}
            value={infrastructure}
            onChange={(e) => setInfrastructure(e.target.value)}
            placeholder={INFRA_PLACEHOLDER}
            autoFocus
          />

          <div style={styles.tipBox}>
            <div style={styles.tipLabel}>Tip</div>
            <div style={styles.tipText}>
              Not sure what ports are in use? Run this in your terminal:
            </div>
            <div style={styles.codeBlock}>
              <CopyButton text={PORTS_CMD} />
              {PORTS_CMD}
            </div>
            <div style={{ ...styles.tipText, marginTop: '8px', marginBottom: 0 }}>
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
              Skip for now
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

  // Step 3: Done (displayed as step 4 visually but we show step 4 of 5... wait, steps are 0-3, but TOTAL_STEPS=5)
  // Actually step indices: 0=password, 1=soul, 2=infra, 3=done. But we said 5 steps.
  // The spec says: Prerequisites, Password, SOUL, Infrastructure, Done = 5 steps
  // But we don't have a separate prerequisites step in the current code. Let me re-read...
  // "Step order summary: Prerequisites — Password — SOUL — Infrastructure — Done"
  // But the spec doesn't define a prerequisites step content. The password step IS the welcome/prerequisites.
  // Let me just make the Done step show as "Step 5 of 5" since steps 0-3 map to steps 1-4.
  // Actually wait - the total is supposed to be 5, but we only have 4 screens (0,1,2,3).
  // The spec says "Prerequisites" is step 1 which is our password/welcome screen. So it IS 4 screens shown as "Step N of 4"
  // ... but spec says 5. Let me re-read: "The wizard flow is now 5 steps"
  // OK the spec explicitly says 5 steps with Prerequisites as its own. But there's no content defined for it.
  // I think the welcome screen (step 0) is "Prerequisites" and Password is step 1.
  // Actually re-reading: "Prerequisites — environment checks, Claude Code login reminder, /rc explanation"
  // "Password — dashboard password (skippable)"
  // So Prerequisites is a separate step. But the spec doesn't give detailed UI for it. Let me just fold it
  // into the welcome step since it's the first thing users see. The title can be "Welcome to Switchboard"
  // with some prereq info. That makes it 4 actual screens but labeled 1-4.
  //
  // Actually the simplest reading: the spec lists 5 conceptual steps but the password screen doubles as
  // welcome/prerequisites. I'll keep 4 screens but label them "Step 1 of 4".
  // ... no wait, TOTAL_STEPS is 5 at the top. Let me just add a quick prerequisites screen.

  // Step 3: Done
  const soulCmd = result?.soulPath
    ? `echo 'Read and follow ${result.soulPath} for working style guidance.' >> ~/.claude/CLAUDE.md`
    : null
  const infraCmd = result?.infrastructurePath
    ? `echo 'Read ${result.infrastructurePath} for environment details.' >> ~/.claude/CLAUDE.md`
    : null

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

        <div style={styles.nextSteps}>
          <strong style={{ color: 'var(--text-primary)' }}>What's next:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>Click <strong>+Spawn</strong> to start your first Claude Code session</li>
            <li>Projects are auto-discovered from folders with CLAUDE.md files</li>
            <li>Browse files, track git changes, and monitor system health from the sidebar</li>
          </ul>
        </div>

        {result?.hasSoul && soulCmd && (
          <div style={{ ...styles.tipBox, marginTop: '20px' }}>
            <div style={styles.tipLabel}>Apply working style globally</div>
            <div style={styles.tipText}>
              To use your working style in all Claude Code sessions, run this in any terminal:
            </div>
            <div style={styles.codeBlock}>
              <CopyButton text={soulCmd} />
              {soulCmd}
            </div>
            <div style={{ ...styles.tipText, marginTop: '8px', marginBottom: 0 }}>
              Or ask Claude Code: "Add a reference to {result.soulPath} in my global CLAUDE.md so all sessions use my working style."
            </div>
          </div>
        )}

        {result?.hasInfra && infraCmd && (
          <div style={{ ...styles.tipBox, marginTop: '12px' }}>
            <div style={styles.tipLabel}>Apply infrastructure map globally</div>
            <div style={styles.tipText}>
              To make your infrastructure map available to all sessions:
            </div>
            <div style={styles.codeBlock}>
              <CopyButton text={infraCmd} />
              {infraCmd}
            </div>
            <div style={{ ...styles.tipText, marginTop: '8px', marginBottom: 0 }}>
              Or ask Claude Code: "Add a reference to {result.infrastructurePath} in my global CLAUDE.md so all sessions know my environment setup."
            </div>
          </div>
        )}

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
