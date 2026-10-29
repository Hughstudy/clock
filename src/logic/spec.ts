import { isTone, TONES, type Tone } from './sketch'
import { PHASES, type Phase } from './types'

export interface DurationBounds {
  default: number
  min: number
  max: number
}

export const DECOR_SEEDS = ['logo', 'dial', 'cycle', 'chart', 'underline', 'character'] as const
export type DecorSeed = (typeof DECOR_SEEDS)[number]

export const POSES = ['idle', 'rice'] as const
export type Pose = (typeof POSES)[number]

export const CAPTIONS = ['focusReady', 'focusRunning', 'paused', 'breakReady', 'breakRunning', 'rice', 'ended'] as const
export type CaptionKey = (typeof CAPTIONS)[number]

export const FRAMES = ['full', 'face'] as const
export type Frame = (typeof FRAMES)[number]

/** One drawable piece of the character: an SVG path sketched by rough.js. */
export interface CharacterPart {
  d: string
  fill?: Tone
  stroke?: Tone
  width?: number
}

export interface CharacterSpec {
  name: string
  roughness: number
  bowing: number
  outlineWidth: number
  /** viewBox `[x, y, width, height]` per framing. */
  frames: Record<Frame, [number, number, number, number]>
  reactionSeconds: Record<'ended', number>
  captions: Record<CaptionKey, string>
  alt: Record<Pose, string>
  /** Back-to-front part names per pose, with groups already expanded. */
  poses: Record<Pose, string[]>
  parts: Record<string, CharacterPart>
}

export interface Spec {
  presentation: {
    motionEnabledDefault: boolean
  }
  timer: {
    durationsMinutes: Record<Phase, DurationBounds>
    quickFocusMinutes: number
    longBreakEvery: number
    soundEnabledDefault: boolean
    completionSoundWindowMs: number
  }
  calendar: {
    /** 0 = Sunday … 6 = Saturday. */
    weekStartsOn: number
  }
  decor: {
    roughness: number
    bowing: number
    seeds: Record<DecorSeed, number>
  }
  palette: Record<Tone, string>
  character: CharacterSpec
}

export class SpecError extends Error {
  constructor(path: string, problem: string) {
    super(`pet-spec ${path}: ${problem}`)
    this.name = 'SpecError'
  }
}

type Json = Record<string, unknown>

function section(raw: unknown, path: string): Json {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SpecError(path, 'expected an object')
  }
  return raw as Json
}

function int(raw: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new SpecError(path, `expected an integer from ${min} to ${max}`)
  }
  return raw
}

function positive(raw: unknown, path: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    throw new SpecError(path, 'expected a positive number')
  }
  return raw
}

function bool(raw: unknown, path: string): boolean {
  if (typeof raw !== 'boolean') throw new SpecError(path, 'expected a boolean')
  return raw
}

function bounds(raw: unknown, path: string): DurationBounds {
  const o = section(raw, path)
  const min = int(o.min, `${path}.min`, 1)
  const max = int(o.max, `${path}.max`, min)
  return { min, max, default: int(o.default, `${path}.default`, min, max) }
}

function text(raw: unknown, path: string): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new SpecError(path, 'expected non-empty text')
  return raw
}

function tone(raw: unknown, path: string): Tone {
  if (!isTone(raw)) throw new SpecError(path, `expected one of ${TONES.join(', ')}`)
  return raw
}

function palette(raw: unknown): Record<Tone, string> {
  const o = section(raw, 'palette')
  return Object.fromEntries(
    TONES.map((t) => {
      const value = o[t]
      if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
        throw new SpecError(`palette.${t}`, 'expected a #rrggbb color')
      }
      return [t, value]
    }),
  ) as Record<Tone, string>
}

const PATH_DATA = /^[MLCZmlcz0-9.,\s-]+$/

function part(raw: unknown, path: string): CharacterPart {
  const o = section(raw, path)
  if (typeof o.d !== 'string' || !PATH_DATA.test(o.d) || !/^\s*M/.test(o.d)) {
    throw new SpecError(`${path}.d`, 'expected SVG path data using M, L, C and Z')
  }
  const result: CharacterPart = { d: o.d }
  if (o.fill !== undefined) result.fill = tone(o.fill, `${path}.fill`)
  if (o.stroke !== undefined) result.stroke = tone(o.stroke, `${path}.stroke`)
  if (o.width !== undefined) result.width = positive(o.width, `${path}.width`)
  if (!result.fill && !result.stroke) throw new SpecError(path, 'needs a fill or a stroke')
  return result
}

