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

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    session: { ...defaultSession },
    loginStatus: 'idle',
    ticketId: ''
  }),
  actions: {
    setLoginStatus(status: WechatLoginStatus) {
      this.loginStatus = status
    },
    setTicketId(ticketId: string) {
      this.ticketId = ticketId
    },
    applySession(session: AuthSession) {
      this.session = session
      this.loginStatus = session.loggedIn ? 'success' : 'waiting'
    },
    logout() {
      this.session = { ...defaultSession }
      this.loginStatus = 'idle'
      this.ticketId = ''
    }
  }
})
