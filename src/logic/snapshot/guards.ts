export type Json = Record<string, unknown>
export const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
export const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
export const isInstant = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
/** A recorded millisecond that the JavaScript calendar can represent. */
export const isEpochMs = (v: unknown): v is number => isCount(v) && v <= 8_640_000_000_000_000
export const isPositiveMs = (v: unknown): v is number => isInstant(v) && v > 0
export const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128
export const isTimeZone = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64
export const isText = (v: unknown, max: number): v is string => typeof v === 'string' && Array.from(v).length <= max
export const isStep = (v: unknown): v is string | null => v === null || (typeof v === 'string' && v.length > 0 && v.length <= 2000)
