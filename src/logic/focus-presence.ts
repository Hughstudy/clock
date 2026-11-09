import type { FocusAttention, ScenePoint } from './scene-pose'

/**
 * What the companion does across one focus session, placed on that session's own time.
 * It settles in as the session starts, keeps its eyes on the work, tilts its head or
 * adjusts a flipper now and then, and looks up with a small smile at the halfway point.
 *
 * Elapsed time is main's. Each gesture is a pure function of it, so pausing holds the
 * performance, a reload resumes it at the same place, and nothing is replayed or caught
 * up. Gestures keep real-time lengths; only where they fall scales with the session.
 */
export type FocusBeatKind = 'settle' | 'tilt' | 'glance'
export interface FocusBeat { kind: FocusBeatKind; startMs: number; side: -1 | 1 }
export interface FocusPresencePose {
  active: boolean
  leanDeg: number
  headDeg: number
  headX: number
  headY: number
  finsDeg: number
  eyeX: number
  eyeY: number
  /** Eye height relative to the resting focused pose: 1 at rest, near 0 in a blink. */
  lid: number
  smile: number
  flipperDeg: number
}

export const FOCUS_BEAT_MS = Object.freeze({ settle: 1700, tilt: 2700, glance: 3300 })
/** More than two 250 ms countdown refreshes, so frames are running before a gesture moves. */
export const FOCUS_BEAT_LEAD_MS = 600
/** The eyes turn this share as far as the face does, so a look leads with the eyes. */
export const FOCUS_EYE_SHARE = 0.6

const OPENING_MS = 1500
const OPENING_CLEAR_MS = 6000
const QUIET_ENDING_MS = 5000
const CADENCE_MIN_MS = 45_000
const CADENCE_MAX_MS = 180_000

const NEUTRAL: FocusPresencePose = Object.freeze({
  active: false, leanDeg: 0, headDeg: 0, headX: 0, headY: 0, finsDeg: 0, eyeX: 0, eyeY: 0, lid: 1, smile: 0, flipperDeg: 0,
})

/**
 * The glance sits at the exact middle. Quiet gestures spread outward from it, every
 * eighth of the session, within 45 seconds to three minutes.
 */
export function focusBeatSchedule(totalMs: number): readonly FocusBeat[] {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return []
  const lastEnd = totalMs - QUIET_ENDING_MS
  const beats: FocusBeat[] = []
  const place = (kind: FocusBeatKind, centreMs: number, side: -1 | 1) => {
    const startMs = centreMs - FOCUS_BEAT_MS[kind] / 2
    if (startMs >= OPENING_CLEAR_MS && startMs + FOCUS_BEAT_MS[kind] <= lastEnd) beats.push({ kind, startMs, side })
  }
  const middle = totalMs / 2
  const cadence = Math.min(CADENCE_MAX_MS, Math.max(CADENCE_MIN_MS, totalMs / 8))
  place('glance', middle, 1)
  for (let step = 1; step * cadence < middle; step++) {
    const kind = step % 2 === 1 ? 'tilt' : 'settle'
    place(kind, middle - step * cadence, step % 2 === 1 ? -1 : 1)
    place(kind, middle + step * cadence, step % 2 === 1 ? 1 : -1)
  }
  if (OPENING_MS + FOCUS_BEAT_MS.settle <= lastEnd) beats.push({ kind: 'settle', startMs: OPENING_MS, side: 1 })
  return beats.sort((a, b) => a.startMs - b.startMs)
}

type Keys = readonly (readonly [atMs: number, value: number])[]
/** Zero velocity and acceleration at every key: pose to pose, with slow in and slow out. */
const quintic = (u: number) => u * u * u * (u * (u * 6 - 15) + 10)
function track(keys: Keys, t: number): number {
  const first = keys[0]!
  if (t <= first[0]) return first[1]
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!
    if (t <= b[0]) {
      const a = keys[i - 1]!
      return a[1] + (b[1] - a[1]) * quintic((t - a[0]) / (b[0] - a[0]))
    }
  }
  return keys[keys.length - 1]![1]
}

const BLINK_DEPTH = 0.13
const blink = (startMs: number, t: number) => track([[startMs, 1], [startMs + 95, BLINK_DEPTH], [startMs + 140, BLINK_DEPTH], [startMs + 340, 1]], t)

/** Anticipate, eyes first, then the head; a small smile and nod; the smile leaves last. */
function glancePose(t: number, attention: FocusAttention, gaze: ScenePoint): FocusPresencePose {
  const turn = track([[0, 0], [240, -0.14], [880, 1], [2080, 1], [3200, 0]], t)
  const look = track([[0, 0], [170, -0.22], [720, 1], [1980, 1], [2820, 0]], t)
  const smile = track([[820, 0], [1340, 1], [2060, 1], [2960, 0]], t)
  const nod = track([[1500, 0], [1790, 0.7], [2090, 0]], t)
  const open = 1 / attention.lid
  return {
    ...NEUTRAL, active: true, smile,
    leanDeg: -attention.tilt * 0.22 * turn,
    headDeg: -attention.tilt * turn + 0.9 * smile * (attention.tilt >= 0 ? -1 : 1),
    headX: -attention.x * turn,
    headY: (-attention.y - 0.7) * turn + nod,
    eyeX: -(attention.x * FOCUS_EYE_SHARE + gaze.x) * look,
    eyeY: -(attention.y * FOCUS_EYE_SHARE + gaze.y + 0.3) * look,
    // A blink hides the eyes' change of direction as the head starts to turn.
    lid: track([[250, 1], [345, BLINK_DEPTH], [395, BLINK_DEPTH], [620, open], [1340, open * 0.95], [2060, open * 0.95], [2900, 1]], t),
    finsDeg: track([[100, 0], [420, 1.7], [1000, -2.6], [1360, 1], [1760, 0], [2300, 0], [2880, 2.1], [3300, 0]], t),
  }
}

