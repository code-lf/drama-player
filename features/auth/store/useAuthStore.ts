import { defineStore } from 'pinia'
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
