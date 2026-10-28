import { useRegisterSW } from 'virtual:pwa-register/react'

export interface PwaUpdate {
  updateReady: boolean
  offlineReady: boolean
  applyUpdate: () => void
  dismiss: () => void
}

/** The new service worker waits until the user chooses to reload; nothing is forced mid-session. */
export function usePwaUpdate(): PwaUpdate {
  const {
    needRefresh: [updateReady, setUpdateReady],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()
  return {
    updateReady,
    offlineReady,
    applyUpdate: () => void updateServiceWorker(true),
    dismiss: () => {
      setUpdateReady(false)
      setOfflineReady(false)
    },
  }
}
