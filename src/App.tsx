import { useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { formatClock, PHASE_LABELS } from './components/format'
import { Notices } from './components/Notices'
import { TabBar, type Screen } from './components/TabBar'
import { useCharacter } from './hooks/useCharacter'
import { useClockApp } from './hooks/useClockApp'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { useNow } from './hooks/useNow'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { useSettingsForm } from './hooks/useSettingsForm'
import { useStatsView, useTimerView } from './hooks/useViews'
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'

// Fast refresh only while a countdown is visible; otherwise often enough to roll over at midnight.
const RUNNING_REFRESH_MS = 250
const IDLE_REFRESH_MS = 15_000

export function App() {
  const app = useClockApp()
  const [screen, setScreen] = useState<Screen>('home')
  const running = app.snapshot.timer.session?.status === 'running'
  const now = useNow(running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS)
  const timerView = useTimerView(app.snapshot, now)
  const statsView = useStatsView(app.snapshot, now)
  const form = useSettingsForm(app.snapshot.settings, app.dispatch)
  const character = useCharacter(timerView, app.reaction)
  const pwa = usePwaUpdate()
  const canEdit = app.persistence !== 'read-only'

  useDocumentTitle(
    timerView.status === 'ready'
      ? 'Whale Focus'
      : `${formatClock(timerView.remainingMs)} · ${PHASE_LABELS[timerView.phase]} — Whale Focus`,
  )

  return (
    <div className="app">
      <AppHeader />
      <Notices
        persistence={app.persistence}
        notice={app.notice}
        saveError={app.saveError}
        // Offer updates only between sessions so a countdown is never interrupted.
        updateReady={pwa.updateReady && timerView.status === 'ready'}
        offlineReady={pwa.offlineReady}
        onUpdate={pwa.applyUpdate}
        onDismissPwa={pwa.dismiss}
      />
      <main className="app-main">
        {screen === 'home' && (
          <HomeScreen view={timerView} character={character} canEdit={canEdit} dispatch={app.dispatch} />
        )}
        {screen === 'stats' && <StatsScreen view={statsView} />}
        {screen === 'settings' && <SettingsScreen form={form} canEdit={canEdit} />}
      </main>
      <TabBar active={screen} onSelect={setScreen} />
      <p className="sr-only" aria-live="polite">
        {app.announcement}
      </p>
    </div>
  )
}
