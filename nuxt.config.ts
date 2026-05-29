export default defineNuxtConfig({
  // 关闭 devtools，保持演示界面简洁
  devtools: { enabled: false },

  // 全局样式：设计令牌、基础样式、Vue Flow 样式
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css', '@vue-flow/core/dist/style.css', '@vue-flow/core/dist/theme-default.css'],

  // 启用 Pinia
  modules: ['@pinia/nuxt'],

  // 路由渲染策略：首页 SSR，创作页 CSR
  routeRules: {
    '/studio/**': { ssr: false }
  },

  // 运行时配置：
  // - 默认指向本地后端 `ai-create-video-api`
  // - 通过环境变量可切换 mock/http，联调时无需改业务代码
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api',
      apiAdapter: process.env.NUXT_PUBLIC_API_ADAPTER || 'http'
    }
  },

  // TypeScript 严格模式
  typescript: {
    strict: true,
    typeCheck: false
  },

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },

  compatibilityDate: '2025-01-01'
})
