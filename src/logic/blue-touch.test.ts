import { describe, expect, it } from 'vitest'
import { blueTouchKind, blueTouchOffset, blueTouchPoint } from './blue-touch'

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
