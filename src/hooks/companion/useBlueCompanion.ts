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
  const finish = useCallback(() => setMotion(previous => previous.active ? { ...previous, active: null } : previous), [])
  const active = !staticOnly && motion.active && motion.active.id === cueId && motion.active.cue === cue && motion.active.stance === stance ? motion.active : null
  return { spec: blueCompanionSpec, sketch, active, finish }
}
