<script setup lang="ts">
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
    icon: 'h-5 w-5',
    unit: 'text-[10px]'
  },
  sm: {
    wrapper: 'gap-2 text-sm',
    icon: 'h-[22px] w-[22px]',
    unit: 'text-xs'
  },
  md: {
    wrapper: 'gap-2 text-base',
    icon: 'h-7 w-7',
    unit: 'text-sm'
  },
  lg: {
    wrapper: 'gap-3 text-2xl',
    icon: 'h-8 w-8',
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
    <!-- 点数统一改成星星语义，和当前产品的“创作值 / 灵感值”感知更贴近。 -->
    <svg viewBox="0 0 24 24" class="shrink-0" :class="currentSize.icon">
      <path d="M12 3.4 13.9 8.1 18.6 10 13.9 11.9 12 16.6 10.1 11.9 5.4 10 10.1 8.1 12 3.4Z" class="fill-current opacity-90" />
      <path d="M17.5 4.8 18.2 6.6 20 7.3 18.2 8 17.5 9.8 16.8 8 15 7.3 16.8 6.6 17.5 4.8Z" class="fill-current opacity-45" />
      <path d="M6.8 14.8 7.35 16.15 8.7 16.7 7.35 17.25 6.8 18.6 6.25 17.25 4.9 16.7 6.25 16.15 6.8 14.8Z" class="fill-current opacity-35" />
    </svg>
    <span>{{ formatValue(value) }}</span>
    <span v-if="showUnit" class="font-medium opacity-80" :class="currentSize.unit">点</span>
  </span>
</template>
