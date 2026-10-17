import { useAuthStore } from '~/features/auth/store/useAuthStore'

/** 工作台共享登录开关；只恢复交互意图，不在登录回调中提交收费任务。 */
export function useWorkbenchAuth() {
  const auth = useAuthStore()
  const loginOpen = useState<boolean>('workbench-login-open', () => false)
  const loginDestination = useState<string>('workbench-login-destination', () => '')
  /** 仅记录站内菜单目的地，登录成功后恢复导航，不恢复生成提交。 */
  function requireLogin(destination?: string): boolean {
    if (auth.session.loggedIn && auth.session.token) return true
    loginDestination.value = typeof destination === 'string' && destination.startsWith('/dashboard') ? destination : ''
    loginOpen.value = true
    return false
  }
  return { auth, loginOpen, loginDestination, requireLogin }
}
