import { useEffect, useState } from 'react'
import { nowMs } from '../adapters/calendar'
import { onAppResume } from '../adapters/lifecycle'

/**
 * Re-renders every `intervalMs` with the current time. The interval only
 * refreshes the screen; timer state is always computed from deadlines.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const tick = () => setNow(nowMs())
    tick()
    const id = window.setInterval(tick, intervalMs)
    const stopResume = onAppResume(tick)
    return () => {
      window.clearInterval(id)
      stopResume()
    }
  }, [intervalMs])
  return now
}
