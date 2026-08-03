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

  async splitSellingPoints(payload: { prompt: string; count: number }) {
    return callApi('productImage/splitSellingPoints', (adapter) => adapter.splitProductSellingPoints(payload))
  },

  async generate(payload: ProductImageGeneratePayload) {
    return callApi('productImage/generate', (adapter) => adapter.generateProductImages(payload))
  }
}
