import type { ReactNode } from 'react'
import type { RecordsBookInput } from '../../../hooks/records/types'
import type { RecordsBook } from '../../../hooks/records/useRecordsBook'

export interface RecordsProps extends RecordsBookInput {
  canEdit: boolean
  showArt: boolean
  systemNotices?: ReactNode
}

export interface BookViewProps {
  props: RecordsProps
  book: RecordsBook
}
