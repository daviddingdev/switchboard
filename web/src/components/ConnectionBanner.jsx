import { useState, useEffect } from 'react'
import socket from '../socket'

export default function ConnectionBanner() {
  const [status, setStatus] = useState('connected') // 'connected' | 'disconnected' | 'reconnected'

  useEffect(() => {
    const onConnect = () => {
      setStatus('reconnected')
      const timer = setTimeout(() => setStatus('connected'), 2000)
      return () => clearTimeout(timer)
    }

    const onDisconnect = () => {
      setStatus('disconnected')
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  if (status === 'connected') return null

  const isDisconnected = status === 'disconnected'

  const bannerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    zIndex: 1000,
    padding: 'calc(6px + env(safe-area-inset-top, 0px)) 0 6px',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: isDisconnected ? '#b8860b' : '#2e7d32',
    transition: 'background-color 0.3s ease, opacity 0.3s ease',
  }

  return (
    <div style={bannerStyle}>
      {isDisconnected ? 'Reconnecting...' : 'Reconnected'}
    </div>
  )
}
