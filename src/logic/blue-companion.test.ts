import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import raw from '../data/companion-spec.json'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import type { CompanionPresentation } from './companion'
import { BLUE_STANCES, nextBlueMotion, sketchBlueCompanion, validateBlueCompanionSpec, type BlueMotion } from './blue-companion'

const spec = validateBlueCompanionSpec(raw)
const blank: BlueMotion = { seenId: null, active: null }
const support: CompanionPresentation = { stance: 'support', cue: 'support', staticOnly: false }

describe('original blue companion', () => {
  it('has deterministic serializable rough.js geometry and complete expressive poses', () => {
    const sketch = sketchBlueCompanion(spec)
    expect(sketchBlueCompanion(spec)).toEqual(sketch)
    expect(JSON.parse(JSON.stringify(sketch))).toEqual(sketch)
    expect(Object.values(sketch.parts).every(part => part.paths.length && part.paths.every(path => !/NaN|Infinity/.test(path.d)))).toBe(true)
    for (const stance of BLUE_STANCES) {
      const pose = spec.poses[stance]
      expect([...pose.arms, ...pose.eyes, ...pose.mouth].every(name => sketch.parts[name])).toBe(true)
    }
    expect(spec.poses.settled.eyes).not.toEqual(spec.poses.ready.eyes)
    expect(spec.poses.support.arms).not.toEqual(spec.poses.resting.arms)
  })
  it('rejects missing paths, invalid timing and unknown palette references', () => {
    const missing = structuredClone(raw); delete (missing.parts as Record<string, unknown>).body
    expect(() => validateBlueCompanionSpec(missing)).toThrow()
    expect(() => validateBlueCompanionSpec({ ...raw, motion: { ...raw.motion, greetingMs: -1 } })).toThrow()
    expect(() => validateBlueCompanionSpec({ ...raw, parts: { ...raw.parts, body: { ...raw.parts.body, fill: 'missing' } } })).toThrow()
    expect(() => validateBlueCompanionSpec({ ...raw, touch: { ...raw.touch, patMs: Infinity } })).toThrow()
    expect(() => validateBlueCompanionSpec({ ...raw, touch: { ...raw.touch, holdMaxMs: 30000 } })).toThrow()
    expect(() => validateBlueCompanionSpec({ ...raw, touch: { ...raw.touch, contactRadius: 0 } })).toThrow()
  })
  it('plays a cue once, cancels obsolete cues and does not replay after static mode', () => {
    expect(nextBlueMotion(blank, support).active).toBeNull()
    const first = nextBlueMotion(blank, support, 'ask-1')
    expect(first.active?.cue).toBe('support')
    expect(nextBlueMotion(first, support, 'ask-1')).toBe(first)
    const finished = { ...first, active: null }
    expect(nextBlueMotion(finished, support, 'ask-1').active).toBeNull()
    const paused = nextBlueMotion(first, { stance: 'paused', cue: null, staticOnly: false }, 'ask-1')
    expect(paused.active).toBeNull()
    const reduced = nextBlueMotion(first, { ...support, staticOnly: true }, 'ask-1')
    expect(nextBlueMotion(reduced, support, 'ask-1').active).toBeNull()
    expect(nextBlueMotion(reduced, support, 'ask-2').active?.id).toBe('ask-2')
  })
  it('renders every static pose with meaningful alternatives and no replay token', () => {
    for (const stance of BLUE_STANCES) {
      const html = renderToStaticMarkup(createElement(BlueCompanion, { presentation: { stance, cue: null, staticOnly: true } }))
      expect(html).toContain(`aria-label="${spec.labels[stance]}"`)
      expect(html).toContain('data-static="true"')
      expect(html).toContain('data-cue=""')
      expect(html).toContain('data-part="body"')
      // The caller owns the native button and the only accessible action.
      expect(html).not.toMatch(/<button|tabindex=|aria-live=/)
      expect(html).toContain('blue-companion__touch-surface')
    }
  })
})
