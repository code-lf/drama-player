<script setup lang="ts">
interface Props {
  /** 用户端统一品牌星形图标尺寸，避免业务页面继续混用 Lucide Sparkles。 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const sizeClassMap = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-11 w-11'
} as const

const sizeClassName = computed(() => sizeClassMap[props.size])
</script>

<template>
  <!-- 品牌积分标记沿用无透明留白的 SVG，颜色由外层文字颜色统一控制。 -->
  <span class="inline-flex shrink-0 items-center justify-center" :class="sizeClassName" aria-hidden="true">
    <svg class="h-full w-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M9.82 2.1c.51 4.56 2.34 7.1 6.93 8.02-4.59.92-6.42 3.46-6.93 8.02-.51-4.56-2.34-7.1-6.93-8.02 4.59-.92 6.42-3.46 6.93-8.02Z" />
      <path fill="currentColor" d="M17.85 3.25c.25 1.75 1.12 2.7 2.88 2.99-1.76.29-2.63 1.24-2.88 2.99-.25-1.75-1.12-2.7-2.88-2.99 1.76-.29 2.63-1.24 2.88-2.99Z" />
    </svg>
  </span>
</template>
