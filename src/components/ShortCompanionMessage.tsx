import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { focusCopy as copy } from '../data/focus-copy'
import { useHeadSpeech } from '../hooks/useHeadSpeech'

interface Props { text: string; voiceRef: RefObject<HTMLElement>; onRead: (opener: HTMLElement) => void }

/** A passing line uses the same crown anchor as requested speech. Its full text
 * stays reachable on the plate when the scene can't fit a two-line bubble. */
export function ShortCompanionMessage({ text, voiceRef, onRead }: Props) {
  const bubble = useRef<HTMLDivElement>(null)
  const paragraph = useRef<HTMLParagraphElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [fits, setFits] = useState(true)
  const sceneLink = useRef<HTMLButtonElement>(null)
  const plateLink = useRef<HTMLButtonElement>(null)
  const restore = useRef(false)
  const place = useCallback((next: boolean) => {
    const outgoing = next ? plateLink.current : sceneLink.current
    if (outgoing && document.activeElement === outgoing) restore.current = true
    setFits(next)
  }, [])
  useHeadSpeech(bubble, text, place)
  useLayoutEffect(() => {
    if (!restore.current) return
    restore.current = false
    const incoming = fits ? sceneLink.current : plateLink.current
    incoming?.focus({ preventScroll: true })
  }, [fits])
  useLayoutEffect(() => {
    const element = paragraph.current
    if (!element) return
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [text])
  return <>
    <div ref={bubble} className="fp-bubble fp-head-speech" data-visible={fits} aria-hidden={!fits}>
      <p ref={paragraph}>{text}</p>
      {overflow && <button ref={sceneLink} type="button" className="text-action" tabIndex={fits ? 0 : -1} onClick={event => onRead(event.currentTarget)}>{copy.fullText}</button>}
    </div>
    {!fits && voiceRef.current && createPortal(<button ref={plateLink} type="button" className="text-action fp-node-text"
      onClick={event => onRead(event.currentTarget)}>小伙伴的话 · {copy.fullText}</button>, voiceRef.current)}
  </>
}
