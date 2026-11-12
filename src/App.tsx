import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatClock, PHASE_LABELS } from './components/format'
import { Notices } from './components/Notices'
import { TabBar, type Screen } from './components/TabBar'
import { TimerEndedBanner, timerEndedText } from './components/TimerEndedBanner'
import { focusCopy } from './data/focus-copy'
import { useFeedback } from './hooks/useFeedback'
import { useMotionPreference } from './hooks/companion/useMotionPreference'
import { useClockApp, type UserAction } from './hooks/useClockApp'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { useNow } from './hooks/useNow'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { useSettingsForm } from './hooks/useSettingsForm'
import { useScreenNavigation } from './hooks/useScreenNavigation'
import { useStatusExpiry } from './hooks/useStatusExpiry'
import { useThoughts } from './hooks/useThoughts'
import { useQuoteFavorites } from './hooks/useQuoteFavorites'
import { useStatsView, useTimerView } from './hooks/useViews'
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import type { BookVisit } from './components/records/book/navigation'

// Fast refresh only while a countdown is visible; otherwise often enough to roll over at midnight.
const RUNNING_REFRESH_MS = 250
const IDLE_REFRESH_MS = 15_000

/** True for requests that change the default focus length (or reset it). */
function changesFocusDefault(action: UserAction): boolean {
  return action.type === 'resetDurations' || (action.type === 'updateSettings' && action.patch.durationsMinutes?.focus !== undefined)
}

