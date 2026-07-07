import { callApi } from '~/shared/api/client'

export const accountService = {
  async getProfile() {
    return callApi('account/profile', (adapter) => adapter.getAccountProfile())
  },

  async getCreditPackages() {
    return callApi('account/creditPackages', (adapter) => adapter.getAccountCreditPackages())
  },

  async getCreditLedgers(page = 1, pageSize = 10) {
    return callApi('account/creditLedgers', (adapter) => adapter.getAccountCreditLedgers(page, pageSize))
  }
}
