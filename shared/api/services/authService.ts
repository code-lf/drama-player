import { callApi } from '~/shared/api/client'

export const authService = {
  async fetchWechatTicket() {
    return callApi('auth/fetchWechatTicket', (adapter) => adapter.getWechatLoginTicket())
  },

  async pollWechatLogin(ticketId: string) {
    // 轮询登录态：保持页面只处理状态切换，不直接关心接口细节
    return callApi('auth/pollWechatLogin', (adapter) => adapter.checkWechatLogin(ticketId))
  },

  async phoneLogin(phone: string, code: string) {
    return callApi('auth/phoneLogin', (adapter: any) => adapter.phoneLogin(phone, code))
  },

  async sendSmsCode(phone: string) {
    return callApi('auth/sendSmsCode', (adapter: any) => adapter.sendSmsCode(phone))
  }
}
