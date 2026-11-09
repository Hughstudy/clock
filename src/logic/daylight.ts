/**
 * Day and night from the device's local time: daylight from 06:00 to 18:00, night otherwise,
 * easing over an hour centred on each change. Presentation only; pure, with time injected.
 */
const DAWN_MIN = 6 * 60
const DUSK_MIN = 18 * 60
const HALF_TWILIGHT_MIN = 30
/** Enough steps that each is invisible, few enough that the art rarely redraws. */
const STEPS = 32

const smooth = (v: number) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t) }

/** 0 in full daylight, 1 at full night. */
export function nightLevel(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0
  const m = ((minutes % 1440) + 1440) % 1440
  const dawn = smooth((m - (DAWN_MIN - HALF_TWILIGHT_MIN)) / (2 * HALF_TWILIGHT_MIN))
  const dusk = smooth((m - (DUSK_MIN - HALF_TWILIGHT_MIN)) / (2 * HALF_TWILIGHT_MIN))
  return Math.round((1 - dawn + dusk) * STEPS) / STEPS
}

export type SceneLightKey = 'washTop' | 'washBottom' | 'floor' | 'viewSky' | 'viewFar' | 'viewNear' | 'far' | 'near' | 'hedge' | 'leaf' | 'groundLine' | 'groundMark'
type Stop = Readonly<Record<SceneLightKey, string>>
export interface SceneLightPalette {
  /** Full daylight, twilight, full night. */
  stops: readonly [Stop, Stop, Stop]
  /** Strength of a multiply wash over the room at the same three points. */
  dim: readonly [number, number, number]
  dimTint: string
}
export type SkyInk = 'default' | 'deep' | 'light'
export interface SceneLight {
  colors: Record<SceneLightKey, string>
  dim: number
  dimTint: string
  sun: number
  moon: number
  stars: number
  lamp: number
  /** The colors the page extends beyond the framed art, matching its edges exactly. */
  sky: string
  floor: string
  skyInk: SkyInk
}

type Rgb = readonly [number, number, number]
function rgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
const hex = (c: Rgb) => `#${c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
export const mixHex = (a: string, b: string, t: number): string => {
  const x = rgb(a), y = rgb(b)
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}
/** The same result as `mix-blend-mode: multiply` at the given strength. */
export const multiplyHex = (color: string, tint: string, strength: number): string => {
  const c = rgb(color), m = rgb(tint), scale = (i: 0 | 1 | 2) => c[i] * (1 - strength + strength * m[i] / 255)
  return hex([scale(0), scale(1), scale(2)])
}
function luminance(color: string): number {
  const [r, g, b] = rgb(color).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }) as unknown as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export const SKY_INK: Readonly<Record<SkyInk, string>> = { default: '#2c4a78', deep: '#0a1120', light: '#ffffff' }

export function resolveSceneLight(palette: SceneLightPalette, night: number): SceneLight {
  const n = Math.min(1, Math.max(0, Number.isFinite(night) ? night : 0))
  const [day, twilight, dark] = palette.stops
  const [from, to, t] = n < 0.5 ? [day, twilight, n * 2] as const : [twilight, dark, (n - 0.5) * 2] as const
  const colors = Object.fromEntries((Object.keys(day) as SceneLightKey[]).map(key => [key, mixHex(from[key], to[key], t)])) as Record<SceneLightKey, string>
  const dim = n < 0.5 ? palette.dim[0] + (palette.dim[1] - palette.dim[0]) * n * 2 : palette.dim[1] + (palette.dim[2] - palette.dim[1]) * (n - 0.5) * 2
  const sky = multiplyHex(colors.washTop, palette.dimTint, dim)
  const skyInk: SkyInk = contrastRatio(SKY_INK.default, sky) >= 4.5 ? 'default' : contrastRatio(SKY_INK.deep, sky) >= 4.5 ? 'deep' : 'light'
  return {
    colors, dim, dimTint: palette.dimTint, sky, skyInk,
    floor: multiplyHex(colors.floor, palette.dimTint, dim),
    sun: 1 - smooth((n - 0.2) / 0.4),
    moon: smooth((n - 0.45) / 0.4),
    stars: smooth((n - 0.55) / 0.4),
    lamp: smooth((n - 0.4) / 0.6),
  }
}
