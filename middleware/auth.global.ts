import { useAuthStore } from '~/features/auth/store/useAuthStore'

// 用户端正式工作台必须使用真实登录态，不能再混用 devUserId / 游客用户。
// 这样 `/api/account/me`、积分余额、剧本扣费流水才能稳定对应同一个用户。
const protectedPrefixes = ['/dashboard', '/drama', '/music', '/recharge', '/projects']

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

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
