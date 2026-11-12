import { useId, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { Persistence, StoreNotice } from '../adapters/storage'
import { FocusTaskDialog } from '../components/FocusTaskDialog'
import { formatMinutes, PHASE_LABELS } from '../components/format'
import { RecordEntry } from '../components/RecordEntry'
import { RecordsRoom } from '../components/RecordsRoom'
import { WeekChart } from '../components/WeekChart'
import { ThoughtNotebook } from '../components/records/ThoughtNotebook'
import { ThoughtDetail, ThoughtEntry } from '../components/records/ThoughtEntry'
import { MemoryChevron, MemoryDetailSheet, MemoryStamp } from '../components/records/MemoryPaper'
import { WelcomeEnvelope } from '../components/records/WelcomeEnvelope'
import { welcomeNote } from '../data/welcome'
import { MemoryAlbum } from '../components/records/MemoryAlbum'
import { RestMemoryEntry } from '../components/records/RestMemoryEntry'
import { RecordsPagination } from '../components/records/RecordsPagination'
import { RecordsFavorites } from '../components/records/RecordsFavorites'
import type { QuoteFavoritesController } from '../contracts/favorites'
import { sceneNames } from '../data/scene-copy'
import type { Thoughts } from '../hooks/useThoughts'
import { useHistoryRange, type RecordView, type StatsView } from '../hooks/useViews'
import { useRecordsBrowser } from '../hooks/records/useRecordsBrowser'
import { RECORDS_MODES as MODES, monthLabel, type RecordsVisit } from '../hooks/records/visit'
import type { RecordsMode as Mode } from '../hooks/records/useRecordsQuery'
import '../styles/records-art.css'

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
  visit: MutableRefObject<RecordsVisit | null>
}

