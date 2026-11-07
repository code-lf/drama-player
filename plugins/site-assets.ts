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

  async function loadSiteAssets() {
    try {
      // SSR 使用内部地址把 OSS 配置带入 HTML，CSR 使用同源代理异步补齐公开配置。
      const baseUrl = import.meta.server
        ? String(runtimeConfig.apiServerBase || '')
        : String(runtimeConfig.public.apiBase || '/api')
      // 配置故障最多等待五秒，不反复重试；页面本身不受该请求阻塞。
      state.value = await $fetch<SiteAssetConfig>(`${baseUrl}/config/site-assets`, { timeout: 5000, retry: 0 })
    } catch (error) {
      // OSS 配置接口不可用时保留 public 本地路径，避免配置故障导致整站图片全部裂开。
      console.warn('[livliv] 站点素材配置读取失败，暂时使用本地静态资源。', error)
    }
  }
  // SSR保留首屏地址；CSR不让公共素材配置阻塞Vue挂载，配置到达后响应式更新地址。
  // SSR已注入有效配置时直接复用，避免hydration再次读取相同公开目录。
  if (!state.value.asset_base_url) {
    if (import.meta.server) await loadSiteAssets()
    else void loadSiteAssets()
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

