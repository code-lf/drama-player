export default defineAppConfig({
  ui: {
    colors: {
      // 主色统一为靛紫 #4F46E5，成功/警告/危险继续使用原有语义色。
      primary: 'indigo',
      neutral: 'slate',
      success: 'emerald',
      warning: 'amber',
      error: 'red',
      info: 'sky'
    },
    // 勾选图标使用品牌实心表面的前景色，避免深色主题 text-inverted 变成黑勾。
    checkbox: {
      slots: {
        indicator: 'text-[var(--liv-control-on-primary)]',
        icon: 'text-[var(--liv-control-on-primary)]'
      }
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
