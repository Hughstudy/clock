/**
 * A one-off focus length picked on the Focus page for this visit. `intent` is the
 * count of default-duration changes the user had requested when they picked it.
 */
export interface DurationChoice { minutes: number; intent: number }

/**
 * A saved default change replaces only choices made before it was requested.
 * A late receipt for an earlier request never clears a newer explicit pick.
 */
export function keepsDurationChoice(choice: DurationChoice | null, latestIntent: number): choice is DurationChoice {
  return choice !== null && choice.intent >= latestIntent
}

export type DurationDraft =
  | { ok: true; minutes: number }
  | { ok: false; reason: 'empty' | 'notInteger' | 'range' }

/** Whole minutes within the phase bounds. An invalid draft stays editable; nothing is coerced. */
export function validateDurationDraft(draft: string, min: number, max: number): DurationDraft {
  const text = draft.trim()
  if (!text) return { ok: false, reason: 'empty' }
  if (!/^\d+$/.test(text)) return { ok: false, reason: 'notInteger' }
  const minutes = Number(text)
  return minutes >= min && minutes <= max ? { ok: true, minutes } : { ok: false, reason: 'range' }
}

/**
 * The whole minute a dial angle (radians clockwise from twelve) points at, on
 * the lap `current` is already on. Twelve closes a lap, so it reads 60, never 0.
 */
export function minuteAtDialAngle(angle: number, current: number, min: number, max: number): number {
  const turn = ((angle / (2 * Math.PI)) % 1 + 1) % 1
  const lap = Math.floor((Math.max(1, current) - 1) / 60)
  return Math.max(min, Math.min(max, lap * 60 + (Math.round(turn * 60) || 60)))
}

/** Travel past either end stays within one lap of it, so the hand rejoins the finger on the way back. */
export function boundDialTravel(travel: number, min: number, max: number): number {
  return travel < min - 60 ? travel + 60 : travel > max + 60 ? travel - 60 : travel
}
