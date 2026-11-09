import { describe, expect, it } from 'vitest'
import { SCENE_LIGHT } from '../data/scene-light'
import { contrastRatio, mixHex, multiplyHex, nightLevel, resolveSceneLight, SKY_INK } from './daylight'

const at = (hour: number, minute = 0) => hour * 60 + minute

describe('day and night from the device clock', () => {
  it('is full day from 06:30 to 17:30 and full night from 18:30 to 05:30', () => {
    for (const minutes of [at(6, 30), at(9), at(12), at(17, 30)]) expect(nightLevel(minutes)).toBe(0)
    for (const minutes of [at(18, 30), at(21), at(0), at(5, 30)]) expect(nightLevel(minutes)).toBe(1)
  })

  it('is halfway through twilight exactly at 06:00 and 18:00', () => {
    expect(nightLevel(at(6))).toBe(0.5)
    expect(nightLevel(at(18))).toBe(0.5)
  })

  it('changes only in steps too small to see, in the right direction', () => {
    let previous = nightLevel(at(17, 30))
    for (let minute = at(17, 30); minute <= at(18, 30); minute++) {
      const level = nightLevel(minute)
      expect(level).toBeGreaterThanOrEqual(previous)
      expect(level - previous).toBeLessThanOrEqual(1 / 16)
      previous = level
    }
  })

  it('wraps past midnight and ignores invalid times', () => {
    expect(nightLevel(at(24, 30))).toBe(nightLevel(at(0, 30)))
    expect(nightLevel(-60)).toBe(nightLevel(at(23)))
    expect(nightLevel(Number.NaN)).toBe(0)
  })

  it.each(['workroom', 'garden'] as const)('keeps the %s clock readable at every level', setting => {
    for (let step = 0; step <= 32; step++) {
      const light = resolveSceneLight(SCENE_LIGHT[setting], step / 32)
      expect(contrastRatio(SKY_INK[light.skyInk], light.sky), `${setting} at ${step}/32`).toBeGreaterThanOrEqual(4.5)
      for (const color of [...Object.values(light.colors), light.sky, light.floor]) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('shows the sun by day and the moon and stars at night, never both at full strength', () => {
    const day = resolveSceneLight(SCENE_LIGHT.garden, 0), night = resolveSceneLight(SCENE_LIGHT.garden, 1)
    expect(day).toMatchObject({ sun: 1, moon: 0, stars: 0 })
    expect(night).toMatchObject({ sun: 0, moon: 1, stars: 1 })
    for (let step = 0; step <= 32; step++) {
      const light = resolveSceneLight(SCENE_LIGHT.garden, step / 32)
      expect(light.sun + light.moon).toBeLessThanOrEqual(1.2)
    }
  })

  it('keeps the original daylight colors unchanged', () => {
    const room = resolveSceneLight(SCENE_LIGHT.workroom, 0), garden = resolveSceneLight(SCENE_LIGHT.garden, 0)
    expect(room).toMatchObject({ sky: '#f4dfc5', floor: '#edcfaf', dim: 0, skyInk: 'default' })
    expect(garden.sky).toBe('#c4dedc')
  })

  it('mixes and multiplies colors exactly', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(multiplyHex('#ffffff', '#808080', 1)).toBe('#808080')
    expect(multiplyHex('#123456', '#000000', 0)).toBe('#123456')
  })
})
