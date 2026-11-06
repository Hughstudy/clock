import { describe, expect, it } from 'vitest'
import { advanceScenePlayback, emptyScenePlayback, scenePlaybackNeedsFrame, type ScenePlaybackInput } from './scene-playback'
import { scenePace } from './scene-pacing'
import { sampleScenePose } from './scene-pose'

const input = (patch: Partial<ScenePlaybackInput> = {}): ScenePlaybackInput => ({ key: 'session-a', progress: 0, mode: 'run', handlingMs: 2600, action: null, ...patch })
describe('scene presentation playback', () => {
  it('smooths precise host progress without inventing elapsed time or overshooting', () => {
    let cursor = advanceScenePlayback(emptyScenePlayback(), input(), 0)
    for (let index = 0; index < 100; index++) {
      const previous = cursor.progress
      cursor = advanceScenePlayback(cursor, input({ progress: 0.0047 }), 16)
      expect(cursor.progress).toBeGreaterThanOrEqual(previous)
      expect(cursor.progress).toBeLessThanOrEqual(0.0047)
    }
    expect(cursor.progress).toBe(0.0047)
    expect(scenePlaybackNeedsFrame(cursor, input({ progress: 0.0047 }))).toBe(false)
    expect(advanceScenePlayback(cursor, input({ progress: 0.002 }), 16).progress).toBe(0.002)
  })
  it('freezes a supported action during pause/touch and settles its remaining path without replay', () => {
    const action = { id: 'begin-a', kind: 'open' as const, durationMs: 1120 }
    let cursor = advanceScenePlayback(emptyScenePlayback(), input({ action }), 0)
    for (let index = 0; index < 20; index++) cursor = advanceScenePlayback(cursor, input({ action }), 16)
    const held = advanceScenePlayback(cursor, input({ mode: 'hold' }), 1000)
    expect(held).toBe(cursor)
    expect(scenePlaybackNeedsFrame(held, input({ mode: 'hold' }))).toBe(false)
    const resumed = advanceScenePlayback(held, input(), 16)
    expect(resumed.actionProgress).toBeGreaterThan(held.actionProgress)
    for (let index = 0; index < 100; index++) cursor = advanceScenePlayback(cursor, input(), 16)
    expect(cursor.actionKind).toBe('idle')
    expect(advanceScenePlayback(cursor, input({ action }), 16).actionKind).toBe('idle')
  })
  it('settles hidden/static/attention states immediately and resets on session replacement', () => {
    const action = { id: 'old', kind: 'beat' as const, durationMs: 1120 }
    const active = advanceScenePlayback(emptyScenePlayback(), input({ action }), 16)
    const settled = advanceScenePlayback(active, input({ mode: 'settle', progress: 0.7 }), 10000)
    expect(settled).toMatchObject({ progress: 0.7, actionKind: 'idle' })
    expect(advanceScenePlayback(settled, input({ progress: 0.7, action }), 16).actionKind).toBe('idle')
    expect(advanceScenePlayback(active, input({ key: 'session-b', progress: 0.2 }), 0)).toMatchObject({ key: 'session-b', progress: 0.2, actionId: null, actionKind: 'idle' })
  })
  it('bounds malformed fractions and large local frame gaps', () => {
    expect(advanceScenePlayback(emptyScenePlayback(), input({ progress: Infinity }), 0).progress).toBe(0)
    expect(advanceScenePlayback(emptyScenePlayback(), input({ progress: 2 }), 0).progress).toBe(1)
    let cursor = advanceScenePlayback(emptyScenePlayback(), input({ action: { id: 'beat', kind: 'beat', durationMs: 1120 } }), 0)
    cursor = advanceScenePlayback(cursor, input(), 60000)
    expect(cursor.actionProgress).toBeCloseTo(64 / 1120)
  })
  it('starts an ending from the current sip cursor, including a paused sip', () => {
    const sip = { id: 'sip', kind: 'beat' as const, durationMs: 1120 }
    let cursor = advanceScenePlayback(emptyScenePlayback(), input({ action: sip }), 0)
    for (let index = 0; index < 35; index++) cursor = advanceScenePlayback(cursor, input({ action: sip }), 16)
    const held = advanceScenePlayback(cursor, input({ mode: 'hold' }), 0)
    const action = { id: 'end', kind: 'ending' as const, durationMs: 1600 }
    for (const previous of [cursor, held]) {
      let ending = advanceScenePlayback(previous, input({ action }), 0)
      expect(ending).toMatchObject({ actionKind: 'ending', actionProgress: 0, endingFromActionProgress: previous.actionProgress })
      expect(advanceScenePlayback(ending, input({ mode: 'hold' }), 16)).toBe(ending)
      for (let index = 0; index < 110; index++) ending = advanceScenePlayback(ending, input({ action }), 16)
      expect(ending.actionKind).toBe('idle')
      expect(advanceScenePlayback(ending, input({ action }), 16).actionKind).toBe('idle')
      expect(advanceScenePlayback(ending, input({ key: 'next' }), 0).endingFromActionProgress).toBe(0)
    }
  })
  it('settles fresh host progress on recovery before allowing further motion', () => {
    const hidden = advanceScenePlayback(emptyScenePlayback(), input({ progress: 0.2, mode: 'settle' }), 0)
    const recovery = advanceScenePlayback(hidden, input({ progress: 0.8, mode: 'settle' }), 0)
    const visible = advanceScenePlayback(recovery, input({ progress: 0.8 }), 16)
    expect(visible).toMatchObject({ progress: 0.8, activityProgress: 0.75, actionKind: 'idle' })
    expect(scenePlaybackNeedsFrame(visible, input({ progress: 0.8 }))).toBe(false)
  })
  it('plays handling in a finite interval only after an achieved progress landmark', () => {
    let cursor = advanceScenePlayback(emptyScenePlayback(), input(), 0)
    cursor = advanceScenePlayback(cursor, input({ progress: 0.399 }), 16)
    expect(cursor.activityProgress).toBe(0)
    cursor = advanceScenePlayback(cursor, input({ progress: 0.4 }), 16)
    expect(cursor.activityProgress).toBeGreaterThan(0)
    expect(cursor.activityProgress).toBeLessThan(0.4)
    for (let i = 0; i < 170; i++) cursor = advanceScenePlayback(cursor, input({ progress: 0.4 }), 16)
    expect(cursor.activityProgress).toBe(0.4)
    expect(scenePlaybackNeedsFrame(cursor, input({ progress: 0.4 }))).toBe(false)
    const restored = advanceScenePlayback(emptyScenePlayback(), input({ progress: 0.8 }), 0)
    expect(restored.activityProgress).toBe(0.75)
    expect(restored.actionKind).toBe('idle')
  })
  it('paints a running session\'s small progress steps at once, so the scene can rest between them', () => {
    let cursor = advanceScenePlayback(emptyScenePlayback(), input({ progress: 0.2 }), 0)
    // A 25-minute session advances about 0.00017 per 250 ms countdown refresh.
    cursor = advanceScenePlayback(cursor, input({ progress: 0.20017 }), 0)
    expect(cursor.progress).toBe(0.20017)
    expect(scenePlaybackNeedsFrame(cursor, input({ progress: 0.20017 }))).toBe(false)
  })
  it('paces handling by the hands\' travel without changing where it starts or ends', () => {
    const pace = scenePace('F3')
    expect(pace(0.75, 1, 0)).toBe(0.75)
    expect(pace(0.75, 1, 1)).toBeCloseTo(1, 6)
    let previous = 0.75, peakPaced = 0, peakPlain = 0
    const palms = (a: number) => { const f = sampleScenePose({ id: 'F3', status: 'running', progress: 1, activityProgress: a, actionKind: 'idle', actionProgress: 1 }); return [f.left.palm.x, f.left.palm.y] }
    for (let i = 1; i <= 240; i++) {
      const u = i / 240, eased = u * u * (3 - 2 * u), prevU = (i - 1) / 240, prevEased = prevU * prevU * (3 - 2 * prevU)
      const paced = pace(0.75, 1, eased)
      expect(paced).toBeGreaterThanOrEqual(previous - 1e-9)
      const [ax, ay] = palms(paced), [bx, by] = palms(previous)
      peakPaced = Math.max(peakPaced, Math.hypot(ax! - bx!, ay! - by!))
      const [cx, cy] = palms(0.75 + 0.25 * eased), [dx, dy] = palms(0.75 + 0.25 * prevEased)
      peakPlain = Math.max(peakPlain, Math.hypot(cx! - dx!, cy! - dy!))
      previous = paced
    }
    expect(peakPaced).toBeLessThan(peakPlain / 3)
    // A span without hand travel keeps the plain eased cursor.
    expect(scenePace('F2')(0, 0.4, 0.5)).toBeCloseTo(0.2, 6)
  })
})
