const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Browser preference reads stay outside deterministic domain logic. */
export function readReducedMotion(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
