import type { ReactNode } from 'react'
import type { Page } from '../../../hooks/records/book'
import { art } from './data'

interface PictureProps {
  id?: string | null | undefined
  className?: string
  alt?: string
}

export function Picture({ id, className, alt = '' }: PictureProps) {
  return id && art[id] ? <img className={className} alt={alt} src={art[id]} draggable={false}/> : null
}

export function PagePicture({ p, showArt }: { p: Page; showArt: boolean }) {
  if (!showArt || !p.art) return null
  return <figure className="jl-photo"><Picture id={p.art} className="jl-illustration" alt={p.alt}/></figure>
}

export function PageHead({ kicker, title, stamp }: { kicker: string; title: string; stamp?: string | undefined }) {
  return <header className="jl-page-head">
    <p className="jl-topline">{kicker}</p>
    <h2 className="jl-section-title">{title}</h2>
    <Picture id={stamp} className="jl-head-stamp"/>
  </header>
}

export function Folio({ index, total }: { index: number; total: number }) {
  return <span className="jl-folio">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
}

export function DatedList<T extends { day: string; id: string }>({ items, render }: {
  items: readonly T[]
  render: (item: T) => ReactNode
}) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const day = groups.get(item.day)
    if (day) day.push(item)
    else groups.set(item.day, [item])
  }
  return <>{Array.from(groups, ([day, rows]) =>
    <section className="jl-day-group" key={day}>
      <h3 className="jl-group-heading">{day}</h3>
      <ol className="jl-simple-list">{rows.map(row => <li key={row.id}>{render(row)}</li>)}</ol>
    </section>)}</>
}

interface RowProps {
  title: string
  detail: string
  stamp?: string | undefined
  onClick: () => void
  attr?: Record<string, string>
}

export function Row({ title, detail, stamp, onClick, attr }: RowProps) {
  return <button type="button" className="jl-row" {...attr} onClick={onClick}>
    <Picture id={stamp} className="jl-mini-stamp"/>
    <span className="jl-row-words"><strong>{title}</strong><small>{detail}</small></span>
    <span className="jl-chevron" aria-hidden="true">›</span>
  </button>
}

export function Facts({ p, showArt }: { p: Page; showArt: boolean }) {
  return <p className="jl-facts">
    {showArt && p.art && <Picture id={'stamp-' + p.art} className="jl-fact-stamp"/>}
    <span>{p.kind} · {p.duration} · {p.ending || p.activity}</span>
  </p>
}
