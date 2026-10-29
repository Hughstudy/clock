import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { applySettingsPatch, defaultSettings, sameSettings, sanitizeSettings } from './settings'

describe('motion preference', () => {
  it('loads the configured default for older settings without a repair warning', () => {
    const { motionEnabled: _, ...old } = defaultSettings(spec)
    expect(sanitizeSettings(old, spec)).toEqual({ settings: { ...old, motionEnabled: true }, issues: [] })
    const quietDefault = { ...spec, presentation: { motionEnabledDefault: false } }
    expect(sanitizeSettings(old, quietDefault).settings.motionEnabled).toBe(false)
  })

  it('keeps an explicit false and reports invalid values without changing other preferences', () => {
    const current = { ...defaultSettings(spec), soundEnabled: false, motionEnabled: false }
    expect(sanitizeSettings(current, spec)).toEqual({ settings: current, issues: [] })
    expect(sanitizeSettings({ ...current, motionEnabled: 'yes' }, spec)).toEqual({
      settings: { ...current, motionEnabled: true }, issues: ['settings.motionEnabled'],
    })
  })

  it('merges the preference as one field and preserves newer duration and sound edits', () => {
    const changedDuration = applySettingsPatch(defaultSettings(spec), { durationsMinutes: { focus: 15 }, soundEnabled: false }, spec)
    const quiet = applySettingsPatch(changedDuration, { motionEnabled: false }, spec)
    expect(quiet).toEqual({ durationsMinutes: { focus: 15, shortBreak: 5, longBreak: 15 }, soundEnabled: false, motionEnabled: false })
    expect(sameSettings(changedDuration, quiet)).toBe(false)
    expect(applySettingsPatch(quiet, { durationsMinutes: { longBreak: 20 } }, spec).motionEnabled).toBe(false)
  })
})
