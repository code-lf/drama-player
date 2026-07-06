import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './features/**/*.vue',
    './shared/**/*.vue'
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        panelSoft: 'var(--color-panel-soft)',
        textMain: 'var(--color-text-main)',
        textMuted: 'var(--color-text-muted)',
        neon: 'var(--color-neon)',
        neonSoft: 'var(--color-neon-soft)',
        borderSoft: 'var(--color-border-soft)'
      },
      boxShadow: {
        neon: 'var(--shadow-neon)',
        panel: 'var(--shadow-panel)'
      },
      borderRadius: {
        lgx: 'var(--radius-lg)',
        xlx: 'var(--radius-xl)'
      },
      backgroundImage: {
        grid: 'radial-gradient(circle at center, rgba(90, 133, 255, 0.2) 1px, transparent 1px)'
      }
    }
  },
  plugins: []
} satisfies Config
