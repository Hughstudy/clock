import type { RecordsMode as Mode, MonthFilter } from './useRecordsQuery'
import type { RangeLength } from '../../logic/stats'
import type { SceneId } from '../../logic/types'
import type { RecordsBand } from '../../logic/record-stories'

export const RECORDS_MODES: Record<Mode, string> = { all: '全部记录', thoughts: '只看想法', scenes: '生活场景', favorites: '我的收藏' }
export interface Browse { month: MonthFilter; search: string; draft: string; page: number; expanded: string | null; sourceRecord: string | null }
export interface Position { offset: number; anchor: string | null; relative: number; focus: string | null }
export interface RecordsVisit {
  mode: Mode
  length: RangeLength
  summaryOpen: boolean
  trend: boolean
  roomTag: SceneId | null
  roomBand: RecordsBand
  roomOpener: 'spot' | 'label'
  sourceTop: number | null
  browse: Record<Mode, Browse>
  positions: Record<Mode, Position>
}

export function initialVisit(roomBand: RecordsBand): RecordsVisit {
  const browse = () => ({ month: null, search: '', draft: '', page: 1, expanded: null, sourceRecord: null })
  const position = () => ({ offset: 0, anchor: null, relative: 0, focus: null })
  return { mode: 'all', length: 7, summaryOpen: false, trend: false, roomTag: null, roomBand, roomOpener: 'label', sourceTop: null,
    browse: { all: browse(), thoughts: browse(), scenes: browse(), favorites: browse() },
    positions: { all: position(), thoughts: position(), scenes: position(), favorites: position() } }
}
export const monthLabel = (month: MonthFilter) => month === 'unknown' ? '日期不详' : month ? `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月` : '全部日期'
