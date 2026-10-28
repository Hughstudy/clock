import { useState } from 'react'
import type { Persistence, StoreNotice } from '../adapters/storage'

interface Props {
  persistence: Persistence
  notice: StoreNotice | null
  saveError: string | null
  updateReady: boolean
  offlineReady: boolean
  onUpdate: () => void
  onDismissPwa: () => void
}

function storeMessage(notice: StoreNotice, persistence: Persistence): string {
  switch (notice.kind) {
    case 'no-locks':
      return 'This browser can’t safely save from several tabs at once, so saved progress is shown read-only. Please open Whale Focus in a current Safari, Chrome, Edge, or Firefox.'
    case 'unavailable':
      return 'This browser is blocking storage, so progress lasts only until this tab closes.'
    case 'newer':
      return 'Your data was saved by a newer version of Whale Focus. Reload to update; until then it is shown read-only.'
    case 'unreadable':
      return notice.backupKey
        ? `Saved data couldn’t be read. A copy of the original was kept in this browser’s storage as “${notice.backupKey}”.`
        : 'Saved data couldn’t be read and was left untouched. Changes made now won’t be saved.'
    case 'repaired':
      return persistence === 'saved'
        ? `Some saved data couldn’t be read and was reset (${notice.fields.join(', ')}). Your other progress is intact, and a copy of the original was kept.`
        : `Some saved data couldn’t be read (${notice.fields.join(', ')}). It was left untouched, so changes made now won’t be saved.`
  }
}

export function Notices({ persistence, notice, saveError, updateReady, offlineReady, onUpdate, onDismissPwa }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const dismissible = notice?.kind === 'repaired' || notice?.kind === 'unreadable'
  return (
    <div className="notices">
      {notice && !(dismissible && dismissed && persistence === 'saved') && (
        <div className="notice notice-warn" role="status">
          <p>{storeMessage(notice, persistence)}</p>
          {dismissible && persistence === 'saved' && (
            <button type="button" className="notice-action" onClick={() => setDismissed(true)}>
              OK
            </button>
          )}
        </div>
      )}
      {saveError && (
        <div className="notice notice-warn" role="alert">
          <p>Couldn’t save your latest change ({saveError}). It will be retried on your next action.</p>
        </div>
      )}
      {updateReady && (
        <div className="notice" role="status">
          <p>A new version of Whale Focus is ready.</p>
          <button type="button" className="notice-action" onClick={onUpdate}>
            Reload
          </button>
          <button type="button" className="notice-action subtle" onClick={onDismissPwa}>
            Later
          </button>
        </div>
      )}
      {offlineReady && !updateReady && (
        <div className="notice" role="status">
          <p>Ready to work offline.</p>
          <button type="button" className="notice-action" onClick={onDismissPwa}>
            OK
          </button>
        </div>
      )}
    </div>
  )
}
