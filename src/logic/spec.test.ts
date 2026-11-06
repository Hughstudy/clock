import { describe, expect, it } from 'vitest'
import raw from '../data/app-spec.json'
import { parseSpec, SpecError } from './spec'

describe('parseSpec', () => {
  it('accepts the shipped data file', () => {
    const spec = parseSpec(raw)
    expect(spec.timer.longBreakEvery).toBe(4)
    expect(spec.timer.completionSoundWindowMs).toBe(60_000)
    expect(spec.presentation.motionEnabledDefault).toBe(true)
  })

  it('names the invalid field', () => {
    const bad = structuredClone(raw)
    bad.timer.durationsMinutes.focus.default = 500
    expect(() => parseSpec(bad)).toThrow(SpecError)
    expect(() => parseSpec(bad)).toThrow(/timer\.durationsMinutes\.focus\.default/)
  })

  it('rejects a zero seed, which rough.js would treat as random', () => {
    const bad = structuredClone(raw)
    bad.decor.seeds.chart = 0
    expect(() => parseSpec(bad)).toThrow(/decor\.seeds\.chart/)
  })
})
