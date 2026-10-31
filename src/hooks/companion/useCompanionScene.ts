import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CompanionScene } from '../../contracts/presentation'
import { sceneMotionSpec } from '../../data/scene-motion'
import { emptySceneMotion, finishSceneMotion, nextSceneMotion, sceneBeatDelay, sceneCanMove, sceneMotionDuration, startSceneBeat } from '../../logic/scene-motion'
import { advanceScenePlayback, emptyScenePlayback, scenePlaybackNeedsFrame, type ScenePlaybackInput } from '../../logic/scene-playback'

interface Options { staticOnly: boolean; touching: boolean; panelOpen: boolean }

/** Cancellable local presentation. It never advances the host's session fraction. */
export function useCompanionScene(scene: CompanionScene | null | undefined, { staticOnly, touching, panelOpen }: Options) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const visibility = useRef(visible)
  const [recovering, setRecovering] = useState(false)
  const conditions = useMemo(() => ({ staticOnly, touching, visible }), [staticOnly, touching, visible])
  const [motion, setMotion] = useState(() => nextSceneMotion(emptySceneMotion(), scene, conditions))
  const [playback, setPlayback] = useState(emptyScenePlayback)
  const cursor = useRef(playback)
  const lastFrameAt = useRef<number | null>(null)
  const currentScene = useRef(scene)
  currentScene.current = scene
  const key = scene?.key ?? null
  const status = scene?.status
  const allowBeats = scene?.allowBeats
  const cueId = scene?.cue?.id
  const cueKind = scene?.cue?.kind
  const cueSession = scene?.cue?.sessionId
  const endingCueId = scene?.ending?.cueId
  const tier = scene?.ending?.tier

  // Countdown updates never replace a cue or restart an action.
  useEffect(() => {
    setMotion(previous => nextSceneMotion(previous, scene, conditions))
  }, [key, status, allowBeats, cueId, cueKind, cueSession, endingCueId, conditions])

  const finish = useCallback((id?: string) => setMotion(previous => finishSceneMotion(previous, id)), [])
  const settle = useCallback(() => {
    finish()
    const latest = currentScene.current
    cursor.current = advanceScenePlayback(cursor.current, { key: latest?.key ?? null, progress: latest?.completedProgress ?? 0, action: null, mode: 'settle', handlingMs: sceneMotionSpec.handlingMs }, 0)
    setPlayback(cursor.current)
  }, [finish])
  useEffect(() => {
    const hide = () => { visibility.current = false; setVisible(false); settle() }
    // Resume listeners also refresh main-owned time. Keep the next committed
    // render static so it settles against that fresh fraction, not the stale
    // fraction captured when the page was hidden.
    const show = () => {
      if (!document.hidden && !visibility.current) {
        visibility.current = true
        setRecovering(true)
        setVisible(true)
      }
    }
    const hidden = () => { if (document.hidden) hide(); else show() }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    window.addEventListener('blur', hide)
    window.addEventListener('focus', show)
    window.addEventListener('resize', settle)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      window.removeEventListener('blur', hide)
      window.removeEventListener('focus', show)
      window.removeEventListener('resize', settle)
    }
  }, [settle])
  useEffect(() => {
    if (!recovering || !visible) return
    const frame = window.requestAnimationFrame(() => setRecovering(false))
    return () => window.cancelAnimationFrame(frame)
  }, [recovering, visible])

  const current = nextSceneMotion(motion, scene, conditions)
  const active = current.active
  const moving = sceneCanMove(scene, conditions)
  // Finite gestures no longer stop/restart independent ambient loops.
  const ambientAllowed = moving && !recovering && status === 'running'
  const durationMs = active && scene ? sceneMotionDuration(active.kind, scene, sceneMotionSpec) : 0
  const mode: ScenePlaybackInput['mode'] = !scene || staticOnly || !visible || recovering || (!allowBeats && !panelOpen) ? 'settle'
    : status === 'paused' || touching || panelOpen ? 'hold' : 'run'
  const input = useMemo<ScenePlaybackInput>(() => ({
    key, progress: scene?.completedProgress ?? 0, mode, handlingMs: sceneMotionSpec.handlingMs,
    // Hiding already consumed old cues. A new main-permitted cue arriving on
    // return starts after placement recovery instead of being consumed by it.
    action: active && !recovering ? { id: active.id, kind: active.kind, durationMs } : null,
  }), [key, scene?.completedProgress, mode, active?.id, active?.kind, durationMs, recovering])

  // A new session or an interruption starts a fresh local frame interval.
  // Ordinary host progress readings keep the last painted frame's timestamp.
  useEffect(() => { lastFrameAt.current = null }, [key, mode])
  useEffect(() => {
    let frame = 0
    cursor.current = advanceScenePlayback(cursor.current, input, 0)
    setPlayback(cursor.current)
    const step = (now: number) => {
      const delta = lastFrameAt.current === null ? 0 : now - lastFrameAt.current
      lastFrameAt.current = now
      cursor.current = advanceScenePlayback(cursor.current, input, delta)
      setPlayback(cursor.current)
      if (scenePlaybackNeedsFrame(cursor.current, input)) frame = window.requestAnimationFrame(step)
      else lastFrameAt.current = null
    }
    if (scenePlaybackNeedsFrame(cursor.current, input)) frame = window.requestAnimationFrame(step)
    else lastFrameAt.current = null
    return () => window.cancelAnimationFrame(frame)
  }, [input])

  useEffect(() => {
    if (!active || !scene || recovering) return
    // A timer is only a local fallback; it never changes a session or a record.
    const timer = window.setTimeout(() => finish(active.id), sceneMotionDuration(active.kind, scene, sceneMotionSpec) + 100)
    return () => window.clearTimeout(timer)
  }, [active?.id, active?.kind, key, tier, finish, recovering])

  useEffect(() => {
    if (!ambientAllowed || active || !key || playback.actionKind !== 'idle') return
    const timer = window.setTimeout(() => setMotion(previous => startSceneBeat(previous, key)), sceneBeatDelay(key, motion.beatIndex, sceneMotionSpec))
    return () => window.clearTimeout(timer)
  }, [ambientAllowed, active?.id, key, motion.beatIndex, playback.actionKind])

  const presented = advanceScenePlayback(playback, input, 0)
  return {
    phase: active?.kind ?? 'idle' as const,
    motionId: active?.id ?? '',
    beatIndex: active?.kind === 'beat' ? active.beatIndex : motion.beatIndex,
    durationMs, finish, ambientAllowed,
    presentedProgress: presented.progress,
    activityProgress: presented.activityProgress,
    actionProgress: presented.actionProgress,
    endingFromActionProgress: presented.endingFromActionProgress,
    sampleKind: presented.actionKind,
  }
}
