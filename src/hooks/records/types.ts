import type { MutableRefObject } from 'react'
import type { Persistence, StoreNotice } from '../../adapters/storage'
import type { QuoteFavoritesController } from '../../contracts/favorites'
import type { Thoughts } from '../useThoughts'
import type { StatsView } from '../useViews'
import type { BookVisit } from './book-navigation'

export interface RecordsBookInput {
  view: StatsView
  thoughts: Thoughts
  favorites?: QuoteFavoritesController
  visit: MutableRefObject<BookVisit | null>
  systemNoticeSummary?: string | null
  onAnnounce?: (text: string) => void
  persistence: Persistence
  notice: StoreNotice | null
  hasSaveError: boolean
}
