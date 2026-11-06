import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { sketchBars } from './sketch'

const style = { roughness: spec.decor.roughness, bowing: spec.decor.bowing }

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
