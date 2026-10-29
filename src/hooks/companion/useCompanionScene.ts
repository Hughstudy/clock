import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanionScene } from '../../contracts/presentation'
import { sceneMotionSpec } from '../../data/scene-motion'
import { emptySceneMotion, finishSceneMotion, nextSceneMotion, sceneBeatDelay, sceneCanMove, sceneMotionDuration, startSceneBeat } from '../../logic/scene-motion'

interface Options { staticOnly: boolean; touching: boolean }

/** Local scene choreography only. No timer, saved-result or reward callbacks. */
export function useCompanionScene(scene: CompanionScene | null | undefined, { staticOnly, touching }: Options) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const conditions = useMemo(() => ({ staticOnly, touching, visible }), [staticOnly, touching, visible])
  const [motion, setMotion] = useState(() => nextSceneMotion(emptySceneMotion(), scene, conditions))
  const key = scene?.key ?? null
  const status = scene?.status
  const allowBeats = scene?.allowBeats
  const cueId = scene?.cue?.id
  const cueKind = scene?.cue?.kind
  const cueSession = scene?.cue?.sessionId
  const endingCueId = scene?.ending?.cueId
  const tier = scene?.ending?.tier

  // Primitive dependencies keep countdown rerenders from restarting a sequence.
  useEffect(() => {
    setMotion(previous => nextSceneMotion(previous, scene, conditions))
  }, [key, status, allowBeats, cueId, cueKind, cueSession, endingCueId, conditions])

  const finish = useCallback((id?: string) => setMotion(previous => finishSceneMotion(previous, id)), [])
  useEffect(() => {
    const hidden = () => { setVisible(!document.hidden); if (document.hidden) finish() }
    const hide = () => { setVisible(false); finish() }
    const show = () => { setVisible(!document.hidden) }
    const cancel = () => finish()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    window.addEventListener('blur', hide)
    window.addEventListener('focus', show)
    window.addEventListener('resize', cancel)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      window.removeEventListener('blur', hide)
      window.removeEventListener('focus', show)
      window.removeEventListener('resize', cancel)
    }
  }, [finish])

  const current = nextSceneMotion(motion, scene, conditions)
  const active = current.active
  const moving = sceneCanMove(scene, conditions)
  const ambientAllowed = moving && status === 'running' && !active

  useEffect(() => {
    if (!active || !scene) return
    // Always settle even when CSS animationend is absent or the styles change.
    const timer = window.setTimeout(() => finish(active.id), sceneMotionDuration(active.kind, scene, sceneMotionSpec) + 100)
    return () => window.clearTimeout(timer)
  }, [active?.id, active?.kind, key, tier, finish])

  useEffect(() => {
    if (!ambientAllowed || !key) return
    // A cancelled wait is dropped. Returning from typing/backgrounding starts
    // a new quiet interval, never a catch-up burst of missed beats.
    const timer = window.setTimeout(() => setMotion(previous => startSceneBeat(previous, key)), sceneBeatDelay(key, motion.beatIndex, sceneMotionSpec))
    return () => window.clearTimeout(timer)
  }, [ambientAllowed, key, motion.beatIndex])

  return {
    phase: active?.kind ?? 'idle' as const,
    motionId: active?.id ?? '',
    beatIndex: active?.kind === 'beat' ? active.beatIndex : motion.beatIndex,
    durationMs: active && scene ? sceneMotionDuration(active.kind, scene, sceneMotionSpec) : 0,
    finish,
    ambientAllowed,
  }
}
