const images = import.meta.glob<string>('./art/*.webp', { eager: true, import: 'default', query: '?no-inline' })
export const art = Object.fromEntries(Object.entries(images).map(([file, url]) => [
  file.replace('./art/', '').replace(/\.webp$/, ''), url,
]))

export function savedDay(timestamp: number) {
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '日期不详'
}
