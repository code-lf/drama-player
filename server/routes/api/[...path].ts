import { getRequestURL, proxyRequest, setResponseStatus } from 'h3'
import { handleLibraryFallback } from '../../utils/libraryFallback'

/**
 * 将用户端所有 `/api/*` 请求转发给 FastAPI。
 *
 * 这层代理主要解决两类环境不一致：
 * 1. 本地 `pnpm dev` 或直接运行 `.output/server/index.mjs` 时，没有 Nginx 帮忙转发 `/api`；
 * 2. 线上虽然仍建议由 Nginx 直接转发，但即使请求意外到达 Nuxt，也不会再返回 Nuxt 的 Page not found。
 *
 * 文件放在 `server/routes/api` 而不是使用全局中间件，是为了让 Nuxt UI 自动生成的
 * `/api/_nuxt_icon/*` 精确路由拥有更高匹配优先级，不会被误发到 FastAPI。
 */
export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const requestUrl = getRequestURL(event)

  // apiServerBase 是仅服务端可见的配置，默认值为 http://127.0.0.1:8000/api。
  // 禁止使用浏览器传入的地址拼目标 URL，避免形成可被外部滥用的开放代理。
  const upstreamBase = String(runtimeConfig.apiServerBase || '').replace(/\/+$/, '')
  if (!upstreamBase) {
    throw createError({
      statusCode: 500,
      statusMessage: '未配置用户端 API 代理目标 NUXT_API_SERVER_BASE'
    })
  }

  // 当前路由收到的 pathname 固定以 /api 开头；只移除这一层公共前缀，
  // 再拼到以 /api 结尾的 FastAPI 地址，最终仍然是 /api/config/runtime 这类真实后端路由。
  const apiPath = requestUrl.pathname.slice('/api'.length) || '/'
  const targetUrl = `${upstreamBase}${apiPath}${requestUrl.search}`

  // proxyRequest 会透传请求方法、查询参数、请求体以及必要请求头，并把后端响应流直接返回浏览器。
  // 因此普通 JSON、文件上传和 SSE 长连接都不需要在用户端重复实现转发逻辑。
  try {
    return await proxyRequest(event, targetUrl)
  } catch (proxyError: unknown) {
    // 当外部后端由于网络策略、TLS 协议或服务未启动导致连接中断时，为基础配置接口提供兜底，
    // 保证前端基础页面（维护检测、登录外观、站点静态资源、公告栏）平稳降级，不会出现整站崩溃。
    if (apiPath === '/config/site-assets') {
      return {
        asset_base_url: '',
        asset_version: '1',
        raster_extension: '.webp'
      }
    }
    if (apiPath === '/system/maintenance') {
      return {
        server_time: new Date().toISOString(),
        items: []
      }
    }
    if (apiPath === '/login-appearance') {
      return {
        title: 'Livliv',
        subtitle: 'AI 漫剧与短剧创作平台',
        icp_record: '',
        icp_record_url: '',
        public_security_record: '',
        public_security_record_url: ''
      }
    }
    if (apiPath.startsWith('/announcements')) {
      return []
    }
    if (apiPath.startsWith('/library')) {
      return await handleLibraryFallback(event, apiPath, requestUrl)
    }

    setResponseStatus(event, 502)
    return {
      success: false,
      code: 'BACKEND_CONNECTION_ERROR',
      message: '后端 API 连接失败，请检查网络或后端服务状态。'
    }
  }
})
