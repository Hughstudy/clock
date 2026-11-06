import { useLayoutEffect, useState } from 'react'
import { historyScreen, navigateScreen, returnScreen, subscribeScreens } from './useFocusTaskBack'

/** Browser navigation changes presentation only; timer and drafts keep their owners. */
export function useScreenNavigation() {
  const [screen, setScreen] = useState(historyScreen)
  useLayoutEffect(() => subscribeScreens(setScreen), [])
  return { screen, navigate: navigateScreen, back: returnScreen }
}
