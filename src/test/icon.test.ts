import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { spec } from '../data/spec'
import { sketchCharacter } from '../logic/character'
import { sketchToSvg } from './render'

const FAVICON = join(import.meta.dirname, '../../public/favicon.svg')

/** The app icon is Whale-chan's face. `npm run icons` rewrites it (then the PNGs) after drawing changes. */
it('keeps public/favicon.svg in sync with the character drawing', () => {
  const face = sketchCharacter({ character: spec.character, pose: 'idle', frame: 'face', seed: spec.decor.seeds.character })
  const svg = sketchToSvg(face, spec.palette, '#e6efff')
  if (process.env.UPDATE_ICON) writeFileSync(FAVICON, svg)
  expect(readFileSync(FAVICON, 'utf8')).toBe(svg)
})
