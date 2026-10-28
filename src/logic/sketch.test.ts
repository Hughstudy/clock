import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { sketchCharacter } from './character'
import { isTone, sketchBars, sketchDial, sketchRiceBowl } from './sketch'
import { POSES } from './spec'

const style = { roughness: spec.decor.roughness, bowing: spec.decor.bowing }
const seed = spec.decor.seeds.character

describe('sketch generation', () => {
  it('is deterministic for a seed and serializable', () => {
    const a = sketchRiceBowl({ seed: 7, style, filled: true })
    const b = sketchRiceBowl({ seed: 7, style, filled: true })
    expect(a).toEqual(b)
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
    expect(a.paths.every((p) => p.d.length > 0 && !p.d.includes('NaN'))).toBe(true)
  })

  it('varies with the seed', () => {
    const a = sketchDial({ size: 200, seed: 11, style })
    const b = sketchDial({ size: 200, seed: 12, style })
    expect(a.paths[0]?.d).not.toEqual(b.paths[0]?.d)
  })

  it('does not depend on what was drawn before', () => {
    const first = sketchBars({ values: [1, 2, 0], highlightIndex: 1, width: 120, height: 60, seed: 23, style })
    sketchRiceBowl({ seed: 99, style, filled: false })
    const second = sketchBars({ values: [1, 2, 0], highlightIndex: 1, width: 120, height: 60, seed: 23, style })
    expect(second).toEqual(first)
  })
})

describe('Whale-chan', () => {
  it('draws every pose with valid tones and no NaN coordinates', () => {
    for (const pose of POSES) {
      const sketch = sketchCharacter({ character: spec.character, pose, frame: 'full', seed })
      expect(sketch.paths.length).toBeGreaterThan(20)
      expect(sketch.paths.every((p) => isTone(p.tone) && !p.d.includes('NaN'))).toBe(true)
    }
  })

  it('draws a shared part identically in every pose, so switching poses does not shimmer', () => {
    const hairOf = (pose: (typeof POSES)[number]) =>
      sketchCharacter({ character: spec.character, pose, frame: 'full', seed }).paths.slice(0, 6)
    expect(hairOf('rice')).toEqual(hairOf('idle'))
    expect(hairOf('cry')).toEqual(hairOf('idle'))
  })

  it('uses the configured framing as its viewBox', () => {
    const face = sketchCharacter({ character: spec.character, pose: 'idle', frame: 'face', seed })
    const [x, y, width, height] = spec.character.frames.face
    expect({ x: face.x, y: face.y, width: face.width, height: face.height }).toEqual({ x, y, width, height })
  })
})
