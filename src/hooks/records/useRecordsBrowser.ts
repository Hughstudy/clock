import { useLayoutEffect, useRef, useState, type MouseEvent, type MutableRefObject } from 'react'
import { quoteKey, type QuoteFavoritesController } from '../../contracts/favorites'
import { sceneNames } from '../../data/scene-copy'
import type { FocusSceneId } from '../../logic/types'
import type { RangeLength } from '../../logic/stats'
import { RECORDS_PAGE_SIZE } from '../../logic/records-query'
import { useFocusTaskBack } from '../useFocusTaskBack'
import type { RecordView, StatsView } from '../useViews'
import { useRecordsQuery, type RecordsMode as Mode, type MonthFilter } from './useRecordsQuery'
import { initialVisit, monthLabel, RECORDS_MODES, type Browse, type Position, type RecordsVisit } from './visit'

interface Options {
  view: StatsView
  favorites: QuoteFavoritesController | undefined
  visit: MutableRefObject<RecordsVisit | null>
  incomplete: boolean
  thoughtsIncomplete: boolean
  onAnnounce: ((text: string) => void) | undefined
}

/** Owns browsing state and DOM restoration together; never writes product data. */
export function useRecordsBrowser({ view, favorites, visit, incomplete, thoughtsIncomplete, onAnnounce }: Options) {
  const [reading, setReading] = useState<RecordsVisit>(() => visit.current ?? initialVisit(view.band))
  const { mode } = reading
  const current = reading.browse[mode]
  const screen = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const positions = useRef(reading.positions)
  const readingRef = useRef(reading)
  readingRef.current = reading
  const [monthPanel, setMonthPanel] = useState(false)
  const [statusPanel, setStatusPanel] = useState(false)
  const [year, setYear] = useState(view.todayKey.slice(0, 4))
  const composing = useRef(false)
  const pageFocus = useRef(false)
  const announceQuery = useRef(false)
  const previousQuery = useRef('')
  const previousIds = useRef<string[]>([])
  const restorePosition = useRef<Position | null>(null)
  const removedFocus = useRef<string | true | null>(null)
  const restoredFocus = useRef<{ entry: string; holder: HTMLElement } | null>(null)
  const previousFavorites = useRef<string[]>([])
  const favoriteRestorePosition = useRef<Position | null>(null)
  const favoriteRemovedFocus = useRef<string | true | null>(null)
  const localFocus = useRef<{ entry: string; source: boolean } | 'welcome' | null>(null)
  const sourceRecord = reading.browse.scenes.sourceRecord
  const roomReturn = useRef<FocusSceneId | null>(null)
  const fromRoomPreview = useRef(false)
  const [activeSeen, setActiveSeen] = useState(!!view.active)
  const result = useRecordsQuery(view, mode, current, reading.roomTag)
  const { entryKey: entryId } = result
  const selectedOriginal = sourceRecord ? view.recordBySession.get(sourceRecord) : null
  const missingSource = sourceRecord && (!selectedOriginal?.saved || selectedOriginal.scene?.sceneId !== reading.roomTag)
  const detachedThought = mode === 'thoughts' && current.expanded?.startsWith('thought:') && !result.all.some(entry => entryId(entry) === current.expanded)
    ? result.thoughtById.get(current.expanded) : undefined
  const queryKey = `${mode}/${current.month}/${current.search}/${mode === 'scenes' ? reading.roomTag : ''}`
  const savedQuotes = favorites?.saved ?? []
  const favPageCount = Math.ceil(savedQuotes.length / RECORDS_PAGE_SIZE)
  const favPage = Math.min(current.page, Math.max(1, favPageCount))
  const quotesShown = savedQuotes.slice((favPage - 1) * RECORDS_PAGE_SIZE, favPage * RECORDS_PAGE_SIZE)

  const patch = (changes: Partial<Browse>) => setReading(value => ({ ...value, browse: { ...value.browse, [mode]: { ...value.browse[mode], ...changes } } }))
  const remember = (forMode: Mode) => {
    const elements = [...(screen.current?.querySelectorAll<HTMLElement>('.records-list [data-entry-id]') ?? [])]
    const expandedFavorite = forMode === 'favorites' ? elements.find(element => element.dataset.entryId === readingRef.current.browse.favorites.expanded) : null
    const anchor = expandedFavorite ?? elements.find(element => element.getBoundingClientRect().bottom > 110)
    const focused = document.activeElement?.closest<HTMLElement>('[data-entry-id]')
    positions.current[forMode] = { offset: window.scrollY, anchor: anchor?.dataset.entryId ?? null,
      relative: anchor?.getBoundingClientRect().top ?? 0, focus: focused?.dataset.entryId ?? null }
    visit.current = { ...readingRef.current, positions: positions.current }
  }
  useLayoutEffect(() => { visit.current = { ...reading, positions: positions.current } }, [reading, visit])
  // Records restores its own per-view anchors. A Back from a local task must
  // not restore the browser's earlier absolute offset over that position.
  useLayoutEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => { history.scrollRestoration = previous }
  }, [])
  useLayoutEffect(() => {
    const position = positions.current[mode]
    const anchor = [...(screen.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])].find(element => element.dataset.entryId === position.anchor)
    window.scrollTo(0, anchor ? window.scrollY + anchor.getBoundingClientRect().top - position.relative : position.offset)
    const onPosition = () => remember(mode)
    window.addEventListener('scroll', onPosition, { passive: true })
    screen.current?.addEventListener('focusin', onPosition)
    const element = screen.current
    return () => { window.removeEventListener('scroll', onPosition); element?.removeEventListener('focusin', onPosition) }
  }, [mode])
  useLayoutEffect(() => {
    if (view.active && !activeSeen) setActiveSeen(true)
  }, [view.active, activeSeen])
  const focusFirst = () => {
    const first = list.current?.querySelector<HTMLElement>('[data-entry-id] button')
    first?.focus({ preventScroll: true })
    first?.scrollIntoView({ block: 'start' })
  }
  useLayoutEffect(() => {
    if (mode === 'favorites') return
    const sameQuery = previousQuery.current === queryKey
    const ids = result.all.map(entryId)
    const oldIds = previousIds.current
    const changed = sameQuery && (ids.length !== oldIds.length || ids.some((id, index) => id !== oldIds[index]))
    previousQuery.current = queryKey
    previousIds.current = ids
    const position = positions.current[mode]
    const anchor = mode === 'scenes' && sourceRecord ? `record:${sourceRecord}` : position.anchor ?? current.expanded
    if (changed && !pageFocus.current && position.anchor && ids.includes(position.anchor)) restorePosition.current = { ...position }
    if (changed && current.expanded && !ids.includes(current.expanded) && !result.thoughtById.has(current.expanded) && document.activeElement === document.body) {
      const removedAt = oldIds.indexOf(current.expanded)
      removedFocus.current = ids[Math.min(Math.max(0, removedAt), ids.length - 1)] ?? true
    }
    const page = changed || (mode === 'scenes' && sourceRecord) ? result.pageForAnchor(anchor, result.page) : result.page
    if (page !== current.page) { patch({ page }); return }
    if (restorePosition.current) {
      const savedPosition = restorePosition.current
      const element = [...(list.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])].find(element => element.dataset.entryId === savedPosition.anchor)
      if (element) window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - savedPosition.relative)
      restorePosition.current = null
    }
    if (pageFocus.current) {
      pageFocus.current = false
      focusFirst()
      positions.current[mode].anchor = result.items[0] ? entryId(result.items[0]) : null
    }
    if (announceQuery.current) {
      announceQuery.current = false
      const scope = mode === 'scenes' && reading.roomTag ? sceneNames[reading.roomTag] : monthLabel(current.month)
      onAnnounce?.(`${RECORDS_MODES[mode]}，${scope}，${incomplete || thoughtsIncomplete ? '当前可读取' : '共'}${result.total}条${result.total ? `，第${result.page}页` : ''}。`)
    }
    if (removedFocus.current) {
      const next = removedFocus.current
      removedFocus.current = null
      const target = [...(list.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])].find(element => element.dataset.entryId === next)
      ;(target?.querySelector<HTMLElement>('button') ?? screen.current?.querySelector<HTMLElement>('.records-modes [aria-pressed="true"]'))?.focus({ preventScroll: true })
    }
    if (restoredFocus.current) {
      // Only take focus back from where the restore left it, never from somewhere the reader has moved to.
      const { entry, holder } = restoredFocus.current
      const target = list.current?.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(entry)}"] button`)
      if (document.activeElement !== holder) restoredFocus.current = null
      else if (target) { restoredFocus.current = null; target.focus({ preventScroll: true }) }
    }
    if (detachedThought && document.activeElement === document.body) list.current?.querySelector<HTMLElement>('.records-detached .record-summary')?.focus({ preventScroll: true })
  }, [result, queryKey])
  useLayoutEffect(() => {
    if (mode !== 'favorites') return
    const keys = savedQuotes.map(quote => `favorite:${quoteKey(quote)}`)
    const old = previousFavorites.current
    previousFavorites.current = keys
    const changed = old.length !== keys.length || keys.some((key, index) => key !== old[index])
    const position = positions.current.favorites
    const anchor = current.expanded?.startsWith('favorite:') ? current.expanded : position.anchor
    const index = anchor ? keys.indexOf(anchor) : -1
    if (changed && !pageFocus.current && position.anchor && keys.includes(position.anchor)) favoriteRestorePosition.current = { ...position }
    const removedExpanded = current.expanded?.startsWith('favorite:') && old.includes(current.expanded) && !keys.includes(current.expanded)
    if (removedExpanded && document.activeElement === document.body) favoriteRemovedFocus.current = keys[Math.min(old.indexOf(current.expanded!), keys.length - 1)] ?? true
    const page = changed && !pageFocus.current && index >= 0 ? Math.floor(index / RECORDS_PAGE_SIZE) + 1 : favPage
    if (current.page !== page || removedExpanded) { patch({ page, ...(removedExpanded ? { expanded: null } : {}) }); return }
    if (favoriteRestorePosition.current) {
      const savedPosition = favoriteRestorePosition.current
      favoriteRestorePosition.current = null
      const element = [...(list.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])].find(element => element.dataset.entryId === savedPosition.anchor)
      if (element) {
        window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - savedPosition.relative)
        if (savedPosition.focus === savedPosition.anchor && document.activeElement === document.body) element.querySelector<HTMLElement>('.record-summary')?.focus({ preventScroll: true })
      }
    }
    if (pageFocus.current) { pageFocus.current = false; focusFirst() }
    if (announceQuery.current) { announceQuery.current = false; onAnnounce?.(`收藏的句子，共${savedQuotes.length}条${savedQuotes.length ? `，第${favPage}页` : ''}。`) }
    if (favoriteRemovedFocus.current) {
      const next = favoriteRemovedFocus.current
      favoriteRemovedFocus.current = null
      const target = [...(list.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])].find(element => element.dataset.entryId === next)
      if (document.activeElement === document.body) (target?.querySelector<HTMLElement>('button') ?? screen.current?.querySelector<HTMLElement>('.records-welcome button'))?.focus({ preventScroll: true })
    }
    // Capture the expanded reading object after layout, including its first open.
    if (current.expanded?.startsWith('favorite:')) remember('favorites')
  }, [savedQuotes, mode, current.page, current.expanded, favPage])
  useLayoutEffect(() => {
    if (fromRoomPreview.current && mode === 'scenes') {
      fromRoomPreview.current = false
      screen.current?.querySelector<HTMLElement>('.records-room h3')?.focus({ preventScroll: true })
    }
    if (roomReturn.current && mode === 'scenes' && !reading.roomTag) {
      const id = roomReturn.current
      roomReturn.current = null
      const opener = screen.current?.querySelector<HTMLElement>(`[data-room-${reading.roomOpener}="${id}"]`)
      ;(opener ?? screen.current?.querySelector<HTMLElement>('.records-modes [aria-pressed="true"]'))?.focus()
    }
    const target = localFocus.current
    if (!target) return
    localFocus.current = null
    if (target === 'welcome') { screen.current?.querySelector<HTMLElement>('.records-welcome > button')?.focus({ preventScroll: true }); return }
    const entry = [...(list.current?.querySelectorAll<HTMLElement>('.records-activity') ?? [])].find(element => element.dataset.entryId === target.entry)
    const control = entry?.querySelector<HTMLElement>(target.source ? '[data-return-activity]' : '[data-view-original]')
    control?.focus({ preventScroll: true })
    if (!target.source && entry && reading.sourceTop !== null) {
      window.scrollTo(0, window.scrollY + entry.getBoundingClientRect().top - reading.sourceTop)
    }
  }, [sourceRecord, current.expanded, reading.roomTag, mode])

  const changeConditions = (changes: Partial<Browse>) => {
    announceQuery.current = true
    positions.current[mode].anchor = null
    patch({ ...changes, page: 1, expanded: null })
  }
  const chooseMonth = (month: MonthFilter) => { changeConditions({ month }); setMonthPanel(false) }
  const changePage = (page: number) => { positions.current[mode].anchor = null; pageFocus.current = true; announceQuery.current = true; patch({ page, expanded: null, sourceRecord: null }) }
  const toggle = (id: string) => patch({ expanded: current.expanded === id ? null : id })
  const selectMode = (next: Mode) => {
    if (next === mode) return
    remember(mode); setMonthPanel(false); setStatusPanel(false)
    setReading(value => ({ ...value, mode: next }))
  }
  const selectTag = (id: FocusSceneId, opener: HTMLButtonElement) => {
    positions.current.scenes.anchor = null
    pageFocus.current = true
    announceQuery.current = true
    setReading(value => ({ ...value, roomTag: id, roomOpener: opener.dataset.roomSpot ? 'spot' : 'label', sourceTop: null,
      browse: { ...value.browse, scenes: { ...value.browse.scenes, page: 1, expanded: null, sourceRecord: null } } }))
  }
  const returnToRoom = () => {
    roomReturn.current = reading.roomTag
    setReading(value => ({ ...value, roomTag: null, browse: { ...value.browse, scenes: { ...value.browse.scenes, expanded: null, sourceRecord: null, page: 1 } } }))
  }
  const returnToTag = () => {
    if (!sourceRecord) return
    localFocus.current = { entry: `record:${sourceRecord}`, source: false }
    patch({ sourceRecord: null, expanded: null })
    if (missingSource && reading.roomTag) {
      if (result.roomActivities.has(reading.roomTag)) pageFocus.current = true
      else returnToRoom()
    }
  }
  useFocusTaskBack(monthPanel || statusPanel || (mode === 'scenes' && !!reading.roomTag), () => {
    if (monthPanel || statusPanel) { setMonthPanel(false); setStatusPanel(false) }
    else if (sourceRecord) returnToTag()
    else returnToRoom()
  }, [monthPanel, statusPanel, sourceRecord, reading.roomTag].join('/'))
  const openRoom = () => {
    remember('all'); fromRoomPreview.current = true
    positions.current.scenes = { offset: 0, anchor: null, relative: 0, focus: null }
    setReading(value => ({ ...value, mode: 'scenes', roomTag: null, browse: { ...value.browse, scenes: { ...value.browse.scenes, page: 1, expanded: null, sourceRecord: null } } }))
  }
  const openOriginal = (record: RecordView, id: string, opener: HTMLButtonElement) => {
    if (sourceRecord === record.sessionId) { returnToTag(); return }
    const sourceTop = opener.getBoundingClientRect().top
    localFocus.current = { entry: id, source: true }
    setReading(value => ({ ...value, sourceTop, browse: { ...value.browse, scenes: { ...value.browse.scenes, expanded: id, sourceRecord: record.sessionId } } }))
  }
  const beforeUndo = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    // The button goes once the restore works, so a keyboard needs somewhere to stay.
    if (event.detail === 0) {
      const next = event.currentTarget.nextElementSibling ?? event.currentTarget.previousElementSibling
      const holder = next instanceof HTMLButtonElement ? next : screen.current?.querySelector<HTMLElement>('.records-modes [aria-pressed="true"]')
      holder?.focus({ preventScroll: true })
      if (holder) restoredFocus.current = { entry: `thought:${id}`, holder }
    }
  }
  const closeWelcome = () => { localFocus.current = 'welcome'; toggle('welcome') }
  const openMonth = (event: MouseEvent<HTMLButtonElement>) => {
    // Safari leaves clicked buttons unfocused; native dialog Back still needs a stable opener.
    event.currentTarget.focus({ preventScroll: true })
    setYear(current.month && current.month !== 'unknown' ? current.month.slice(0, 4) : view.todayKey.slice(0, 4))
    setStatusPanel(false)
    setMonthPanel(true)
  }
  const openStatus = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.focus({ preventScroll: true })
    setMonthPanel(false)
    setStatusPanel(true)
  }

  return {
    reading, current, result, screen, list, activeSeen, sourceRecord, selectedOriginal, missingSource, detachedThought,
    savedQuotes, quotesShown, favPage, favPageCount, monthPanel, statusPanel, year, setYear, composing,
    patch, changeConditions, chooseMonth, changePage, toggle, selectMode, selectTag, returnToRoom, returnToTag,
    openRoom, openOriginal, beforeUndo, closeWelcome, openMonth, openStatus,
    closeMonth: () => setMonthPanel(false), closeStatus: () => setStatusPanel(false),
    toggleSummary: () => setReading(value => ({ ...value, summaryOpen: !value.summaryOpen })),
    toggleTrend: () => setReading(value => ({ ...value, trend: !value.trend })),
    setLength: (length: RangeLength) => setReading(value => ({ ...value, length })),
  }
}
