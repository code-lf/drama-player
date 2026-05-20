import { callApi } from '~/shared/api/client'

export const authService = {
  async fetchWechatTicket() {
    return callApi('auth/fetchWechatTicket', (adapter) => adapter.getWechatLoginTicket())
  },

  async pollWechatLogin(ticketId: string) {
    // 轮询登录态：保持页面只处理状态切换，不直接关心接口细节
    return callApi('auth/pollWechatLogin', (adapter) => adapter.checkWechatLogin(ticketId))
  }
}
