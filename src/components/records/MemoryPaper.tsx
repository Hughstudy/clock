import type { ReactNode } from 'react'
import { useFocusTaskBack } from '../../hooks/useFocusTaskBack'
import { FocusTaskDialog } from '../FocusTaskDialog'

export { MemoryStamp } from './MemoryStamp'

export function MemoryDetailSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useFocusTaskBack(true, onClose)
  return <FocusTaskDialog title={title} closeLabel="返回记录" onClose={onClose}>{children}</FocusTaskDialog>
}

export function MemoryChevron() {
  return <svg className="record-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg>
}
