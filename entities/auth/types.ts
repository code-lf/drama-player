export interface AuthUser {
  id: string
  nickname: string
  avatar: string
  creditBalance?: number
}

export interface AuthSession {
  loggedIn: boolean
  token: string
  expiresAt: string
  user: AuthUser | null
}

export type WechatLoginStatus = 'idle' | 'waiting' | 'success' | 'expired'
