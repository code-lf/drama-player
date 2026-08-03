import { callApi } from '~/shared/api/client'

export const authService = {
  async fetchWechatTicket() {
    return callApi('auth/fetchWechatTicket', (adapter) => adapter.getWechatLoginTicket())
  },

  async pollWechatLogin(ticketId: string) {
    // 轮询登录态：保持页面只处理状态切换，不直接关心接口细节
    return callApi('auth/pollWechatLogin', (adapter) => adapter.checkWechatLogin(ticketId))
  },

  async accountLogin(account: string, password: string, acceptedDocumentCodes: string[] = []) {
    return callApi('auth/accountLogin', (adapter: any) => adapter.accountLogin(account, password, acceptedDocumentCodes))
  },

  async accountRegister(payload: { account: string; password: string; code: string; nickname?: string; acceptedDocumentCodes?: string[] }) {
    return callApi('auth/accountRegister', (adapter: any) => adapter.accountRegister(payload))
  },

  async sendSmsCode(phone: string, purpose: 'login' | 'register' = 'register') {
    return callApi('auth/sendSmsCode', (adapter: any) => adapter.sendSmsCode(phone, purpose))
  },

  async phoneLogin(phone: string, code: string, acceptedDocumentCodes: string[] = []) {
    return callApi('auth/phoneLogin', (adapter: any) => adapter.phoneLogin(phone, code, acceptedDocumentCodes))
  }
}
