import { useMemo } from 'react'
import { spec } from '../data/spec'
import { sketchBars, type Sketch, type Tone } from '../logic/sketch'

const style = { roughness: spec.decor.roughness, bowing: spec.decor.bowing }
export function usePalette(): Record<Tone, string> {
  return spec.palette
}

export function useBarsSketch(values: readonly number[], highlightIndex: number, width: number, height: number): Sketch {
  const key = `${values.join(',')}|${highlightIndex}|${width}x${height}`
  return useMemo(
    () => sketchBars({ values, highlightIndex, width, height, seed: spec.decor.seeds.chart, style }),
    // `key` captures every input, so array identity changes alone do not regenerate.
    [key],
  )
}
