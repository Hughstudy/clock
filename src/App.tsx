import { useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { formatClock, PHASE_LABELS } from './components/format'
import { Notices } from './components/Notices'
import { TabBar, type Screen } from './components/TabBar'
import { useFeedback } from './hooks/companion/useFeedback'
import { useMotionPreference } from './hooks/companion/useMotionPreference'
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
  const companion = useFeedback(app, { active: screen === 'home' })
  const motion = useMotionPreference(app.snapshot.settings.motionEnabled)
  const pwa = usePwaUpdate()
  const canEdit = app.persistence !== 'read-only'

  useDocumentTitle(
    timerView.status === 'ready'
      ? 'Whale Focus'
      : `${formatClock(timerView.remainingMs)} · ${PHASE_LABELS[timerView.phase]} — Whale Focus`,
  )

  return (
    <div className="app" data-reduced-motion={motion.reducedMotion}>
      <AppHeader settingsOpen={screen === 'settings'} onSettings={() => setScreen(screen === 'settings' ? 'home' : 'settings')} />
      <Notices
        announceSaveError={screen !== 'home'}
        onRetry={() => app.dispatch({ type: 'retrySave' })}
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
        {app.notice?.kind === 'newer' ? (
          <p role="status">历史数据由更新版本保存，当前无法读取。请更新应用后查看。</p>
        ) : (
          <>
            <div hidden={screen !== 'home'}>
              <HomeScreen view={timerView} companion={companion} reducedMotion={motion.reducedMotion} saveState={app.saveState} canEdit={canEdit} dispatch={app.dispatch} />
            </div>
            {screen === 'stats' && <StatsScreen view={statsView} />}
            {screen === 'settings' && <SettingsScreen form={form} canEdit={canEdit} />}
          </>
        )}
      </main>
      <TabBar active={screen} onSelect={setScreen} />
      <p className="sr-only" aria-live={companion.feedback.announcement?.priority ?? 'polite'} aria-atomic="true">
        {companion.feedback.announcement?.text ?? ''}
      </p>
    </div>
  )
}
