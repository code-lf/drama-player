import { callApi } from '~/shared/api/client'

export const generationProfileService = {
  /** 页面只消费公开能力快照，供应商路由和采购价始终留在服务端。 */
  async get(useCaseKey: string) {
    return callApi(`generationProfile/${useCaseKey}`, adapter => adapter.getGenerationProfile(useCaseKey))
  }
}
