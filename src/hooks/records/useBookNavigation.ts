import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { useFocusTaskBack } from '../useFocusTaskBack'
import { readBook, useBookEntries, listPageFor, preferredPage } from './book-data'
import {
  chapters,
  firstPage,
  initialVisit,
  controlKey,
  locateControl,
  locationKey,
  type Direction,
  type Location,
  type Chapter,
} from './book-navigation'
import { createBookMotion } from '../../components/records/book/motion'
import type { RecordsBookInput } from './types'

/** Owns one reading visit: selected objects, history, page turns and focus/scroll return. */
export function useBookNavigation(props: Pick<RecordsBookInput, 'view' | 'favorites' | 'thoughts' | 'visit'>) {
  const { view, favorites, thoughts } = props
  const [place] = useState(() => (props.visit.current ??= initialVisit()))
  const data = useMemo(() => readBook(view), [view])
  const { notes, groups } = data
  const phrases = favorites?.saved ?? []
  const latest = useMemo(() => preferredPage(data.pages)?.id ?? '', [data.pages])
  const [where, setWhere] = useState<Location>(() => {
    const saved = place.location
    const followLatest = !saved.story || saved.story === place.latest
    return followLatest && latest !== place.latest ? { ...saved, story: latest } : saved
  })
  const { chapter, detail, story, quote, query, month } = where
  const [input, setInput] = useState(place.input)
  const scroller = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLElement>(null)
  const motion = useRef<ReturnType<typeof createBookMotion> | null>(null)
  const lastTap = useRef<HTMLElement | null>(null)
  const landing = useRef<{
    top: number
    key: string | null
    focus: boolean
    relativeTop?: number | null
    reflow?: boolean
  } | null>(null)
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null)
  const { pages, matches, timeline } = useBookEntries(data, view, month, query)
  const page = useMemo(() => pages.find((p) => p.id === story) ?? preferredPage(pages), [pages, story])
  const pageIndex = page ? pages.indexOf(page) : -1
  const phrase = phrases.find((p) => p.id === quote) ?? phrases[0]
  const phraseIndex = phrase ? phrases.indexOf(phrase) : -1
  const offsetKey = locationKey(where)
  useLayoutEffect(() => {
    const root = shell.current!
    const api = createBookMotion({
      book: root.querySelector<HTMLElement>('.rj-book')!,
      canvas: root.querySelector<HTMLElement>('.rj-canvas')!,
      cover: root.querySelector<HTMLElement>('.rj-cover')!,
    })
    motion.current = api
    api.open()
    return () => {
      api.dispose()
      motion.current = null
    }
  }, [])
  useLayoutEffect(() => {
    const arriving = landing.current
    landing.current = null
    const body = scroller.current
    if (!body) return
    const top = arriving?.top ?? place.offsets.get(offsetKey) ?? 0
    body.scrollTop = top
    if (arriving?.focus) {
      const target = locateControl(arriving.key, shell.current!) ?? body
      target.focus({ preventScroll: true })
      if (arriving.relativeTop != null && target !== body && body.contains(target)) {
        const delta = target.getBoundingClientRect().top - body.getBoundingClientRect().top - arriving.relativeTop
        const desired = body.scrollTop + delta
        // A peer insert can move this formerly last row to the beginning of another
        // page. Keep the tapped line in place even when that page has less to scroll.
        if (arriving.reflow && desired < 0) {
          body.style.paddingBlockStart = parseFloat(getComputedStyle(body).paddingBlockStart) - desired + 'px'
        } else if (arriving.reflow && desired > body.scrollHeight - body.clientHeight) {
          body.style.paddingBlockEnd =
            parseFloat(getComputedStyle(body).paddingBlockEnd) + desired - body.scrollHeight + body.clientHeight + 'px'
        }
        body.scrollTop = Math.max(0, desired)
      } else body.scrollTop = top
    }
    Object.assign(place, { location: where })
    if (!where.detail || where.detail.kind === 'results') place.chapters[chapter] = where
  }, [where, place, offsetKey, chapter])
  useLayoutEffect(() => {
    place.latest = latest
  }, [place, latest])
  useLayoutEffect(() => {
    place.input = input
  }, [input, place])
  const recordOffset = () => {
    if (scroller.current) place.offsets.set(offsetKey, scroller.current.scrollTop)
  }
  function animate(direction: Direction, mutate: () => void, ribbon?: [Chapter, Chapter]) {
    const commit = () => flushSync(mutate)
    if (!motion.current) {
      commit()
      return
    }
    if (ribbon) motion.current.switchSection(ribbon[0], ribbon[1], commit)
    else motion.current.turnPage(direction, commit)
  }
  function navigate(
    next: Location,
    direction: Direction = 'forward',
    options: { ribbon?: [Chapter, Chapter] | undefined; focus?: string; top?: number; input?: string } = {}
  ) {
    const root = shell.current
    if (!root) return
    const origin = lastTap.current?.isConnected ? lastTap.current : document.activeElement
    lastTap.current = null
    const key = origin ? controlKey(origin, root) : null
    const top = scroller.current?.scrollTop ?? 0
    place.offsets.set(offsetKey, top)
    const sourceLocation = { ...where, story: page?.id ?? where.story, quote: phrase?.id ?? where.quote }
    const element = origin instanceof HTMLElement ? origin : null
    const rowId = element?.dataset.jlNote || element?.dataset.jlSourcePage || element?.dataset.jlPage || null
    const relativeTop =
      element && scroller.current?.contains(element)
        ? element.getBoundingClientRect().top - scroller.current.getBoundingClientRect().top
        : null
    place.trail.push({ location: sourceLocation, top, anchor: key, rowId, relativeTop, input, direction })
    landing.current = {
      top: options.top ?? place.offsets.get(locationKey(next)) ?? 0,
      key: options.focus ?? null,
      focus: true,
    }
    animate(
      direction,
      () => {
        setWhere(next)
        if (options.input !== undefined) setInput(options.input)
      },
      options.ribbon
    )
  }
  function back() {
    if (detail?.kind === 'editor' && thoughts.open) thoughts.setOpen(false)
    const previous = place.trail.pop()
    if (!previous) return
    lastTap.current = null
    recordOffset()
    const prior = previous.location
    // Item → detail keeps the same filter, so these rows are the current, full
    // result for the source list even if it changed while the detail was open.
    const sourceRows =
      prior.detail?.kind === 'linked'
        ? view.recordBySession.get(prior.detail.id)?.thoughts
        : prior.detail?.kind === 'room'
          ? data.groups.get(prior.detail.scene)
          : prior.detail?.kind === 'contents'
            ? timeline
            : prior.chapter === 'thoughts' && (!prior.detail || prior.detail.kind === 'results')
              ? matches
              : null
    const rowIndex = previous.rowId && sourceRows ? sourceRows.findIndex((row) => row.id === previous.rowId) : -1
    const nextPage = rowIndex >= 0 ? listPageFor(rowIndex) : prior.listPage
    const restored = { ...prior, listPage: nextPage }
    landing.current = {
      top: previous.top,
      key: previous.anchor,
      focus: true,
      relativeTop: previous.relativeTop,
      reflow: prior.listPage !== nextPage,
    }
    const inverse = previous.direction === 'forward' ? 'back' : 'forward'
    const priorChapter = previous.location.chapter
    animate(
      inverse,
      () => {
        setWhere(restored)
        setInput(previous.input)
      },
      chapter === priorChapter ? undefined : [chapter, priorChapter]
    )
  }
  useFocusTaskBack(place.trail.length > 0, back, offsetKey)
  const backRef = useRef(back)
  backRef.current = back
  useLayoutEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.key !== 'Escape' || !place.trail.length) return
      e.preventDefault()
      backRef.current()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [place])
  function switchChapter(next: Chapter) {
    if (chapter === next && !detail) return
    if (detail?.kind === 'editor' && thoughts.open) thoughts.setOpen(false)
    const target = place.chapters[next] ?? firstPage(next)
    const nextRoot =
      chapter === next ? { ...target, detail: null, query: next === 'thoughts' ? '' : target.query } : target
    const direction = chapters.indexOf(next) > chapters.indexOf(chapter) ? 'forward' : 'back'
    const nextLocation = { ...nextRoot }
    if (next === 'favorites' && !nextLocation.quote) nextLocation.quote = phrases[0]?.id ?? ''
    if (next === 'story' && !nextLocation.story && !nextLocation.month) nextLocation.story = latest
    navigate(nextLocation, direction, {
      ribbon: chapter === next ? undefined : [chapter, next],
      focus: '[data-section="' + next + '"]',
    })
  }
  function turn(i: number) {
    if (!pages[i] || (i === pageIndex && !detail)) return
    navigate({ ...where, detail: null, story: pages[i].id }, i >= pageIndex ? 'forward' : 'back')
  }
  function swipe(direction: number) {
    if (detail && detail.kind !== 'results') {
      if (direction < 0 && place.trail.length) {
        back()
        return true
      }
      return false
    }
    if (chapter === 'story' && pages[pageIndex + direction]) {
      turn(pageIndex + direction)
      return true
    }
    if (direction < 0 && detail?.kind === 'results') {
      back()
      return true
    }
    return false
  }

  function rememberTap(element: HTMLElement | null) {
    lastTap.current = element
  }
  function onChapterKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? chapters.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % chapters.length
            : event.key === 'ArrowLeft'
              ? (index + chapters.length - 1) % chapters.length
              : null
    if (next === null) return
    event.preventDefault()
    rememberTap(event.currentTarget)
    switchChapter(chapters[next]!)
  }
  function onPageKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey) return
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step && swipe(step)) event.preventDefault()
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    gesture.current = null
    const element = event.target as Element
    const rect = event.currentTarget.getBoundingClientRect()
    if (
      event.isPrimary &&
      event.button === 0 &&
      !element.closest('button,input,textarea') &&
      event.clientX > rect.left + 20 &&
      event.clientX < rect.right - 20
    ) {
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current
    gesture.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.5) swipe(dx < 0 ? 1 : -1)
  }

  return {
    place,
    where,
    setWhere,
    input,
    setInput,
    data,
    notes,
    groups,
    latest,
    pages,
    matches,
    timeline,
    page,
    pageIndex,
    phrases,
    phrase,
    phraseIndex,
    shell,
    scroller,
    offsetKey,
    backRef,
    navigate,
    back,
    animate,
    turn,
    switchChapter,
    rememberTap,
    onChapterKeyDown,
    pageEvents: {
      onScroll: recordOffset,
      onKeyDown: onPageKeyDown,
      onPointerDown,
      onPointerUp,
      onPointerCancel: () => {
        gesture.current = null
      },
    },
  }
}
