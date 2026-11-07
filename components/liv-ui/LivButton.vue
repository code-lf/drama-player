<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  type?: 'button' | 'submit' | 'reset'
  /** 设置弹窗固定按钮规格，不由业务页再次拼接。 */
  settings?: boolean
  /** 纯图标按钮统一36px点击区及18px居中图标；调用方必须提供aria-label。 */
  iconOnly?: boolean
  /** 图标名称直接交给 Nuxt UI，保留原命名与加载态处理。 */
  icon?: string
}>(), {
  variant: 'secondary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
  type: 'button'
})

// 兼容旧页面的 LivButton API，实际交互、焦点和加载状态统一交给 Nuxt UI。
const buttonAppearance = computed(() => {
  if (props.variant === 'primary') return { color: 'primary' as const, variant: 'solid' as const }
  if (props.variant === 'danger') return { color: 'error' as const, variant: 'soft' as const }
  if (props.variant === 'ghost') return { color: 'neutral' as const, variant: 'ghost' as const }
  return { color: 'neutral' as const, variant: 'outline' as const }
})
</script>

<template>
  <UButton
    :type="type"
    :color="buttonAppearance.color"
    :variant="buttonAppearance.variant"
    :size="size"
    :loading="loading"
    :disabled="disabled"
    :block="block"
    :square="iconOnly"
    :icon="icon"
    class="liv-button" :class="{'liv-icon-button':iconOnly,'liv-settings-button':settings,'liv-settings-button-primary':settings&&variant==='primary'}"
    :ui="{ base: 'min-w-0 justify-center rounded-md font-semibold tracking-normal' }"
  >
    <template v-if="$slots.icon" #leading><slot name="icon" /></template>
    <slot />
  </UButton>
</template>
<style scoped>
/* 图标居中由真实button保证，不依赖父级布局或页面对svg的补丁。 */
.liv-button.liv-icon-button{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;min-height:36px;flex-shrink:0;padding:0!important;border-radius:10px;line-height:1;gap:0}
.liv-button.liv-icon-button :deep(.iconify){display:block;width:18px;height:18px;flex-shrink:0;margin:0;color:inherit}
</style>
