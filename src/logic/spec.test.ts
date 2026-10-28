import { describe, expect, it } from 'vitest'
import raw from '../data/pet-spec.json'
import { parseSpec, SpecError } from './spec'

describe('parseSpec', () => {
  it('accepts the shipped data file', () => {
    const spec = parseSpec(raw)
    expect(spec.timer.longBreakEvery).toBe(4)
    expect(spec.timer.completionSoundWindowMs).toBe(60_000)
    expect(spec.calendar.weekStartsOn).toBe(1)
  })

  it('names the invalid field', () => {
    const bad = structuredClone(raw)
    bad.timer.durationsMinutes.focus.default = 500
    expect(() => parseSpec(bad)).toThrow(SpecError)
    expect(() => parseSpec(bad)).toThrow(/timer\.durationsMinutes\.focus\.default/)
  })

  it('rejects a pose that names a missing part', () => {
    const bad = structuredClone(raw)
    bad.character.poses.cry.push('tail2')
    expect(() => parseSpec(bad)).toThrow(/character\.poses\.cry: unknown part tail2/)
  })

  it('rejects unknown tones and non-path data', () => {
    const badTone = structuredClone(raw)
    badTone.character.parts.face.fill = 'tomato'
    expect(() => parseSpec(badTone)).toThrow(/character\.parts\.face\.fill/)
    const badPath = structuredClone(raw)
    badPath.character.parts.face.d = '<script>'
    expect(() => parseSpec(badPath)).toThrow(/character\.parts\.face\.d/)
  })

  it('rejects a zero seed, which rough.js would treat as random', () => {
    const bad = structuredClone(raw)
    bad.decor.seeds.logo = 0
    expect(() => parseSpec(bad)).toThrow(/decor\.seeds\.logo/)
  })
})
