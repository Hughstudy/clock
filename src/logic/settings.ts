import type { Spec } from './spec'
import { PHASES, type Phase, type Settings } from './types'

export function defaultSettings(spec: Spec): Settings {
  const durationsMinutes = Object.fromEntries(
    PHASES.map((phase) => [phase, spec.timer.durationsMinutes[phase].default]),
  ) as Record<Phase, number>
  return {
    durationsMinutes,
    soundEnabled: spec.timer.soundEnabledDefault,
    motionEnabled: spec.presentation.motionEnabledDefault,
    encouragementEnabled: spec.presentation.encouragementEnabledDefault,
    sceneVarietyEnabled: spec.presentation.sceneVarietyEnabledDefault,
  }
}

export type DurationCheck = { ok: true; minutes: number } | { ok: false; message: string }

/** Validates a duration typed by the user, in whole minutes within the spec bounds. */
export function checkDuration(phase: Phase, input: string, spec: Spec): DurationCheck {
  const { min, max } = spec.timer.durationsMinutes[phase]
  const text = input.trim()
  if (!/^\d+$/.test(text)) return { ok: false, message: `请输入 ${min} 到 ${max} 之间的整数分钟。` }
  const minutes = Number(text)
  if (minutes < min || minutes > max) return { ok: false, message: `请选择 ${min} 到 ${max} 分钟。` }
  return { ok: true, minutes }
}

export function isValidDuration(phase: Phase, value: unknown, spec: Spec): value is number {
  const { min, max } = spec.timer.durationsMinutes[phase]
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/**
 * Keeps each valid stored field and replaces invalid ones with defaults,
 * reporting what was replaced.
 */
export function sanitizeSettings(raw: unknown, spec: Spec): { settings: Settings; issues: string[] } {
  const defaults = defaultSettings(spec)
  if (!isRecord(raw)) return { settings: defaults, issues: ['settings'] }

  const issues: string[] = []
  const durations = isRecord(raw.durationsMinutes) ? raw.durationsMinutes : {}
  const durationsMinutes = { ...defaults.durationsMinutes }
  for (const phase of PHASES) {
    const value = durations[phase]
    if (isValidDuration(phase, value, spec)) durationsMinutes[phase] = value
    else issues.push(`settings.durationsMinutes.${phase}`)
  }

  let soundEnabled = defaults.soundEnabled
  if (typeof raw.soundEnabled === 'boolean') soundEnabled = raw.soundEnabled
  else issues.push('settings.soundEnabled')

  // These additive preferences were absent in older data. Missing is a normal
  // upgrade; malformed values still report a repair for raw-data backup.
  const optional = (key: 'motionEnabled' | 'encouragementEnabled' | 'sceneVarietyEnabled'): boolean => {
    const value = raw[key]
    if (typeof value === 'boolean') return value
    if (value !== undefined) issues.push(`settings.${key}`)
    return defaults[key]
  }
  const motionEnabled = optional('motionEnabled')
  const encouragementEnabled = optional('encouragementEnabled')
  const sceneVarietyEnabled = optional('sceneVarietyEnabled')

  return { settings: { durationsMinutes, soundEnabled, motionEnabled, encouragementEnabled, sceneVarietyEnabled }, issues }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Field-level change, applied to the latest stored settings rather than a possibly stale copy. */
export interface SettingsPatch {
  durationsMinutes?: Partial<Record<Phase, number>>
  soundEnabled?: boolean
  motionEnabled?: boolean
  encouragementEnabled?: boolean
  sceneVarietyEnabled?: boolean
}

/** Applies the valid fields of a patch; invalid fields leave the current value in place. */
export function applySettingsPatch(current: Settings, patch: SettingsPatch, spec: Spec): Settings {
  const durationsMinutes = { ...current.durationsMinutes }
  for (const phase of PHASES) {
    const value = patch.durationsMinutes?.[phase]
    if (isValidDuration(phase, value, spec)) durationsMinutes[phase] = value
  }
  const soundEnabled = typeof patch.soundEnabled === 'boolean' ? patch.soundEnabled : current.soundEnabled
  const motionEnabled = typeof patch.motionEnabled === 'boolean' ? patch.motionEnabled : current.motionEnabled
  const encouragementEnabled = typeof patch.encouragementEnabled === 'boolean' ? patch.encouragementEnabled : current.encouragementEnabled
  const sceneVarietyEnabled = typeof patch.sceneVarietyEnabled === 'boolean' ? patch.sceneVarietyEnabled : current.sceneVarietyEnabled
  return { durationsMinutes, soundEnabled, motionEnabled, encouragementEnabled, sceneVarietyEnabled }
}

export function sameSettings(a: Settings, b: Settings): boolean {
  return a.soundEnabled === b.soundEnabled && a.motionEnabled === b.motionEnabled && a.encouragementEnabled === b.encouragementEnabled && a.sceneVarietyEnabled === b.sceneVarietyEnabled &&
    PHASES.every((p) => a.durationsMinutes[p] === b.durationsMinutes[p])
}
