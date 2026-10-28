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

export interface RiceBowlInput {
  seed: number
  style: SketchStyle
  /** An empty bowl is a placeholder, e.g. for cycle progress. */
  filled: boolean
}

/** A bowl of rice in a 32×32 box; SVG scaling sets the rendered size. */
export function sketchRiceBowl({ seed, style, filled }: RiceBowlInput): Sketch {
  const b = new SketchBuilder(seed, style)
  if (filled) {
    b.add(b.gen.path('M4 15 C6 8 12 6 16 7 C20 6 26 8 28 15 Z', b.options({ stroke: 'muted', fill: 'rice', fillStyle: 'solid', strokeWidth: 1, roughness: 0.3, singleStroke: true })))
    b.add(b.gen.path('M11 11 L12.5 10 M16 9.5 L17.5 9 M20 11.5 L21.5 10.5', b.options({ stroke: 'muted', strokeWidth: 0.9, roughness: 0.2 })))
  }
  b.add(b.gen.path('M3 15 C4 23 9 27 16 27 C23 27 28 23 29 15 Z', b.options({
    stroke: filled ? 'ink' : 'muted',
    fill: filled ? 'white' : 'line',
    fillStyle: 'solid',
    strokeWidth: 1.3,
    roughness: 0.4,
    singleStroke: true,
  })))
  b.add(b.gen.path('M5 20 C12 22.5 20 22.5 27 20', b.options({ stroke: filled ? 'accent' : 'muted', strokeWidth: 1.4, roughness: 0.4 })))
  return b.build(32, 32)
}

export interface DialInput {
  size: number
  seed: number
  style: SketchStyle
}

/** Hand-drawn clock face: an outer ring with twelve hour ticks. */
export function sketchDial({ size, seed, style }: DialInput): Sketch {
  const b = new SketchBuilder(seed, style)
  const c = size / 2
  b.add(b.gen.circle(c, c, size * 0.96, b.options({ stroke: 'line', strokeWidth: 2.2 })))
  for (let i = 0; i < 12; i += 1) {
    const angle = (i * Math.PI) / 6
    const outer = size * 0.455
    const inner = size * (i % 3 === 0 ? 0.405 : 0.425)
    b.add(
      b.gen.line(
        c + Math.cos(angle) * inner,
        c + Math.sin(angle) * inner,
        c + Math.cos(angle) * outer,
        c + Math.sin(angle) * outer,
        b.options({ stroke: 'muted', strokeWidth: i % 3 === 0 ? 2.2 : 1.4, roughness: 0.8 }),
      ),
    )
  }
  return b.build(size, size)
}

export interface UnderlineInput {
  width: number
  seed: number
  style: SketchStyle
}

export function sketchUnderline({ width, seed, style }: UnderlineInput): Sketch {
  const b = new SketchBuilder(seed, style)
  const height = 12
  const points: [number, number][] = []
  const steps = 6
  for (let i = 0; i <= steps; i += 1) {
    points.push([4 + ((width - 8) * i) / steps, height / 2 + (i % 2 === 0 ? -2 : 2)])
  }
  b.add(b.gen.curve(points, b.options({ stroke: 'accent', strokeWidth: 2.4, roughness: 0.9 })))
  return b.build(width, height)
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
