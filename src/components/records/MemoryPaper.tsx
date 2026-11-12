import type { ReactNode } from 'react'
import { useFocusTaskBack } from '../../hooks/useFocusTaskBack'
import type { SceneId } from '../../logic/types'
import { FocusTaskDialog } from '../FocusTaskDialog'
import { MemorySketch } from '../RecordsRoom'

/** The same picture identifies a saved activity on the postcard, timeline and shelf. */
export function MemoryStamp({ id }: { id: SceneId }) {
  return <span className="memory-stamp" data-picture={id} aria-hidden="true">
    <span className="memory-stamp-print"><MemorySketch id={id}/></span>
  </span>
}

export function MemoryDetailSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useFocusTaskBack(true, onClose)
  return <FocusTaskDialog title={title} closeLabel="返回记录" onClose={onClose}>{children}</FocusTaskDialog>
}

export function MemoryChevron() {
  return <svg className="record-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg>
}
