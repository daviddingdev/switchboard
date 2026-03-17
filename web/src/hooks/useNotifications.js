import { useEffect, useRef } from 'react'
import socket from '../socket'

export default function useNotifications() {
  const prevWorkersRef = useRef(null)
  const permissionGranted = useRef(false)

  // Request permission on first user interaction
  useEffect(() => {
    const requestOnClick = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
          permissionGranted.current = p === 'granted'
        })
      } else if ('Notification' in window) {
        permissionGranted.current = Notification.permission === 'granted'
      }
      document.removeEventListener('click', requestOnClick)
    }
    // If already granted, just set the flag
    if ('Notification' in window && Notification.permission === 'granted') {
      permissionGranted.current = true
    } else {
      document.addEventListener('click', requestOnClick)
    }
    return () => document.removeEventListener('click', requestOnClick)
  }, [])

  // Listen for worker:idle events
  useEffect(() => {
    const onIdle = (data) => {
      if (document.visibilityState === 'visible') return
      if (!permissionGranted.current) return
      new Notification('Worker Idle', {
        body: `${data.name} is waiting for input`,
        tag: `idle-${data.name}`,
      })
    }

    socket.on('worker:idle', onIdle)
    return () => socket.off('worker:idle', onIdle)
  }, [])

  // Detect spawn/kill by diffing worker lists
  useEffect(() => {
    const onWorkers = (data) => {
      if (document.visibilityState === 'visible') return
      if (!permissionGranted.current) return

      const currentNames = new Set((data || []).map(w => w.name))
      const prevNames = prevWorkersRef.current

      if (prevNames !== null) {
        // Detect new workers (spawned)
        for (const name of currentNames) {
          if (!prevNames.has(name)) {
            new Notification('Worker Spawned', {
              body: `${name} started`,
              tag: `spawn-${name}`,
            })
          }
        }
        // Detect removed workers (killed)
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
  }, [])
}
