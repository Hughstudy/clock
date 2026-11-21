import { monthLabel } from '../../format'
import { ThoughtPanel } from '../../ThoughtPanel'
import { welcomeNote } from '../../../data/welcome'
import { BookTools, BookFilters, BookPagination } from './BookTools'
import { PageHead, DatedList, Row } from './BookPaper'
import { NoteLeaf, QuoteLeaf } from './BookWriting'
import { BookChapters } from './BookChapters'
import { BookMemory } from './BookMemory'
import type { BookViewProps } from './props'

/** Detail routing is presentation only; closing and editing preserve the controller's reading visit. */
export function BookContent({ props, book }: BookViewProps) {
  const { view, thoughts, showArt } = props
  const {
    where: { detail, month },
    roomPage,
    roomPages,
    linkedNotes,
    selectedNote,
    selectedQuote,
    timeline,
    pages,
    pending,
    incomplete,
    hasUnknownDates,
    openDetail,
    turn,
    editNote,
    setMonth,
    visible,
  } = book
  if (!detail || detail.kind === 'results') return <BookChapters props={props} book={book} />
  if (detail.kind === 'room') {
    if (roomPage)
      return (
        <div data-jl-detail="room" data-jl-source-detail={roomPage.id}>
          <BookMemory p={roomPage} props={props} openDetail={openDetail} />
        </div>
      )
    return (
      <div data-jl-detail="room">
        <PageHead
          kicker="小屋 · 画签的来处"
          title={roomPages[0]?.activity ?? '来源记录'}
          stamp={showArt ? 'stamp-' + detail.scene : undefined}
        />
        {detail.source && <p>这段原记录目前无法读取。</p>}
        <DatedList
          items={visible(roomPages)}
          render={(p) => (
            <Row
              title={p.record?.step || p.title}
              detail={p.time + ' · ' + p.kind + ' ' + p.duration}
              attr={{ 'data-jl-source-page': p.id }}
              onClick={() => openDetail({ ...detail, source: p.id })}
            />
          )}
        />
        <BookPagination book={book} />
      </div>
    )
  }
  if (detail.kind === 'linked')
    return (
      <section data-jl-detail="linked">
        <PageHead kicker="随手便笺" title="这一段的想法" />
        {visible(linkedNotes).map((n) => (
          <Row
            key={n.id}
            title={n.text || '留过标记'}
            detail={view.shortDate(n.dateKey) + ' · ' + view.clockTime(n.createdAt)}
            attr={{ 'data-jl-note': n.id }}
            onClick={() => openDetail({ kind: 'note', id: n.id })}
          />
        ))}
        <BookPagination book={book} />
      </section>
    )
  if (detail.kind === 'contents')
    return (
      <section data-jl-detail="contents">
        <PageHead kicker={monthLabel(month)} title="手记目录" />
        <BookFilters book={book} />
        <DatedList
          items={visible(timeline)}
          render={(item) => (
            <Row
              title={item.title}
              stamp={showArt && item.art ? 'stamp-' + item.art : undefined}
              detail={item.info}
              attr={{ 'data-jl-page': item.id }}
              onClick={() =>
                item.note ? openDetail({ kind: 'note', id: item.id }) : turn(pages.findIndex((p) => p.id === item.id))
              }
            />
          )}
        />
        {!timeline.length && (
          <p>{incomplete ? '目前没有可确认的条目。' : month ? '这个月还没有记录。' : '还没有记录。'}</p>
        )}
        <BookPagination book={book} />
      </section>
    )
  if (detail.kind === 'note') return <NoteLeaf note={selectedNote} props={props} onEdit={editNote} />
  if (detail.kind === 'quote') return <QuoteLeaf quote={selectedQuote} props={props} />
  if (detail.kind === 'editor')
    return (
      <section data-jl-detail="editor">
        <PageHead kicker="随手便笺" title="编辑想法" />
        <ThoughtPanel thoughts={thoughts} canEdit={props.canEdit} />
        {(props.hasSaveError || thoughts.status?.kind === 'error') && (
          <p className="panel-save-error">
            最新更改尚未保存。
            <button type="button" className="link-button" onClick={thoughts.retry}>
              重试保存
            </button>
          </p>
        )}
      </section>
    )
  if (detail.kind === 'letter')
    return (
      <section data-jl-detail="letter">
        <PageHead kicker="给你的信" title="欢迎笺" stamp={showArt ? 'envelope' : undefined} />
        <div className="jl-letter-text">
          <p>{welcomeNote.text}</p>
        </div>
      </section>
    )
  return (
    <BookTools
      hasUnknownDates={hasUnknownDates}
      kind={detail.kind}
      {...props}
      month={month}
      onMonth={setMonth}
      hasSaveError={pending}
      onTurn={book.turnTool}
    />
  )
}
