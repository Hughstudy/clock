import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { sketchCharacter } from './character'
import { isTone, sketchBars } from './sketch'
import { POSES } from './spec'

const style = { roughness: spec.decor.roughness, bowing: spec.decor.bowing }
const seed = spec.decor.seeds.character

describe('sketch generation', () => {
  const bars = (seed: number) => sketchBars({ values: [1, 2, 0], highlightIndex: 1, width: 120, height: 60, seed, style })

  it('is deterministic for a seed and serializable', () => {
    const a = bars(7)
    expect(a).toEqual(bars(7))
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
    expect(a.paths.every((p) => p.d.length > 0 && !p.d.includes('NaN'))).toBe(true)
  })

  it('varies with the seed', () => {
    expect(bars(11).paths[0]?.d).not.toEqual(bars(12).paths[0]?.d)
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
  })

  it('uses the configured framing as its viewBox', () => {
    const face = sketchCharacter({ character: spec.character, pose: 'idle', frame: 'face', seed })
    const [x, y, width, height] = spec.character.frames.face
    expect({ x: face.x, y: face.y, width: face.width, height: face.height }).toEqual({ x, y, width, height })
  })
})
