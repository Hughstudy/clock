import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import { sceneArtPalette, sceneArtSketch } from '../data/scene-art'
import type { CompanionScene, SceneId } from '../contracts/presentation'

const ids: SceneId[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'R1', 'R2', 'R3']
function render(id: SceneId, status: CompanionScene['status'], tier: 'hello' | 'snack' | 'meal' | 'feast' = 'snack', progress = 0.5) {
  const phase = id.startsWith('R') ? 'break' : 'focus'
  const scene: CompanionScene = {
    id, key: `test:${id}`, sessionId: `session:${id}`, phase, status, completedProgress: phase === 'break' ? 0 : progress,
    allowBeats: true, cue: null, ending: status === 'ended' ? { cueId: `end:${id}`, tier: phase === 'break' ? null : tier } : null,
  }
  return renderToStaticMarkup(createElement(BlueCompanion, { scene, presentation: {
    stance: status === 'paused' ? 'paused' : status === 'ended' ? 'settled' : phase === 'break' ? 'resting' : 'focused',
    cue: null, staticOnly: true,
  } }))
}

describe('scene artwork rendering', () => {
  it('ships valid cached paths with known palette entries', () => {
    expect(Object.keys(sceneArtSketch.parts).length).toBeGreaterThan(40)
    expect(JSON.parse(JSON.stringify(sceneArtSketch))).toEqual(sceneArtSketch)
    for (const part of Object.values(sceneArtSketch.parts)) {
      expect(part.paths.length).toBeGreaterThan(0)
      for (const path of part.paths) {
        expect(path.d).not.toMatch(/NaN|Infinity/)
        if (path.fill) expect(sceneArtPalette[path.fill]).toBeDefined()
        if (path.stroke) expect(sceneArtPalette[path.stroke]).toBeDefined()
      }
    }
  })

  it('renders all eleven activities in running, paused and ending static states', () => {
    for (const id of ids) for (const status of ['running', 'paused', 'ended'] as const) {
      const html = render(id, status)
      expect(html).toContain(`data-scene="${id}"`)
      expect(html).toContain(`data-scene-status="${status}"`)
      expect(html).toContain('data-scene-phase="idle"')
      expect(html).toContain('data-scene-motion="false"')
      expect(html).toContain('data-static="true"')
      expect(html).toContain('data-scene-part=')
      expect(html).toContain('blue-companion__touch-surface')
      expect(html).not.toMatch(/NaN|Infinity|<button|tabindex=|aria-live=/)
      for (const match of html.matchAll(/<g[^>]* data-part="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)) {
        expect(match[2], `Missing character geometry: ${match[1]} in ${id}`).toContain('<path')
      }
    }
  })

  it('keeps all focus ending tiers and rest endings representable without motion', () => {
    for (const id of ids.filter(id => id.startsWith('F'))) for (const tier of ['hello', 'snack', 'meal', 'feast'] as const) {
      const html = render(id, 'ended', tier)
      expect(html).toContain(`data-scene-tier="${tier}"`)
      expect(html).toContain('data-scene-phase="idle"')
    }
    for (const id of ids.filter(id => id.startsWith('R'))) expect(render(id, 'ended')).toContain('data-scene-tier=""')
  })

  it('renders endpoint progress without invalid growth geometry or a new cue', () => {
    for (const id of ids) for (const progress of [0, 0.01, 0.99, 1]) {
      const html = render(id, 'running', 'snack', progress)
      expect(html).not.toMatch(/NaN|Infinity/)
      expect(html).toContain('data-scene-phase="idle"')
    }
  })
})
