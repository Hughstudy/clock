import { useLayoutEffect, useState } from 'react'
import { cancelSceneJournal, turnSceneJournal } from '../components/scene-journal/navigation'
import { historyScreen, navigateScreen, returnScreen, subscribeScreens } from './useFocusTaskBack'

/** Browser navigation changes presentation only; timer and drafts keep their owners. */
export function useScreenNavigation() {
  const [screen, setScreen] = useState(historyScreen)
  useLayoutEffect(() => {
    // History and the visible tabs share this path. The destination owns
    // focus and accepts input while the journal moves into place.
    const unsubscribe = subscribeScreens(next => turnSceneJournal(next, () => setScreen(next)))
    return () => {
      unsubscribe()
      cancelSceneJournal()
    }
  }, [])
  return { screen, navigate: navigateScreen, back: returnScreen }
}
