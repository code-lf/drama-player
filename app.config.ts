export default defineAppConfig({
  ui: {
    colors: {
      // Livliv 主色统一为蓝色系，状态色使用 Nuxt UI 的语义色。
      primary: 'blue',
      neutral: 'slate',
      success: 'emerald',
      warning: 'amber',
      error: 'red',
      info: 'sky'
    },
    button: {
      defaultVariants: {
        size: 'md',
        color: 'neutral',
        variant: 'outline'
      }
    },
    badge: {
      defaultVariants: {
        size: 'sm',
        variant: 'soft'
      }
    },
    input: {
      defaultVariants: {
        size: 'md',
        color: 'primary',
        variant: 'outline'
      }
    },
    select: {
      defaultVariants: {
        size: 'md',
        color: 'primary',
        variant: 'outline'
      }
    }
  }
})
