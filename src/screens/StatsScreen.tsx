import { useId, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { Persistence, StoreNotice } from '../adapters/storage'
import { FocusTaskDialog } from '../components/FocusTaskDialog'
import { formatMinutes, PHASE_LABELS } from '../components/format'
import { RecordEntry } from '../components/RecordEntry'
import { WeekChart } from '../components/WeekChart'
import { quoteKey, type QuoteFavoritesController } from '../contracts/favorites'
import { sceneNames } from '../data/scene-copy'
import { welcomeNote } from '../data/welcome'
import type { Thoughts } from '../hooks/useThoughts'
import { useFocusTaskBack } from '../hooks/useFocusTaskBack'
import { useHistoryRange, type RecordView, type StatsView } from '../hooks/useViews'
import { useRecordsQuery, type RecordsMode as Mode, type MonthFilter } from '../hooks/useRecordsQuery'
import type { RangeLength } from '../logic/stats'
import type { Thought } from '../logic/types'
import '../styles/records-art.css'

const MODES: Record<Mode, string> = { all: '全部记录', thoughts: '只看想法', scenes: '生活场景', favorites: '我的收藏' }
interface Browse { month: MonthFilter; search: string; draft: string; page: number; expanded: string | null; sourceRecord: string | null }
interface Position { offset: number; anchor: string | null; relative: number; focus: string | null }
export interface RecordsVisit {
  mode: Mode
  length: RangeLength
  summaryOpen: boolean
  trend: boolean
  browse: Record<Mode, Browse>
  positions: Record<Mode, Position>
}
interface Props {
  view: StatsView
  thoughts: Thoughts
  canEdit: boolean
  onEditThought?: (id: string) => void
  onContinueDraft?: () => void
  hasDraft?: boolean
  favorites?: QuoteFavoritesController
  systemNoticeSummary?: string | null
  systemNotices?: ReactNode
  onAnnounce?: (text: string) => void
  persistence: Persistence
  notice: StoreNotice | null
  hasSaveError: boolean
  showArt: boolean
  reducedMotion: boolean
  visit: MutableRefObject<RecordsVisit | null>
}

function initialVisit(): RecordsVisit {
  const browse = () => ({ month: null, search: '', draft: '', page: 1, expanded: null, sourceRecord: null })
  const position = () => ({ offset: 0, anchor: null, relative: 0, focus: null })
  return { mode: 'all', length: 7, summaryOpen: false, trend: false,
    browse: { all: browse(), thoughts: browse(), scenes: browse(), favorites: browse() },
    positions: { all: position(), thoughts: position(), scenes: position(), favorites: position() } }
}
const monthLabel = (month: MonthFilter) => month === 'unknown' ? '日期不详' : month ? `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月` : '全部日期'

function ThoughtEntry({ item, expanded, toggle, view, persistence, canEdit, thoughts, edit }: {
  item: Thought; expanded: boolean; toggle: () => void; view: StatsView; persistence: Persistence
  canEdit: boolean; thoughts: Thoughts; edit: Props['onEditThought']
}) {
  const detailId = useId()
  const linkedRecord = item.sessionId ? view.recordBySession.get(item.sessionId) : undefined
  const pending = view.pendingThoughtIds.has(item.id)
  const originalPending = !view.confirmedThoughtIds.has(item.id)
  return <li data-thought-id={item.id} data-entry-id={`thought:${item.id}`}>
    <button type="button" className="record-summary" aria-expanded={expanded} aria-controls={detailId} onClick={toggle}>
      <span className="record-identity">
        <span className="record-meta">{view.clockTime(item.createdAt)} · {item.text ? '想法' : '标记'}{item.status === 'putAway' ? ' · 已收起' : ''}
          {originalPending ? persistence === 'memory-only' ? ' · 仅在此页' : ' · 待保存' : pending ? ' · 有更改待保存' : ''}</span>
        <strong className="thought-preview">{item.text || '留过标记'}</strong>
      </span><span aria-hidden="true">{expanded ? '−' : '＋'}</span>
    </button>
    {!item.text && edit && !expanded && <button type="button" className="link-button records-add-text" disabled={!canEdit || pending} onClick={() => edit(item.id)}>补充文字</button>}
    <div id={detailId} className="record-detail" hidden={!expanded}>
      {expanded && <>
        {item.text && <p className="thought-body">{item.text}</p>}
        {linkedRecord && <p>关联专注 · {view.shortDate(linkedRecord.dateKey)} {linkedRecord.timeLabel} · {formatMinutes(linkedRecord.elapsedMs)}{linkedRecord.step && ' · ' + linkedRecord.step}</p>}
        {item.sessionId && item.sessionId === view.active?.id && <p>关联当前专注</p>}
        <div className="thought-row-actions">
          {edit && <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => edit(item.id)}>{item.text ? '编辑文字' : '补充文字'}</button>}
          <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => item.status === 'open' ? thoughts.putAway(item.id) : thoughts.reopen(item.id)}>{item.status === 'open' ? '收起想法' : '放回待看'}</button>
          <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => thoughts.remove(item.id)}>删除这条想法</button>
        </div>
        {pending && <p className="hint">这条想法有更改待保存。<button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button></p>}
      </>}
    </div>
  </li>
}

