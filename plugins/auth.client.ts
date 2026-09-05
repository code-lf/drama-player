import { useAuthStore } from '~/features/auth/store/useAuthStore'

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const router = useRouter()
  const route = useRoute()
  const toast = useToast()
  let redirecting = false

  authStore.hydrate()

  window.addEventListener('livliv:auth-expired', async () => {
    // 工作台初始化常会同时发出多个请求；用锁保证只提示和跳转一次。
    if (redirecting || route.path === '/login') return
    redirecting = true
    toast.add({
      title: '登录已过期',
      description: '为了保障账户安全，请重新登录后继续操作。',
      color: 'warning'
    })
    const redirect = route.fullPath
    await router.replace({ path: '/login', query: { redirect } })
    window.setTimeout(() => { redirecting = false }, 800)
  })
})
