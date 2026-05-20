import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  // 异步任务统一策略：轻量重试 + 合理缓存，避免频繁闪烁
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        retry: 1,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: 0
      }
    }
  })

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
})
