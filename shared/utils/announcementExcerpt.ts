import { sanitizeAnnouncementContent } from '~/shared/utils/sanitizeAnnouncementContent'

// 列表与提示条只提取可读摘要；块级标签先转为空格，避免段落和价格粘连。
export function announcementExcerpt(content: string): string {
  if (!content) return ''
  const separated = sanitizeAnnouncementContent(content)
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/?\s*(?:p|div|h[1-6]|li|ul|ol|blockquote|pre)\b[^>]*>/gi, ' ')

  if (!import.meta.client) return separated.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const container = document.createElement('div')
  container.innerHTML = separated
  return (container.textContent || '').replace(/\s+/g, ' ').trim()
}
