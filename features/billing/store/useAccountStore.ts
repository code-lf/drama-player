import { defineStore } from 'pinia'
import type { AccountProfile, CreditLedgerPage, CreditPackage } from '~/entities/account/types'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { accountService } from '~/shared/api/services/accountService'

interface AccountState {
  profile: AccountProfile | null
  packages: CreditPackage[]
  ledgerPage: CreditLedgerPage
  loadingProfile: boolean
  loadingPackages: boolean
  loadingLedgers: boolean
}

const emptyLedgerPage: CreditLedgerPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10
}

export const useAccountStore = defineStore('account', {
  state: (): AccountState => ({
    profile: null,
    packages: [],
    ledgerPage: { ...emptyLedgerPage },
    loadingProfile: false,
    loadingPackages: false,
    loadingLedgers: false
  }),
  getters: {
    currentBalance(state): number {
      return state.profile?.creditBalance ?? 0
    }
  },
  actions: {
    async refreshProfile() {
      const authStore = useAuthStore(),owner=authStore.session.user?.id
      this.loadingProfile = true
      try {
        const profile = await accountService.getProfile()
        // 任务完成触发的账户读取可能晚到；退出或换号后不能回填上一个账号的资料与余额。
        if(owner!==authStore.session.user?.id||!authStore.session.loggedIn)return profile
        this.profile = profile

        // 登录态下顺手把昵称、头像、余额同步回会话缓存，保证页面刷新后展示一致。
        authStore.syncUserProfile(profile)
        return profile
      } finally {
        this.loadingProfile = false
      }
    },
    async refreshPackages() {
      this.loadingPackages = true
      try {
        this.packages = await accountService.getCreditPackages()
        return this.packages
      } finally {
        this.loadingPackages = false
      }
    },
    async refreshLedgers(page = 1, pageSize = 10) {
      this.loadingLedgers = true
      try {
        this.ledgerPage = await accountService.getCreditLedgers(page, pageSize)
        return this.ledgerPage
      } finally {
        this.loadingLedgers = false
      }
    },
    async refreshBillingOverview() {
      const page = this.ledgerPage.page || 1
      const pageSize = this.ledgerPage.pageSize || 10
      return Promise.all([
        this.refreshProfile(),
        this.refreshPackages(),
        this.refreshLedgers(page, pageSize)
      ])
    },
    reset() {
      this.profile = null
      this.packages = []
      this.ledgerPage = { ...emptyLedgerPage }
    }
  }
})
