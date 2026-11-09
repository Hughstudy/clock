import { describe, expect, it } from 'vitest'
import { approachFocusWeight, FOCUS_BEAT_LEAD_MS, FOCUS_BEAT_MS, focusBeatSchedule, focusFlipperTransform, focusPresenceNeedsFrame, focusRigTransforms, sampleFocusPresence, type FocusPresencePose } from './focus-presence'
import type { FocusAttention } from './scene-pose'

const MINUTE = 60_000
const attention: FocusAttention = { x: -1.6, y: 1.8, tilt: -1.4, lid: 0.92 }
const gaze = { x: 0, y: 0 }
const channels = ['leanDeg', 'headDeg', 'headX', 'headY', 'finsDeg', 'eyeX', 'eyeY', 'lid', 'smile', 'flipperDeg'] as const
const length = (kind: keyof typeof FOCUS_BEAT_MS) => FOCUS_BEAT_MS[kind]
const neutral = (pose: FocusPresencePose) => channels.every(channel => pose[channel] === (channel === 'lid' ? 1 : 0))

describe('focus presence follows the session clock', () => {
  it.each([1, 5, 25, 50, 120])('places one glance at the exact middle of a %i minute session', minutes => {
    const total = minutes * MINUTE
    const glances = focusBeatSchedule(total).filter(beat => beat.kind === 'glance')
    expect(glances).toHaveLength(1)
    expect(glances[0]!.startMs + length('glance') / 2).toBe(total / 2)
  })

  it.each([1, 5, 15, 25, 60, 120])('keeps every gesture separate and inside a %i minute session', minutes => {
    const total = minutes * MINUTE
    const beats = focusBeatSchedule(total)
    expect(beats[0]).toMatchObject({ kind: 'settle', startMs: 1500 })
    beats.forEach((beat, index) => {
      expect(beat.startMs).toBeGreaterThan(0)
      expect(beat.startMs + length(beat.kind)).toBeLessThanOrEqual(total - 5000)
      if (index > 0) expect(beat.startMs).toBeGreaterThan(beats[index - 1]!.startMs + length(beats[index - 1]!.kind))
    })
  })

  it('spaces a 25 minute session about three minutes apart', () => {
    const beats = focusBeatSchedule(25 * MINUTE)
    expect(beats.length).toBe(10)
    const centres = beats.slice(1).map(beat => beat.startMs + length(beat.kind) / 2)
    centres.slice(1).forEach((centre, index) => expect(centre - centres[index]!).toBeCloseTo(3 * MINUTE, 3))
  })

  it('has no schedule without a real session length', () => {
    for (const total of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(focusBeatSchedule(total)).toEqual([])
  })

  it('is a pure function of elapsed time, and holds still between gestures', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const middle = 12.5 * MINUTE
    expect(sampleFocusPresence(middle, schedule, attention, gaze)).toEqual(sampleFocusPresence(middle, schedule, attention, gaze))
    expect(neutral(sampleFocusPresence(5 * MINUTE + 12_000, schedule, attention, gaze))).toBe(true)
    expect(sampleFocusPresence(5 * MINUTE + 12_000, schedule, attention, gaze).active).toBe(false)
  })

  it('smiles at the viewer with the face turned fully back to them', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const glance = schedule.find(beat => beat.kind === 'glance')!
    const pose = sampleFocusPresence(glance.startMs + 1700, schedule, attention, gaze)
    expect(pose.smile).toBe(1)
    expect(pose.headX).toBeCloseTo(-attention.x)
    expect(pose.eyeX).toBeCloseTo(-attention.x * 0.6)
  })

  it('looks back at the viewer from wherever the eyes were', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const glance = schedule.find(beat => beat.kind === 'glance')!
    const stars = sampleFocusPresence(glance.startMs + 1700, schedule, { x: 0, y: 0, tilt: 0, lid: 1 }, { x: -2, y: -4 })
    expect(stars.eyeX).toBeCloseTo(2)
    expect(stars.eyeY).toBeCloseTo(3.7)
  })

  it('leaves the smile on a little longer than the turn of the head', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const glance = schedule.find(beat => beat.kind === 'glance')!
    const leaving = sampleFocusPresence(glance.startMs + 2800, schedule, attention, gaze)
    expect(leaving.smile).toBeGreaterThan(0)
    expect(Math.abs(leaving.eyeX)).toBeLessThan(Math.abs(leaving.headX) + 1e-9)
  })

  it.each(['settle', 'tilt', 'glance'] as const)('starts, moves and ends the %s gesture with no visible step', kind => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const beat = schedule.find(item => item.kind === kind)!
    const end = beat.startMs + length(kind)
    const stepMs = 2
    // Per millisecond, so a slow 60 Hz display still gets small steps; the blink is the fast one.
    const limits = { leanDeg: 0.01, headDeg: 0.015, headX: 0.012, headY: 0.012, finsDeg: 0.025, eyeX: 0.012, eyeY: 0.012, lid: 0.02, smile: 0.008, flipperDeg: 0.03 }
    let previous = sampleFocusPresence(beat.startMs - stepMs, schedule, attention, gaze)
    expect(neutral(previous)).toBe(true)
    for (let at = beat.startMs; at <= end + stepMs; at += stepMs) {
      const pose = sampleFocusPresence(at, schedule, attention, gaze)
      for (const channel of channels) expect(Math.abs(pose[channel] - previous[channel]) / stepMs, `${kind} ${channel} at ${at - beat.startMs}`).toBeLessThan(limits[channel])
      previous = pose
    }
    expect(neutral(previous)).toBe(true)
  })

  it('stays small enough to read as quiet', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    for (const beat of schedule) for (let t = 0; t < length(beat.kind); t += 20) {
      const pose = sampleFocusPresence(beat.startMs + t, schedule, attention, gaze)
      expect(Math.abs(pose.headDeg)).toBeLessThanOrEqual(2.4)
      expect(Math.abs(pose.leanDeg)).toBeLessThanOrEqual(0.6)
      expect(Math.abs(pose.finsDeg)).toBeLessThanOrEqual(2.7)
      expect(Math.abs(pose.flipperDeg)).toBeLessThanOrEqual(4.7)
    }
  })

  it('asks for frames only from just before a gesture until it ends', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const glance = schedule.find(beat => beat.kind === 'glance')!
    expect(focusPresenceNeedsFrame(glance.startMs - FOCUS_BEAT_LEAD_MS - 1, schedule)).toBe(false)
    expect(focusPresenceNeedsFrame(glance.startMs - FOCUS_BEAT_LEAD_MS, schedule)).toBe(true)
    expect(focusPresenceNeedsFrame(glance.startMs + length('glance') - 1, schedule)).toBe(true)
    expect(focusPresenceNeedsFrame(glance.startMs + length('glance'), schedule)).toBe(false)
    const framed = Array.from({ length: 25 * 60 * 4 }, (_, i) => focusPresenceNeedsFrame(i * 250, schedule)).filter(Boolean).length
    expect(framed / (25 * 60 * 4)).toBeLessThan(0.03)
  })

  it('fades an interrupted gesture out and back in', () => {
    let weight = 1
    for (let i = 0; i < 40; i++) {
      const next = approachFocusWeight(weight, 0, 16)
      expect(next).toBeLessThanOrEqual(weight)
      weight = next
    }
    expect(weight).toBe(0)
    expect(approachFocusWeight(0.5, 1, 0)).toBe(0.5)
  })

  it('writes finite transforms that vanish at zero weight', () => {
    const schedule = focusBeatSchedule(25 * MINUTE)
    const glance = schedule.find(beat => beat.kind === 'glance')!
    const pose = sampleFocusPresence(glance.startMs + 1700, schedule, attention, gaze)
    expect(Object.values(focusRigTransforms(pose, 1)).join(' ')).not.toMatch(/NaN|Infinity/)
    const faded = focusRigTransforms(pose, 0)
    expect(faded.head).toBe('translate(0 0) rotate(0 120 100)')
    expect(faded.mouth).toBe('translate(120.5 108) scale(1 1) translate(-120.5 -108)')
    expect(focusFlipperTransform(4, 0.5, 111, 143, -1)).toBe('rotate(-2 111 143)')
  })
})
