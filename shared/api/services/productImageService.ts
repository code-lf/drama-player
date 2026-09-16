import type { ProductImageGeneratePayload } from '~/entities/product-image/types'
import { callApi } from '~/shared/api/client'

export const productImageService = {
  /** 商品图模板由运营后台下发，支持后续持续扩容。 */
  async listTemplates(params?: { category?: string; featured?: boolean }) {
    return callApi('productImage/listTemplates', (adapter) => adapter.listProductImageTemplates(params))
  },

  async previewCredits(payload: Pick<ProductImageGeneratePayload, 'count' | 'model' | 'prompt' | 'splitSellingPoints' | 'templateId'>) {
    return callApi('productImage/previewCredits', (adapter) => adapter.previewProductImageCredits(payload))
  },

  /** 免费 AI 套图策划；服务不可用时后端会返回明确标记的规则兜底方案。 */
  async splitSellingPoints(payload: { batchId?: string; prompt: string; count: number; style?: string; aspectRatio?: string }) {
    return callApi('productImage/splitSellingPoints', (adapter) => adapter.splitProductSellingPoints(payload))
  },

  async generate(payload: ProductImageGeneratePayload) {
    return callApi('productImage/generate', (adapter) => adapter.generateProductImages(payload))
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
