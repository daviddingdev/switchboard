import { useEffect, useRef } from 'react'

export default function useKeyboardShortcuts(keyMap) {
  const keyMapRef = useRef(keyMap)
  keyMapRef.current = keyMap

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const callback = keyMapRef.current[e.key]
      if (callback) {
        e.preventDefault()
        callback(e)
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
