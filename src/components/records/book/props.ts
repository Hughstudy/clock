import type {MutableRefObject, ReactNode} from 'react'
import type {Persistence,StoreNotice} from '../../../adapters/storage'
import type {QuoteFavoritesController} from '../../../contracts/favorites'
import type {Thoughts} from '../../../hooks/useThoughts'
import type {StatsView} from '../../../hooks/useViews'
import type {BookVisit} from './navigation'

export interface RecordsProps {
  view: StatsView
  thoughts: Thoughts
  canEdit: boolean
  favorites?: QuoteFavoritesController
  systemNoticeSummary?: string | null
  systemNotices?: ReactNode
  onAnnounce?: (text: string) => void
  persistence: Persistence
  notice: StoreNotice | null
  hasSaveError: boolean
  showArt: boolean
  visit: MutableRefObject<BookVisit | null>
}
