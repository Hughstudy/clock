import { useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { FocusTaskDialog } from './components/FocusTaskDialog'
import { ThoughtPanel } from './components/ThoughtPanel'
import { formatClock, PHASE_LABELS } from './components/format'
import { Notices } from './components/Notices'
import { TabBar, type Screen } from './components/TabBar'
import { useFeedback } from './hooks/companion/useFeedback'
import { useMotionPreference } from './hooks/companion/useMotionPreference'
import { useClockApp } from './hooks/useClockApp'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { useFocusTaskBack } from './hooks/useFocusTaskBack'
import { useNow } from './hooks/useNow'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { useSettingsForm } from './hooks/useSettingsForm'
import { useThoughts } from './hooks/useThoughts'
import { useStatsView, useTimerView } from './hooks/useViews'
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen, type RecordsVisit } from './screens/StatsScreen'

// Fast refresh only while a countdown is visible; otherwise often enough to roll over at midnight.
const RUNNING_REFRESH_MS = 250
const IDLE_REFRESH_MS = 15_000

export function App({ entryLayout = 'console' }: { entryLayout?: 'console' | 'cards' }) {
  const app = useClockApp()
  const [screen, setScreen] = useState<Screen>('home')
  const recordsVisit = useRef<RecordsVisit | null>(null)
  const visitGeneration = useRef(app.snapshot.datasetGeneration)
  if (visitGeneration.current !== app.snapshot.datasetGeneration) {
    recordsVisit.current = null
    visitGeneration.current = app.snapshot.datasetGeneration
  }
  const running = app.snapshot.timer.session?.status === 'running'
  const { now, refresh } = useNow(running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS)
  const timerView = useTimerView(app.snapshot, now)
  const statsView = useStatsView(app.snapshot, now, app.savedRecordIds, app.durableThoughts)
  const form = useSettingsForm(app.snapshot.settings, app.dispatch)
  const thoughts = useThoughts(app)
  useFocusTaskBack(screen === 'stats' && thoughts.open, () => thoughts.setOpen(false))
  // The companion consumes hidden events silently. Announce a Records edit or
  // undo in the same app-level live region, only on a fresh object receipt.
  const receipt = app.thoughtResult
  const receiptKey = receipt && [receipt.generation, receipt.operationId, receipt.change, receipt.saved].join('/')
  const consumed = useRef<string | null>(receiptKey)
  const [recordAnnouncement, setRecordAnnouncement] = useState<{ id: string; text: string; priority: 'polite' | 'assertive' } | null>(null)
  const noteText = thoughts.status?.text
  const noteKind = thoughts.status?.kind
  useEffect(() => {
    if (screen !== 'stats') setRecordAnnouncement(null)
    if (receiptKey === consumed.current) return
    consumed.current = receiptKey
    if (screen === 'stats' && receiptKey && noteText) {
      setRecordAnnouncement({ id: receiptKey, text: noteText, priority: noteKind === 'error' ? 'assertive' : 'polite' })
    }
  }, [screen, receiptKey, noteText, noteKind])
  const focusId = app.snapshot.timer.session?.id ?? app.result?.sessionId
  const linkedThoughts = useMemo(() => app.snapshot.thoughts.filter(t =>
    t.deletedAt === null && t.sessionId === focusId), [app.snapshot.thoughts, focusId])
  const companion = useFeedback(app, { active: screen === 'home', completedProgress: timerView.completedProgress })
  const motion = useMotionPreference(app.snapshot.settings.motionEnabled)
  const pwa = usePwaUpdate()
  const canEdit = app.persistence !== 'read-only'
  const announcement = screen === 'stats' ? recordAnnouncement : companion.feedback.announcement

  useDocumentTitle(
    timerView.status === 'ready'
      ? 'Whale Focus'
      : `${formatClock(timerView.remainingMs)} · ${PHASE_LABELS[timerView.phase]} — Whale Focus`,
  )

  return (
    <div className="app" data-reduced-motion={motion.reducedMotion}>
      <AppHeader settingsOpen={screen === 'settings'} showSettings={screen !== 'stats'} onSettings={() => setScreen(screen === 'settings' ? 'home' : 'settings')} />
      <Notices
        announceSaveError={screen !== 'home' && !(screen === 'stats' && noteKind === 'error')}
        onRetry={() => app.dispatch({ type: 'retrySave' })}
        persistence={app.persistence}
        notice={app.notice}
        saveError={screen === 'home' ? null : app.saveError}
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
              <HomeScreen key={app.snapshot.datasetGeneration} view={timerView} companion={companion} thoughts={thoughts} reducedMotion={motion.reducedMotion}
                active={screen === 'home'} result={app.result} linkedThoughts={linkedThoughts} durationResetKey={app.durationResetKey}
                entryLayout={entryLayout} saveState={app.saveState} canEdit={canEdit} dispatch={app.dispatch} />
            </div>
            {screen === 'stats' && <StatsScreen key={app.snapshot.datasetGeneration} view={statsView} thoughts={thoughts} canEdit={canEdit} visit={recordsVisit}
              onEditThought={thoughts.edit}
              persistence={app.persistence} notice={app.notice} hasSaveError={!!app.saveError}
              showArt={app.snapshot.settings.sceneVarietyEnabled} reducedMotion={motion.reducedMotion} />}
            {screen === 'stats' && thoughts.open && <FocusTaskDialog title="编辑想法" onClose={() => thoughts.setOpen(false)}>
              <ThoughtPanel thoughts={thoughts} canEdit={canEdit} />
              {app.saveState === 'pending' && <p className="panel-save-error">有更改尚未保存。
                <button type="button" className="link-button" onClick={() => app.dispatch({ type: 'retrySave' })}>重试保存</button></p>}
            </FocusTaskDialog>}
            {screen === 'settings' && <SettingsScreen form={form} canEdit={canEdit} />}
          </>
        )}
      </main>
      <TabBar active={screen} onSelect={next => {
        if (next === 'stats' && next !== screen) refresh()
        setScreen(next)
      }} />
      <p className="sr-only" aria-live={announcement?.priority ?? 'polite'} aria-atomic="true">
        {announcement && <span key={announcement.id}>{announcement.text}</span>}
      </p>
    </div>
  )
}