export function StatsScreen({ view, thoughts, canEdit, onEditThought, onContinueDraft, hasDraft, favorites, systemNoticeSummary, systemNotices, onAnnounce, persistence, notice, hasSaveError, showArt, visit }: Props) {
  const [reading, setReading] = useState<RecordsVisit>(() => visit.current ?? initialVisit())
  const { mode, length, summaryOpen, trend } = reading
  const current = reading.browse[mode]
  const screen = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const positions = useRef(reading.positions)
  const readingRef = useRef(reading)
  readingRef.current = reading
  const [monthPanel, setMonthPanel] = useState(false)
  const [statusPanel, setStatusPanel] = useState(false)
  useFocusTaskBack(monthPanel || statusPanel, () => { setMonthPanel(false); setStatusPanel(false) })
  const [year, setYear] = useState(view.todayKey.slice(0, 4))
  const composing = useRef(false)
  const pageFocus = useRef(false)
  const announceQuery = useRef(false)
  const previousQuery = useRef('')
  const previousIds = useRef<string[]>([])
  const restorePosition = useRef<Position | null>(null)
  const removedFocus = useRef<string | true | null>(null)
  const previousFavorites = useRef<string[]>([])
  const favoriteRestorePosition = useRef<Position | null>(null)
  const favoriteRemovedFocus = useRef<string | true | null>(null)
  const localFocus = useRef<{ entry: string; source: boolean } | 'welcome' | null>(null)
  const sourceRecord = reading.browse.scenes.sourceRecord
  const setSourceRecord = (sourceRecord: string | null) => setReading(value => ({ ...value, browse: { ...value.browse, scenes: { ...value.browse.scenes, sourceRecord } } }))
  const [activeSeen, setActiveSeen] = useState(!!view.active)
  const incomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('records')))
  const thoughtsIncomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('thoughts')))
  const { totals } = useHistoryRange(view, length)
  const result = useRecordsQuery(view, mode, current)
  const { entryKey: entryId, isKnownDate: knownDate, hasUnknownDates: unknown } = result
  const selectedOriginal = sourceRecord ? view.recordBySession.get(sourceRecord) : null
  const detachedThought = mode === 'thoughts' && current.expanded?.startsWith('thought:') && !result.all.some(entry => entryId(entry) === current.expanded)
    ? result.thoughtById.get(current.expanded) : undefined
  const queryKey = `${mode}/${current.month}/${current.search}`
  const savedQuotes = favorites?.saved ?? []
  const favPageCount = Math.ceil(savedQuotes.length / 20)
  const favPage = Math.min(current.page, Math.max(1, favPageCount))
  const quotesShown = savedQuotes.slice((favPage - 1) * 20, favPage * 20)

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
    const anchor = position.anchor ?? current.expanded
    if (changed && !pageFocus.current && position.anchor && ids.includes(position.anchor)) restorePosition.current = { ...position }
    if (changed && current.expanded && !ids.includes(current.expanded) && !result.thoughtById.has(current.expanded) && document.activeElement === document.body) {
      const removedAt = oldIds.indexOf(current.expanded)
      removedFocus.current = ids[Math.min(Math.max(0, removedAt), ids.length - 1)] ?? true
    }
    const page = changed ? result.pageForAnchor(anchor, result.page) : result.page
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
      onAnnounce?.(`${MODES[mode]}，${monthLabel(current.month)}，${incomplete || thoughtsIncomplete ? '当前可读取' : '共'}${result.total}条${result.total ? `，第${result.page}页` : ''}。`)
    }
    if (removedFocus.current) {
      const next = removedFocus.current
      removedFocus.current = null
      const target = [...(list.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])].find(element => element.dataset.entryId === next)
      ;(target?.querySelector<HTMLElement>('button') ?? screen.current?.querySelector<HTMLElement>('.records-modes [aria-pressed="true"]'))?.focus({ preventScroll: true })
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
    const page = changed && !pageFocus.current && index >= 0 ? Math.floor(index / 20) + 1 : favPage
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
    const target = localFocus.current
    if (!target) return
    localFocus.current = null
    if (target === 'welcome') { screen.current?.querySelector<HTMLElement>('.records-welcome > button')?.focus({ preventScroll: true }); return }
    const entry = [...(list.current?.querySelectorAll<HTMLElement>('.records-activity') ?? [])].find(element => element.dataset.entryId === target.entry)
    entry?.querySelector<HTMLElement>(target.source ? '[data-return-activity]' : '[data-view-original]')?.focus({ preventScroll: true })
  }, [sourceRecord, current.expanded])

  const changeConditions = (changes: Partial<Browse>) => {
    announceQuery.current = true
    positions.current[mode].anchor = null
    if (mode === 'scenes') setSourceRecord(null)
    patch({ ...changes, page: 1, expanded: null })
  }
  const chooseMonth = (month: MonthFilter) => { changeConditions({ month }); setMonthPanel(false) }
  const changePage = (page: number) => { positions.current[mode].anchor = null; pageFocus.current = true; announceQuery.current = true; patch({ page, expanded: null }) }
  const toggle = (id: string) => { if (mode === 'scenes') setSourceRecord(null); patch({ expanded: current.expanded === id ? null : id }) }
  const recordEntry = (record: RecordView, expanded: boolean, onToggle: () => void) => <RecordEntry key={record.sessionId} record={record} expanded={expanded}
    onToggle={onToggle} persistence={persistence} showArt={showArt} confirmedThoughtIds={view.confirmedThoughtIds} pendingThoughtIds={view.pendingThoughtIds}
    editThought={canEdit ? onEditThought : undefined} formatDate={view.shortDate} />
  const selectMode = (next: Mode) => {
    if (next === mode) return
    remember(mode); setMonthPanel(false); setStatusPanel(false)
    setReading(value => ({ ...value, mode: next }))
  }
  const displayDate = (date: string) => knownDate(date) ? view.dayHeading(date) : '日期不详的记录'
  const empty = mode === 'scenes' ? '还没有可回看的伙伴活动。' : current.search ? '没有找到匹配的想法。' : current.month && current.month !== 'unknown' ? '这个月还没有记录。' : current.month === 'unknown' ? '没有日期不详的记录。' : mode === 'thoughts' ? '还没有想法。' : '还没有记录。'
  const stateLine = view.active ? `${PHASE_LABELS[view.active.phase]} · ${view.active.status === 'paused' ? '已暂停' : '正在计时'}（未计入汇总）`
    : hasSaveError || result.hasPendingRecords ? '有结果待保存，原内容仍在。' : activeSeen ? '本段已结束，可继续阅读。' : ''
  const yearValue = Number(year)
  const validYear = /^\d{1,4}$/.test(year) && yearValue >= 1 && yearValue <= 9999

  return <section ref={screen} className="screen stats records-v35" aria-labelledby="stats-title">
    <h2 id="stats-title" className="screen-title">记录</h2>
    <div className="records-switch records-modes" role="group" aria-label="记录内容">
      {(Object.keys(MODES) as Mode[]).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => selectMode(value)}>{MODES[value]}</button>)}
    </div>
    <div className="records-session-status">
      <p>{stateLine || <span aria-hidden="true">{'\u00a0'}</span>}</p>
      <div className="records-system-status"><span className="records-system-summary">{systemNoticeSummary || <span aria-hidden="true">{'\u00a0'}</span>}</span>
        {systemNoticeSummary && <button type="button" className="link-button" onClick={() => { setMonthPanel(false); setStatusPanel(true) }}>查看状态</button>}</div>
    </div>
    {mode === 'all' && <section className="records-summary" aria-label="计时汇总">
      <p>近{length}天 · {incomplete ? '计时汇总暂不可确认' : <><strong>{formatMinutes(totals.focusMs)}</strong> · {totals.count} 段已结束专注</>}</p>
      <button type="button" className="link-button" aria-expanded={summaryOpen} onClick={() => setReading(value => ({ ...value, summaryOpen: !value.summaryOpen }))}>{summaryOpen ? '收起统计' : '查看统计'}</button>
      {summaryOpen && <div className="records-summary-detail">
        <div className="records-switch" role="group" aria-label="计时统计范围">{([7, 30] as const).map(days => <button type="button" key={days} aria-pressed={length === days} onClick={() => setReading(value => ({ ...value, length: days }))}>近{days}天</button>)}</div>
        <p className="hint">{view.shortDate(totals.startKey)} – {view.shortDate(view.todayKey)} · 只统计已确认保存的专注，下面的历史另按月份查找。</p>
        {!incomplete && <><button type="button" className="link-button" aria-expanded={trend} onClick={() => setReading(value => ({ ...value, trend: !value.trend }))}>{trend ? '收起趋势' : '查看趋势'}</button>{trend && <WeekChart days={totals.days} todayKey={view.todayKey} />}</>}
      </div>}
    </section>}
    {(incomplete || thoughtsIncomplete) && <p className="hint">历史数据未能完整读取。这里只展示当前能确认的内容。</p>}
    {mode !== 'favorites' && <div className="records-tools">
      {mode === 'thoughts' && <>
        <form className="records-search" onSubmit={event => { event.preventDefault(); if (!composing.current) changeConditions({ search: current.draft.trim() }) }}>
          <label htmlFor="thought-search">搜索想法</label>
          <div><input id="thought-search" type="search" value={current.draft} placeholder="搜索想法" onChange={event => patch({ draft: event.target.value })}
            onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
            onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault() }} />
            <button type="submit" className="pill">搜索</button></div>
        </form>
        {(hasDraft || thoughts.hasDraft) && <button type="button" className="link-button" onClick={onContinueDraft ?? thoughts.openNew}>继续草稿</button>}
      </>}
      <div className="records-filter-row"><span>{monthLabel(current.month)}{current.search && ` · 搜索“${current.search}”`}</span>
        <button type="button" className="link-button" onClick={() => { setYear(current.month && current.month !== 'unknown' ? current.month.slice(0, 4) : view.todayKey.slice(0, 4)); setMonthPanel(true) }}>选择月份</button>
        {current.month && <button type="button" className="link-button" onClick={() => changeConditions({ month: null })}>查看全部日期</button>}
        {current.search && <button type="button" className="link-button" onClick={() => changeConditions({ search: '', draft: '' })}>清除搜索</button>}
        {unknown && current.month !== 'unknown' && <button type="button" className="link-button" onClick={() => changeConditions({ month: 'unknown' })}>日期不详的记录</button>}
      </div>
    </div>}
    {mode === 'scenes' && <p className="hint">回看每段已记录的伙伴活动，或打开对应的专注记录。</p>}
    <div className="records-list" ref={list} data-result-count={mode === 'favorites' ? savedQuotes.length : result.total}>
      {mode !== 'favorites' ? <>
        {detachedThought && <section className="records-detached"><p className="hint">这条想法已不符合当前查找条件，关闭后返回原结果。</p><ol className="focus-records"><ThoughtEntry item={detachedThought} expanded toggle={() => patch({ expanded: null })} view={view} persistence={persistence} canEdit={canEdit} thoughts={thoughts} edit={onEditThought} /></ol></section>}
        {result.total === 0 && <p className="records-empty">{incomplete || thoughtsIncomplete ? '目前没有可确认的条目。' : empty}</p>}
        {result.days.map(day => <section className="record-day" key={day.dateKey} data-date={day.dateKey}>
          <h3>{knownDate(day.dateKey) ? <time dateTime={day.dateKey}>{displayDate(day.dateKey)}</time> : displayDate(day.dateKey)}
            {mode === 'all' && !incomplete && knownDate(day.dateKey) && <small> · {formatMinutes(view.totalsByDay.get(day.dateKey)?.focusMs ?? 0)}</small>}</h3>
          <ol className="focus-records">{day.entries.map(entry => {
            const id = entryId(entry)
            if (entry.kind === 'thought') return <ThoughtEntry key={id} item={entry.thought} expanded={current.expanded === id} toggle={() => toggle(id)} view={view} persistence={persistence} canEdit={canEdit} thoughts={thoughts} edit={onEditThought} />
            if (mode !== 'scenes') return recordEntry(entry.record, current.expanded === id, () => toggle(id))
            const record = entry.record
            return <li key={id} data-entry-id={id} className="records-activity">
              <button type="button" className="record-summary" aria-expanded={current.expanded === id} onClick={() => toggle(id)}>
                <span className="record-identity"><span className="record-meta">{record.timeLabel}</span><strong>{record.scene ? sceneNames[record.scene.sceneId] : '伙伴活动'}</strong><span className="record-meta">本段计时 {formatMinutes(record.elapsedMs)}</span></span><span aria-hidden="true">{current.expanded === id ? '−' : '＋'}</span>
              </button>
              {current.expanded === id && <div className="record-detail">
                {sourceRecord === record.sessionId && selectedOriginal ? <><button data-return-activity type="button" className="link-button" onClick={() => { localFocus.current = { entry: id, source: false }; setSourceRecord(null) }}>返回伙伴活动</button><ol className="focus-records">{recordEntry(selectedOriginal, true, () => { localFocus.current = { entry: id, source: false }; setSourceRecord(null) })}</ol></>
                  : <><p>{record.endReason === 'manual' ? '这段由你提前结束。' : '这段已到时结束。'}伙伴活动随本段计时保留。</p><button data-view-original type="button" className="link-button" onClick={() => { localFocus.current = { entry: id, source: true }; setSourceRecord(record.sessionId) }}>查看原记录</button></>}
              </div>}
            </li>
          })}</ol>
        </section>)}
        {result.total > 0 && <div className="records-pagination" aria-label="记录分页">
          <button type="button" className="pill pill--ghost" disabled={result.page <= 1} onClick={() => changePage(result.page - 1)}>上一页</button>
          <span>第{result.page}页{result.pageCount > 1 && `／共${result.pageCount}页`}</span>
          <button type="button" className="pill pill--ghost" disabled={result.page >= result.pageCount} onClick={() => changePage(result.page + 1)}>下一页</button>
        </div>}
      </> : <>
        <section className="records-favorites" aria-labelledby="saved-quotes-title"><h3 id="saved-quotes-title">收藏的句子</h3>
          {savedQuotes.length === 0 && <p className="records-empty">还没有收藏的句子。读到喜欢的鼓励时，可以把它留在这里。</p>}
          <ol className="focus-records">{quotesShown.map(quote => {
            const key = quoteKey(quote), id = `favorite:${key}`, expanded = current.expanded === id
            return <li key={key} data-entry-id={id}><button type="button" className="record-summary" aria-expanded={expanded} onClick={() => toggle(id)}><span className="record-identity"><strong className="thought-preview">{quote.text}</strong></span><span aria-hidden="true">{expanded ? '−' : '＋'}</span></button>
              {expanded && <div className="record-detail"><p className="thought-body">{quote.text}</p><button type="button" className="link-button" disabled={!canEdit || favorites?.isPending(quote)} onClick={() => favorites?.toggle(quote)}>{favorites?.isPending(quote) ? '正在保存' : '取消收藏'}</button></div>}
            </li>
          })}</ol>
          {savedQuotes.length > 0 && <div className="records-pagination" aria-label="收藏分页"><button type="button" className="pill pill--ghost" disabled={favPage <= 1} onClick={() => changePage(favPage - 1)}>上一页</button><span>第{favPage}页{favPageCount > 1 && `／共${favPageCount}页`}</span><button type="button" className="pill pill--ghost" disabled={favPage >= favPageCount} onClick={() => changePage(favPage + 1)}>下一页</button></div>}
          <div className="records-feedback">{favorites?.status}{!!favorites?.problems.length && <button type="button" className="link-button" onClick={favorites.retry}>重试保存</button>}</div>
        </section>
        <section className="records-welcome"><h3>给你的信</h3><button type="button" className="record-summary" aria-expanded={current.expanded === 'welcome'} onClick={() => toggle('welcome')}>{welcomeNote.title}<span aria-hidden="true">{current.expanded === 'welcome' ? '−' : '＋'}</span></button>
          {current.expanded === 'welcome' && <div className="record-detail"><p className="thought-body">{welcomeNote.text}</p><button type="button" className="link-button" onClick={() => { localFocus.current = 'welcome'; toggle('welcome') }}>关闭欢迎笺</button></div>}
        </section>
      </>}
    </div>
    {mode !== 'favorites' && <div className="records-feedback">
      {thoughts.status?.text}
      {thoughts.status?.kind === 'error' && <button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button>}
      {thoughts.undos.map(undo => <button type="button" key={undo.id} className="link-button" disabled={!canEdit} onClick={undo.run}>{undo.label}</button>)}
    </div>}
    {monthPanel && <FocusTaskDialog title="选择月份" closeLabel="返回记录" onClose={() => setMonthPanel(false)}>
      <label className="records-year">年份<input data-initial-focus inputMode="numeric" type="number" min="1" max="9999" value={year} onChange={event => setYear(event.target.value)} aria-invalid={!validYear} /></label>
      {!validYear && <p className="field-error">请输入1到9999之间的年份。</p>}
      <div className="records-month-grid">{Array.from({ length: 12 }, (_, index) => <button type="button" className="pill pill--ghost" key={index} disabled={!validYear} onClick={() => chooseMonth(`${String(yearValue).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`)}>{index + 1}月</button>)}</div>
      <button type="button" className="link-button" onClick={() => chooseMonth(null)}>查看全部日期</button>
    </FocusTaskDialog>}
    {statusPanel && <FocusTaskDialog title="应用状态" closeLabel="返回记录" onClose={() => setStatusPanel(false)}>{systemNotices ?? <p>目前没有需要处理的应用状态。</p>}</FocusTaskDialog>}
  </section>
}