function tiltPose(t: number, side: -1 | 1): FocusPresencePose {
  const lean = track([[0, 0], [170, -0.12], [1000, 1], [1760, 1], [2700, 0]], t)
  const look = track([[60, 0], [820, 1], [1640, 1], [2420, 0]], t)
  return {
    ...NEUTRAL, active: true,
    headDeg: 2.2 * side * lean,
    headX: 0.8 * side * lean,
    headY: 0.3 * lean,
    eyeX: 0.6 * side * look,
    lid: blink(1180, t),
    finsDeg: side * track([[130, 0], [480, 1.6], [1240, -1.5], [1620, 0.4], [1900, 0], [2260, -1.2], [2700, 0]], t),
  }
}

/** A small dip, the flipper lifts past its place and settles; the body answers a beat late. */
function settlePose(t: number, side: -1 | 1): FocusPresencePose {
  return {
    ...NEUTRAL, active: true,
    flipperDeg: track([[0, 0], [220, -1.6], [760, 4.6], [1120, -1], [1700, 0]], t),
    leanDeg: track([[120, 0], [440, -0.55], [980, 0.4], [1700, 0]], t),
    headY: track([[140, 0], [460, -0.5], [1000, 0.35], [1700, 0]], t),
    eyeX: 0.7 * side * track([[0, 0], [340, 1], [1100, 1], [1650, 0]], t),
    lid: blink(560, t),
    finsDeg: track([[200, 0], [540, 1.3], [1060, -1.5], [1380, 0.4], [1700, 0]], t),
  }
}

export function sampleFocusPresence(elapsedMs: number, schedule: readonly FocusBeat[], attention: FocusAttention, gaze: ScenePoint): FocusPresencePose {
  const beat = schedule.find(item => elapsedMs >= item.startMs && elapsedMs < item.startMs + FOCUS_BEAT_MS[item.kind])
  if (!beat) return NEUTRAL
  const t = elapsedMs - beat.startMs
  return beat.kind === 'glance' ? glancePose(t, attention, gaze) : beat.kind === 'tilt' ? tiltPose(t, beat.side) : settlePose(t, beat.side)
}

/** True from just before a gesture until it ends. No frames are requested between gestures. */
export function focusPresenceNeedsFrame(elapsedMs: number, schedule: readonly FocusBeat[]): boolean {
  return schedule.some(item => elapsedMs >= item.startMs - FOCUS_BEAT_LEAD_MS && elapsedMs < item.startMs + FOCUS_BEAT_MS[item.kind])
}

/** Fading an interrupted gesture out over a few hundred milliseconds instead of cutting it. */
export function approachFocusWeight(weight: number, target: number, deltaMs: number): number {
  const next = target + (weight - target) * Math.exp(-Math.max(0, deltaMs) / 90)
  return Math.abs(target - next) < 0.002 ? target : next
}

const n = (value: number) => Math.round(value * 1000) / 1000
const rotate = (degrees: number, x: number, y: number) => `rotate(${n(degrees)} ${x} ${y})`
const scaleAt = (sx: number, sy: number, x: number, y: number) => `translate(${x} ${y}) scale(${n(sx)} ${n(sy)}) translate(${-x} ${-y})`
const MOUTH = { x: 120.5, y: 108 }
const CHEEK_Y = 111
const cheek = (x: number, smile: number) => `translate(0 ${n(-0.9 * smile)}) ${scaleAt(1 + 0.07 * smile, 1 + 0.07 * smile, x, CHEEK_Y)}`

export const FOCUS_RIG_NAMES = ['lean', 'head', 'fins', 'eyes', 'mouth', 'cheek-left', 'cheek-right'] as const
export type FocusRigName = (typeof FOCUS_RIG_NAMES)[number]

/** SVG transforms in the character's own coordinates. An interrupted gesture fades by `weight`. */
export function focusRigTransforms(pose: FocusPresencePose, weight: number): Record<FocusRigName, string> {
  const w = Math.min(1, Math.max(0, weight))
  const smile = pose.smile * w
  return {
    lean: rotate(pose.leanDeg * w, 120, 164),
    head: `translate(${n(pose.headX * w)} ${n(pose.headY * w)}) ${rotate(pose.headDeg * w, 120, 100)}`,
    fins: rotate(pose.finsDeg * w, 111, 42),
    eyes: `translate(${n(pose.eyeX * w)} ${n(pose.eyeY * w)}) ${scaleAt(1, 1 + (pose.lid - 1) * w, 120, 94)}`,
    mouth: scaleAt(1 + 0.14 * smile, 1 + 0.3 * smile, MOUTH.x, MOUTH.y),
    'cheek-left': cheek(88.5, smile),
    'cheek-right': cheek(153.5, smile),
  }
}

/** `direction` is 1 for the left arm and -1 for the right, so a positive angle lifts outward. */
export const focusFlipperTransform = (degrees: number, weight: number, x: number, y: number, direction: number) => rotate(degrees * direction * Math.min(1, Math.max(0, weight)), x, y)
