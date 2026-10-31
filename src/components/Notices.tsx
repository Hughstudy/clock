import { useState } from 'react'
import type { Persistence, StoreNotice } from '../adapters/storage'

interface Props {
  persistence: Persistence
  notice: StoreNotice | null
  saveError: string | null
  updateReady: boolean
  offlineReady: boolean
  onRetry: () => void
  onUpdate: () => void
  onDismissPwa: () => void
  announceSaveError?: boolean
}

function storeMessage(notice: StoreNotice, persistence: Persistence): string {
  switch (notice.kind) {
    case 'no-locks':
      return '此浏览器不支持安全的多窗口保存，当前为只读模式。请使用支持此功能的浏览器。'
    case 'unavailable':
      return '此浏览器阻止了数据保存，进度只保留在当前页面，关闭后无法恢复。'
    case 'removed':
      return '浏览器中的专注数据已被清除。这一页的内容仅保留在内存中，重新打开应用即可查看当前的本地记录。'
    case 'newer':
      return '数据由更新版本保存，当前无法读取。请更新应用；原数据不会被覆盖。'
    case 'unreadable':
      return notice.backupKey
        ? `暂时无法读取原记录，已在此浏览器中保留备份“${notice.backupKey}”。`
        : '暂时无法读取原记录，原数据未被修改。当前更改不会保存。'
    case 'repaired':
      return persistence === 'saved'
        ? `部分数据无法读取，已修复这些字段（${notice.fields.join(', ')}）。其他记录仍保留，原数据也已备份。`
        : `部分数据无法读取（${notice.fields.join(', ')}）。原数据未被修改，当前更改不会保存。`
  }
}

export function Notices({ persistence, notice, saveError, updateReady, offlineReady, onRetry, onUpdate, onDismissPwa, announceSaveError = true }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const dismissible = notice?.kind === 'repaired' || notice?.kind === 'unreadable'
  return (
    <div className="notices">
      {notice && !(dismissible && dismissed && persistence === 'saved') && (
        <div className="notice notice-warn" role="status">
          <p>{storeMessage(notice, persistence)}</p>
          {dismissible && persistence === 'saved' && (
            <button type="button" className="notice-action" onClick={() => setDismissed(true)}>
              知道了
            </button>
          )}
        </div>
      )}
      {saveError && persistence === 'saved' && (
        <div className="notice notice-warn" role={announceSaveError ? 'alert' : undefined}>
          <p>最新操作尚未保存（{saveError}）。请保留页面；系统会自动重试。</p>
          <button type="button" className="notice-action" onClick={onRetry}>重试保存</button>
        </div>
      )}
      {updateReady && (
        <div className="notice" role="status">
          <p>新版本已准备好，可以更新了。</p>
          <button type="button" className="notice-action" onClick={onUpdate}>
            更新并重载
          </button>
          <button type="button" className="notice-action subtle" onClick={onDismissPwa}>
            稍后
          </button>
        </div>
      )}
      {offlineReady && !updateReady && (
        <div className="notice" role="status">
          <p>已准备好离线使用。</p>
          <button type="button" className="notice-action" onClick={onDismissPwa}>
            知道了
          </button>
        </div>
      )}
    </div>
  )
}
