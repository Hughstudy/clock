export const bookmarks = {story:'手记', thoughts:'想法', room:'小屋', favorites:'收藏'} as const
export type Chapter = keyof typeof bookmarks
export const chapters = Object.keys(bookmarks) as Chapter[]
export type Direction = 'forward' | 'back'
export type Detail =
  | {kind:'room'; scene:string; source?:string}
  | {kind:'note' | 'quote' | 'linked'; id:string}
  | {kind:'letter' | 'contents' | 'results' | 'editor' | 'month' | 'stats' | 'status'}
export interface Location {
  chapter: Chapter
  detail: Detail | null
  story: string
  quote: string
  query: string
  month: string | null
  listPage: number
}
interface Stop {
  location: Location
  top: number
  anchor: string | null
  rowId: string | null
  relativeTop: number | null
  input: string
  direction: Direction
}
/** Ephemeral reading position, scoped to the app's dataset generation. */
export interface BookVisit {
  location: Location
  latest: string
  input: string
  trail: Stop[]
  offsets: Map<string, number>
  chapters: Partial<Record<Chapter,Location>>
}
export const firstPage = (chapter:Chapter): Location => ({
  chapter, detail:null, story:'', quote:'', query:'', month:null, listPage:1,
})
export const initialVisit = (): BookVisit => ({
  location:firstPage('story'), latest:'', input:'', trail:[], offsets:new Map(), chapters:{},
})
export const locationKey = (location: Location) => JSON.stringify(location)
const buttonSelector = 'button:not(:disabled), input, [tabindex="0"]'
export function controlKey(element: Element, root: Element): string|null {
  const attribute = Array.from(element.attributes).find(a => a.name.startsWith('data-jl-') || a.name==='data-section')
  if (attribute) return '['+attribute.name+'="'+CSS.escape(attribute.value)+'"]'
  const label = element.getAttribute('aria-label')
  if (label) return '[aria-label="'+CSS.escape(label)+'"]'
  const index = Array.from(root.querySelectorAll(buttonSelector)).indexOf(element)
  return index < 0 ? null : '#'+index
}
export function locateControl(key:string|null, root: HTMLElement): HTMLElement|null {
  if(!key)return null
  return /^#\d+$/.test(key) ? root.querySelectorAll<HTMLElement>(buttonSelector)[Number(key.slice(1))] ?? null : root.querySelector<HTMLElement>(key)
}