export function App() {
  const app = useClockApp()
  const { screen, navigate, back } = useScreenNavigation()
  const recordsVisit = useRef<BookVisit | null>(null)
  const visitGeneration = useRef(app.snapshot.datasetGeneration)
  if (visitGeneration.current !== app.snapshot.datasetGeneration) {
    recordsVisit.current = null
    visitGeneration.current = app.snapshot.datasetGeneration
  }
  const running = app.snapshot.timer.session?.status === 'running'
  const { now, refresh } = useNow(running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS)
  const timerView = useTimerView(app.snapshot, now)
  const statsView = useStatsView(app.snapshot, now, app.savedRecordIds, app.durableThoughts, app.durableRests)
  // Count default-length requests as they are made, so a slow save can't clear a newer pick on Focus.
  const [defaultsIntent, setDefaultsIntent] = useState(0)
  const appDispatch = app.dispatch
  const settingsDispatch = useCallback((action: UserAction) => {
    if (changesFocusDefault(action)) setDefaultsIntent(n => n + 1)
    appDispatch(action)
  }, [appDispatch])
  const form = useSettingsForm(app.snapshot.settings, settingsDispatch)
  const thoughts = useThoughts(app)
  const favorites = useQuoteFavorites(app)
  const [focusTaskOpen, setFocusTaskOpen] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateConflict, setUpdateConflict] = useState(false)
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
  const linkedThoughts = useMemo(() => statsView.thoughtDays.flatMap(day => day.entries.flatMap(entry =>
    entry.kind === 'thought' && entry.thought.sessionId === focusId ? [entry.thought] : [])), [statsView.thoughtDays, focusId])
  const companion = useFeedback(app, { active: screen === 'home', completedProgress: timerView.completedProgress })
  const motion = useMotionPreference(app.snapshot.settings.motionEnabled)
  const pwa = usePwaUpdate()
  useStatusExpiry(pwa.offlineReady && !pwa.updateReady ? 'offline-ready' : null, pwa.dismiss)
  const canEdit = app.persistence !== 'read-only'
  const [announcement, setAnnouncement] = useState<{ id: string; text: string; priority: 'polite' | 'assertive' } | null>(null)
  const announcementSequence = useRef(0)
  const announce = useCallback((text: string) => setAnnouncement({ id: `local-${++announcementSequence.current}`, text, priority: 'polite' }), [])
  const sourceAnnouncement = screen === 'stats' ? recordAnnouncement : screen === 'home' ? companion.feedback.announcement : null
  const sourceAnnouncementId = sourceAnnouncement?.id
  useEffect(() => { setAnnouncement(sourceAnnouncement) }, [screen, sourceAnnouncementId])
  useEffect(() => { if (favorites.status) announce(favorites.status) }, [favorites.status, announce])
  useEffect(() => {
    // Closed status panels cannot announce quiet draft/settings write failures.
    // Object-specific thought/favorite failures already use this same region.
    if (!app.saveError || screen === 'home' || favorites.problems.length || (screen === 'stats' && noteKind === 'error')) return
    setAnnouncement({ id: `save-error-${++announcementSequence.current}`, text: '最新更改尚未保存。请保留页面，可通过查看状态重试保存。', priority: 'assertive' })
  }, [app.saveError, screen])
  const protectedInput = thoughts.open || thoughts.hasDraft || !!thoughts.text || form.hasDraft || focusTaskOpen
  const updateBlocked = timerView.sessionId ? '新版本已准备好。请在这段计时结束后更新。'
    : protectedInput ? '新版本已准备好。请先保存或处理当前输入，再更新。'
    : app.hasPendingOperations || (app.saveState !== 'saved' && app.notice?.kind !== 'newer') ? '新版本已准备好。请先确认当前更改已保存，再更新。'
    : null
  const updateGuard = useRef({ protectedInput, sessionId: timerView.sessionId })
  updateGuard.current = { protectedInput, sessionId: timerView.sessionId }
  useEffect(() => setUpdateConflict(false), [app.snapshot.revision, protectedInput, timerView.sessionId])
  const update = async () => {
    if (checkingUpdate || updateGuard.current.protectedInput || updateGuard.current.sessionId) return
    setCheckingUpdate(true)
    try {
      const safe = await app.checkReload()
      if (safe && !updateGuard.current.protectedInput && !updateGuard.current.sessionId) pwa.applyUpdate()
      else setUpdateConflict(true)
    } catch { setUpdateConflict(true) }
    finally { setCheckingUpdate(false) }
  }

  // An ending seen on Focus needs no second notice on the other screens.
  const ended = app.result
  const [seenEnding, setSeenEnding] = useState<string | null>(null)
  useEffect(() => { if (screen === 'home') setSeenEnding(ended?.sessionId ?? null) }, [screen, ended?.sessionId])
  const unseenEnding = ended && screen !== 'home' && seenEnding !== ended.sessionId ? ended : null
  const unseenEndingId = unseenEnding?.sessionId
  const unseenEndingText = unseenEnding && timerEndedText(unseenEnding)
  useEffect(() => {
    if (unseenEndingId && unseenEndingText) setAnnouncement({ id: `ended-${unseenEndingId}-${unseenEndingText}`, text: unseenEndingText, priority: 'polite' })
  }, [unseenEndingId, unseenEndingText])

  useDocumentTitle(
    timerView.status !== 'ready'
      ? `${formatClock(timerView.remainingMs)} · ${PHASE_LABELS[timerView.phase]} — Whale Focus`
      : ended && (screen === 'home' || unseenEnding)
        ? `${ended.phase === 'focus' ? focusCopy.focusEndedTitle : focusCopy.restEndedTitle} — Whale Focus`
        : screen === 'settings' ? '设置 — Whale Focus' : screen === 'stats' ? '记录 — Whale Focus' : 'Whale Focus',
  )

  // Moving between screens without the tab bar moves keyboard and screen-reader focus with it:
  // into Settings' heading, back to the button that opened Settings, or to the result's next action.
  const focusOnHome = useRef<string | null>(null)
  const previousScreen = useRef(screen)
  useLayoutEffect(() => {
    const from = previousScreen.current
    previousScreen.current = screen
    if (from === screen) return
    const target = screen === 'settings' ? '#settings-title' : screen === 'home'
      ? focusOnHome.current ?? (from === 'settings' ? '.home .fp-top .pill--icon' : '.tab[data-tab="home"]')
      : '#stats-title'
    focusOnHome.current = null
    if (target) document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true })
  }, [screen])
  // Settings is a separate surface with a way back, so entering and leaving it has a direction:
  // it slides in from the trailing edge, and Focus fades back in on return. Tabs stay instant.
  // The screen changes synchronously in the same tap; only its first frames ease in.
  const navTimer = useRef(0)
  const openScreen = (next: Screen, focusTarget: string | null = null, returning = false) => {
    const root = document.documentElement
    window.clearTimeout(navTimer.current)
    if ((next === 'settings' || screen === 'settings') && !motion.reducedMotion) {
      root.dataset.nav = next === 'settings' ? 'forward' : 'back'
      navTimer.current = window.setTimeout(() => { delete root.dataset.nav }, 400)
    } else delete root.dataset.nav
    focusOnHome.current = focusTarget
    if (returning) back(next)
    else navigate(next)
  }

  // A new install opens quietly: offline readiness is listed in Settings › 应用状态, not on Focus.
  const systemNoticeSummary = app.notice ? '数据状态需要查看' : app.saveError ? '有更改尚未保存' : pwa.updateReady ? '新版本已准备好' : null
  const settingsNoticeSummary = systemNoticeSummary ?? (pwa.offlineReady ? '已准备好离线使用。' : null)
  const notices = (
    <Notices
        inline={app.notice?.kind !== 'newer'}
        announceSaveError={screen !== 'home' && !(screen === 'stats' && noteKind === 'error')}
        onRetry={() => app.dispatch({ type: 'retrySave' })}
        persistence={app.persistence}
        notice={app.notice}
        saveError={screen === 'home' ? null : app.saveError}
        updateReady={pwa.updateReady && timerView.status === 'ready'}
        updateBlocked={updateBlocked}
        checkingUpdate={checkingUpdate}
        updateError={updateConflict}
        offlineReady={pwa.offlineReady}
        onUpdate={() => void update()}
        onDismissPwa={pwa.dismiss}
      />
  )

  return (
    <div className="app" data-screen={screen} data-reduced-motion={motion.reducedMotion}>
      {app.notice?.kind === 'newer' && notices}
      <main className="app-main">
        {app.notice?.kind === 'newer' ? (
          <p role="status">历史数据由更新版本保存，当前无法读取。请更新应用后查看。</p>
        ) : (
          <>
            {/* Settings is a sheet over Focus, so Focus stays in view behind it, out of reach. */}
            <div hidden={screen === 'stats'} {...(screen === 'settings' ? { inert: '' } : {})}>
              <HomeScreen key={app.snapshot.datasetGeneration} view={timerView} companion={companion} thoughts={thoughts} reducedMotion={motion.reducedMotion}
                active={screen === 'home'} result={app.result} linkedThoughts={linkedThoughts} defaultsIntent={defaultsIntent}
                favorites={favorites} timerPending={app.timerPending} onTaskChange={setFocusTaskOpen}
                systemNoticeSummary={systemNoticeSummary} systemNotices={notices}
                saveState={app.saveState} canEdit={canEdit} dispatch={app.dispatch} onSettings={() => openScreen('settings')} />
            </div>
            {screen === 'stats' && <RecordsScreen key={app.snapshot.datasetGeneration} view={statsView} thoughts={thoughts} canEdit={canEdit} visit={recordsVisit}
              favorites={favorites}
              onAnnounce={announce}
              systemNoticeSummary={systemNoticeSummary} systemNotices={notices}
              persistence={app.persistence} notice={app.notice} hasSaveError={!!app.saveError}
              showArt={app.snapshot.settings.sceneVarietyEnabled} />}
            {screen === 'settings' && <SettingsScreen form={form} canEdit={canEdit} onBack={() => openScreen('home', '.home .fp-top .pill--icon', true)}
              systemNoticeSummary={settingsNoticeSummary} systemNotices={notices} />}
          </>
        )}
      </main>
      {unseenEnding && <TimerEndedBanner result={unseenEnding} onView={() => openScreen('home', '.home .fp-primary button')} onDismiss={() => setSeenEnding(unseenEnding.sessionId)} />}
      <TabBar active={screen} onSelect={next => {
        if (next === 'stats' && next !== screen) refresh()
        openScreen(next)
      }} />
      <p className="sr-only" aria-live={announcement?.priority ?? 'polite'} aria-atomic="true">
        {announcement && <span key={announcement.id}>{announcement.text}</span>}
      </p>
    </div>
  )
}
