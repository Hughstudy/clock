import { useMemo } from 'react'
import { spec } from '../data/spec'
import { sketchCharacter } from '../logic/character'
import { sketchBars, sketchDial, sketchRiceBowl, sketchUnderline, type Sketch, type Tone } from '../logic/sketch'
import type { Frame, Pose } from '../logic/spec'

const style = { roughness: spec.decor.roughness, bowing: spec.decor.bowing }
const cache = new Map<string, Sketch>()

/** Sketches are generated once per input and reused, never per timer tick. */
function cached(key: string, make: () => Sketch): Sketch {
  let sketch = cache.get(key)
  if (!sketch) {
    sketch = make()
    cache.set(key, sketch)
  }
  return sketch
}

export function usePalette(): Record<Tone, string> {
  return spec.palette
}

export function useCharacterSketch(pose: Pose, frame: Frame = 'full'): Sketch {
  return cached(`character:${pose}:${frame}`, () =>
    sketchCharacter({ character: spec.character, pose, frame, seed: spec.decor.seeds.character }),
  )
}

export function useRiceBowlSketch(filled: boolean, variant = 0): Sketch {
  return cached(`bowl:${filled}:${variant}`, () =>
    sketchRiceBowl({ filled, seed: spec.decor.seeds.cycle + variant, style }),
  )
}

export function useDialSketch(size: number): Sketch {
  return cached(`dial:${size}`, () => sketchDial({ size, seed: spec.decor.seeds.dial, style }))
}

export function useUnderlineSketch(width: number): Sketch {
  return cached(`underline:${width}`, () => sketchUnderline({ width, seed: spec.decor.seeds.underline, style }))
}

export function useBarsSketch(values: readonly number[], highlightIndex: number, width: number, height: number): Sketch {
  const key = `${values.join(',')}|${highlightIndex}|${width}x${height}`
  return useMemo(
    () => sketchBars({ values, highlightIndex, width, height, seed: spec.decor.seeds.chart, style }),
    // `key` captures every input, so array identity changes alone do not regenerate.
    [key],
  )
}
