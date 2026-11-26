import bakery from './art/reading-hat.svg?no-inline'
import ticketBook from './art/reading-ticket.svg?no-inline'
import type { ReadingMemory } from '../../../logic/reading-story'

const images = import.meta.glob<string>('./art/*.webp', { eager: true, import: 'default', query: '?no-inline' })
export const art = Object.fromEntries(Object.entries(images).map(([file, url]) => [
  file.replace('./art/', '').replace(/\.webp$/, ''), url,
]))

export const readingArt: Record<ReadingMemory['illustration'], string> = {
  reading: art.F3!,
  'dog-hat': bakery,
  'dog-found': bakery + '#found',
  'closed-book': ticketBook,
}

export function savedDay(timestamp: number) {
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '日期不详'
}
