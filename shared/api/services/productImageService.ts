import type { ProductImageGeneratePayload } from '~/entities/product-image/types'
import { callApi } from '~/shared/api/client'

export const productImageService = {
  async previewCredits(payload: Pick<ProductImageGeneratePayload, 'count' | 'model' | 'prompt' | 'splitSellingPoints'>) {
    return callApi('productImage/previewCredits', (adapter) => adapter.previewProductImageCredits(payload))
  },

  async splitSellingPoints(payload: { prompt: string; count: number }) {
    return callApi('productImage/splitSellingPoints', (adapter) => adapter.splitProductSellingPoints(payload))
  },

  async generate(payload: ProductImageGeneratePayload) {
    return callApi('productImage/generate', (adapter) => adapter.generateProductImages(payload))
  }
}
