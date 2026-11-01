import { useCallback, useState } from 'react'
import { keepsDurationChoice, validateDurationDraft, type DurationChoice } from '../logic/prepare'

export { validateDurationDraft }

/** This visit's one-off focus length, ordered against default-length requests made in Settings. */
export function useDurationChoice(defaultsIntent: number) {
  const [choice, setChoice] = useState<DurationChoice | null>(null)
  const pick = useCallback((minutes: number) => setChoice({ minutes, intent: defaultsIntent }), [defaultsIntent])
  const clear = useCallback(() => setChoice(null), [])
  return { picked: keepsDurationChoice(choice, defaultsIntent) ? choice.minutes : null, pick, clear }
}
