import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

export const ToastContext = createContext(null)

const TYPE_COLORS = {
  success: '#2e7d32',
  error: '#c62828',
  info: '#1565c0',
}

const TYPE_DURATIONS = {
  success: 3000,
  info: 3000,
  error: 5000,
}

const MAX_TOASTS = 5

let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const addToast = useCallback(
    (message, type = 'info', duration, action) => {
      const id = ++toastIdCounter
      setToasts((prev) => {
        const next = [...prev, { id, message, type, exiting: false, action }]
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })
      const dur = duration || TYPE_DURATIONS[type] || 3000
      timersRef.current[id] = setTimeout(() => removeToast(id), dur)
      return id
    },
    [removeToast]
  )

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  const containerStyle = {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: 8,
    maxWidth: 360,
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" style={containerStyle}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }) {
  const { message, type, exiting, action } = toast

  const style = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    backgroundColor: TYPE_COLORS[type] || TYPE_COLORS.info,
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transform: exiting ? 'translateX(120%)' : 'translateX(0)',
    opacity: exiting ? 0 : 1,
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    animation: exiting ? 'none' : 'toast-slide-in 0.3s ease',
  }

  const closeStyle = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 0 0 4px',
    lineHeight: 1,
    flexShrink: 0,
  }

  const actionStyle = {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 4,
    lineHeight: 1.4,
    flexShrink: 0,
  }

  return (
    <div style={style}>
      <span>{message}</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
        {action && (
          <button style={actionStyle} onClick={() => { action(); onClose() }}>
            View
          </button>
        )}
        <button style={closeStyle} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
