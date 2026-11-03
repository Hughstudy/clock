import type { Drawable, Options } from 'roughjs/bin/core'
import { RoughGenerator } from 'roughjs/bin/generator'

// Deterministic, DOM-free rough.js output. Colors are named tones so each
// renderer (SVG today, React Native later) maps them to its own palette.

export const TONES = [
  'ink', 'muted', 'line', 'accent', 'accentSoft', 'teal',
  'hair', 'hairDeep', 'hairLight', 'navy', 'skin', 'blush', 'white', 'eye', 'mouth', 'tear', 'wood', 'rice', 'sky',
] as const
export type Tone = (typeof TONES)[number]

export function isTone(value: unknown): value is Tone {
  return (TONES as readonly unknown[]).includes(value)
}

export interface SketchPath {
  d: string
  tone: Tone
  kind: 'stroke' | 'fill'
  width: number
}

/** Paths plus the viewBox (`x y width height`) they are framed in. */
export interface Sketch {
  x: number
  y: number
  width: number
  height: number
  paths: SketchPath[]
}

export interface SketchStyle {
  roughness: number
  bowing: number
}

export interface ShapeOptions {
  stroke?: Tone
  strokeWidth?: number
  fill?: Tone
  fillStyle?: 'solid' | 'hachure' | 'zigzag' | 'cross-hatch' | 'dots'
  hachureGap?: number
  roughness?: number
  /** Single clean outline instead of rough.js's doubled sketch line. */
  singleStroke?: boolean
  /**
   * Fixes the shape's seed independently of drawing order, so a part shared
   * by several poses looks identical in each of them.
   */
  seedKey?: string
}

const DECIMALS = 2
const MAX_SEED = 2 ** 31 - 1

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export class SketchBuilder {
  private readonly generator = new RoughGenerator()
  private readonly paths: SketchPath[] = []
  private shapeCount = 0
  private readonly seed: number
  private readonly style: SketchStyle

  constructor(seed: number, style: SketchStyle) {
    this.seed = seed
    this.style = style
  }

  /** Each shape gets its own derived seed so shapes never depend on drawing order. */
  options(shape: ShapeOptions): Options {
    this.shapeCount += 1
    const salt = shape.seedKey === undefined ? this.shapeCount * 104729 : hash(shape.seedKey)
    const seed = ((this.seed * 7919 + salt) % MAX_SEED) || 1
    const options: Options = {
      seed,
      roughness: shape.roughness ?? this.style.roughness,
      bowing: this.style.bowing,
      stroke: shape.stroke ?? 'none',
      strokeWidth: shape.strokeWidth ?? 1.5,
      fillStyle: shape.fillStyle ?? 'hachure',
    }
    if (shape.fill) options.fill = shape.fill
    if (shape.hachureGap !== undefined) options.hachureGap = shape.hachureGap
    if (shape.singleStroke) {
      options.disableMultiStroke = true
      options.preserveVertices = true
    }
    return options
  }

  add(drawable: Drawable): this {
    const o = drawable.options
    for (const set of drawable.sets) {
      const d = this.generator.opsToPath(set, DECIMALS)
      if (set.type === 'path') {
        this.paths.push({ d, tone: o.stroke as Tone, kind: 'stroke', width: o.strokeWidth })
      } else if (set.type === 'fillPath') {
        this.paths.push({ d, tone: o.fill as Tone, kind: 'fill', width: 0 })
      } else {
        const width = o.fillWeight < 0 ? o.strokeWidth / 2 : o.fillWeight
        this.paths.push({ d, tone: o.fill as Tone, kind: 'stroke', width })
      }
    }
    return this
  }

  get gen(): RoughGenerator {
    return this.generator
  }

  build(width: number, height: number, x = 0, y = 0): Sketch {
    return { x, y, width, height, paths: this.paths }
  }
}

export interface BarsInput {
  /** Bar values, e.g. focus minutes per day. */
  values: readonly number[]
  highlightIndex: number
  width: number
  height: number
  seed: number
  style: SketchStyle
}

/** Week chart bars. Regenerate only when the values change, not on timer ticks. */
export function sketchBars({ values, highlightIndex, width, height, seed, style }: BarsInput): Sketch {
  const b = new SketchBuilder(seed, style)
  const baseline = height - 4
  const slot = width / Math.max(1, values.length)
  const barWidth = slot * 0.56
  const max = Math.max(1, ...values)
  values.forEach((value, i) => {
    const x = i * slot + (slot - barWidth) / 2
    const highlight = i === highlightIndex
    if (value <= 0) {
      b.add(
        b.gen.line(x + barWidth * 0.2, baseline - 3, x + barWidth * 0.8, baseline - 3,
          b.options({ stroke: 'line', strokeWidth: 2, roughness: 0.6 })),
      )
      return
    }
    const barHeight = Math.max(6, (value / max) * (baseline - 8))
    b.add(
      b.gen.rectangle(x, baseline - barHeight, barWidth, barHeight, b.options({
        stroke: highlight ? 'accent' : 'muted',
        fill: highlight ? 'accent' : 'accentSoft',
        fillStyle: 'hachure',
        hachureGap: 4,
        strokeWidth: 1.6,
      })),
    )
  })
  b.add(b.gen.line(2, baseline, width - 2, baseline, b.options({ stroke: 'line', strokeWidth: 1.8, roughness: 0.7 })))
  return b.build(width, height)
}
