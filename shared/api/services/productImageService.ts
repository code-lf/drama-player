import type { ProductImageGeneratePayload, ImageSafetyRepair } from '~/entities/product-image/types'
import { callApi } from '~/shared/api/client'
import { request, buildProductImagePayload } from '~/shared/api/adapters/httpAdapter'

export const productImageService = {
  /** 只获取一次持久化的合规文字候选，不创建或重试图片任务。 */
  async safetyRepair(batchId: string) {
    return request<ImageSafetyRepair>(`/product-image/history/${batchId}/safety-repair`, { method: 'POST' })
  },
  /** 会话工作台只等待任务创建，进度和结果交给可恢复的独立轮询。 */
  async createTask(payload: ProductImageGeneratePayload) {
    return request<{ batch_id: string }>('/product-image/tasks', { method: 'POST', body: buildProductImagePayload(payload) })
  },
  /** 商品图模板由运营后台下发，支持后续持续扩容。 */
  async listTemplates(params?: { category?: string; featured?: boolean }) {
    return callApi('productImage/listTemplates', (adapter) => adapter.listProductImageTemplates(params))
  },

  async previewCredits(payload: Pick<ProductImageGeneratePayload, 'count' | 'model' | 'prompt' | 'splitSellingPoints' | 'templateId' | 'resolution' | 'quality' | 'background' | 'outputFormat' | 'outputCompression'> & Partial<ProductImageGeneratePayload>) {
    return callApi('productImage/previewCredits', (adapter) => adapter.previewProductImageCredits(payload))
  },

  /** 免费 AI 套图策划；服务不可用时后端会返回明确标记的规则兜底方案。 */
  async splitSellingPoints(payload: { batchId?: string; prompt: string; count: number; style?: string; aspectRatio?: string }) {
    return callApi('productImage/splitSellingPoints', (adapter) => adapter.splitProductSellingPoints(payload))
  },

  /** 仅获取候选优化稿；是否替换用户原文由页面二次确认。 */
  async optimizePrompt(payload: { prompt: string; mode: 'single' | 'marketing' | 'free' }) {
    return callApi('productImage/optimizePrompt', (adapter) => adapter.optimizeProductImagePrompt(payload))
  },

  async generate(payload: ProductImageGeneratePayload, onProgress?: (progress: number, step: string) => void) {
    return callApi('productImage/generate', (adapter) => adapter.generateProductImages(payload, onProgress))
  },

  async getTask(batchId: string) {
    return callApi('productImage/getTask', (adapter) => adapter.getProductImageTask(batchId))
  },

  /** 历史记录从服务端读取，刷新页面或更换设备后仍然可见。 */
  async listHistory(params?: { favoritesOnly?: boolean; limit?: number }) {
    return callApi('productImage/listHistory', (adapter) => adapter.listProductImageHistory(params))
  },

  async getHistory(batchId: string) {
    return callApi('productImage/getHistory', (adapter) => adapter.getProductImageHistory(batchId))
  },

  async setFavorite(batchId: string, resultId: string, isFavorite: boolean) {
    return callApi('productImage/setFavorite', (adapter) => adapter.setProductImageFavorite(batchId, resultId, isFavorite))
  },

  async deleteHistory(batchId: string) {
    return callApi('productImage/deleteHistory', (adapter) => adapter.deleteProductImageHistory(batchId))
  }
}
