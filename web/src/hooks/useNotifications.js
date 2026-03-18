import { useState, useEffect, useRef, useCallback } from 'react'
import socket from '../socket'
import { useToast } from '../components/Toast'

export default function useNotifications({ onViewWorker } = {}) {
  const prevWorkersRef = useRef(null)
  const prevIdleRef = useRef(new Set())
  const { addToast } = useToast()
  const [permission, setPermission] = useState(() => {
    if ('Notification' in window) return Notification.permission
    return 'unsupported'
  })

  const requestPermission = useCallback(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      setPermission('granted')
      return
    }
    if (Notification.permission === 'denied') {
      setPermission('denied')
      return
    }
    Notification.requestPermission().then(p => setPermission(p))
  }, [])

  // Listen for worker:idle events (browser notifications when page is hidden)
  useEffect(() => {
    const onIdle = (data) => {
      if (document.visibilityState === 'visible') return
      if (permission !== 'granted') return
      new Notification('Worker Idle', {
        body: `${data.name} is waiting for input`,
        tag: `idle-${data.name}`,
      })
    }

    socket.on('worker:idle', onIdle)
    return () => socket.off('worker:idle', onIdle)
  }, [permission])

  // Detect spawn/kill and idle transitions by diffing worker lists
  useEffect(() => {
    const onWorkers = (data) => {
      const workers = data || []
      const currentNames = new Set(workers.map(w => w.name))
      const currentIdle = new Set(workers.filter(w => w.idle).map(w => w.name))
      const prevNames = prevWorkersRef.current
      const prevIdle = prevIdleRef.current

      if (prevNames !== null) {
        // Spawn/kill browser notifications (only when page is hidden)
        if (document.visibilityState !== 'visible' && permission === 'granted') {
          for (const name of currentNames) {
            if (!prevNames.has(name)) {
              new Notification('Worker Spawned', {
                body: `${name} started`,
                tag: `spawn-${name}`,
              })
            }
          }
          for (const name of prevNames) {
            if (!currentNames.has(name)) {
              new Notification('Worker Stopped', {
                body: `${name} was killed`,
                tag: `kill-${name}`,
              })
            }
          }
        }

        // In-app idle transition toast (fires regardless of page visibility).
        // The "View" action opens the worker's terminal tab unconditionally —
        // if the worker is no longer idle by the time the user clicks, the tab
        // will just show its current (active) state, which is fine.
        for (const name of currentIdle) {
          if (!prevIdle.has(name)) {
            addToast(
              `${name} is idle`,
              'success',
              5000,
              onViewWorker ? () => onViewWorker(name) : undefined
            )
          }
        }
      }

      prevWorkersRef.current = currentNames
      prevIdleRef.current = currentIdle
    }

    socket.on('workers:update', onWorkers)
    return () => socket.off('workers:update', onWorkers)
  }, [permission, addToast, onViewWorker])

  return { permission, requestPermission }
}
