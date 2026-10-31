import { useId, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Persistence, StoreNotice } from '../adapters/storage'
import { RecordsGreetingArt } from '../components/companion/RecordsArt'
import { formatMinutes, PHASE_LABELS } from '../components/format'
import { RecordEntry } from '../components/RecordEntry'
import { WeekChart } from '../components/WeekChart'
import { recordsGreeting } from '../data/record-stories'
import { useRecordsEntrance } from '../hooks/companion/useRecordsEntrance'
import type { Thoughts } from '../hooks/useThoughts'
import { useHistoryRange, type RecordView, type StatsView } from '../hooks/useViews'
import type { HistoryDay, RangeLength } from '../logic/stats'
import type { Thought } from '../logic/types'

type Mode = 'all' | 'thoughts'

export interface RecordsVisit {
  mode: Mode
  length: RangeLength
  expanded: Record<Mode, string | null>
  visibleDays: Record<Mode, number>
  earlierDays: number
  trend: boolean
  offsets: Record<Mode, number>
}

interface Props {
  view: StatsView
  thoughts: Thoughts
  canEdit: boolean
  onEditThought?: (id: string) => void
  persistence: Persistence
  notice: StoreNotice | null
  hasSaveError: boolean
  showArt: boolean
  reducedMotion: boolean
  visit: MutableRefObject<RecordsVisit | null>
}

const PAGE_DAYS = 7

function initialVisit(): RecordsVisit {
  return {
    mode: 'all', length: 7, expanded: { all: null, thoughts: null },
    visibleDays: { all: PAGE_DAYS, thoughts: PAGE_DAYS }, earlierDays: 0,
    trend: false, offsets: { all: 0, thoughts: 0 },
  }
}

interface ThoughtEntryProps {
  item: Thought
  expanded: boolean
  onToggle: () => void
  linkedRecord: RecordView | undefined
  linkedActive: boolean
  pendingLabel: string | null
  canEdit: boolean
  thoughts: Thoughts
  edit: Props['onEditThought']
}

function ThoughtEntry({ item, expanded, onToggle, linkedRecord, linkedActive, pendingLabel, canEdit, thoughts, edit }: ThoughtEntryProps) {
  const detailId = useId()
  return <li data-thought-id={item.id}>
    <button type="button" className="record-summary" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}>
      <span className="record-identity">
        <span className="record-meta">{item.text ? '想法' : '标记'}{item.status === 'putAway' ? ' · 已收起' : ''}{pendingLabel && ' · ' + pendingLabel}</span>
        <strong className="thought-preview">{item.text || '留过标记'}</strong>
      </span>
      <span aria-hidden="true">{expanded ? '−' : '＋'}</span>
    </button>
    <div id={detailId} className="record-detail" hidden={!expanded}>
      {expanded && <>
        {item.text && <p className="thought-body">{item.text}</p>}
        {linkedRecord && <p>关联专注 · {linkedRecord.dateKey} · {formatMinutes(linkedRecord.elapsedMs)}{linkedRecord.step && ' · ' + linkedRecord.step}</p>}
        {linkedActive && <p>关联当前专注</p>}
        <div className="thought-row-actions">
          {edit && <button type="button" className="link-button" disabled={!canEdit} onClick={() => edit(item.id)}>{item.text ? '编辑文字' : '补充文字'}</button>}
          {item.status === 'open'
            ? <button type="button" className="link-button" disabled={!canEdit} onClick={() => thoughts.putAway(item.id)}>收起想法</button>
            : <button type="button" className="link-button" disabled={!canEdit} onClick={() => thoughts.reopen(item.id)}>放回待看</button>}
          <button type="button" className="link-button" disabled={!canEdit} onClick={() => thoughts.remove(item.id)}>删除这条想法</button>
        </div>
      </>}
    </div>
  </li>
}

