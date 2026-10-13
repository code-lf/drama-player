type SiteAssetConfig = {
  asset_base_url: string
  asset_version: string
  raster_extension: string
}

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig()
  const state = useState<SiteAssetConfig>('livliv-site-assets', () => ({
    asset_base_url: '',
    asset_version: '1',
    raster_extension: '.webp'
  }))

  try {
    if (runtimeConfig.public.apiAdapter === 'mock') {
      return { provide: { siteAsset } }
    }
    // SSR 使用后端内部地址，浏览器使用同源 /api；这样首屏 HTML 直接携带 OSS 地址，
    // 不会先请求本地大图再在 hydration 后切换，真正减少首次加载流量。
    const baseUrl = import.meta.server
      ? String(runtimeConfig.apiServerBase || '')
      : String(runtimeConfig.public.apiBase || '/api')
    state.value = await $fetch<SiteAssetConfig>(`${baseUrl}/config/site-assets`)
  } catch (error) {
    // OSS 配置接口不可用时平滑降级使用 public 本地路径，避免阻断页面渲染
    if (process.env.DEBUG_ASSETS) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`[livliv] 站点素材配置读取失败，暂时使用本地静态资源: ${errorMessage}`)
    }
  }

  const siteAsset = (rawPath: string): string => {
    if (!rawPath || /^(?:https?:|data:|blob:)/i.test(rawPath)) return rawPath
    if (!state.value.asset_base_url) return rawPath
    let relativePath = rawPath.replace(/^\/+/, '')
    // 批量迁移会把位图压缩成 WebP；调用方仍可继续使用原来的 png/jpeg 语义路径。
    relativePath = relativePath.replace(/\.(?:png|jpe?g)$/i, state.value.raster_extension || '.webp')
    const separator = relativePath.includes('?') ? '&' : '?'
    return `${state.value.asset_base_url.replace(/\/+$/, '')}/${relativePath}${separator}v=${encodeURIComponent(state.value.asset_version)}`
  }

  return { provide: { siteAsset } }
})

