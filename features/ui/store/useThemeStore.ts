import { defineStore } from 'pinia'

export type ThemeMode = 'dark' | 'light'

interface ThemeState {
  mode: ThemeMode
  hydrated: boolean
}

const THEME_STORAGE_KEY = 'livliv-theme-mode'

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    mode: 'dark',
    hydrated: false
  }),
  actions: {
    hydrate() {
      if (!import.meta.client) return
      const cachedMode = localStorage.getItem(THEME_STORAGE_KEY)
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
        localStorage.setItem(THEME_STORAGE_KEY, mode)
      }
    },
    toggleMode() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark')
    },
    applyToDom() {
      if (!import.meta.client) return
      document.documentElement.dataset.theme = this.mode
    }
  }
})
