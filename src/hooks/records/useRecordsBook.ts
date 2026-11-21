import { useEffect, useLayoutEffect, useRef } from 'react'
import { listWindow, listPageFor, matchesMonth } from './book-data'
import { bookmarks, firstPage, type Detail } from './book-navigation'
import { monthLabel } from '../../components/format'
import { useBookNavigation } from './useBookNavigation'
import type { RecordsBookInput } from './types'

/** Coordinates existing writing controllers with the current book page; never persists on its own. */
export function useRecordsBook(props: RecordsBookInput) {
  const { view, favorites, thoughts } = props
  const navigation = useBookNavigation(props)
  const {
    place,
    where,
    setWhere,
    input,
    setInput,
    data,
    notes,
    groups,
    pages,
    matches,
    timeline,
    page,
    pageIndex,
    phrases,
    phrase,
    phraseIndex,
    scroller,
    backRef,
    navigate,
    back,
    animate,
    turn,
  } = navigation
  const { chapter, detail, query, month } = where
  const composing = useRef(false)
  const announceResults = useRef(false)
  const openDetail = (next: Detail) => navigate({ ...where, detail: next, listPage: 1 }, 'forward', { top: 0 })
  function applySearch(value: string) {
    announceResults.current = true
    const q = value.trim()
    navigate({ ...where, query: q, listPage: 1, detail: { kind: 'results' } }, 'forward', { top: 0, input: q })
  }
  const roomPages = detail?.kind === 'room' ? (groups.get(detail.scene) ?? []) : []
  const roomPage =
    detail?.kind === 'room'
      ? (roomPages.find((p) => p.id === detail.source) ??
        (!detail.source && roomPages.length === 1 ? roomPages[0] : undefined))
      : undefined
  const selectedNote = detail?.kind === 'note' ? notes.find((n) => n.id === detail.id) : undefined
  const selectedQuote = detail?.kind === 'quote' ? phrases.find((q) => q.id === detail.id) : undefined
  const incomplete =
    props.notice?.kind === 'unavailable' || props.notice?.kind === 'unreadable' || props.notice?.kind === 'repaired'
  const pending =
    props.hasSaveError ||
    !!view.pendingThoughtIds.size ||
    !!favorites?.problems.length ||
    data.pages.some((p) => p.record && !p.record.saved)
  const realIssue =
    props.systemNoticeSummary ??
    (pending
      ? '有待保存'
      : props.persistence === 'memory-only'
        ? '仅在此页'
        : props.persistence === 'read-only'
          ? '当前只读'
          : null)
  const undoAnchor = useRef<string | null>(null)
  function restoreUndo(id: string) {
    undoAnchor.current = id
    if (chapter === 'thoughts' && (!detail || detail.kind === 'results')) return
    const origin = place.trail.at(-1)?.location
    if (origin?.chapter === 'thoughts' && (!origin.detail || origin.detail.kind === 'results')) back()
    else navigate(firstPage('thoughts'), 'back', { top: 0, input: '' })
  }
  useLayoutEffect(() => {
    const id = undoAnchor.current
    if (!id || !notes.some((n) => n.id === id)) return
    const element = scroller.current?.querySelector<HTMLElement>('[data-jl-note="' + CSS.escape(id) + '"]')
    if (element) {
      undoAnchor.current = null
      element.focus({ preventScroll: true })
      element.scrollIntoView({ block: 'nearest' })
    } else if (chapter === 'thoughts' && (!detail || detail.kind === 'results')) {
      const index = matches.findIndex((n) => n.id === id)
      if (index >= 0 && where.listPage !== listPageFor(index)) {
        setWhere((current) => ({ ...current, listPage: listPageFor(index) }))
      } else if (index < 0 && (month || query)) {
        setWhere(firstPage('thoughts'))
        setInput('')
      }
    }
  }, [notes, matches, where.listPage, chapter, detail, month, query])
  const usedEditor = useRef(false)
  useEffect(() => {
    if (detail?.kind === 'editor') {
      if (thoughts.open) usedEditor.current = true
      else if (usedEditor.current) {
        const id = requestAnimationFrame(() => backRef.current())
        return () => cancelAnimationFrame(id)
      }
    } else usedEditor.current = false
  }, [thoughts.open, detail])
  // Deletion/cancel-favorite takes effect only after the durable view loses that ID.
  useEffect(() => {
    if ((detail?.kind === 'note' && !selectedNote) || (detail?.kind === 'quote' && !selectedQuote)) {
      const frame = requestAnimationFrame(() => backRef.current())
      return () => cancelAnimationFrame(frame)
    }
  }, [detail, selectedNote, selectedQuote])
  function editNote(id?: string) {
    if (id) thoughts.edit(id)
    else thoughts.setOpen(true)
    navigate({ ...where, detail: { kind: 'editor' } }, 'forward', { focus: '#thought-text', top: 0 })
  }
  function setMonth(value: string | null) {
    announceResults.current = true
    navigate(
      {
        ...where,
        month: value,
        listPage: 1,
        story: '',
        detail: chapter === 'story' ? { kind: 'contents' } : query ? { kind: 'results' } : null,
      },
      'back',
      { top: 0 }
    )
  }
  const linkedNotes = detail?.kind === 'linked' ? (view.recordBySession.get(detail.id)?.thoughts ?? []) : []
  const listItems =
    detail?.kind === 'contents'
      ? timeline
      : detail?.kind === 'room'
        ? roomPages
        : detail?.kind === 'linked'
          ? linkedNotes
          : matches
  const { page: listPage, count: listCount } = listWindow<unknown>(listItems, where.listPage)
  useEffect(() => {
    if (!announceResults.current) return
    announceResults.current = false
    props.onAnnounce?.(
      bookmarks[chapter] +
        '，' +
        monthLabel(month) +
        '，' +
        (incomplete ? '当前可读取' : '共') +
        listItems.length +
        '条，第' +
        listPage +
        '页。'
    )
  }, [where, props.onAnnounce, chapter, month, listItems.length, listPage, incomplete])

  const hasUnknownDates =
    detail?.kind === 'month' &&
    (chapter === 'thoughts'
      ? notes.some((note) => matchesMonth(note.source.dateKey, 'unknown'))
      : data.pages.some((page) => matchesMonth(page.dateKey, 'unknown')) ||
        notes.some((note) => !note.source.sessionId && matchesMonth(note.source.dateKey, 'unknown')))
  const visible = <T>(items: readonly T[]) => listWindow(items, where.listPage).items
  const changeListPage = (next: number) => {
    announceResults.current = true
    navigate({ ...where, listPage: next }, next > listPage ? 'forward' : 'back', { top: 0 })
  }
  const clearSearch = () =>
    navigate({ ...where, query: '', detail: null, listPage: 1 }, 'back', {
      input: '',
      top: 0,
      focus: '[aria-label="搜索想法"]',
    })
  const nextQuote = () =>
    navigate({ ...where, quote: phrases[(phraseIndex + 1) % phrases.length]!.id }, 'forward', {
      focus: '[data-jl-quote]',
    })
  const openContents = () =>
    place.trail.at(-1)?.location.detail?.kind === 'contents' ? back() : openDetail({ kind: 'contents' })
  const showWritingFeedback =
    (chapter === 'thoughts' || chapter === 'favorites' || detail?.kind === 'note' || detail?.kind === 'status') &&
    detail?.kind !== 'editor' &&
    (detail?.kind !== 'note' || !!selectedNote)
  function parentLabel() {
    const parent = place.trail.at(-1)?.location
    if (parent?.detail?.kind === 'room') return '画签来处'
    if (parent?.detail?.kind === 'note') return '想法'
    if (parent?.detail?.kind === 'linked') return '这一段的想法'
    if (parent?.detail?.kind === 'results') return '搜索结果'
    if (parent?.detail?.kind === 'contents') return '目录'
    return bookmarks[parent?.chapter ?? chapter]
  }

  function accessibleTitle() {
    if (!detail) return chapter === 'story' ? (page?.title ?? '手记') : bookmarks[chapter]
    if (detail.kind === 'room') return roomPage?.title ?? '画签的来处'
    if (detail.kind === 'note') return '想法'
    if (detail.kind === 'linked') return '这一段的想法'
    if (detail.kind === 'quote') return '收藏的句子'
    return {
      letter: '欢迎笺',
      contents: '手记目录',
      editor: '编辑想法',
      month: '选择月份',
      stats: '专注时光',
      status: '应用状态',
      results: '搜索结果',
    }[detail.kind]
  }

  return {
    where,
    input,
    setInput,
    composing,
    groups,
    pages,
    matches,
    timeline,
    page,
    pageIndex,
    phrases,
    phrase,
    phraseIndex,
    roomPages,
    roomPage,
    selectedNote,
    selectedQuote,
    linkedNotes,
    incomplete,
    pending,
    realIssue,
    listPage,
    listCount,
    hasUnknownDates,
    visible,
    showWritingFeedback,
    shell: navigation.shell,
    scroller,
    offsetKey: navigation.offsetKey,
    pageEvents: navigation.pageEvents,
    rememberTap: navigation.rememberTap,
    onChapterKeyDown: navigation.onChapterKeyDown,
    switchChapter: navigation.switchChapter,
    openDetail,
    back,
    turn,
    applySearch,
    setMonth,
    editNote,
    restoreUndo,
    changeListPage,
    clearSearch,
    nextQuote,
    openContents,
    turnTool: (update: () => void) => animate('forward', update),
    parentLabel: parentLabel(),
    accessibleTitle: accessibleTitle(),
  }
}

export type RecordsBook = ReturnType<typeof useRecordsBook>
