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
        surfaceBase: 'var(--color-surface-base)',
        surfaceRaised: 'var(--color-surface-raised)',
        surfaceOverlay: 'var(--color-surface-overlay)',
        surfaceHover: 'var(--color-surface-hover)',
        textMain: 'var(--color-text-main)',
        textMuted: 'var(--color-text-muted)',
        textInverse: 'var(--color-text-inverse)',
        neon: 'var(--color-neon)',
        neonSoft: 'var(--color-neon-soft)',
        borderSoft: 'var(--color-border-soft)',
        stateSuccess: 'var(--color-state-success)',
        stateWarning: 'var(--color-state-warning)',
        stateDanger: 'var(--color-state-danger)'
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
