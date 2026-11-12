import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useFocusTaskBack } from '../hooks/useFocusTaskBack'
import { readBook, useBookEntries, listWindow, listPageFor, matchesMonth, preferredPage, type Page } from '../hooks/records/book'
import { monthLabel } from '../hooks/records/visit'
import { ThoughtPanel } from '../components/ThoughtPanel'
import { RecordsPagination } from '../components/records/RecordsPagination'
import { BookTools } from '../components/records/book/BookTools'
import { Picture, PagePicture, PageHead, Folio, DatedList, Row, Facts } from '../components/records/book/BookPaper'
import { NoteLeaf, QuoteLeaf, WritingFeedback } from '../components/records/book/BookWriting'
import { savedDay } from '../components/records/book/data'
import { bookmarks, chapters, firstPage, initialVisit, controlKey, locateControl, locationKey,
  type Direction, type Location, type Detail, type Chapter } from '../components/records/book/navigation'
import { welcomeNote } from '../data/welcome'
import { createBookMotion } from '../components/records/book/motion'
import { formatMinutes } from '../components/format'
import type { RecordsProps } from '../components/records/book/props'
import '../components/records/book/book.css'

export function RecordsScreen(props: RecordsProps) {
  const { view, favorites, showArt, thoughts } = props
  const [place] = useState(() => props.visit.current ??= initialVisit())
  const data = useMemo(() => readBook(view), [view])
  const { notes, groups } = data
  const phrases = favorites?.saved ?? []
  const latest = useMemo(() => preferredPage(data.pages)?.id ?? '', [data.pages])
  const [where,setWhere] = useState<Location>(() => {
    const saved=place.location
    const followLatest = !saved.story || saved.story===place.latest
    return followLatest && latest!==place.latest ? {...saved,story:latest} : saved
  })
  const {chapter,detail,story,quote,query,month} = where
  const [input,setInput] = useState(place.input)
  const scroller = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLElement>(null)
  const motion = useRef<ReturnType<typeof createBookMotion>|null>(null)
  const lastTap = useRef<HTMLElement|null>(null)
  const landing = useRef<{top:number; key:string|null; focus:boolean; relativeTop?:number|null; reflow?:boolean}|null>(null)
  const gesture = useRef<{id:number;x:number;y:number}|null>(null)
  const {pages,matches,timeline}=useBookEntries(data,view,month,query)
  const page = useMemo(() => pages.find(p=>p.id===story) ?? preferredPage(pages), [pages,story])
  const pageIndex = page ? pages.indexOf(page) : -1
  const phrase = phrases.find(p=>p.id===quote) ?? phrases[0]
  const phraseIndex = phrase ? phrases.indexOf(phrase) : -1
  const offsetKey = locationKey(where)
  const composing = useRef(false)
  const announceResults = useRef(false)
  useLayoutEffect(()=>{
    const root = shell.current!
    const api = createBookMotion({book:root.querySelector<HTMLElement>('.rj-book')!,canvas:root.querySelector<HTMLElement>('.rj-canvas')!,cover:root.querySelector<HTMLElement>('.rj-cover')!})
    motion.current=api
    api.open()
    return ()=>{api.dispose();motion.current=null}
  },[])
  useLayoutEffect(()=>{
    const arriving=landing.current
    landing.current=null
    const body=scroller.current
    if(!body)return
    const top=arriving?.top ?? place.offsets.get(offsetKey) ?? 0
    body.scrollTop=top
    if(arriving?.focus){
      const target=locateControl(arriving.key,shell.current!) ?? body
      target.focus({preventScroll:true})
      if(arriving.relativeTop!=null && target!==body && body.contains(target)){
        const delta=target.getBoundingClientRect().top-body.getBoundingClientRect().top-arriving.relativeTop
        const desired=body.scrollTop+delta
        // A peer insert can move this formerly last row to the beginning of another
        // page. Keep the tapped line in place even when that page has less to scroll.
        if(arriving.reflow && desired<0) {
          body.style.paddingBlockStart=(parseFloat(getComputedStyle(body).paddingBlockStart)-desired)+'px'
        } else if(arriving.reflow && desired>body.scrollHeight-body.clientHeight){
          body.style.paddingBlockEnd=(parseFloat(getComputedStyle(body).paddingBlockEnd)+desired-body.scrollHeight+body.clientHeight)+'px'
        }
        body.scrollTop=Math.max(0,desired)
      } else body.scrollTop=top
    }
    Object.assign(place,{location:where})
    if(!where.detail || where.detail.kind==='results')place.chapters[chapter]=where
  },[where,place,offsetKey,chapter])
  useLayoutEffect(()=>{place.latest=latest},[place,latest])
  useLayoutEffect(()=>{place.input=input},[input,place])
  const recordOffset = () => {if(scroller.current)place.offsets.set(offsetKey,scroller.current.scrollTop)}
  function animate(direction:Direction, mutate:()=>void, ribbon?:[Chapter,Chapter]) {
    const commit=()=>flushSync(mutate)
    if (!motion.current) {commit();return}
    if(ribbon)motion.current.switchSection(ribbon[0],ribbon[1],commit)
    else motion.current.turnPage(direction,commit)
  }
  function navigate(next:Location, direction:Direction='forward', options:{ribbon?:[Chapter,Chapter]|undefined; focus?:string; top?:number; input?:string}={}) {
    const root=shell.current
    if(!root)return
    const origin=lastTap.current?.isConnected ? lastTap.current : document.activeElement
    lastTap.current=null
    const key=origin ? controlKey(origin,root) : null
    const top=scroller.current?.scrollTop ?? 0
    place.offsets.set(offsetKey,top)
    const sourceLocation = {...where,story:page?.id ?? where.story,quote:phrase?.id ?? where.quote}
    const element = origin instanceof HTMLElement ? origin : null
    const rowId = element?.dataset.jlNote || element?.dataset.jlSourcePage || element?.dataset.jlPage || null
    const relativeTop = element && scroller.current?.contains(element) ? element.getBoundingClientRect().top-scroller.current.getBoundingClientRect().top : null
    place.trail.push({location:sourceLocation,top,anchor:key,rowId,relativeTop,input,direction})
    landing.current={top:options.top ?? place.offsets.get(locationKey(next)) ?? 0,key:options.focus ?? null,focus:true}
    animate(direction,()=>{setWhere(next);if(options.input!==undefined)setInput(options.input)},options.ribbon)
  }
  function back() {
    if(detail?.kind==='editor' && thoughts.open)thoughts.setOpen(false)
    const previous=place.trail.pop()
    if(!previous)return
    lastTap.current=null
    recordOffset()
    const prior=previous.location
    // Item → detail keeps the same filter, so these rows are the current, full
    // result for the source list even if it changed while the detail was open.
    const sourceRows = prior.detail?.kind==='linked' ? view.recordBySession.get(prior.detail.id)?.thoughts : prior.detail?.kind==='room' ? data.groups.get(prior.detail.scene) :
      prior.detail?.kind==='contents' ? timeline : prior.chapter==='thoughts' && (!prior.detail || prior.detail.kind==='results') ? matches : null
    const rowIndex=previous.rowId && sourceRows ? sourceRows.findIndex(row=>row.id===previous.rowId) : -1
    const nextPage=rowIndex>=0 ? listPageFor(rowIndex) : prior.listPage
    const restored={...prior,listPage:nextPage}
    landing.current={top:previous.top,key:previous.anchor,focus:true,relativeTop:previous.relativeTop,reflow:prior.listPage!==nextPage}
    const inverse=previous.direction==='forward'?'back':'forward'
    const priorChapter=previous.location.chapter
    animate(inverse,()=>{setWhere(restored);setInput(previous.input)},chapter===priorChapter?undefined:[chapter,priorChapter])
  }
  useFocusTaskBack(place.trail.length>0, back, offsetKey)
  const backRef=useRef(back)
  backRef.current=back
  useLayoutEffect(()=>{
    const close=(e:KeyboardEvent)=>{
      if(e.defaultPrevented||e.isComposing||e.key!=='Escape'||!place.trail.length)return
      e.preventDefault();backRef.current()
    }
    window.addEventListener('keydown',close)
    return ()=>window.removeEventListener('keydown',close)
  },[place])
  const openDetail=(next:Detail)=>navigate({...where,detail:next,listPage:1},'forward',{top:0})
  function switchChapter(next:Chapter) {
    if(chapter===next && !detail)return
    if(detail?.kind==='editor' && thoughts.open)thoughts.setOpen(false)
    const target=place.chapters[next] ?? firstPage(next)
    const nextRoot=chapter===next ? {...target,detail:null,query:next==='thoughts'?'':target.query} : target
    const direction=chapters.indexOf(next)>chapters.indexOf(chapter)?'forward':'back'
    const nextLocation = {...nextRoot}
    if(next==='favorites' && !nextLocation.quote)nextLocation.quote=phrases[0]?.id ?? ''
    if(next==='story' && !nextLocation.story && !nextLocation.month)nextLocation.story=latest
    navigate(nextLocation,direction,{ribbon:chapter===next?undefined:[chapter,next],focus:'[data-section="'+next+'"]'})
  }
  function turn(i:number) {
    if(!pages[i] || (i===pageIndex&&!detail))return
    navigate({...where,detail:null,story:pages[i].id},i>=pageIndex?'forward':'back')
  }
  function applySearch(value:string) {
    announceResults.current=true
    const q=value.trim()
    navigate({...where,query:q,listPage:1,detail:{kind:'results'}},'forward',{top:0,input:q})
  }
  const roomPages = detail?.kind==='room' ? groups.get(detail.scene) ?? [] : []
  const roomPage = detail?.kind==='room' ? roomPages.find(p=>p.id===detail.source) ?? (!detail.source && roomPages.length===1 ? roomPages[0] : undefined) : undefined
  const selectedNote = detail?.kind==='note' ? notes.find(n=>n.id===detail.id) : undefined
  const selectedQuote = detail?.kind==='quote' ? phrases.find(q=>q.id===detail.id) : undefined
  const incomplete = props.notice?.kind==='unavailable' || props.notice?.kind==='unreadable' || props.notice?.kind==='repaired'
  const pending = props.hasSaveError || !!view.pendingThoughtIds.size || !!favorites?.problems.length || data.pages.some(p=>p.record && !p.record.saved)
  const realIssue = props.systemNoticeSummary ?? (pending ? '有待保存' : props.persistence==='memory-only' ? '仅在此页' : props.persistence==='read-only' ? '当前只读' : null)
  const undoAnchor = useRef<string|null>(null)
  function restoreUndo(id: string) {
    undoAnchor.current = id
    if (chapter === 'thoughts' && (!detail || detail.kind === 'results')) return
    const origin = place.trail.at(-1)?.location
    if (origin?.chapter === 'thoughts' && (!origin.detail || origin.detail.kind === 'results')) back()
    else navigate(firstPage('thoughts'), 'back', {top: 0, input: ''})
  }
  useLayoutEffect(()=>{
    const id=undoAnchor.current
    if(!id || !notes.some(n=>n.id===id))return
    const element=scroller.current?.querySelector<HTMLElement>('[data-jl-note="'+CSS.escape(id)+'"]')
    if(element){
      undoAnchor.current=null
      element.focus({preventScroll:true});element.scrollIntoView({block:'nearest'})
    } else if (chapter === 'thoughts' && (!detail || detail.kind === 'results')) {
      const index = matches.findIndex(n => n.id === id)
      if (index >= 0 && where.listPage !== listPageFor(index)) {
        setWhere(current => ({...current, listPage:listPageFor(index)}))
      } else if (index < 0 && (month || query)) {
        setWhere(firstPage('thoughts'))
        setInput('')
      }
    }
  },[notes,matches,where.listPage,chapter,detail,month,query])
  const usedEditor = useRef(false)
  useEffect(() => {
    if (detail?.kind==='editor') {
      if (thoughts.open) usedEditor.current=true
      else if (usedEditor.current) {
        const id=requestAnimationFrame(()=>backRef.current())
        return ()=>cancelAnimationFrame(id)
      }
    } else usedEditor.current=false
  }, [thoughts.open,detail])
  // Deletion/cancel-favorite takes effect only after the durable view loses that ID.
  useEffect(()=>{
    if ((detail?.kind==='note' && !selectedNote) || (detail?.kind==='quote' && !selectedQuote)) {
      const frame=requestAnimationFrame(()=>backRef.current())
      return ()=>cancelAnimationFrame(frame)
    }
  },[detail,selectedNote,selectedQuote])
  function editNote(id?: string) {
    if(id)thoughts.edit(id)
    else thoughts.setOpen(true)
    navigate({...where,detail:{kind:'editor'}},'forward',{focus:'#thought-text',top:0})
  }
  function setMonth(value:string|null) {
    announceResults.current=true
    navigate({...where,month:value,listPage:1,story:'',detail:chapter==='story' ? {kind:'contents'} : query ? {kind:'results'} : null},'back',{top:0})
  }
  const linkedNotes = detail?.kind==='linked' ? view.recordBySession.get(detail.id)?.thoughts ?? [] : []
  const listItems = detail?.kind==='contents' ? timeline : detail?.kind==='room' ? roomPages : detail?.kind==='linked' ? linkedNotes : matches
  const {page:listPage,count:listCount}=listWindow<unknown>(listItems,where.listPage)
  useEffect(() => {
    if (!announceResults.current) return
    announceResults.current=false
    props.onAnnounce?.(bookmarks[chapter]+'，'+monthLabel(month)+'，'+(incomplete ? '当前可读取' : '共')+listItems.length+'条，第'+listPage+'页。')
  }, [where, props.onAnnounce, chapter, month, listItems.length, listPage, incomplete])
  const visible = <T,>(items:readonly T[]) => listWindow(items,where.listPage).items
  function pagination() {
    return listCount>1 && <RecordsPagination label="记录分页" page={listPage} pageCount={listCount}
      onChange={next=>{announceResults.current=true;navigate({...where,listPage:next},next>listPage?'forward':'back',{top:0})}}/>
  }
  const tools = <div className="jl-actions">
    <button type="button" data-jl-month onClick={()=>openDetail({kind:'month'})}>选择月份</button>
    {month && <button type="button" onClick={()=>setMonth(null)}>查看全部日期</button>}
    {chapter==='story' && <button type="button" data-jl-stats onClick={()=>openDetail({kind:'stats'})}>查看统计</button>}
  </div>
  function storyBody(p:Page) {
    return <article className="jl-memory-leaf" data-record-id={p.record?.sessionId} data-rest-id={p.record ? undefined : p.id.slice(5)} data-saved={p.record?.saved ?? true}>
      <header className="jl-date"><span>{p.day}</span><span className="jl-day-rule"/><span className="jl-day-time">{p.time}</span></header>
      <PagePicture p={p} showArt={showArt}/>
      <div className="jl-story-words"><h2 className="jl-story-title">{p.title}</h2>{p.caption && <p className="jl-caption">{p.caption}</p>}</div>
      <Facts p={p} showArt={showArt}/>
      {p.record && <div className="jl-record-metadata">
        {p.record.step && <p>这一小步：{p.record.step}</p>}
        <p>目标 {formatMinutes(p.record.targetMs)} · {p.record.saved ? '已保存' : props.persistence==='memory-only' ? '仅在此页' : '待保存'}</p>
        {listWindow(p.record.thoughts,1).items.map(n=><button type="button" className="jl-row" data-jl-note={n.id} key={n.id} onClick={()=>openDetail({kind:'note',id:n.id})}>
          <span>{n.text || '留过标记'}</span><span aria-hidden="true">›</span></button>)}
        {listWindow(p.record.thoughts,1).count>1 && <button type="button" className="link-button" data-jl-linked onClick={()=>openDetail({kind:'linked',id:p.record!.sessionId})}>查看全部 {p.record.thoughts.length} 条想法</button>}
      </div>}
    </article>
  }
  function chapterBody() {
    if (chapter==='story') return page ? storyBody(page) : <>
      <PageHead kicker="手记" title="窗边的第一张纸" stamp={showArt?'notebook':undefined}/>
      <p className="jl-caption">{incomplete?'目前没有可确认的手记。':month?'这个月还没有记录。':'下一段专注或休息结束并保存后，可以在这里重读。'}</p>
      <Row title="欢迎笺" detail="给你的信" stamp={showArt?'envelope':undefined} attr={{'data-jl-letter':''}} onClick={()=>openDetail({kind:'letter'})}/>
    </>
    if (chapter==='thoughts') return <>
      <PageHead kicker={monthLabel(month)} title={query?'搜索结果':'随手便笺'} stamp={showArt?'notebook':undefined}/>
      <form className="jl-search" onSubmit={e=>{e.preventDefault();if(!composing.current)applySearch(input)}}>
        <input aria-label="搜索想法" type="search" enterKeyHint="search" placeholder="搜索便笺里的文字" value={input}
          onChange={e=>setInput(e.target.value)} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false}}
          onKeyDown={e=>{if(e.key==='Enter' && (e.nativeEvent.isComposing || composing.current))e.preventDefault()}}/>
        <button type="submit" data-jl-search>搜索</button>
      </form>
      {tools}
      {thoughts.hasDraft && <button type="button" className="link-button" onClick={()=>editNote()}>继续草稿</button>}
      <div className="jl-note-stack"><DatedList items={visible(matches)} render={n=><button type="button" data-jl-note={n.id} data-thought-id={n.id} className="jl-note-line" onClick={()=>openDetail({kind:'note',id:n.id})}>
        <small>{n.time} · {n.text?'想法':'标记'}{n.source.status==='putAway' && ' · 已收起'}{!view.confirmedThoughtIds.has(n.id) ? ' · 待保存' : view.pendingThoughtIds.has(n.id) ? ' · 有更改待保存' : ''}</small>
        <span className="jl-note-entry">{n.text||'留过标记'}</span></button>}/></div>
      {!matches.length && <p className="jl-empty">{query?'没有找到相符的便笺。':month?'这个月还没有想法。':incomplete?'目前没有可确认的想法。':'专注或休息时写下的想法，会夹在这里。'}</p>}
      {pagination()}
    </>
    if (chapter==='room') return <><PageHead kicker="生活场景" title="窗边的小屋"/>{showArt && <figure className="jl-room-photo"><Picture id="room" alt="蓝伙伴坐在窗边的小屋里。"/></figure>}
      <div className="jl-stamp-shelf"><h3 className="jl-subtitle">架上的画签</h3>{!groups.size && <p className="jl-empty">{incomplete?'目前没有可确认的画签。':'有了带画签的手记，就能在这里找到它的来处。'}</p>}
      <div className="jl-stamp-grid">{Array.from(groups,([id,items])=><button key={id} type="button" data-jl-source={id} className="jl-stamp-cell" aria-label={items[0]!.activity+'，查看'+items.length+'段手记'} onClick={()=>openDetail({kind:'room',scene:id})}>{showArt && <Picture id={'stamp-'+id}/>}<span>{items[0]!.activity}</span></button>)}</div></div></>
    return <><PageHead kicker="我的收藏" title="喜欢的句子" stamp={showArt?'bookmark':undefined}/>
      {phrase ? <><button type="button" className="jl-quotation jl-quotation-button" data-jl-quote-detail={phrase.id} onClick={()=>openDetail({kind:'quote',id:phrase.id})}><span className="jl-quote-mark" aria-hidden="true">“</span><span className="jl-quote-text">{phrase.text}</span><span className="jl-attribution">伙伴的话 · {savedDay(phrase.savedAt)}收藏</span></button>
      {phrases.length>1 && <button className="jl-next-quote" type="button" data-jl-quote onClick={()=>navigate({...where,quote:phrases[(phraseIndex+1)%phrases.length]!.id},'forward',{focus:'[data-jl-quote]'})}>读另一句 <span aria-hidden="true">›</span></button>}</> : <p className="jl-empty">{incomplete ? '目前没有可确认的收藏。' : '喜欢伙伴的哪句话，可以把它夹在这里。'}</p>}
      <Row title="欢迎笺" detail="给你的信" stamp={showArt?'envelope':undefined} attr={{'data-jl-letter':''}} onClick={()=>openDetail({kind:'letter'})}/>
    </>
  }
  function parentLabel() {
    const parent=place.trail.at(-1)?.location
    if (parent?.detail?.kind==='room') return '画签来处'
    if (parent?.detail?.kind==='note') return '想法'
    if (parent?.detail?.kind==='linked') return '这一段的想法'
    if (parent?.detail?.kind==='results') return '搜索结果'
    if (parent?.detail?.kind==='contents') return '目录'
    return bookmarks[parent?.chapter ?? chapter]
  }

  function detailBody() {
    if (!detail || detail.kind==='results') return chapterBody()
    if (detail.kind==='room') {
      if (roomPage) return <div data-jl-detail="room" data-jl-source-detail={roomPage.id}>{storyBody(roomPage)}</div>
      return <div data-jl-detail="room"><PageHead kicker="小屋 · 画签的来处" title={roomPages[0]?.activity ?? '来源记录'} stamp={showArt?'stamp-'+detail.scene:undefined}/>
        {detail.source && <p>这段原记录目前无法读取。</p>}
        <DatedList items={visible(roomPages)} render={p=><Row title={p.record?.step || p.title} detail={p.time+' · '+p.kind+' '+p.duration}
          attr={{'data-jl-source-page':p.id}} onClick={()=>openDetail({...detail,source:p.id})}/>}/>{pagination()}</div>
    }
    if (detail.kind==='linked') return <section data-jl-detail="linked"><PageHead kicker="随手便笺" title="这一段的想法"/>
      {visible(linkedNotes).map(n=><Row key={n.id} title={n.text || '留过标记'} detail={view.shortDate(n.dateKey)+' · '+view.clockTime(n.createdAt)}
        attr={{'data-jl-note':n.id}} onClick={()=>openDetail({kind:'note',id:n.id})}/>)}{pagination()}</section>
    if (detail.kind==='contents') return <section data-jl-detail="contents"><PageHead kicker={monthLabel(month)} title="手记目录"/>{tools}
      <DatedList items={visible(timeline)} render={item=><Row title={item.title} stamp={showArt && item.art?'stamp-'+item.art:undefined} detail={item.info}
        attr={{'data-jl-page':item.id}} onClick={()=>item.note ? openDetail({kind:'note',id:item.id}) : turn(pages.findIndex(p=>p.id===item.id))}/>}/>
      {!timeline.length && <p>{incomplete?'目前没有可确认的条目。':month?'这个月还没有记录。':'还没有记录。'}</p>}
      {pagination()}</section>
    if (detail.kind==='note') return <NoteLeaf note={selectedNote} props={props} onEdit={editNote}/>
    if (detail.kind==='quote') return <QuoteLeaf quote={selectedQuote} props={props}/>
    if (detail.kind==='editor') return <section data-jl-detail="editor"><PageHead kicker="随手便笺" title="编辑想法"/>
      <ThoughtPanel thoughts={thoughts} canEdit={props.canEdit}/>
      {(props.hasSaveError || thoughts.status?.kind==='error') && <p className="panel-save-error">最新更改尚未保存。
        <button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button></p>}</section>
    if (detail.kind==='letter') return <section data-jl-detail="letter"><PageHead kicker="给你的信" title="欢迎笺" stamp={showArt?'envelope':undefined}/>
      <div className="jl-letter-text"><p>{welcomeNote.text}</p></div></section>
    const hasUnknownDates = detail.kind==='month' && (chapter==='thoughts' ? notes.some(n=>matchesMonth(n.source.dateKey,'unknown')) :
      data.pages.some(p=>matchesMonth(p.dateKey,'unknown')) || notes.some(n=>!n.source.sessionId && matchesMonth(n.source.dateKey,'unknown')))
    return <BookTools hasUnknownDates={hasUnknownDates} kind={detail.kind} {...props} month={month} onMonth={setMonth} hasSaveError={pending} onTurn={update=>animate('forward',update)}/>
  }

  const footerInfo = (text:string) => <><span className="jl-foot-info">{text}</span><span className="jl-endmark" aria-hidden="true">✦</span></>
  function chapterFoot() {
    if (detail && detail.kind!=='results') return <><button type="button" data-jl-back className="jl-wide-action" onClick={back}>‹ 返回{parentLabel()}</button><span className="jl-endmark" aria-hidden="true">✦</span></>
    if (chapter==='story') return <>{page && <button type="button" data-jl-prev className="jl-turn" disabled={pageIndex===0} onClick={()=>turn(pageIndex-1)}>‹ 上一页</button>}
      <button type="button" data-jl-contents className="jl-open-index" onClick={()=>place.trail.at(-1)?.location.detail?.kind==='contents' ? back() : openDetail({kind:'contents'})}>目录 {page && <Folio index={pageIndex} total={pages.length}/>}</button>
      {page && <button type="button" data-jl-next className="jl-turn" disabled={pageIndex+1===pages.length} onClick={()=>turn(pageIndex+1)}>下一页 ›</button>}</>
    if (chapter==='thoughts' && detail?.kind==='results') return <><span className="jl-foot-info">找到 {matches.length} 条</span><button type="button" data-jl-clear-search className="jl-foot-action" onClick={()=>navigate({...where,query:'',detail:null,listPage:1},'back',{input:'',top:0,focus:'[aria-label="搜索想法"]'})}>清除搜索</button></>
    if (chapter==='favorites' && phrase) return <><span className="jl-foot-info">收藏的句子</span><Folio index={phraseIndex} total={phrases.length}/></>
    return footerInfo(chapter==='room' && groups.size?'点画签，翻到它的那一页':chapter==='thoughts'?'共 '+matches.length+' 则':'窗边手记')
  }
  function swipe(direction:number) {
    if(detail && detail.kind!=='results'){
      if(direction<0 && place.trail.length){back();return true}
      return false
    }
    if(chapter==='story' && pages[pageIndex+direction]){turn(pageIndex+direction);return true}
    if(direction<0 && detail?.kind==='results'){back();return true}
    return false
  }
  function accessibleTitle() {
    if(!detail)return chapter==='story' ? page?.title ?? '手记' : bookmarks[chapter]
    if(detail.kind==='room')return roomPage?.title ?? '画签的来处'
    if(detail.kind==='note')return '想法'
    if(detail.kind==='linked')return '这一段的想法'
    if(detail.kind==='quote')return '收藏的句子'
    return {letter:'欢迎笺', contents:'手记目录', editor:'编辑想法', month:'选择月份', stats:'专注时光', status:'应用状态', results:'搜索结果'}[detail.kind]
  }
  return <section ref={shell} id="ribbon-journal" aria-labelledby="stats-title"
    onClickCapture={e=>{lastTap.current=(e.target as Element).closest<HTMLElement>('button,input')}}>
    <header className="rj-top"><h1 id="stats-title" className="screen-title" tabIndex={-1}>记录</h1>{(realIssue || view.active || props.notice) &&
      <button type="button" className="link-button records-status-button" data-jl-status onClick={()=>openDetail({kind:'status'})}>{realIssue || (view.active ? '计时状态' : '查看状态')}</button>}</header>
    <div className="rj-records"><div className="rj-book"><div className="rj-textblock">
      <nav className="rj-ribbons" role="tablist" aria-label="手记书签">{chapters.map((c,i)=><button key={c} type="button" role="tab" id={'rj-tab-'+c} data-section={c} aria-controls="rj-leaf" aria-selected={chapter===c} tabIndex={chapter===c?0:-1} onClick={()=>switchChapter(c)}
        onKeyDown={e=>{const to=e.key==='Home'?0:e.key==='End'?3:e.key==='ArrowRight'?(i+1)%4:e.key==='ArrowLeft'?(i+3)%4:null;if(to!==null){e.preventDefault();lastTap.current=e.currentTarget;switchChapter(chapters[to]!)}}}><span>{bookmarks[c]}</span></button>)}</nav>
      <div className="rj-running-head"><span>窗边手记</span></div>
      <div className="rj-canvas" id="rj-leaf" role="tabpanel" aria-labelledby={'rj-tab-'+chapter}><div data-leaves="" data-jl-section={chapter} className="jl-book-content">
        <div key={offsetKey} className={'jl-body jl-'+(detail && detail.kind!=='results'?'inner':chapter)+'-page'} ref={scroller}
          role="region" aria-label={accessibleTitle()} tabIndex={0} onScroll={recordOffset}
          onKeyDown={e=>{if(e.target!==e.currentTarget||e.altKey||e.metaKey||e.ctrlKey)return;const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(step&&swipe(step))e.preventDefault()}}
          onPointerDown={e=>{gesture.current=null;const el=e.target as Element;const rect=e.currentTarget.getBoundingClientRect();if(e.isPrimary&&e.button===0&&!el.closest('button,input,textarea')&&e.clientX>rect.left+20&&e.clientX<rect.right-20)gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY}}}
          onPointerCancel={()=>{gesture.current=null}} onPointerUp={e=>{const g=gesture.current;gesture.current=null;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.abs(dx)>46&&Math.abs(dx)>Math.abs(dy)*1.5)swipe(dx<0?1:-1)}}>
          {detailBody()}{(chapter==='thoughts' || chapter==='favorites' || detail?.kind==='note' || detail?.kind==='status') && detail?.kind!=='editor' && (detail?.kind!=='note' || selectedNote) && <WritingFeedback props={props} onUndo={restoreUndo}/>}</div><div className="jl-footer-slot"><footer className="jl-page-foot">{chapterFoot()}</footer></div></div></div>
    </div><div className="rj-cover" aria-hidden="true" hidden/></div></div>
  </section>
}
