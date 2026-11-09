/** Whether the Focus card stays on screen. Presentation only: it never reads or writes a timer. */
export interface FocusChromeInput {
  /** A focus or rest countdown is running. Ready, paused and ended always keep the card. */
  running: boolean
  /** The card is still needed: a task, a note, an undo, an error, a finger or keyboard focus. */
  held: boolean
  /** When the card may leave, set by the latest start or interaction. */
  visibleUntil: number
  nowMs: number
}

/** Milliseconds until the card may step aside, or null while nothing would send it away. */
export function focusChromeDelay({ running, held, visibleUntil, nowMs }: FocusChromeInput): number | null {
  return running && !held ? Math.max(0, visibleUntil - nowMs) : null
}

/** The handle's explanation is for people still learning it. The current session counts as one. */
export function showsHandleHint(participations: number, hintSessions: number): boolean {
  return participations <= hintSessions
}
