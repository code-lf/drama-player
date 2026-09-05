import { defineStore } from 'pinia'
import type { AccountProfile } from '~/entities/account/types'
import type { AuthSession, WechatLoginStatus } from '~/entities/auth/types'

interface AuthState {
  session: AuthSession
  loginStatus: WechatLoginStatus
  ticketId: string
}

const defaultSession: AuthSession = {
  loggedIn: false,
  token: '',
  expiresAt: '',
  user: null
}

const AUTH_STORAGE_KEY = 'livliv-auth-session'

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    session: { ...defaultSession },
    loginStatus: 'idle',
    ticketId: ''
  }),
  actions: {
    hydrate() {
      if (!import.meta.client) return
      try {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY)
        if (cached) {
          const session = JSON.parse(cached) as AuthSession
          // 简单的过期判断
          if (session.expiresAt && new Date(session.expiresAt) > new Date()) {
            this.session = session
          } else if (!session.expiresAt && session.loggedIn) {
             // 没有过期时间的兼容处理
             this.session = session
          } else {
             this.logout()
          }
        }
      } catch (error) {
        console.error('Failed to parse auth session from localStorage', error)
        // 缓存损坏与过期 token 一样都不能继续保留“已登录”假状态。
        this.logout()
      }
    },
    setLoginStatus(status: WechatLoginStatus) {
      this.loginStatus = status
    },
    setTicketId(ticketId: string) {
      this.ticketId = ticketId
    },
    applySession(session: AuthSession) {
      this.session = session
      this.loginStatus = session.loggedIn ? 'success' : 'waiting'
      if (import.meta.client) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
      }
    },
    syncUserProfile(profile: AccountProfile) {
      // 登录后的昵称、头像、余额统一以后端账户接口为准，避免本地缓存与真实账户数据漂移。
      if (!this.session.loggedIn) return

      this.session.user = {
        id: profile.id || this.session.user?.id || '',
        nickname: profile.nickname || this.session.user?.nickname || '',
        avatar: profile.avatarUrl || this.session.user?.avatar || '',
        creditBalance: profile.creditBalance
      }

      if (import.meta.client) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.session))
      }
    },
    logout() {
      this.session = { ...defaultSession }
      this.loginStatus = 'idle'
      this.ticketId = ''
      if (import.meta.client) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    }
  }
})
