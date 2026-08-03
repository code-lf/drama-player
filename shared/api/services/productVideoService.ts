import type { ProductVideoCreatePayload } from '~/entities/product-video/types'
import { callApi } from '~/shared/api/client'

/** 商品视频接口封装：页面只和语义化服务交互，不感知底层 REST 路径。 */
export const productVideoService = {
  getHome() {
    return callApi('productVideo/home', (adapter) => adapter.getProductVideoHome())
  },
  listTemplates(params?: { category?: string; featured?: boolean }) {
    return callApi('productVideo/templates', (adapter) => adapter.listProductVideoTemplates(params))
  },
  previewCredits(payload: Pick<ProductVideoCreatePayload, 'templateId' | 'durationSec' | 'resultCount' | 'model'>) {
    return callApi('productVideo/creditPreview', (adapter) => adapter.previewProductVideoCredits(payload))
  },
  createTask(payload: ProductVideoCreatePayload) {
    return callApi('productVideo/createTask', (adapter) => adapter.createProductVideoTask(payload))
  },
  getTask(taskId: string) {
    return callApi('productVideo/getTask', (adapter) => adapter.getProductVideoTask(taskId))
  },
  listTasks() {
    return callApi('productVideo/listTasks', (adapter) => adapter.listProductVideoTasks())
  },
  selectResult(taskId: string, resultId: string) {
    return callApi('productVideo/selectResult', (adapter) => adapter.selectProductVideoResult(taskId, resultId))
  }
}
