import { useAuthStore } from '~/features/auth/store/useAuthStore'

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  authStore.hydrate()
})
