import { useEffect, useState } from 'react'
import { onAppHide } from '../../adapters/lifecycle'
import type { RecordsBand } from '../../logic/record-stories'

/** A mount is one deliberate visit. Clock changes and interruptions consume its entrance. */
export function useRecordsEntrance(band: RecordsBand, enabled: boolean): boolean {
  const [entranceBand, setEntranceBand] = useState<RecordsBand | null>(() =>
    enabled && typeof document !== 'undefined' && document.visibilityState === 'visible' ? band : null)
  const playing = enabled && entranceBand === band
  useEffect(() => {
    if (entranceBand === null) return
    const settle = () => setEntranceBand(null)
    if (!playing) { settle(); return }
    const stopOnHide = onAppHide(settle)
    const inputs = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const
    for (const event of inputs) document.addEventListener(event, settle, { capture: true, passive: true })
    const timeout = window.setTimeout(settle, 2000)
    return () => {
      stopOnHide()
      window.clearTimeout(timeout)
      for (const event of inputs) document.removeEventListener(event, settle, true)
    }
  }, [entranceBand, playing])
  return playing
}
