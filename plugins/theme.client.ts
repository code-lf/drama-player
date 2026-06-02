import { useThemeStore } from '~/features/ui/store/useThemeStore'

export default defineNuxtPlugin(() => {
  const themeStore = useThemeStore()
  themeStore.hydrate()
})
