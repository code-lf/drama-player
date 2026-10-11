import { request } from '~/shared/api/adapters/httpAdapter'

export interface InvoiceTitle {
  id: string
  title_type: 'personal' | 'company'
  title_name: string
  tax_id: string
  email: string
  phone: string
  is_default: boolean
}

export interface InvoiceRecord {
  id: string
  payment_order_id: string
  order_no: string
  amount: number
  title_name: string
  status: 'pending' | 'rejected' | 'issued'
  rejection_reason: string
  invoice_number: string | null
  created_at: string
  issued_at: string | null
  order_count: number
  orders: Array<{ payment_order_id: string; order_no: string; amount: number }>
}

/** 发票接口始终复用站内登录鉴权；PDF 下载也不暴露私有 OSS 地址。 */
export const invoiceService = {
  eligibleOrders: (page = 1) => request<{ items: Array<{ id: string; order_no: string; amount: number }>; total: number }>('/invoices/eligible-orders', { query: { page } }),
  titles: () => request<InvoiceTitle[]>('/invoices/titles'),
  createTitle: (body: Omit<InvoiceTitle, 'id'>) => request<InvoiceTitle>('/invoices/titles', { method: 'POST', body }),
  updateTitle: (id: string, body: Omit<InvoiceTitle, 'id'>) => request<InvoiceTitle>(`/invoices/titles/${id}`, { method: 'PUT', body }),
  deleteTitle: (id: string) => request<{ deleted: boolean }>(`/invoices/titles/${id}`, { method: 'DELETE' }),
  records: () => request<InvoiceRecord[]>('/invoices/requests'),
  apply: (payment_order_id: string, title_id: string) => request<InvoiceRecord>('/invoices/requests', { method: 'POST', body: { payment_order_id, title_id } }),
  applyBatch: (payment_order_ids: string[], title_id: string) => request<InvoiceRecord>('/invoices/requests/batch', { method: 'POST', body: { payment_order_ids, title_id } }),
  download: (id: string) => request<Blob>(`/invoices/requests/${id}/download`, { responseType: 'blob' }),
}
