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
    class="liv-button" :class="{'liv-settings-button':settings,'liv-settings-button-primary':settings&&variant==='primary'}"
    :ui="{ base: 'min-w-0 justify-center rounded-md font-semibold tracking-normal' }"
  >
    <template v-if="$slots.icon" #leading><slot name="icon" /></template>
    <slot />
  </UButton>
</template>
