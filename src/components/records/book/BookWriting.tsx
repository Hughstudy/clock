import type { RecordsProps } from './props'
import type { Note } from '../../../hooks/records/book'
import { savedDay } from './data'
import { PageHead } from './BookPaper'
import { formatMinutes } from '../../format'
import type { SavedQuote } from '../../../contracts/favorites'

export function NoteLeaf({note, props, onEdit}: {note:Note|undefined; props:RecordsProps; onEdit:(id:string)=>void}) {
  if (!note) return <p>这条想法目前无法读取。</p>
  const {view, thoughts, persistence, canEdit} = props
  const pending = view.pendingThoughtIds.has(note.id)
  const confirmed = view.confirmedThoughtIds.has(note.id)
  const source = note.source.sessionId ? view.recordBySession.get(note.source.sessionId) : null
  const disabled = !canEdit || pending
  return <section data-jl-detail="note" data-thought-id={note.id}>
    <PageHead kicker={note.day+' · '+note.time} title={note.text ? '写下的一念' : '留过的标记'} stamp={props.showArt ? (note.text ? 'note' : 'marker') : undefined}/>
    <div className="jl-writing"><p className="jl-note-entry">{note.text || '那时留过一个标记。'}</p></div>
    <p>{note.source.status === 'putAway' ? '已收起' : '待看'}{!confirmed && (persistence==='memory-only'?' · 仅在此页':' · 待保存')}{pending && confirmed && ' · 有更改待保存'}</p>
    {source && <p>关联专注 · {view.shortDate(source.dateKey)} {source.timeLabel} · {formatMinutes(source.elapsedMs)}{source.step && ' · '+source.step}</p>}
    {note.source.sessionId && note.source.sessionId === view.active?.id && <p>关联当前专注</p>}
    <div className="jl-actions">
      <button data-jl-edit type="button" disabled={disabled} onClick={()=>onEdit(note.id)}>{note.text ? '编辑文字' : '补充文字'}</button>
      <button type="button" disabled={disabled} onClick={()=>note.source.status==='open' ? thoughts.putAway(note.id) : thoughts.reopen(note.id)}>{note.source.status==='open' ? '收起想法' : '放回待看'}</button>
      <button type="button" disabled={disabled} onClick={()=>thoughts.remove(note.id)}>删除这条想法</button>
    </div>
    {pending && <button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button>}
  </section>
}

export function QuoteLeaf({quote,props}: {quote:SavedQuote|undefined;props:RecordsProps}) {
  if (!quote) return <p>这句话目前无法读取。</p>
  const {favorites, canEdit} = props
  const problem = favorites?.detailFor(quote)
  return <section data-jl-detail="quote">
    <PageHead kicker="我的收藏" title="伙伴的话" stamp={props.showArt?'bookmark':undefined}/>
    <figure className="jl-quotation"><span className="jl-quote-mark" aria-hidden="true">“</span><blockquote>{quote.text}</blockquote>
      <figcaption className="jl-attribution">{savedDay(quote.savedAt)} 收藏</figcaption></figure>
    {favorites && <button className="link-button" type="button" disabled={!canEdit || favorites.isPending(quote)}
      onClick={()=>favorites.toggle(quote)}>{favorites.isPending(quote) ? '正在取消' : '取消收藏'}</button>}
    {problem && <p>{problem} <button type="button" className="link-button" onClick={favorites?.retry}>重试保存</button></p>}
  </section>
}

export function WritingFeedback({props, onUndo}: {props:RecordsProps;onUndo:(id:string)=>void}) {
  const {thoughts,favorites}=props
  if (!thoughts.status && !thoughts.undos.length && !favorites?.problems.length) return null
  return <div data-status-actions>
    {thoughts.status && <p>{thoughts.status.text} {thoughts.status.kind === 'error' && <button type="button" onClick={thoughts.retry}>重试保存</button>}</p>}
    {thoughts.undos.map(undo=><button type="button" key={undo.id} data-jl-undo={undo.id} disabled={!props.canEdit} onClick={e=>{if(!e.detail)onUndo(undo.id);undo.run()}}>{undo.label}</button>)}
    {favorites?.problems.map(problem=><p key={problem.quote.id}>{problem.message} <button type="button" onClick={favorites.retry}>重试保存</button></p>)}
  </div>
}
