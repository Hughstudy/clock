import { describe, expect, it } from 'vitest'
import type { CompanionScene } from '../contracts/presentation'
import { sceneMotionSpec } from '../data/scene-motion'
import { emptySceneMotion, finishSceneMotion, nextSceneMotion, sceneBeatDelay, sceneMotionDuration, startSceneBeat, validateSceneMotionSpec } from './scene-motion'

const enabled = { staticOnly: false, touching: false, visible: true }
const scene = (patch: Partial<CompanionScene> = {}): CompanionScene => ({
  key: 'generation:session-a:1', id: 'F1', sessionId: 'session-a', phase: 'focus', status: 'running',
  completedProgress: 0, allowBeats: true,
  cue: { id: 'begin-a', kind: 'begin', sessionId: 'session-a', thoughtId: null }, ending: null,
  ...patch,
})

describe('companion scene choreography', () => {
  it('plays only matching fresh focus/rest entrances and consumes their identity', () => {
    const first = nextSceneMotion(emptySceneMotion(), scene(), enabled)
    expect(first.active?.kind).toBe('open')
    const finished = finishSceneMotion(first, 'begin-a')
    expect(nextSceneMotion(finished, scene({ completedProgress: 0.7 }), enabled).active).toBeNull()
    const rest = scene({ id: 'R1', phase: 'break', cue: { id: 'rest-a', kind: 'rest', sessionId: 'session-a', thoughtId: null } })
    expect(nextSceneMotion(emptySceneMotion(), rest, enabled).active?.kind).toBe('open')
    expect(nextSceneMotion(emptySceneMotion(), scene({ phase: 'break' }), enabled).active).toBeNull()
    expect(nextSceneMotion(emptySceneMotion(), scene({ cue: { id: 'wrong', kind: 'begin', sessionId: 'other-session', thoughtId: null } }), enabled).active).toBeNull()
  })

  it('requires a matching saved ending descriptor and rejects stale results', () => {
    const ended = scene({ status: 'ended', ending: { cueId: 'end-a', tier: 'snack' }, cue: { id: 'end-a', kind: 'settle', sessionId: 'session-a', thoughtId: null } })
    const motion = nextSceneMotion(emptySceneMotion(), ended, enabled)
    expect(motion.active?.kind).toBe('ending')
    expect(nextSceneMotion(emptySceneMotion(), { ...ended, ending: null }, enabled).active).toBeNull()
    expect(nextSceneMotion(emptySceneMotion(), { ...ended, ending: { cueId: 'wrong', tier: 'meal' } }, enabled).active).toBeNull()
    const newSession = scene({ key: 'generation:session-b:1', sessionId: 'session-b', cue: ended.cue, ending: ended.ending })
    expect(nextSceneMotion(motion, newSession, enabled).active).toBeNull()
    const restEnd = { ...ended, id: 'R1' as const, phase: 'break' as const, ending: { cueId: 'end-a', tier: null } }
    expect(nextSceneMotion(emptySceneMotion(), restEnd, enabled).active?.kind).toBe('ending')
  })

  it('cancels on pause, static mode, touch, typing, hiding and removal without replay', () => {
    const first = nextSceneMotion(emptySceneMotion(), scene(), enabled)
    for (const conditions of [{ ...enabled, staticOnly: true }, { ...enabled, touching: true }, { ...enabled, visible: false }]) {
      const cancelled = nextSceneMotion(first, scene(), conditions)
      expect(cancelled.active).toBeNull()
      expect(nextSceneMotion(cancelled, scene(), enabled).active).toBeNull()
    }
    const paused = nextSceneMotion(first, scene({ status: 'paused' }), enabled)
    expect(paused.active).toBeNull()
    expect(nextSceneMotion(paused, scene(), enabled).active).toBeNull()
    const typing = nextSceneMotion(first, scene({ allowBeats: false }), enabled)
    expect(typing.active).toBeNull()
    expect(nextSceneMotion(typing, scene(), enabled).active).toBeNull()
    expect(nextSceneMotion(first, null, enabled).active).toBeNull()
  })

  it('consumes a cue first seen while motion is unavailable', () => {
    for (const conditions of [{ ...enabled, staticOnly: true }, { ...enabled, touching: true }, { ...enabled, visible: false }]) {
      const skipped = nextSceneMotion(emptySceneMotion(), scene(), conditions)
      expect(skipped.seenCueId).toBe('begin-a')
      expect(nextSceneMotion(skipped, scene(), enabled).active).toBeNull()
    }
  })

  it('replaces old cues and ignores obsolete completion callbacks', () => {
    const first = nextSceneMotion(emptySceneMotion(), scene(), enabled)
    const second = nextSceneMotion(first, scene({ cue: { id: 'begin-b', kind: 'begin', sessionId: 'session-a', thoughtId: null } }), enabled)
    expect(second.active?.id).toBe('begin-b')
    expect(finishSceneMotion(second, 'begin-a')).toBe(second)
    expect(finishSceneMotion(second, 'begin-b').active).toBeNull()
  })

  it('schedules sparse deterministic beats and cannot start a stale scene beat', () => {
    const idle = nextSceneMotion(emptySceneMotion(), scene({ cue: null }), enabled)
    expect(startSceneBeat(idle, 'obsolete')).toBe(idle)
    const beat = startSceneBeat(idle, scene().key)
    expect(beat.active).toMatchObject({ kind: 'beat', beatIndex: 0 })
    expect(startSceneBeat(beat, scene().key)).toBe(beat)
    const second = startSceneBeat(finishSceneMotion(beat), scene().key)
    expect(second.active?.beatIndex).toBe(1)
    expect(second.active?.id).not.toBe(beat.active?.id)
    const delays = Array.from({ length: 30 }, (_, index) => sceneBeatDelay(scene().key, index, sceneMotionSpec))
    expect(delays.every(delay => delay >= 60_000 && delay <= 90_000)).toBe(true)
    expect(new Set(delays).size).toBeGreaterThan(10)
    expect(sceneBeatDelay(scene().key, 7, sceneMotionSpec)).toBe(delays[7])
  })

  it('bounds finite motions and rejects unsafe cadence data', () => {
    expect(sceneMotionDuration('open', scene(), sceneMotionSpec)).toBe(1800)
    for (const tier of ['hello', 'snack', 'meal', 'feast', null] as const) {
      expect(sceneMotionDuration('ending', scene({ ending: { cueId: 'end', tier } }), sceneMotionSpec)).toBeLessThanOrEqual(2400)
    }
    expect(() => validateSceneMotionSpec({ ...sceneMotionSpec, beatMinMs: 500 })).toThrow()
    expect(() => validateSceneMotionSpec({ ...sceneMotionSpec, beatMaxMs: 59_000 })).toThrow()
    expect(() => validateSceneMotionSpec({ ...sceneMotionSpec, endingMs: { ...sceneMotionSpec.endingMs, feast: Infinity } })).toThrow()
  })
})
