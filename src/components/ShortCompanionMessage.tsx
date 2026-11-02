import { useLayoutEffect, useRef, useState } from 'react'
import { focusCopy as copy } from '../data/focus-copy'

/** Keep the passing line within its slot; the full text has an explicit reader. */
export function ShortCompanionMessage({ text, onRead }: { text: string; onRead: (opener: HTMLElement) => void }) {
  const paragraph = useRef<HTMLParagraphElement>(null)
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    const element = paragraph.current
    if (!element) return
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [text])
  return <div className="fp-bubble">
    <p ref={paragraph}>{text}</p>
    {overflow && <button type="button" className="text-action" onClick={event => onRead(event.currentTarget)}>{copy.fullText}</button>}
  </div>
}
