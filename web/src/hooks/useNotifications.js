import { useState, useEffect, useRef, useCallback } from 'react'
import socket from '../socket'

export default function useNotifications() {
  const prevWorkersRef = useRef(null)
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

  // Listen for worker:idle events
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

  // Detect spawn/kill by diffing worker lists
  useEffect(() => {
    const onWorkers = (data) => {
      if (document.visibilityState === 'visible') return
      if (permission !== 'granted') return

      const currentNames = new Set((data || []).map(w => w.name))
      const prevNames = prevWorkersRef.current

      if (prevNames !== null) {
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

      prevWorkersRef.current = currentNames
    }

    socket.on('workers:update', onWorkers)
    return () => socket.off('workers:update', onWorkers)
  }, [permission])

  return { permission, requestPermission }
}
