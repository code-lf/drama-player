import { fileURLToPath } from 'node:url'

// Nuxt 3.21 在部分 Windows + Vite dev 场景下会出现 `#app-manifest` 无法被预解析的问题。
// 这里不再依赖 `.nuxt-app/manifest/meta/dev.json` 这类会在热更新时被重建的文件，
// 而是改成一个仓库内稳定存在的本地模块，彻底切断和临时生成目录的耦合。
const devAppManifestPath = fileURLToPath(new URL('./app-manifest-dev.mjs', import.meta.url))

// Nuxt 在不同启动方式下设置 NODE_ENV 的时机并不完全一致，所以同时检查命令参数。
// 这样 `pnpm dev` 固定使用 `.nuxt-app`，`pnpm build` 固定使用 `.nuxt-build`，
// 避免生产构建覆盖正在运行的开发服务，导致浏览器热刷新时拿到半成品 SSR 文件。
const isBuildCommand = process.argv.some((argument) => argument === 'build' || argument.endsWith('/build') || argument.endsWith('\\build'))
const isProductionBuild = process.env.NODE_ENV === 'production' || isBuildCommand
const nuxtBuildDir = process.env.NUXT_BUILD_DIR || (isProductionBuild ? '.nuxt-build' : '.nuxt-app')
// 本地开发默认走 Nuxt 同源代理，直接绕开浏览器跨域预检。
// 如果后续接正式环境或远端测试环境，仍然可以通过 `NUXT_PUBLIC_API_BASE` 显式覆盖。
const defaultApiBase = process.env.NUXT_PUBLIC_API_BASE || (isProductionBuild ? 'http://127.0.0.1:8000/api' : '/api')
// Nuxt dev 代理的后端目标地址统一收口到配置项，便于后续切换后端端口或机器地址。
// 这里要显式带上 `/api` 前缀，否则浏览器请求 `/api/config/runtime` 时会被转发成后端的 `/config/runtime`，
// 最终命中不到 FastAPI 已挂载的 `/api` 路由树。
const localApiProxyTarget = process.env.NUXT_LOCAL_API_PROXY_TARGET || 'http://127.0.0.1:8000/api'

export default defineNuxtConfig({
  // 关闭 devtools，保持演示界面简洁
  devtools: { enabled: false },

  // 在 Nuxt 挂载前先同步本地主题到 `html[data-theme]`，
  // 这样浏览器首屏绘制就能直接命中正确主题，避免出现“先黑一下再白一下”的闪烁。
  app: {
    head: {
      script: [
        {
          id: 'livliv-theme-bootstrap',
          innerHTML: `
            (() => {
              try {
                const storageKey = 'livliv-theme-mode';
                const legacyStorageKey = 'livliv:theme-mode';
                const cachedMode = window.localStorage.getItem(storageKey) || window.localStorage.getItem(legacyStorageKey);
                const mode = cachedMode === 'dark' || cachedMode === 'light' ? cachedMode : 'light';
                document.documentElement.dataset.theme = mode;
                document.documentElement.classList.toggle('dark', mode === 'dark');
                document.documentElement.style.colorScheme = mode;
              } catch (error) {
                document.documentElement.dataset.theme = 'light';
                document.documentElement.classList.remove('dark');
                document.documentElement.style.colorScheme = 'light';
              }
            })();
          `
        }
      ]
    }
  },

  // 显式指定 Nuxt 生成目录，绕开当前 `.nuxt` 在本机上的不稳定目录状态。
  buildDir: nuxtBuildDir,

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
      apiBase: defaultApiBase,
      apiAdapter: process.env.NUXT_PUBLIC_API_ADAPTER || 'http'
    }
  },

  // 开发环境显式补齐 `#app-manifest`，用于规避 Nuxt/Vite 在本地预转换阶段的别名解析缺失。
  alias: isProductionBuild
    ? {}
    : {
        '#app-manifest': devAppManifestPath
      },

  // 这里额外把别名同步给 Vite。
  // 原因是当前报错发生在 `vite:import-analysis` 阶段，仅配置 Nuxt alias 还不够稳定。
  vite: isProductionBuild
    ? undefined
    : {
        resolve: {
          alias: {
            '#app-manifest': devAppManifestPath
          }
        }
      },

  // Nitro 也同步一份，避免服务端构建链在极端重启时走到另一套解析逻辑。
  nitro: isProductionBuild
    ? undefined
    : {
        alias: {
          '#app-manifest': devAppManifestPath
        },
        // 开发期把同源 `/api` 请求代理到本地 FastAPI，避免浏览器因为端口不同反复做 CORS 预检。
        devProxy: {
          '/api': {
            target: localApiProxyTarget,
            changeOrigin: true
          }
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
