/** Calls `onResume` when the page becomes visible again, is restored from bfcache, or regains focus. */
export function onAppResume(onResume: () => void): () => void {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') onResume()
  }
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pageshow', onResume)
  window.addEventListener('focus', onResume)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('pageshow', onResume)
    window.removeEventListener('focus', onResume)
  }
}