export function StatsScreen({ view, thoughts, canEdit, onEditThought, persistence, notice, hasSaveError, showArt, reducedMotion, visit }: Props) {
  const [reading, setReading] = useState<RecordsVisit>(() => visit.current ?? initialVisit())
  const { mode, length, visibleDays, earlierDays, trend } = reading
  const offsets = useRef(reading.offsets)
  const screen = useRef<HTMLElement>(null)
  const toggled = useRef(false)
  const incomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('records')))
  const thoughtsIncomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('thoughts')))
  const animate = useRecordsEntrance(view.band, showArt && !reducedMotion && !hasSaveError && !incomplete && notice?.kind !== 'removed')
  const { totals, range, earlier, later } = useHistoryRange(view, length)
  const days = mode === 'all' ? range : view.thoughtDays

  useLayoutEffect(() => { visit.current = { ...reading, offsets: offsets.current } }, [reading, visit])
  useLayoutEffect(() => {
    const destination = offsets.current[mode]
    if (window.scrollY !== destination) window.scrollTo(0, destination)
    const remember = () => { offsets.current[mode] = window.scrollY }
    window.addEventListener('scroll', remember, { passive: true })
    return () => window.removeEventListener('scroll', remember)
  }, [mode])
  useLayoutEffect(() => {
    if (!toggled.current) return
    toggled.current = false
    screen.current?.querySelector('button.record-summary[aria-expanded="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [reading.expanded])

  const toggle = (id: string) => {
    toggled.current = true
    setReading(current => ({ ...current, expanded: { ...current.expanded, [mode]: current.expanded[mode] === id ? null : id } }))
  }
  const renderDay = (day: HistoryDay<RecordView>) => <section className="record-day" key={day.dateKey} data-date={day.dateKey}>
    <h4><time dateTime={day.dateKey}>{day.dateKey}</time>
      {mode === 'all' && !incomplete && <small> · {formatMinutes(view.totalsByDay.get(day.dateKey)?.focusMs ?? 0)}</small>}
    </h4>
    <ol className="focus-records">{day.entries.map(entry => {
      if (entry.kind === 'record') {
        const id = 'record:' + entry.record.sessionId
        return <RecordEntry key={id} record={entry.record} expanded={reading.expanded[mode] === id}
          onToggle={() => toggle(id)} persistence={persistence} showArt={showArt} confirmedThoughtIds={view.confirmedThoughtIds}
          editThought={canEdit ? onEditThought : undefined} />
      }
      const t = entry.thought
      const id = 'thought:' + t.id
      return <ThoughtEntry key={id} item={t} expanded={reading.expanded[mode] === id}
        onToggle={() => toggle(id)} linkedRecord={t.sessionId ? view.recordBySession.get(t.sessionId) : undefined}
        pendingLabel={view.confirmedThoughtIds.has(t.id) ? null : persistence === 'memory-only' ? '仅在此页' : '待保存'}
        linkedActive={!!t.sessionId && t.sessionId === view.active?.id} canEdit={canEdit} thoughts={thoughts} edit={onEditThought} />
    })}</ol>
  </section>

  return <section ref={screen} className="screen stats" aria-labelledby="stats-title">
    <header className="records-greeting" data-band={view.band} data-animate={animate}>
      <div><h2 id="stats-title" className="screen-title">记录</h2>
        {showArt && <p>{recordsGreeting[view.band]}</p>}
      </div>
      {showArt && <RecordsGreetingArt band={view.band} animate={animate} />}
    </header>
    <div className="records-switch" role="group" aria-label="记录内容">
      {(['all', 'thoughts'] as const).map(m => <button type="button" key={m} aria-pressed={mode === m}
        onClick={() => { if (mode !== m) setReading({ ...reading, mode: m }) }}>{m === 'all' ? '全部记录' : '只看想法'}</button>)}
    </div>
    {(incomplete || thoughtsIncomplete) && <p className="hint">历史数据未能完整读取。这里只展示当前能确认的内容。</p>}
    {mode === 'all' && <>
      <section className="card records-range" aria-label="记录范围">
        <div className="records-switch" role="group" aria-label="日期范围">
          {([7, 30] as const).map(n => <button type="button" aria-pressed={length === n} key={n}
            onClick={() => setReading(current => ({ ...current, length: n, earlierDays: 0 }))}>近{n}天</button>)}
        </div>
        <p>{totals.startKey} 至 {view.todayKey}</p>
        {!incomplete && <>
          <p>累计专注 <strong className="stat-value">{formatMinutes(totals.focusMs)}</strong> · {totals.count} 段</p>
          <button type="button" className="link-button" aria-expanded={trend}
            onClick={() => setReading(current => ({ ...current, trend: !current.trend }))}>{trend ? '收起趋势' : '查看趋势'}</button>
          {trend && <WeekChart days={totals.days} todayKey={view.todayKey} />}
        </>}
      </section>
      {view.active && <p className="hint">{PHASE_LABELS[view.active.phase]} · {view.active.status === 'paused' ? '已暂停' : '正在计时'}，未计入上方累计。</p>}
    </>}
    <section className="card focus-history">
      <h3 className="card-title">{mode === 'all' ? '按日回顾' : '全部日期的想法'}</h3>
      {days.length === 0 && <p>{(mode === 'all' && incomplete) || thoughtsIncomplete ? '目前没有可显示的条目。' :
        mode === 'all' ? '这段日期里还没有记录。' : '还没有想法。'}</p>}
      {days.slice(0, visibleDays[mode]).map(renderDay)}
      {days.length > visibleDays[mode] && <button type="button" className="link-button"
        onClick={() => setReading(current => ({ ...current, visibleDays: { ...current.visibleDays, [mode]: current.visibleDays[mode] + PAGE_DAYS } }))}>再看几天</button>}
      {mode === 'all' && earlier.length > 0 && <div className="records-outside">
        {earlierDays > 0 && <p>更早记录，不计入上方范围汇总。</p>}
        {earlier.slice(0, earlierDays).map(renderDay)}
        {earlierDays < earlier.length && <button type="button" className="link-button"
          onClick={() => setReading(current => ({ ...current, earlierDays: current.earlierDays + PAGE_DAYS }))}>查看更早记录</button>}
      </div>}
      {mode === 'all' && later.length > 0 && <details className="records-outside">
        <summary>晚于本地今天的记录，不计入上方范围汇总</summary>{later.map(renderDay)}
      </details>}
      {(thoughts.status || thoughts.undo) && <p className={'thought-status' + (thoughts.status?.kind === 'error' ? ' thought-status--error' : '')}>
        {thoughts.status?.text}
        {thoughts.undo && <button type="button" className="link-button" disabled={!canEdit} onClick={thoughts.undo.run}>{thoughts.undo.label}</button>}
      </p>}
    </section>
  </section>
}
