// 这是 Nuxt dev 场景下的稳定 app manifest 兜底模块。
// 目的不是替代正式构建产物，而是避免 Windows 本地热更新重启时，
// `#app-manifest` 在生成目录尚未恢复完成之前就被 Vite 预解析，从而导致整页报错。
export const id = 'dev'
export const timestamp = Date.now()
export const prerendered = []

export default {
  id,
  timestamp,
  prerendered
}