export function RecordsScreen({ view, thoughts, canEdit, onEditThought, onContinueDraft, hasDraft, favorites, systemNoticeSummary, systemNotices, onAnnounce, persistence, notice, hasSaveError, showArt, visit }: Props) {
  const incomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('records')))
  const restsIncomplete = notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('restMemories'))
  const thoughtsIncomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('thoughts')))
  const {
    reading, current, result, screen, list, activeSeen, sourceRecord, selectedOriginal, missingSource,
    savedQuotes, quotesShown, favPage, favPageCount, monthPanel, statusPanel, year, setYear, composing,
    patch, changeConditions, chooseMonth, changePage, toggle, selectMode, selectTag, returnToRoom, returnToTag,
    openRoom, openOriginal, beforeUndo, closeWelcome, openMonth, openStatus, closeMonth, closeStatus,
    toggleSummary, toggleTrend, setLength,
  } = useRecordsBrowser({ view, favorites, visit, editing: thoughts.open, incomplete: incomplete || restsIncomplete, thoughtsIncomplete, onAnnounce })
  const { mode, length, summaryOpen, trend } = reading
  const { entryKey: entryId, isKnownDate: knownDate, hasUnknownDates: unknown } = result
  const { totals } = useHistoryRange(view, length)
  const statusDescriptionId = useId()
  const [letterOpen, setLetterOpen] = useState(false)
  const editedFromReader = useRef<string | null>(null)
  const [deletedThoughtId, setDeletedThoughtId] = useState<string | null>(null)
  const displayDate = (date: string) => knownDate(date) ? view.dayHeading(date) : '日期不详的记录'
  const shortDate = (key: string | null) => key && knownDate(key) ? view.shortDate(key) : '日期不详'
  const recordEntry = (record: RecordView, expanded: boolean, onToggle: () => void, inline = false) => <RecordEntry key={record.sessionId} record={record} expanded={expanded}
    onToggle={onToggle} inline={inline} persistence={persistence} showArt={showArt} confirmedThoughtIds={view.confirmedThoughtIds} pendingThoughtIds={view.pendingThoughtIds}
    editThought={canEdit ? onEditThought : undefined} formatDate={shortDate} />
  const empty = mode === 'scenes' ? '还没有可回看的伙伴活动。' : current.search ? '没有找到匹配的想法。' : current.month && current.month !== 'unknown' ? '这个月还没有记录。' : current.month === 'unknown' ? '没有日期不详的记录。' : mode === 'thoughts' ? '还没有想法。' : '还没有记录。'
  const stateLine = view.active ? `${PHASE_LABELS[view.active.phase]} · ${view.active.status === 'paused' ? '已暂停' : '正在计时'}（未计入汇总）`
    : activeSeen ? '本段已结束，可继续阅读。' : ''
  const pendingSave = hasSaveError || result.hasPendingRecords || view.pendingThoughtIds.size > 0 || !!favorites?.problems.length
  const saveLine = pendingSave ? '有内容待保存，原内容仍在。' : ''
  const historyIncomplete = incomplete || restsIncomplete || thoughtsIncomplete
  const firstVisit = mode === 'all' && !current.month && !result.total && !view.thoughtDays.length && !savedQuotes.length
    && !view.active && !historyIncomplete && !pendingSave
  const phaseLabel = view.active?.phase === 'focus' ? '专注' : '休息'
  const statusLabel = view.active
    ? `${phaseLabel}${view.active.status === 'paused' ? '暂停' : '计时'}`
    : pendingSave ? '有待保存' : systemNoticeSummary ? '状态提示' : activeSeen ? '计时结束' : '查看状态'
  const secondaryStatusLabel = view.active ? pendingSave ? '有待保存' : systemNoticeSummary ? '状态提示' : '' : ''
  const statusDescription = [stateLine, saveLine, systemNoticeSummary].filter(Boolean).join(' ')
  const yearValue = Number(year)
  const validYear = /^\d{1,4}$/.test(year) && yearValue >= 1 && yearValue <= 9999
  // Keep the recovery action for the entry the person was reading within reach.
  // Its eligibility and object version still come from the saved deletion.
  const selectedUndo = thoughts.undos.find(undo => undo.id === deletedThoughtId && !current.expanded)
  const undoButton = (undo: Thoughts['undos'][number]) => <button type="button" key={undo.id} className="link-button"
    disabled={!canEdit} onClick={event => { beforeUndo(event, undo.id); undo.run() }}>{undo.label}</button>

  const roomTag = mode === 'scenes' ? reading.roomTag : null
  const selectedThought = (mode === 'all' || mode === 'thoughts') && current.expanded ? result.thoughtById.get(current.expanded) : undefined
  const editSelectedThought = onEditThought ? (id: string) => {
    editedFromReader.current = id
    if (current.expanded !== `thought:${id}`) toggle(`thought:${id}`)
    onEditThought(id)
  } : undefined
  const entries = <>
      {roomTag && sourceRecord ? <>
        <button data-return-activity type="button" className="link-button" onClick={returnToTag}>‹ 返回{sceneNames[roomTag]}</button>
        {missingSource && <p>这段原记录目前无法读取。</p>}
        {selectedOriginal && <ol className="focus-records">{selectedOriginal.kind === 'rest'
          ? <RestMemoryEntry memory={selectedOriginal.memory} expanded onToggle={returnToTag} showArt={showArt} view={view} inline/>
          : recordEntry(selectedOriginal.record, true, returnToTag, true)}</ol>}
      </> : mode !== 'favorites' ? <>
        {roomTag && <div className="room-source-heading">
          <MemoryStamp id={roomTag}/><span>这张画签的来处 · {result.total} 段{roomTag.startsWith('R') ? '休息' : '专注'}</span>
        </div>}
        {!firstVisit && result.total === 0 && (mode !== 'scenes' || reading.roomTag) && <p className="records-empty">{historyIncomplete ? '目前没有可确认的条目。' : empty}</p>}
        {result.days.map(day => <section className="record-day" key={day.dateKey} data-date={day.dateKey}>
          <h3>{knownDate(day.dateKey) ? <time dateTime={day.dateKey}>{displayDate(day.dateKey)}</time> : displayDate(day.dateKey)}
            {mode === 'all' && !incomplete && knownDate(day.dateKey) && view.totalsByDay.has(day.dateKey) && <small> · 专注 {formatMinutes(view.totalsByDay.get(day.dateKey)!.focusMs)}</small>}</h3>
          <ol className="focus-records">{day.entries.map(entry => {
            const id = entryId(entry)
            if (entry.kind === 'thought') return <ThoughtEntry key={id} notebook={mode === 'thoughts'} illustrated={showArt} item={entry.thought} expanded={current.expanded === id} toggle={() => toggle(id)} view={view} persistence={persistence} canEdit={canEdit} edit={editSelectedThought} />
            if (mode !== 'scenes') return entry.kind === 'rest'
              ? <RestMemoryEntry key={id} memory={entry.memory} expanded={current.expanded === id} onToggle={() => toggle(id)} showArt={showArt} view={view}/>
              : recordEntry(entry.record, current.expanded === id, () => toggle(id))
            const timeLabel = entry.kind === 'rest' ? view.clockTime(entry.memory.endedAt) : entry.record.timeLabel
            const elapsedMs = entry.kind === 'rest' ? entry.memory.elapsedMs : entry.record.elapsedMs
            const phase = entry.kind === 'record' ? '专注' : entry.memory.phase ? PHASE_LABELS[entry.memory.phase] : '休息'
            return <li key={id} data-entry-id={id} className="records-activity">
              <button type="button" data-view-original className="record-summary" onClick={event => openOriginal(id, event.currentTarget)}>
                <span className="record-identity"><strong>{entry.kind === 'record' && entry.record.step ? entry.record.step : phase}</strong>
                  <span className="record-meta">{timeLabel} · {formatMinutes(elapsedMs)}</span></span>
                <span className="sr-only">查看原记录</span><MemoryChevron/>
              </button>
            </li>
          })}</ol>
        </section>)}
        {result.pageCount > 1 && <RecordsPagination label="记录分页" page={result.page} pageCount={result.pageCount} onChange={changePage} />}
      </> : <RecordsFavorites quotes={quotesShown} total={savedQuotes.length} page={favPage} pageCount={favPageCount}
        expandedId={current.expanded} canEdit={canEdit} favorites={favorites} onPage={changePage} onToggle={toggle} onCloseWelcome={closeWelcome} />}
    </>

  return <section ref={screen} className="screen stats records-v35" data-records-mode={mode} aria-labelledby="stats-title">
    <div className="records-header">
      <h1 id="stats-title" className="screen-title" tabIndex={-1}>记录</h1>
      <button type="button" className="link-button records-status-button" aria-label={`查看状态${statusLabel === '查看状态' ? '' : `：${statusLabel}`}${secondaryStatusLabel ? `，${secondaryStatusLabel}` : ''}`}
        aria-describedby={statusDescription ? statusDescriptionId : undefined} aria-haspopup="dialog" aria-expanded={statusPanel}
        onClick={openStatus}><span>{statusLabel}</span>{secondaryStatusLabel && <span>{secondaryStatusLabel}</span>}</button>
      <span id={statusDescriptionId} className="sr-only">{statusDescription}</span>
    </div>
    <div className="records-switch records-modes" role="group" aria-label="记录内容">
      {(Object.keys(MODES) as Mode[]).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => selectMode(value)}>{MODES[value]}</button>)}
    </div>
    {mode === 'all' && <MemoryAlbum featured={result.featured} activities={result.roomActivities} page={result.page} band={reading.roomBand}
      showArt={showArt} onRead={toggle} onRoom={openRoom}/>}
    {firstVisit && <button type="button" className="memory-letter" aria-haspopup="dialog" onClick={event => {
      event.currentTarget.focus({ preventScroll: true }); setLetterOpen(true)
    }}>
      <WelcomeEnvelope/><span><small>给你的信</small><strong>{welcomeNote.title}</strong></span><span aria-hidden="true">›</span>
    </button>}
    {letterOpen && <MemoryDetailSheet title={welcomeNote.title} onClose={() => setLetterOpen(false)}><p className="memory-letter-text">{welcomeNote.text}</p></MemoryDetailSheet>}
    {mode === 'all' && !firstVisit && <section className="records-summary" aria-label="计时汇总">
      <p><span>近{length}天专注</span>{incomplete ? '计时汇总暂不可确认' : <><strong>{formatMinutes(totals.focusMs)}</strong><span> · {totals.count} 段已结束专注</span></>}</p>
      <button type="button" className="link-button" aria-expanded={summaryOpen} onClick={toggleSummary}>{summaryOpen ? '收起统计' : '查看统计'}</button>
      {summaryOpen && <div className="records-summary-detail">
        <div className="records-switch" role="group" aria-label="计时统计范围">{([7, 30] as const).map(days => <button type="button" key={days} aria-pressed={length === days} onClick={() => setLength(days)}>近{days}天</button>)}</div>
        <p className="hint">{view.shortDate(totals.startKey)} – {view.shortDate(view.todayKey)} · 只统计已确认保存的专注，下面的历史另按月份查找。</p>
        {!incomplete && <><button type="button" className="link-button" aria-expanded={trend} onClick={toggleTrend}>{trend ? '收起趋势' : '查看趋势'}</button>{trend && <WeekChart days={totals.days} todayKey={view.todayKey} />}</>}
      </div>}
    </section>}
    {historyIncomplete && <p className="hint">历史数据未能完整读取。这里只展示当前能确认的内容。</p>}
    {((mode === 'all' && !firstVisit) || mode === 'thoughts') && <div className="records-tools">
      {mode === 'thoughts' && <ThoughtNotebook empty={!thoughtsIncomplete && !view.thoughtDays.length} showArt={showArt}>
        <form className="records-search" onSubmit={event => { event.preventDefault(); if (!composing.current) changeConditions({ search: current.draft.trim() }) }}>
          <label htmlFor="thought-search">搜索想法</label>
          <div><input id="thought-search" type="search" value={current.draft} placeholder="搜索想法" onChange={event => patch({ draft: event.target.value })}
            onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
            onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault() }} />
            <button type="submit" className="pill">搜索</button></div>
        </form>
        {(hasDraft || thoughts.hasDraft) && <button type="button" className="link-button thought-draft" onClick={onContinueDraft ?? thoughts.openNew}>继续草稿 <span aria-hidden="true">›</span></button>}
      </ThoughtNotebook>}
      <div className="records-filter-row"><h2>{mode === 'all' ? '时光足迹' : '按日翻阅'}</h2><span>{monthLabel(current.month)}{current.search && ` · 搜索“${current.search}”`}</span>
        <button type="button" className="link-button" onClick={openMonth}>选择月份</button>
        {current.month && <button type="button" className="link-button" onClick={() => changeConditions({ month: null })}>查看全部日期</button>}
        {current.search && <button type="button" className="link-button" onClick={() => changeConditions({ search: '', draft: '' })}>清除搜索</button>}
        {unknown && current.month !== 'unknown' && <button type="button" className="link-button" onClick={() => changeConditions({ month: 'unknown' })}>日期不详的记录</button>}
      </div>
    </div>}
    {mode === 'scenes' && <RecordsRoom band={reading.roomBand} activities={result.roomActivities} selected={reading.roomTag} onSelect={selectTag} incomplete={incomplete || restsIncomplete}/>}
    <div className="records-list" ref={list} data-result-count={mode === 'favorites' ? savedQuotes.length : result.total}>
      {roomTag ? !thoughts.open && <FocusTaskDialog title={sourceRecord ? '原记录' : sceneNames[roomTag]}
        closeLabel="返回小屋" onClose={returnToRoom} onBack={sourceRecord ? returnToTag : returnToRoom}>{entries}</FocusTaskDialog> : entries}
    </div>
    {selectedThought && !thoughts.open && <ThoughtDetail item={selectedThought} view={view} persistence={persistence} canEdit={canEdit}
      thoughts={thoughts} edit={editSelectedThought} returningFromEdit={editedFromReader.current === selectedThought.id}
      detached={mode === 'thoughts' && !result.all.some(entry => entryId(entry) === current.expanded)}
      onRemove={() => { setDeletedThoughtId(selectedThought.id); thoughts.remove(selectedThought.id) }}
      onClose={() => { editedFromReader.current = null; toggle(`thought:${selectedThought.id}`) }}/>}
    {mode !== 'favorites' && selectedUndo && <div className="records-feedback records-undo" data-status-actions>
      {undoButton(selectedUndo)}
    </div>}
    {mode !== 'favorites' && <div className="records-feedback" data-status-actions>
      {thoughts.status?.text}
      {thoughts.status?.kind === 'error' && <button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button>}
      {thoughts.undos.filter(undo => undo !== selectedUndo).map(undoButton)}
    </div>}
    {monthPanel && <FocusTaskDialog title="选择月份" closeLabel="返回记录" onClose={closeMonth}>
      <label className="records-year">年份<input data-initial-focus inputMode="numeric" type="number" min="1" max="9999" value={year} onChange={event => setYear(event.target.value)} aria-invalid={!validYear} /></label>
      {!validYear && <p className="field-error">请输入1到9999之间的年份。</p>}
      <div className="records-month-grid">{Array.from({ length: 12 }, (_, index) => <button type="button" className="pill pill--ghost" key={index} disabled={!validYear} onClick={() => chooseMonth(`${String(yearValue).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`)}>{index + 1}月</button>)}</div>
      <button type="button" className="link-button" onClick={() => chooseMonth(null)}>查看全部日期</button>
    </FocusTaskDialog>}
    {statusPanel && <FocusTaskDialog title="应用状态" closeLabel="返回记录" onClose={closeStatus}>
      {stateLine && <p>{stateLine}</p>}
      {saveLine && <p>{saveLine}</p>}
      {systemNotices ?? (systemNoticeSummary && <p>{systemNoticeSummary}</p>)}
      {!stateLine && !saveLine && !systemNoticeSummary && <p>目前没有需要处理的应用状态。</p>}
    </FocusTaskDialog>}
  </section>
}
