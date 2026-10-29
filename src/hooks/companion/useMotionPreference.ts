import { useSyncExternalStore } from 'react'
import { readReducedMotion, subscribeReducedMotion } from '../../adapters/motion'

const staticOnServer = () => true

/** A saved app preference can reduce motion further, never override the OS. */
export function useMotionPreference(enabled: boolean) {
  const systemReducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, staticOnServer)
  return { systemReducedMotion, reducedMotion: systemReducedMotion || !enabled }
}
