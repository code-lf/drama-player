import type { LibraryCapabilities, LibraryConfiguration, LibraryItem, LibraryPage, LibraryReference } from '~/entities/library/types'
import { request } from '~/shared/api/adapters/httpAdapter'

/** 共用库使用现有 HTTP 鉴权和协议确认入口，不把文件地址当作授权依据。 */
export const libraryService = {
  capabilities: () => request<LibraryCapabilities>('/library/capabilities'),
  configuration: () => request<LibraryConfiguration>('/library/configuration'),
  list: (filters: { scope: string; category?: string; media_type?: string; query?: string; page?: number; archived?: boolean }) => request<LibraryPage>('/library/', { query: filters }),
  restore: (id: string) => request<LibraryItem>(`/library/${id}/restore`, { method: 'POST' }),
  /** 名称、用途可编辑；文件和固定版本引用不随分类改变。 */
  edit: (id: string, body: { name: string; category: string }) => request<LibraryItem>(`/library/${id}`, { method: 'PATCH', body }),
  saveResult: (source_type: 'product_image' | 'product_video' | 'drama_asset', source_id: string, result_id = '', category = 'other') => request<LibraryItem>('/library/save-result', { method: 'POST', body: { source_type, source_id, result_id, category } }),
  async addVersion(id: string, file: File) {
    const body = new FormData()
    body.append('file', file)
    return request<LibraryItem>(`/library/${id}/versions`, { method: 'POST', body })
  },
  async upload(file: File, category: string) {
    const body = new FormData()
    body.append('file', file)
    body.append('category', category)
    return request<LibraryItem>('/library/upload', { method: 'POST', body })
  },
  archive: (id: string) => request(`/library/${id}/archive`, { method: 'POST' }),
  readDocument: (reference: LibraryReference, offset = 0, query = '') => request<{ text: string; offset: number; total_chars: number; parse_status: string; parse_error: string }>('/library/document/read', { method: 'POST', body: reference, query: { offset, query } }),
  retryDocument: (reference: LibraryReference) => request<LibraryItem>('/library/document/retry', { method: 'POST', body: reference }),
  /** 预览链接短期有效；兼容同源代理和 API 独立域名，不拼接用户提供的外部 URL。 */
  previewUrl(path: string) {
    if (!path) return ''
    const base = String(useRuntimeConfig().public.apiBase || '')
    return base.startsWith('http') ? new URL(path, base).href : path
  }
}
