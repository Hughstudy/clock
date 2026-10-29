import { RoughGenerator } from 'roughjs/bin/generator'
import type { CompanionPresentation, CompanionStance } from './companion'

export const BLUE_STANCES: readonly CompanionStance[] = ['ready', 'focused', 'paused', 'resting', 'settled', 'support', 'neutral']
interface BluePart { d: string; fill?: string; stroke?: string; width?: number }
interface BluePose { arms: string[]; eyes: string[]; mouth: string[] }
export interface BlueCompanionSpec {
  version: 1
  seed: number
  width: number
  height: number
  roughness: number
  bowing: number
  outlineWidth: number
  motion: { greetingMs: number; beginMs: number; settleMs: number; breathingMs: number; blinkMs: number }
  touch: { patMs: number; squishMs: number; highFiveMs: number; holdMaxMs: number; contactRadius: number }
  palette: Record<string, string>
  labels: Record<CompanionStance, string>
  parts: Record<string, BluePart>
  poses: Record<CompanionStance, BluePose>
}
export interface BluePath { d: string; fill: string | null; stroke: string | null; width: number }
export interface BluePartSketch { name: string; paths: BluePath[] }
export interface BlueCompanionSketch { width: number; height: number; parts: Record<string, BluePartSketch> }

const COMMON_PARTS = ['ground', 'groundEdge', 'shadow', 'footLeft', 'footRight', 'tuft', 'body', 'shine', 'belly', 'bellyDimple', 'cheekLeft', 'cheekRight', 'sparkLeft', 'sparkRight']
const REQUIRED_PALETTE = ['outline', 'ink', 'body', 'light', 'shade', 'belly', 'bellyShade', 'white', 'blush', 'ground', 'groundLight', 'shadow', 'spark']
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function finite(value: unknown, min: number, max: number): boolean { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max }

/** Validate the original prototype's editable art and timings before generating any geometry. */
export function validateBlueCompanionSpec(value: unknown): BlueCompanionSpec {
  if (!object(value) || value.version !== 1 || !finite(value.seed, 1, 2147483646) || !Number.isInteger(value.seed)
    || !finite(value.width, 100, 1000) || !finite(value.height, 100, 1000)
    || !finite(value.roughness, 0, 2) || !finite(value.bowing, 0, 2) || !finite(value.outlineWidth, 0.1, 10)) throw new Error('Invalid blue companion geometry settings')
  const { palette, parts, poses, labels, motion, touch } = value
  if (!object(palette) || !REQUIRED_PALETTE.every(key => typeof palette[key] === 'string')
    || !Object.values(palette).every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) throw new Error('Invalid blue companion palette')
  if (!object(motion) || !['greetingMs', 'beginMs', 'settleMs', 'breathingMs', 'blinkMs'].every(key => finite(motion[key], 100, 30000))) throw new Error('Invalid blue companion motion timings')
  if (!object(touch) || !['patMs', 'squishMs', 'highFiveMs'].every(key => finite(touch[key], 150, 2000))
    || !finite(touch.holdMaxMs, 1000, 15000) || !finite(touch.contactRadius, 4, 20)) throw new Error('Invalid blue companion touch settings')
  if (!object(parts) || !COMMON_PARTS.every(name => object(parts[name]))) throw new Error('Missing blue companion parts')
  for (const part of Object.values(parts)) {
    if (!object(part) || typeof part.d !== 'string' || !/^M/.test(part.d) || part.d.length > 5000
      || (part.fill !== undefined && (typeof part.fill !== 'string' || !(part.fill in palette)))
      || (part.stroke !== undefined && (typeof part.stroke !== 'string' || !(part.stroke in palette)))
      || (part.width !== undefined && !finite(part.width, 0.1, 10))) throw new Error('Invalid blue companion part')
  }
  if (!object(poses) || !object(labels)) throw new Error('Missing blue companion poses')
  for (const stance of BLUE_STANCES) {
    const pose = poses[stance]
    if (typeof labels[stance] !== 'string' || !labels[stance] || !object(pose)) throw new Error(`Missing blue companion stance: ${stance}`)
    for (const layer of ['arms', 'eyes', 'mouth']) {
      const names = pose[layer]
      if (!Array.isArray(names) || !names.length || !names.every(name => typeof name === 'string' && name in parts)) throw new Error(`Invalid blue companion pose: ${stance}`)
    }
    if ((pose.arms as unknown[]).length !== 2) throw new Error('A blue companion pose needs two arms')
  }
  return value as unknown as BlueCompanionSpec
}

/** Serializable, DOM-free output. Every named piece keeps its seed when the pose changes. */
export function sketchBlueCompanion(spec: BlueCompanionSpec): BlueCompanionSketch {
  const gen = new RoughGenerator()
  const parts: BlueCompanionSketch['parts'] = {}
  for (const [name, part] of Object.entries(spec.parts)) {
    let hash = spec.seed
    for (const char of name) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
    const drawable = gen.path(part.d, {
      seed: hash % 2147483646 + 1, roughness: spec.roughness, bowing: spec.bowing,
      stroke: part.stroke ?? 'none', fill: part.fill ?? '', fillStyle: 'solid',
      strokeWidth: part.width ?? spec.outlineWidth, disableMultiStroke: true, preserveVertices: true,
    })
    parts[name] = { name, paths: drawable.sets.map(set => ({
      d: gen.opsToPath(set, 2),
      fill: set.type === 'fillPath' ? part.fill ?? null : null,
      stroke: set.type === 'path' ? part.stroke ?? null : null,
      width: part.width ?? spec.outlineWidth,
    })).filter(path => path.fill !== null || path.stroke !== null) }
  }
  return { width: spec.width, height: spec.height, parts }
}

export interface BlueMotion {
  seenId: string | null
  active: { id: string; cue: NonNullable<CompanionPresentation['cue']>; stance: CompanionStance } | null
}
/** Presentation deduplication only. No animation can alter the timer, records or saving state. */
export function nextBlueMotion(previous: BlueMotion, presentation: CompanionPresentation, cueId?: string): BlueMotion {
  const { cue, stance, staticOnly } = presentation
  if (staticOnly || !cue || !cueId) return previous.active === null && (!cueId || cueId === previous.seenId)
    ? previous : { seenId: cueId ?? previous.seenId, active: null }
  if (cueId === previous.seenId) return previous.active && (previous.active.stance !== stance || previous.active.cue !== cue)
    ? { ...previous, active: null } : previous
  return { seenId: cueId, active: { id: cueId, cue, stance } }
}
