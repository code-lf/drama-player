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
// 生产浏览器请求明确指向已验证的 HTTPS API 入口；该地址由 Nginx 转发给 FastAPI。
// 本地开发仍使用同源 /api 代理，避免开发机访问线上用户数据或遇到跨域问题。
// NUXT_PUBLIC_API_BASE 可在部署时覆盖；不要填服务器内部 IP 或 HTTP 地址，
// 否则 HTTPS 页面可能被浏览器的混合内容保护拦截。
const defaultApiBase = process.env.NUXT_PUBLIC_API_BASE || (isProductionBuild ? 'https://livliv.suyoulink.cn/api' : '/api')
// Nuxt dev 代理的后端目标地址统一收口到配置项，便于后续切换后端端口或机器地址。
// 这里要显式带上 `/api` 前缀，否则浏览器请求 `/api/config/runtime` 时会被转发成后端的 `/config/runtime`，
// 最终命中不到 FastAPI 已挂载的 `/api` 路由树。
const localApiProxyTarget = process.env.NUXT_LOCAL_API_PROXY_TARGET || 'http://127.0.0.1:8000/api'
// 支付宝异步通知在本地联调时会先经过 cpolar，再由 Nuxt 的 /api 代理转给 FastAPI。
// Vite 默认拒绝未知 Host，因此只允许当前明确配置的隧道域名；不要使用 allowedHosts: true，
// 否则会放大 DNS rebinding 风险。域名变化时可用逗号分隔的环境变量覆盖。
const devAllowedHosts = (process.env.NUXT_DEV_ALLOWED_HOSTS || '7f40049f.r33.cpolar.top')
  .split(',')
  .map(host => host.trim())
  .filter(Boolean)

export default defineNuxtConfig({
  // Nuxt UI v4 需要 Nuxt 4，但现有项目仍采用 Nuxt 3 的根目录结构。
  // 显式保留 Nuxt 3 目录约定，避免 Nuxt 4 默认从 app/ 目录读取并退回欢迎页。
  future: {
    compatibilityVersion: 3
  },

  // 关闭 devtools，保持演示界面简洁
  devtools: { enabled: false },

  // 在 Nuxt 挂载前先同步本地主题到 `html[data-theme]`，
  // 这样浏览器首屏绘制就能直接命中正确主题，避免出现“先黑一下再白一下”的闪烁。
  app: {
    head: {
      // 浏览器标签页统一复用首页导航栏的 Livliv 品牌 Logo。
      // 查询参数用于刷新浏览器已经缓存的旧 favicon，避免修改后仍显示 Nuxt 默认图标。
      link: [
        // 预加载本地字体，首页与工作台统一使用，无需访问第三方字体服务。
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/GoogleSansFlex-Variable.woff2', crossorigin: 'anonymous' },
        // 中文界面同样预加载真实中文字体，避免首屏长期显示系统字体。
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/NotoSansSC-Variable.woff2', crossorigin: 'anonymous' },
        { rel: 'icon', type: 'image/jpeg', href: '/branding/livliv-logo.jpeg?v=20260815' },
        { rel: 'shortcut icon', type: 'image/jpeg', href: '/branding/livliv-logo.jpeg?v=20260815' },
        { rel: 'apple-touch-icon', href: '/branding/livliv-logo.jpeg?v=20260815' }
      ],
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
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css', '~/assets/css/creation.css', '@vue-flow/core/dist/style.css', '@vue-flow/core/dist/theme-default.css'],

  // Nuxt UI 统一提供按钮、图标、下拉、徽章、弹窗、抽屉等基础交互；
  // 项目业务卡片仍保留 Livliv 自己的页面结构和视觉规范。
  modules: ['@pinia/nuxt', '@nuxt/ui'],

  ui: {
    // 项目已有完整中文字体栈和明暗主题逻辑，关闭模块的自动字体与颜色模式，避免重复初始化。
    fonts: false,
    colorMode: false,
    experimental: {
      // 仅为实际使用到的组件生成主题 CSS，控制用户端工作台的构建体积。
      componentDetection: true
    },
    theme: {
      defaultVariants: {
        color: 'primary',
        size: 'md'
      }
    }
  },

  // 路由渲染策略：首页 SSR，创作页和登录态工作台 CSR。
  // 工作台依赖浏览器登录态，且内部 Tooltip/浮层需要 UApp 客户端上下文；关闭 SSR 可避免
  // 用户直接刷新商品图等页面时出现 Provider 尚未建立导致的 500。
  routeRules: {
    // 匿名音乐分享不缓存页面和作品快照，关闭链接后刷新必须重新核验授权。
    '/listen/**': { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' } },
    '/studio/**': { ssr: false },
    '/dashboard': { ssr: false },
    '/dashboard-announcements': { ssr: false },
    '/dashboard-billing': { ssr: false },
    '/dashboard-canvas': { ssr: false },
    '/dashboard-exports': { ssr: false },
    '/dashboard-help': { ssr: false },
    // 资料管理复用工作台登录态和站内浮层，同样只在浏览器端初始化。
    '/dashboard-library': { ssr: false },
    '/dashboard-skills': { ssr: false },
    '/dashboard-product': { ssr: false },
    '/dashboard-product-video': { ssr: false },
    '/dashboard-projects': { ssr: false }
  },

  // 运行时配置：
  // - 浏览器生产环境使用线上 HTTPS API，本地开发使用 /api 代理
  // - 通过环境变量可切换 mock/http，联调时无需改业务代码
  runtimeConfig: {
    // 服务端渲染首页时直接请求 FastAPI，确保首屏输出的就是 OSS 图片地址。
    // 生产环境可用 NUXT_API_SERVER_BASE 指向容器内 API 地址，浏览器不会看到该配置。
    apiServerBase: process.env.NUXT_API_SERVER_BASE || localApiProxyTarget,
    public: {
      apiBase: defaultApiBase,
      apiAdapter: process.env.NUXT_PUBLIC_API_ADAPTER || 'http',
      // 历史兼容字段：真实用户端请求已经改为只使用登录 session 的 user_id。
      // 不再用这里的 devUserId 给浏览器请求兜底，避免未登录状态串到测试账号导致积分错位。
      devUserId: process.env.NUXT_PUBLIC_DEV_USER_ID || 'fe8d06dd-0edd-4307-803d-146e7f4e8711'
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
        server: {
          allowedHosts: devAllowedHosts
        },
        resolve: {
          alias: {
            '#app-manifest': devAppManifestPath
          }
        }
      },

  // Nitro 只需要同步开发期的模块别名。
  // `/api` 转发已经统一放到 server/routes/api/[...path].ts，开发服务、preview 和生产包
  // 都会走同一份代理逻辑，避免之前“本地开发正常、直接启动生产包却 404”的环境差异。
  nitro: isProductionBuild
    ? undefined
    : {
        alias: {
          '#app-manifest': devAppManifestPath
        }
      },

  // TypeScript 严格模式
  typescript: {
    strict: true,
    typeCheck: false
  },

  compatibilityDate: '2025-01-01'
})
