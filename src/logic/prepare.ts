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
