import { callApi } from '~/shared/api/client'

export const accountService = {
  async getProfile() {
    return callApi('account/profile', (adapter) => adapter.getAccountProfile())
  },

  async updateProfile(payload: { nickname: string }) {
    return callApi('account/profile/update', async (adapter) => {
      if (!adapter.updateAccountProfile) throw new Error('当前接口适配器未实现个人资料保存。')
      return adapter.updateAccountProfile(payload)
    })
  },

  async uploadAvatar(file: File) {
    return callApi('account/profile/avatar', async (adapter) => {
      if (!adapter.uploadAccountAvatar) throw new Error('当前接口适配器未实现头像上传。')
      return adapter.uploadAccountAvatar(file)
    })
  },

  async getSecuritySummary() {
    return callApi('account/security', async (adapter) => {
      if (!adapter.getAccountSecurity) throw new Error('当前接口适配器未实现账户安全查询。')
      return adapter.getAccountSecurity()
    })
  },

  async sendSecurityCode(payload: { target: 'old_phone' | 'new_phone' | 'password'; newPhone?: string }) {
    return callApi('account/security/code', async (adapter) => {
      if (!adapter.sendAccountSecurityCode) throw new Error('当前接口适配器未实现安全验证码发送。')
      return adapter.sendAccountSecurityCode(payload)
    })
  },

  async rebindPhone(payload: { newPhone: string; oldPhoneCode: string; newPhoneCode: string }) {
    return callApi('account/security/rebind-phone', async (adapter) => {
      if (!adapter.rebindAccountPhone) throw new Error('当前接口适配器未实现手机号换绑。')
      return adapter.rebindAccountPhone(payload)
    })
  },

  async changePassword(payload: { currentPassword: string; newPassword: string; verificationCode: string }) {
    return callApi('account/security/password', async (adapter) => {
      if (!adapter.changeAccountPassword) throw new Error('当前接口适配器未实现密码修改。')
      return adapter.changeAccountPassword(payload)
    })
  },

  async getCreditPackages() {
    return callApi('account/creditPackages', (adapter) => adapter.getAccountCreditPackages())
  },

  async getCreditLedgers(page = 1, pageSize = 10) {
    return callApi('account/creditLedgers', (adapter) => adapter.getAccountCreditLedgers(page, pageSize))
  },

  async createPaymentOrder(payload: { packageId: string; channel: 'wechat' | 'alipay'; idempotencyKey: string }) {
    return callApi('account/paymentOrders/create', async (adapter) => {
      if (!adapter.createPaymentOrder) throw new Error('当前接口适配器未实现支付订单创建。')
      return adapter.createPaymentOrder(payload)
    })
  },

  async retryPaymentCheckout(orderNo: string) {
    return callApi('account/paymentOrders/checkout', async (adapter) => {
      if (!adapter.retryPaymentCheckout) throw new Error('当前接口适配器未实现支付二维码重试。')
      return adapter.retryPaymentCheckout(orderNo)
    })
  },

  async getPaymentOrders(page = 1, pageSize = 20) {
    return callApi('account/paymentOrders/list', async (adapter) => {
      if (!adapter.getPaymentOrders) throw new Error('当前接口适配器未实现支付订单查询。')
      return adapter.getPaymentOrders(page, pageSize)
    })
  }
}
