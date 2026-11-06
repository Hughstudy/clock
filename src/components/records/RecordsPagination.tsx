interface Props {
  label: string
  page: number
  pageCount: number
  onChange: (page: number) => void
}

/** History and favorites use the same replacement-page controls and accessible labels. */
export function RecordsPagination({ label, page, pageCount, onChange }: Props) {
  return <div className="records-pagination" aria-label={label}>
    <button type="button" className="pill pill--ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button>
    <span>第{page}页{pageCount > 1 && `／共${pageCount}页`}</span>
    <button type="button" className="pill pill--ghost" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>下一页</button>
  </div>
}
