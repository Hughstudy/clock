/** Captured at the click; subsequent quote changes cannot retarget this object. */
export interface FavoriteQuote {
  id: string
  text: string
  copyVersion: string
  category?: string
}

export interface SavedQuote extends FavoriteQuote {
  savedAt: number
  rev: number
  deletedAt: number | null
}

export interface QuoteFavoritesController {
  saved: readonly SavedQuote[]
  isSaved: (quote: FavoriteQuote) => boolean
  isPending: (quote: FavoriteQuote) => boolean
  toggle: (quote: FavoriteQuote) => void
  status: string | null
  statusFor: (quote: FavoriteQuote) => string | null
  /** A visible explanation for a conflict or an unsuccessful write; normal progress is on the button. */
  detailFor: (quote: FavoriteQuote) => string | null
  problems: readonly { quote: FavoriteQuote; message: string }[]
  retry: () => void
}

/** One stable relationship per quote ID, across content revisions. */
export const quoteKey = (quote: Pick<FavoriteQuote, 'id'>): string => quote.id
