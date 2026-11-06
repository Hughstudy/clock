import { TONES, type Tone } from './sketch'
import { PHASES, type Phase } from './types'

export interface DurationBounds {
  default: number
  min: number
  max: number
}

export const DECOR_SEEDS = ['chart'] as const
export type DecorSeed = (typeof DECOR_SEEDS)[number]

export interface Spec {
  presentation: {
    motionEnabledDefault: boolean
    encouragementEnabledDefault: boolean
    sceneVarietyEnabledDefault: boolean
  }
  timer: {
    durationsMinutes: Record<Phase, DurationBounds>
    stepMaxLength: number
    longBreakEvery: number
    soundEnabledDefault: boolean
    completionSoundWindowMs: number
    /** A break suggested by a deadline more than this long ago is not offered on a fresh open. */
    restSuggestionStaleMs: number
  }
  thoughts: {
    maxLength: number
    /** How long a deleted thought keeps its text for undo. */
    undoPeriodMs: number
    /** Repeated mark presses within this period are one accidental press. */
    markCoalesceMs: number
    /** Draft text is written after typing pauses for this long. */
    draftSaveDelayMs: number
    /** How long a success message and its shortcuts stay in the feedback slot. */
    statusVisibleMs: number
  }
  decor: {
    roughness: number
    bowing: number
    seeds: Record<DecorSeed, number>
  }
  palette: Record<Tone, string>
}

export class SpecError extends Error {
  constructor(path: string, problem: string) {
    super(`app-spec ${path}: ${problem}`)
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

/** Validates the tunable data file. Throws `SpecError` naming the bad field. */
export function parseSpec(raw: unknown): Spec {
  const root = section(raw, '$')
  int(root.specVersion, 'specVersion', 1, 1)

  const timer = section(root.timer, 'timer')
  const durations = section(timer.durationsMinutes, 'timer.durationsMinutes')
  const durationsMinutes = Object.fromEntries(
    PHASES.map((phase) => [phase, bounds(durations[phase], `timer.durationsMinutes.${phase}`)]),
  ) as Record<Phase, DurationBounds>

  const decor = section(root.decor, 'decor')
  const seeds = section(decor.seeds, 'decor.seeds')
  const presentation = section(root.presentation, 'presentation')
  const thoughts = section(root.thoughts, 'thoughts')

  return {
    presentation: {
      motionEnabledDefault: bool(presentation.motionEnabledDefault, 'presentation.motionEnabledDefault'),
      encouragementEnabledDefault: bool(presentation.encouragementEnabledDefault, 'presentation.encouragementEnabledDefault'),
      sceneVarietyEnabledDefault: bool(presentation.sceneVarietyEnabledDefault, 'presentation.sceneVarietyEnabledDefault'),
    },
    timer: {
      durationsMinutes,
      stepMaxLength: int(timer.stepMaxLength, 'timer.stepMaxLength', 1, 500),
      longBreakEvery: int(timer.longBreakEvery, 'timer.longBreakEvery', 1),
      soundEnabledDefault: bool(timer.soundEnabledDefault, 'timer.soundEnabledDefault'),
      completionSoundWindowMs:
        int(timer.completionSoundWindowSeconds, 'timer.completionSoundWindowSeconds', 0) * 1000,
      restSuggestionStaleMs: int(timer.restSuggestionStaleMinutes, 'timer.restSuggestionStaleMinutes', 1, 1440) * 60_000,
    },
    thoughts: {
      maxLength: int(thoughts.maxLength, 'thoughts.maxLength', 1, 5000),
      undoPeriodMs: int(thoughts.undoPeriodSeconds, 'thoughts.undoPeriodSeconds', 1, 86_400) * 1000,
      markCoalesceMs: int(thoughts.markCoalesceMs, 'thoughts.markCoalesceMs', 0, 5000),
      draftSaveDelayMs: int(thoughts.draftSaveDelayMs, 'thoughts.draftSaveDelayMs', 0, 10_000),
      statusVisibleMs: int(thoughts.statusVisibleSeconds, 'thoughts.statusVisibleSeconds', 1, 600) * 1000,
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
  }
}
