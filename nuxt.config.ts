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

  // 运行时配置：当前使用 mock 适配器
  runtimeConfig: {
    public: {
      apiBase: '/api',
      apiAdapter: 'mock'
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
