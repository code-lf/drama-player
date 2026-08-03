import type { FeedbackSubmitPayload } from '~/entities/support/types'
import { callApi } from '~/shared/api/client'

/** 用户支持中心接口统一封装，页面层不感知 HTTP 与 Mock 的差异。 */
export const supportService = {
  async redeemCode(code: string) {
    return callApi('account/redeemCode', adapter => adapter.redeemCode(code))
  },

  async getSupportCenter() {
    return callApi('support/center', adapter => adapter.getSupportCenter())
  },

  async getLoginAppearance() {
    return callApi('support/loginAppearance', adapter => adapter.getLoginAppearance())
  },

  async getLegalDocuments() {
    return callApi('support/legalDocuments', (adapter: any) => adapter.getLegalDocuments())
  },

  async submitFeedback(payload: FeedbackSubmitPayload) {
    return callApi('support/feedback', adapter => adapter.submitFeedback(payload))
  },

  async getMyFeedback(page = 1, pageSize = 20) {
    return callApi('support/myFeedback', adapter => adapter.getMyFeedback(page, pageSize))
  }
}
