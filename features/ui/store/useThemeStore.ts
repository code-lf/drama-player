import { defineStore } from 'pinia'

export type ThemeMode = 'dark' | 'light'

interface ThemeState {
  mode: ThemeMode
  hydrated: boolean
}

const THEME_STORAGE_KEY = 'livliv-theme-mode'
const LEGACY_THEME_STORAGE_KEY = 'livliv:theme-mode'

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    // 默认主题改为浅色，和当前产品主视觉保持一致，
    // 避免本地还没完成 hydrate 之前先闪出一帧深色主题。
    mode: 'light',
    hydrated: false
  }),
  actions: {
    hydrate() {
      if (!import.meta.client) return
      // 客户端启动后优先读取本地已缓存主题，
      // 这样用户刷新或重新进入页面时能恢复上次选择。
      const cachedMode = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
      if (cachedMode === 'dark' || cachedMode === 'light') {
        this.mode = cachedMode
      }
      this.applyToDom()
      this.hydrated = true
    },
    setMode(mode: ThemeMode) {
      this.mode = mode
      this.applyToDom()
      if (import.meta.client) {
        // 主题切换结果持久化到本地，供下次首屏恢复；兼容历史 key，避免旧页面刷新后读不到。
        localStorage.setItem(THEME_STORAGE_KEY, mode)
        localStorage.setItem(LEGACY_THEME_STORAGE_KEY, mode)
      }
    },
    toggleMode() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark')
    },
    applyToDom() {
      if (!import.meta.client) return
      document.documentElement.dataset.theme = this.mode
      
      if (this.mode === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      // 同步浏览器原生表单/滚动条配色，减少主题切换割裂感。
      document.documentElement.style.colorScheme = this.mode
    }
  }
})
