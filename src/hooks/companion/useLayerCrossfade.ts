import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Layer { key: string; layer: ReactNode }

/**
 * When the drawn layer changes identity (preparation to an activity, one activity to
 * the next), keep the last committed drawing for a short fade above the incoming one,
 * so a start reads as one continuous moment rather than a cut. Controls never wait.
 */
export function useLayerCrossfade(key: string, layer: ReactNode, durationMs: number, disabled: boolean): { outgoing: ReactNode; outgoingKey: string | null } {
  // Compare with what was last committed, never a value changed during render, so a
  // repeated render (Strict Mode, an interrupted render) makes the same decision.
  const committed = useRef<Layer>({ key, layer })
  const [fading, setFading] = useState<Layer | null>(null)
  const previous = committed.current
  if (!disabled && previous.key !== key && fading?.key !== previous.key) setFading(previous)
  useLayoutEffect(() => { committed.current = { key, layer } })
  useEffect(() => {
    if (!fading) return
    const timer = window.setTimeout(() => setFading(null), durationMs)
    return () => window.clearTimeout(timer)
  }, [fading, durationMs])
  // Attention or a disabled motion setting ends a fade at once; it never resumes later.
  useEffect(() => { if (disabled) setFading(null) }, [disabled])
  const shown = disabled ? null : fading
  return { outgoing: shown?.layer ?? null, outgoingKey: shown?.key ?? null }
}
