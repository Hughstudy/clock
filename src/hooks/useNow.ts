import { useCallback, useEffect, useState } from 'react'
import { nowMs } from '../adapters/calendar'
import { onAppResume } from '../adapters/lifecycle'

/**
 * Re-renders every `intervalMs` with the current time. The interval only
 * refreshes the screen; timer state is always computed from deadlines.
 */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(nowMs)
  const refresh = useCallback(() => setNow(nowMs()), [])
  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, intervalMs)
    const stopResume = onAppResume(refresh)
    return () => {
      window.clearInterval(id)
      stopResume()
    }
  }, [intervalMs, refresh])
  return { now, refresh }
}