function character(raw: unknown): CharacterSpec {
  const c = section(raw, 'character')
  const partsRaw = section(c.parts, 'character.parts')
  const parts = Object.fromEntries(Object.entries(partsRaw).map(([k, v]) => [k, part(v, `character.parts.${k}`)]))

  const groupsRaw = section(c.groups, 'character.groups')
  const names = (list: unknown, path: string): string[] => {
    if (!Array.isArray(list) || list.length === 0) throw new SpecError(path, 'expected a list of part names')
    return list.map((n, i) => text(n, `${path}[${i}]`))
  }
  const groups = Object.fromEntries(Object.entries(groupsRaw).map(([k, v]) => [k, names(v, `character.groups.${k}`)]))
  const posesRaw = section(c.poses, 'character.poses')
  const poses = Object.fromEntries(
    POSES.map((pose) => {
      const path = `character.poses.${pose}`
      const expanded = names(posesRaw[pose], path).flatMap((n) => {
        if (!n.startsWith('@')) return [n]
        const group = groups[n.slice(1)]
        if (!group) throw new SpecError(path, `unknown group ${n}`)
        return group
      })
      for (const n of expanded) if (!parts[n]) throw new SpecError(path, `unknown part ${n}`)
      return [pose, expanded]
    }),
  ) as Record<Pose, string[]>

  const framesRaw = section(c.frames, 'character.frames')
  const frames = Object.fromEntries(
    FRAMES.map((f) => {
      const box = framesRaw[f]
      if (!Array.isArray(box) || box.length !== 4 || box.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
        throw new SpecError(`character.frames.${f}`, 'expected [x, y, width, height]')
      }
      return [f, box as [number, number, number, number]]
    }),
  ) as Record<Frame, [number, number, number, number]>

  const seconds = section(c.reactionSeconds, 'character.reactionSeconds')
  const captions = section(c.captions, 'character.captions')
  const alt = section(c.alt, 'character.alt')
  return {
    name: text(c.name, 'character.name'),
    roughness: positive(c.roughness, 'character.roughness'),
    bowing: positive(c.bowing, 'character.bowing'),
    outlineWidth: positive(c.outlineWidth, 'character.outlineWidth'),
    frames,
    reactionSeconds: {
      ended: int(seconds.ended, 'character.reactionSeconds.ended', 1, 600),
    },
    captions: Object.fromEntries(CAPTIONS.map((k) => [k, text(captions[k], `character.captions.${k}`)])) as Record<CaptionKey, string>,
    alt: Object.fromEntries(POSES.map((k) => [k, text(alt[k], `character.alt.${k}`)])) as Record<Pose, string>,
    poses,
    parts,
  }
}

/** Validates the tunable data file. Throws `SpecError` naming the bad field. */
export function parseSpec(raw: unknown): Spec {
  const root = section(raw, '$')
  int(root.specVersion, 'specVersion', 1, 1)

  const timer = section(root.timer, 'timer')
  const durations = section(timer.durationsMinutes, 'timer.durationsMinutes')
  const durationsMinutes = Object.fromEntries(
    PHASES.map((phase) => [phase, bounds(durations[phase], `timer.durationsMinutes.${phase}`)]),
  ) as Record<Phase, DurationBounds>

  const calendar = section(root.calendar, 'calendar')
  const decor = section(root.decor, 'decor')
  const seeds = section(decor.seeds, 'decor.seeds')
  const presentation = section(root.presentation, 'presentation')

  return {
    presentation: {
      motionEnabledDefault: bool(presentation.motionEnabledDefault, 'presentation.motionEnabledDefault'),
    },
    timer: {
      durationsMinutes,
      quickFocusMinutes: int(timer.quickFocusMinutes, 'timer.quickFocusMinutes', durationsMinutes.focus.min, durationsMinutes.focus.max),
      longBreakEvery: int(timer.longBreakEvery, 'timer.longBreakEvery', 1),
      soundEnabledDefault: bool(timer.soundEnabledDefault, 'timer.soundEnabledDefault'),
      completionSoundWindowMs:
        int(timer.completionSoundWindowSeconds, 'timer.completionSoundWindowSeconds', 0) * 1000,
    },
    calendar: {
      weekStartsOn: int(calendar.weekStartsOn, 'calendar.weekStartsOn', 0, 6),
    },
    decor: {
      roughness: positive(decor.roughness, 'decor.roughness'),
      bowing: positive(decor.bowing, 'decor.bowing'),
      // rough.js treats seed 0 as "use Math.random", so seeds start at 1.
      seeds: Object.fromEntries(
        DECOR_SEEDS.map((name) => [name, int(seeds[name], `decor.seeds.${name}`, 1, 2 ** 31 - 1)]),
      ) as Record<DecorSeed, number>,
    },
    palette: palette(root.palette),
    character: character(root.character),
  }
}
