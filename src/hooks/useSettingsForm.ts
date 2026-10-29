import { useEffect, useState } from 'react'
import { spec } from '../data/spec'
import { applySettingsPatch, checkDuration, defaultSettings, sameSettings, type SettingsPatch } from '../logic/settings'
import { PHASES, type Phase, type Settings } from '../logic/types'
import type { UserAction } from './useClockApp'

export interface DurationField {
  phase: Phase
  draft: string
  error: string | null
  min: number
  max: number
  value: number
  onChange: (text: string) => void
  onBlur: () => void
  step: (delta: number) => void
  /** Discards an invalid entry and shows the saved value again. */
  restorePrevious: () => void
}

export interface SettingsForm {
  fields: DurationField[]
  soundEnabled: boolean
  setSoundEnabled: (on: boolean) => void
  motionEnabled: boolean
  setMotionEnabled: (on: boolean) => void
  encouragementEnabled: boolean
  setEncouragementEnabled: (on: boolean) => void
  isDefault: boolean
  restoreDefaults: () => void
}

/**
 * Saves each valid edit immediately. An invalid entry stays on screen with its
 * range error until the user fixes it or explicitly restores the saved value;
 * it is never silently replaced.
 * Saves are asynchronous, so the form shows edits optimistically until the saved settings
 * arrive; quick repeated taps then build on what is on screen instead of a stale value.
 */
export function useSettingsForm(saved: Settings, dispatch: (action: UserAction) => void): SettingsForm {
  const [drafts, setDrafts] = useState<Partial<Record<Phase, string>>>({})
  const [pending, setPending] = useState<SettingsPatch[]>([])
  // Each committed save produces new settings; drop the optimistic layer then.
  useEffect(() => setPending([]), [saved])
  const settings = pending.reduce<Settings>((acc, patch) => applySettingsPatch(acc, patch, spec), saved)

  const save = (patch: SettingsPatch) => {
    setPending((p) => [...p, patch])
    dispatch({ type: 'updateSettings', patch })
  }
  const saveMinutes = (phase: Phase, minutes: number) => save({ durationsMinutes: { [phase]: minutes } })
  const clearDraft = (phase: Phase) =>
    setDrafts((d) => {
      const next = { ...d }
      delete next[phase]
      return next
    })

  const fields = PHASES.map((phase): DurationField => {
    const { min, max } = spec.timer.durationsMinutes[phase]
    const value = settings.durationsMinutes[phase]
    const draft = drafts[phase] ?? String(value)
    const check = checkDuration(phase, draft, spec)
    return {
      phase,
      draft,
      error: check.ok ? null : check.message,
      min,
      max,
      value,
      onChange: (text) => {
        setDrafts((d) => ({ ...d, [phase]: text }))
        const result = checkDuration(phase, text, spec)
        if (result.ok && result.minutes !== value) saveMinutes(phase, result.minutes)
      },
      onBlur: () => { if (check.ok) clearDraft(phase) },
      step: (delta) => {
        const minutes = Math.min(max, Math.max(min, value + delta))
        clearDraft(phase)
        if (minutes !== value) saveMinutes(phase, minutes)
      },
      restorePrevious: () => clearDraft(phase),
    }
  })

  const defaults = defaultSettings(spec)
  return {
    fields,
    soundEnabled: settings.soundEnabled,
    setSoundEnabled: (on) => save({ soundEnabled: on }),
    motionEnabled: settings.motionEnabled,
    setMotionEnabled: (on) => save({ motionEnabled: on }),
    encouragementEnabled: settings.encouragementEnabled,
    setEncouragementEnabled: (on) => save({ encouragementEnabled: on }),
    isDefault: sameSettings({ ...defaults, soundEnabled: settings.soundEnabled, motionEnabled: settings.motionEnabled, encouragementEnabled: settings.encouragementEnabled }, settings),
    restoreDefaults: () => {
      setDrafts({})
      save({ durationsMinutes: defaults.durationsMinutes })
    },
  }
}
