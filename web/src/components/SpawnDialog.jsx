import { useState, useEffect } from 'react'
import { spawnProcess, fetchProjects, fetchModels, initProject } from '../api'

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
    maxHeight: '90vh',
    overflow: 'auto',
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
    overflow: 'hidden',
    minWidth: 0,
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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    direction: 'rtl',
    textAlign: 'left',
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

export default function SpawnDialog({ onClose, onSpawned, isMobile }) {
  const [projects, setProjects] = useState([])
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [name, setName] = useState('')
  const [directory, setDirectory] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProjectDir, setNewProjectDir] = useState('')
  const [addingProject, setAddingProject] = useState(false)

  const loadProjects = () => {
    fetchProjects()
      .then(data => {
        const all = data.projects || data
        const showSelf = data.show_self || false
        setProjects(showSelf ? all : all.filter(p => !p.is_self))
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadProjects()
    fetchModels()
      .then(data => {
        const models = data.models || []
        setModels(models)
        setModel(data.default || (models.length > 0 ? models[0].id : ''))
      })
      .catch(() => {})
  }, [])

  const handleAddProject = async () => {
    if (!newProjectDir.trim()) return
    setAddingProject(true)
    setError(null)
    try {
      const result = await initProject(newProjectDir.trim())
      loadProjects()
      setShowAddProject(false)
      setNewProjectDir('')
      // Auto-select the new project
      setSelectedProject(result.name)
      setName(result.name)
      setDirectory(result.directory)
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingProject(false)
    }
  }

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
      await spawnProcess(name.trim(), directory.trim(), model || undefined)
      onSpawned()
      onClose()
    } catch (err) {
      setError(err.message)
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
          {projects.length === 0 ? (
            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>No projects found</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '12px' }}>
                Switchboard discovers projects by looking for folders with a <code>CLAUDE.md</code> file in your project root.
              </div>
              <button
                type="button"
                style={{ ...styles.cancelButton, fontSize: '12px', padding: '6px 12px' }}
                onClick={loadProjects}
              >
                Check again
              </button>
            </div>
          ) : (
            <div style={{
              ...styles.projectGrid,
              ...(isMobile ? { gridTemplateColumns: '1fr' } : {}),
            }}>
              {projects.map(project => (
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
                  <div style={styles.projectDir}>{project.relative_dir || project.directory}</div>
                </button>
              ))}
            </div>
          )}

          {/* Add a new project */}
          <div style={{ marginTop: '8px' }}>
            {!showAddProject ? (
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
                onClick={() => setShowAddProject(true)}
              >
                + Add a new project
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  style={{ ...styles.input, flex: 1, fontSize: '12px', padding: '6px 10px' }}
                  type="text"
                  value={newProjectDir}
                  onChange={(e) => setNewProjectDir(e.target.value)}
                  placeholder="~/path/to/project"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                />
                <button
                  type="button"
                  style={{ ...styles.spawnButton, fontSize: '12px', padding: '6px 12px', opacity: addingProject || !newProjectDir.trim() ? 0.5 : 1 }}
                  disabled={addingProject || !newProjectDir.trim()}
                  onClick={handleAddProject}
                >
                  {addingProject ? '...' : 'Create CLAUDE.md'}
                </button>
              </div>
            )}
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
          <div style={styles.field}>
            <label style={styles.label}>Model</label>
            <select
              style={{ ...styles.input, cursor: 'pointer' }}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
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
