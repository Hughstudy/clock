import { describe, expect, it } from 'vitest'
import { advanceBlueTouchMotion, blueTouchKind, blueTouchMotionNeedsFrame, blueTouchMotionTransform, blueTouchOffset, blueTouchPoint, blueTouchPressPose, emptyBlueTouchMotion, springOf, springSettled, stepSpring, type BlueTouchInput, type BlueTouchMotion, type SpringState } from './blue-touch'

const canvas = { width: 240, height: 190 }
const bounds = { left: 10, top: 20, ...canvas }

describe('blue companion touch geometry', () => {
  it('maps resized SVGs to the same character point, including translated bounds', () => {
    for (const scale of [0.5, 1, 1.75, 2]) {
      expect(blueTouchPoint(
        { x: -30 + 120 * scale, y: 40 + 95 * scale },
        { left: -30, top: 40, width: 240 * scale, height: 190 * scale }, canvas,
      )).toEqual({ x: 120, y: 95 })
    }
  })

  it('accounts for vertical letterboxing and rejects the empty bands', () => {
    const square = { left: 10, top: 20, width: 480, height: 480 }
    expect(blueTouchPoint({ x: 250, y: 260 }, square, canvas)).toEqual({ x: 120, y: 95 })
    expect(blueTouchPoint({ x: 10, y: 70 }, square, canvas)).toEqual({ x: 0, y: 0 })
    expect(blueTouchPoint({ x: 490, y: 450 }, square, canvas)).toEqual(canvasToPoint(canvas))
    expect(blueTouchPoint({ x: 250, y: 69 }, square, canvas)).toBeNull()
    expect(blueTouchPoint({ x: 250, y: 451 }, square, canvas)).toBeNull()
  })

  it('accounts for horizontal letterboxing and rejects the empty bands', () => {
    const wide = { left: 10, top: 20, width: 480, height: 190 }
    expect(blueTouchPoint({ x: 250, y: 115 }, wide, canvas)).toEqual({ x: 120, y: 95 })
    expect(blueTouchPoint({ x: 130, y: 20 }, wide, canvas)).toEqual({ x: 0, y: 0 })
    expect(blueTouchPoint({ x: 370, y: 210 }, wide, canvas)).toEqual(canvasToPoint(canvas))
    expect(blueTouchPoint({ x: 129, y: 115 }, wide, canvas)).toBeNull()
    expect(blueTouchPoint({ x: 371, y: 115 }, wide, canvas)).toBeNull()
  })

  it('accepts exact content edges and rejects contacts outside every edge', () => {
    expect(blueTouchPoint({ x: 10, y: 20 }, bounds, canvas)).toEqual({ x: 0, y: 0 })
    expect(blueTouchPoint({ x: 250, y: 210 }, bounds, canvas)).toEqual({ x: 240, y: 190 })
    for (const point of [{ x: 9, y: 100 }, { x: 251, y: 100 }, { x: 120, y: 19 }, { x: 120, y: 211 }]) {
      expect(blueTouchPoint(point, bounds, canvas)).toBeNull()
    }
  })

  it('rejects invalid coordinates, bounds and canvas sizes without producing NaN', () => {
    const center = { x: 130, y: 115 }
    for (const invalid of [NaN, Infinity, -Infinity]) {
      for (const key of ['x', 'y'] as const) expect(blueTouchPoint({ ...center, [key]: invalid }, bounds, canvas)).toBeNull()
      for (const key of ['left', 'top', 'width', 'height'] as const) expect(blueTouchPoint(center, { ...bounds, [key]: invalid }, canvas)).toBeNull()
      for (const key of ['width', 'height'] as const) expect(blueTouchPoint(center, bounds, { ...canvas, [key]: invalid })).toBeNull()
    }
    for (const invalid of [0, -1]) {
      for (const key of ['width', 'height'] as const) {
        expect(blueTouchPoint(center, { ...bounds, [key]: invalid }, canvas)).toBeNull()
        expect(blueTouchPoint(center, bounds, { ...canvas, [key]: invalid })).toBeNull()
      }
    }
  })

  it('classifies head, hands and belly consistently at different canvas sizes', () => {
    for (const size of [100, 200]) {
      const square = { width: size, height: size }
      expect(blueTouchKind({ x: size * 0.5, y: size * 0.42 }, square)).toBe('pat')
      expect(blueTouchKind({ x: size * 0.1, y: size * 0.39 }, square)).toBe('high-five')
      expect(blueTouchKind({ x: size * 0.9, y: size * 0.39 }, square)).toBe('high-five')
      expect(blueTouchKind({ x: size * 0.5, y: size * 0.43 }, square)).toBe('squish')
      expect(blueTouchKind({ x: size * 0.31, y: size * 0.6 }, square)).toBe('high-five')
      expect(blueTouchKind({ x: size * 0.69, y: size * 0.6 }, square)).toBe('high-five')
      expect(blueTouchKind({ x: size * 0.32, y: size * 0.6 }, square)).toBe('squish')
      expect(blueTouchKind({ x: size * 0.68, y: size * 0.6 }, square)).toBe('squish')
    }
  })

  it('keeps gaze centered or bounded even when the pointer leaves the canvas', () => {
    expect(blueTouchOffset({ x: 120, y: 95 }, canvas)).toEqual({ x: 0, y: 0 })
    expect(blueTouchOffset({ x: 0, y: 0 }, canvas)).toEqual({ x: -3, y: -2 })
    expect(blueTouchOffset({ x: 240, y: 190 }, canvas)).toEqual({ x: 3, y: 2 })
    expect(blueTouchOffset({ x: -1000, y: 1000 }, canvas)).toEqual({ x: -3, y: 2 })
    expect(blueTouchOffset({ x: 180, y: 142.5 }, canvas)).toEqual({ x: 1.5, y: 1 })
  })

  it('falls back to neutral touch geometry for invalid inputs', () => {
    expect(blueTouchKind({ x: NaN, y: 10 }, canvas)).toBe('squish')
    expect(blueTouchKind({ x: 10, y: 10 }, { width: 0, height: 190 })).toBe('squish')
    expect(blueTouchOffset({ x: Infinity, y: 10 }, canvas)).toEqual({ x: 0, y: 0 })
    expect(blueTouchOffset({ x: 10, y: 10 }, { width: 240, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})

function canvasToPoint(size: { width: number; height: number }) { return { x: size.width, y: size.height } }

describe('blue companion touch spring', () => {
  const run = (state: SpringState, target: number, ms: number, spring = springOf(0.5, 0.65)) => {
    for (let t = 0; t < ms; t += 16) state = stepSpring(state, target, spring, 16)
    return state
  }

  it('presses smoothly, then bounces back through a stretch and settles', () => {
    const pressed = run({ value: 0, velocity: 0 }, 1, 400, springOf(0.12, 0))
    expect(pressed.value).toBeCloseTo(1, 2)
    let state = pressed, lowest = 1
    for (let t = 0; t < 2000; t += 16) { state = stepSpring(state, 0, springOf(0.5, 0.65), 16); lowest = Math.min(lowest, state.value) }
    expect(lowest).toBeLessThan(-0.2)
    expect(lowest).toBeGreaterThan(-0.5)
    expect(springSettled(state, 0)).toBe(true)
  })

  it('keeps position and velocity when a second tap arrives mid-bounce', () => {
    const release = springOf(0.5, 0.65), press = springOf(0.12, 0)
    const mid = run(run({ value: 0, velocity: 0 }, 1, 300, press), 0, 120, release)
    const next = stepSpring(mid, 1, press, 16)
    // One frame moves a little, never straight to the pressed pose.
    expect(Math.abs(next.value - mid.value)).toBeLessThan(0.35)
    expect(next.value).not.toBeCloseTo(1, 1)
  })

  it('clamps a long frame gap and keeps squash close to area-preserving', () => {
    const state = stepSpring({ value: 1, velocity: 0 }, 0, springOf(0.5, 0.65), 5000)
    expect(Math.abs(state.value)).toBeLessThan(1.5)
    const squish = blueTouchPressPose('squish', 1)
    expect(squish.sx * squish.sy).toBeGreaterThan(0.98)
    expect(blueTouchPressPose('high-five', -1).r).toBe(-3)
  })
})

describe('blue companion touch continuity', () => {
  const run = (state: BlueTouchMotion, input: BlueTouchInput | null, ms: number) => {
    for (let time = 0; time < ms; time += 16) state = advanceBlueTouchMotion(state, input, 16)
    return state
  }

  it('retargets opposite hands and different touch zones without changing the current pose or velocity', () => {
    const contacts: BlueTouchInput[] = [
      { id: 1, kind: 'high-five', side: -1, phase: 'press' },
      { id: 2, kind: 'high-five', side: 1, phase: 'press' },
      { id: 3, kind: 'pat', side: 1, phase: 'press' },
      { id: 4, kind: 'squish', side: 1, phase: 'press' },
    ]
    let state = emptyBlueTouchMotion()
    for (const contact of contacts) {
      const retargeted = advanceBlueTouchMotion(state, contact, 0)
      expect(retargeted.pose).toEqual(state.pose)
      expect(blueTouchMotionTransform(retargeted)).toEqual(blueTouchMotionTransform(state))
      state = run(retargeted, contact, 80)
    }
    expect(state.pose.sx.value).toBeGreaterThan(1.03)
  })

  it('gives release-only keyboard pats a finite press and rebound without another input', () => {
    const pat: BlueTouchInput = { id: 1, kind: 'pat', side: 1, phase: 'release' }
    const start = advanceBlueTouchMotion(emptyBlueTouchMotion(), pat, 0)
    expect(blueTouchMotionNeedsFrame(start)).toBe(true)
    const pressed = run(start, pat, 80)
    expect(pressed.pose.sy.value).toBeLessThan(0.98)
    const released = run(pressed, pat, 320)
    expect(released.pose.sy.value).toBeGreaterThan(1)
    const settled = run(released, pat, 2000)
    expect(blueTouchMotionNeedsFrame(settled)).toBe(false)
    expect(blueTouchMotionTransform(settled)).toBe('translateY(0px) rotate(0deg) scale(1, 1)')
  })

  it('cancels a keyboard pulse without resetting its pose or starting a delayed gesture', () => {
    const pat: BlueTouchInput = { id: 1, kind: 'pat', side: 1, phase: 'release' }
    const moving = run(emptyBlueTouchMotion(), pat, 64)
    const cancelled = advanceBlueTouchMotion(moving, null, 0)
    expect(cancelled.pose).toEqual(moving.pose)
    expect(cancelled.phase).toBe('release')
    const settled = run(cancelled, null, 2000)
    expect(blueTouchMotionNeedsFrame(settled)).toBe(false)
    expect(settled.pose).toEqual(emptyBlueTouchMotion().pose)
  })
})
