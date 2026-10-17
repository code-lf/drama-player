import { useAuthStore } from '~/features/auth/store/useAuthStore'

// 用户端正式工作台必须使用真实登录态，不能再混用 devUserId / 游客用户。
// 这样 `/api/account/me`、积分余额、剧本扣费流水才能稳定对应同一个用户。
// 工作台允许游客浏览；私人项目详情仍维持原有路由鉴权。
const protectedPrefixes = ['/drama', '/music', '/recharge', '/projects']

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  // 站内私人菜单与直接访问使用同一登录弹窗，保持目标路由，不跳独立登录页。
  if (/^\/dashboard-(library|projects|billing|exports)(?:\/|$)/.test(to.path)) {
    const { auth, requireLogin } = useWorkbenchAuth()
    auth.hydrate()
    requireLogin()
    return
  }

  const needsLogin = protectedPrefixes.some((prefix) => {
    return to.path === prefix || to.path.startsWith(`${prefix}/`)
  })
  if (!needsLogin) return

  const authStore = useAuthStore()
  authStore.hydrate()

  if (!authStore.session.loggedIn || !authStore.session.user?.id) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
