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

/** Calls `onHide` when the page is hidden or put into the back/forward cache. */
export function onAppHide(onHide: () => void): () => void {
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') onHide()
  }
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pagehide', onHide)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('pagehide', onHide)
  }
}
