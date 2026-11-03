import { useEffect, useRef } from 'react'
import { spec } from '../data/spec'

/** Retires a success message after its reading time, but never from under keyboard focus. */
export function useStatusExpiry(key: string | null, expire: () => void) {
  const latest = useRef(expire)
  latest.current = expire
  useEffect(() => {
    if (!key) return
    let waiting: number
    const check = () => {
      if (document.activeElement?.closest('[data-status-actions]')) waiting = window.setTimeout(check, spec.thoughts.statusVisibleMs)
      else latest.current()
    }
    waiting = window.setTimeout(check, spec.thoughts.statusVisibleMs)
    return () => window.clearTimeout(waiting)
  }, [key])
}
