import { useMemo } from 'react'
import { formatMinutes, PHASE_LABELS } from '../../components/format'
import { sceneNames } from '../../data/scene-copy'
import { knownDate, searchText, RECORDS_PAGE_SIZE } from '../../logic/records-query'
import type { SceneId, Thought } from '../../logic/types'
import type { RecordView, StatsView } from '../useViews'

export interface Page {
  id: string
  art: SceneId | null
  day: string
  dateKey: string | null
  time: string
  kind: string
  duration: string
  activity: string
  title: string
  caption: string
  alt: string
  endedAt: number
  ending: string
  record?: RecordView
}
export interface Note {
  id: string
  day: string
  time: string
  text: string
  source: Thought
}
export const matchesMonth = (key:string|null, month:string|null) =>
  month === 'unknown' ? !key || !knownDate(key) : !month || !!key?.startsWith(month+'-')
const captions: Record<SceneId, string> = {
  F1:'锅沿上搭着一把小勺，小伙伴还在桌边。', F2:'从花盆旁边望过去，叶子把窗边映成了浅绿色。',
  F3:'小伙伴把手搭在摊开的书上。一张纸，也能撑起一座小山。', F4:'杯口上方，留着一点热气。',
  F5:'小伙伴仰起头，眼前有一颗圆圆的泡泡。', F6:'桌边的水盘里，纸船一头高，一头低。',
  F7:'小伙伴面前的积木，一块挨着一块。', F8:'抬起头，几颗星星就在小伙伴的手边。',
  R1:'小伙伴坐在垫子上，舒舒服服地伸开双臂。', R2:'天空那朵云慢悠悠的。小伙伴也抬头看着它。',
  R3:'杯子圆圆的，刚好可以用两只手围住。',
}

export function preferredPage(pages: readonly Page[]) {
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i]!
    if (page.art) return page
  }
  return pages.at(-1)
}

export function readBook(view:StatsView) {
  const date = (key:string|null) => key && knownDate(key) ? view.dayHeading(key) : '日期不详'
  const pages: Page[] = []
  function add(id:string, scene:SceneId|null, kind:string, dateKey:string|null, endedAt:number, time:string, elapsed:number,
    reason:string|null, record?:RecordView) {
    const title = scene ? sceneNames[scene] : '一段'+kind
    pages.push({id, art:scene, kind, dateKey:dateKey && knownDate(dateKey) ? dateKey : null, day:date(dateKey), time, endedAt,
      duration:formatMinutes(elapsed), activity:title, title, caption:scene ? captions[scene] : '',
      alt:scene ? '伙伴的活动插画：'+title : '', ending:reason==='manual' ? '手动结束' : reason==='deadline' ? '到时结束' : '',
      ...(record && {record})})
  }
  for (const row of view.recordBySession.values())
    add('record:'+row.sessionId,row.saved ? row.scene?.sceneId ?? null : null,'专注',row.dateKey,row.endedAt,row.timeLabel,row.elapsedMs,row.endReason,row)
  for (const row of view.restMemories)
    add('rest:'+row.sessionId,row.sceneId,row.phase ? PHASE_LABELS[row.phase] : '休息',row.dateKey,row.endedAt,
      view.clockTime(row.endedAt)+' 结束',row.elapsedMs,row.endReason)
  pages.sort((a,b) => {
    const aDate = a.dateKey ?? ''
    const bDate = b.dateKey ?? ''
    return aDate.localeCompare(bDate) || a.endedAt-b.endedAt || b.id.localeCompare(a.id)
  })
  const groups = new Map<string,Page[]>()
  for (const p of [...pages].reverse()) {
    if (!p.art) continue
    const items = groups.get(p.art)
    if (items) items.push(p)
    else groups.set(p.art,[p])
  }
  const notes: Note[] = view.thoughtDays.flatMap(day => day.entries.flatMap(entry => {
    if (entry.kind !== 'thought') return []
    const n = entry.thought
    return [{id:n.id,day:date(n.dateKey),time:view.clockTime(n.createdAt),text:n.text,source:n}]
  }))
  return {pages, notes, groups}
}

export function useBookEntries(data:ReturnType<typeof readBook>, view:StatsView, month:string|null, query:string) {
  const {notes}=data
  const pages=useMemo(()=>data.pages.filter(p=>matchesMonth(p.dateKey,month)),[data.pages,month])
  const matches = useMemo(() => {
    const needle=searchText(query)
    return notes.filter(n=>matchesMonth(n.source.dateKey,month) && (!needle || view.confirmedThoughtIds.has(n.id) && searchText(n.text).includes(needle)))
  }, [notes, month, query, view.confirmedThoughtIds])
  const timeline = useMemo(() => {
    const records=pages.map(p=>({id:p.id,day:p.day,key:p.dateKey ?? '',at:p.endedAt,title:p.record?.step || p.title,info:p.time+' · '+p.kind+' '+p.duration,art:p.art, note:false}))
    const independent=notes.filter(n=>!n.source.sessionId && matchesMonth(n.source.dateKey,month)).map(n=>({
      id:n.id,day:n.day,key:knownDate(n.source.dateKey) ? n.source.dateKey : '',at:n.source.createdAt,title:n.text || '留过标记',info:n.time+' · 想法',art:null,note:true,
    }))
    return [...records,...independent].sort((a,b)=>b.key.localeCompare(a.key) || b.at-a.at || a.id.localeCompare(b.id))
  }, [pages, notes, month])
  return {pages,matches,timeline}
}
export function listWindow<T>(items:readonly T[],requestedPage:number) {
  const count=Math.max(1,Math.ceil(items.length/RECORDS_PAGE_SIZE))
  const page=Math.min(count,Math.max(1,requestedPage))
  return {page,count,items:items.slice((page-1)*RECORDS_PAGE_SIZE,page*RECORDS_PAGE_SIZE)}
}
export const listPageFor = (at:number) => Math.floor(at/RECORDS_PAGE_SIZE)+1
