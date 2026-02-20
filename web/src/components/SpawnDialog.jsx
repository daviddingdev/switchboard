import { useState } from 'react'
import { spawnProcess } from '../api'

// Known project directories - click to auto-fill
const PROJECTS = [
  { name: 'family-vault', directory: '~/family-vault', description: 'Document search for family business' },
  { name: 'research', directory: '~/research', description: 'Paper discovery pipeline' },
  { name: 'hbs-cases', directory: '~/hbs-cases', description: 'Case study practice' },
  { name: 'services', directory: '~/services', description: 'Service scripts' },
]

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialog: {
    background: 'var(--bg-secondary)',
    borderRadius: '12px',
    padding: '24px',
    width: '440px',
    maxWidth: '90vw',
    border: '1px solid var(--border)',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  subtitle: {
    margin: '0 0 20px 0',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  section: {
    marginBottom: '20px',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
  },
  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  projectButton: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  projectButtonSelected: {
    borderColor: 'var(--accent)',
    background: 'rgba(59, 130, 246, 0.1)',
  },
  projectName: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '2px',
    color: 'var(--text-primary)',
  },
  projectDir: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '16px 0',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border)',
  },
  field: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '6px',
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  cancelButton: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '14px',
  },
  spawnButton: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
  },
  error: {
    color: 'var(--danger)',
    fontSize: '14px',
    marginTop: '12px',
  },
}

export default function SpawnDialog({ onClose, onSpawned }) {
  const [name, setName] = useState('')
  const [directory, setDirectory] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleProjectClick = (project) => {
    setSelectedProject(project.name)
    setName(project.name)
    setDirectory(project.directory)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!directory.trim()) {
      setError('Directory is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await spawnProcess(name.trim(), directory.trim())
      onSpawned()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.dialog}>
        <h2 style={styles.title}>Spawn Worker</h2>
        <p style={styles.subtitle}>Start a Claude Code session in a project directory</p>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Projects</div>
          <div style={styles.projectGrid}>
            {PROJECTS.map(project => (
              <button
                key={project.name}
                type="button"
                style={{
                  ...styles.projectButton,
                  ...(selectedProject === project.name ? styles.projectButtonSelected : {}),
                }}
                onClick={() => handleProjectClick(project)}
              >
                <div style={styles.projectName}>{project.name}</div>
                <div style={styles.projectDir}>{project.directory}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span>or custom</span>
          <div style={styles.dividerLine} />
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Worker Name</label>
            <input
              style={styles.input}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSelectedProject(null)
              }}
              placeholder="e.g., my-project"
            />
            <div style={styles.hint}>Identifier shown in process list (not permanent)</div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Directory</label>
            <input
              style={styles.input}
              type="text"
              value={directory}
              onChange={(e) => {
                setDirectory(e.target.value)
                setSelectedProject(null)
              }}
              placeholder="~/path/to/project"
            />
            <div style={styles.hint}>Where Claude Code will run</div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.buttons}>
            <button type="button" style={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              style={{
                ...styles.spawnButton,
                opacity: loading || !name.trim() || !directory.trim() ? 0.5 : 1,
              }}
              disabled={loading || !name.trim() || !directory.trim()}
            >
              {loading ? 'Spawning...' : 'Spawn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
