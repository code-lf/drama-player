<script setup lang="ts">
import CreditIcon from '~/components/ui/CreditIcon.vue'

interface Props {
  value: number | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  tone?: 'default' | 'accent' | 'success' | 'muted' | 'inherit'
  showUnit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  tone: 'default',
  showUnit: false
})

const sizeClassMap = {
  xs: {
    wrapper: 'gap-1.5 text-xs',
    icon: 'xs',
    unit: 'text-[10px]'
  },
  sm: {
    wrapper: 'gap-2 text-sm',
    icon: 'sm',
    unit: 'text-xs'
  },
  md: {
    wrapper: 'gap-2 text-base',
    icon: 'md',
    unit: 'text-sm'
  },
  lg: {
    wrapper: 'gap-3 text-2xl',
    icon: 'lg',
    unit: 'text-sm'
  }
} as const

const toneClassMap = {
  default: 'text-textMain',
  accent: 'text-neon',
  success: 'text-emerald-500 dark:text-emerald-300',
  muted: 'text-textMuted',
  inherit: 'text-current'
} as const

const currentSize = computed(() => sizeClassMap[props.size])
const toneClassName = computed(() => toneClassMap[props.tone])

function formatValue(value: number | string): string {
  const normalized = Number(value)
  if (Number.isFinite(normalized)) {
    return new Intl.NumberFormat('zh-CN').format(normalized)
  }
  return String(value)
}
</script>

<template>
  <span class="inline-flex items-center font-semibold leading-none" :class="[currentSize.wrapper, toneClassName]">
    <CreditIcon :size="currentSize.icon" />
    <span>{{ formatValue(value) }}</span>
    <span v-if="showUnit" class="font-medium opacity-80" :class="currentSize.unit">点</span>
  </span>
</template>
