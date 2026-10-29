import { useCallback, useEffect, useState } from 'react'
import { blueCompanionSpec } from '../../data/blue-companion'
import { nextBlueMotion, sketchBlueCompanion } from '../../logic/blue-companion'
import type { CompanionPresentation } from '../../logic/companion'

// One original drawing for the entire app lifetime; all poses reuse these exact paths.
const sketch = sketchBlueCompanion(blueCompanionSpec)

export function useBlueCompanion(presentation: CompanionPresentation, cueId?: string) {
  const { cue, stance, staticOnly } = presentation
  const [motion, setMotion] = useState(() => nextBlueMotion({ seenId: null, active: null }, presentation, cueId))
  useEffect(() => {
    setMotion(previous => nextBlueMotion(previous, { cue, stance, staticOnly }, cueId))
  }, [cue, stance, staticOnly, cueId])
  // A late CSS event must not finish a newer gesture. The timeout also covers
  // removed styles and browsers that never deliver animationend.
  const finish = useCallback((id?: string) => setMotion(previous => previous.active && (!id || previous.active.id === id)
    ? { ...previous, active: null } : previous), [])
  useEffect(() => {
    const cancel = () => finish()
    const visibility = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
    }
  }, [finish])
  useEffect(() => {
    if (!motion.active) return
    if (document.hidden) { finish(motion.active.id); return }
    const { id, cue: activeCue } = motion.active
    const timing = activeCue === 'begin' ? blueCompanionSpec.motion.beginMs
      : activeCue === 'settle' ? blueCompanionSpec.motion.settleMs : blueCompanionSpec.motion.greetingMs
    const timer = window.setTimeout(() => finish(id), timing + 100)
    return () => window.clearTimeout(timer)
  }, [motion.active, finish])
  const active = !staticOnly && motion.active && motion.active.id === cueId && motion.active.cue === cue && motion.active.stance === stance ? motion.active : null
  return { spec: blueCompanionSpec, sketch, active, finish }
}
