<script setup lang="ts">
interface Props {
  /** 统一控制积分图标尺寸，避免各业务页面重复维护宽高。 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const sizeClassMap = {
  // 统一放大积分图标，避免按钮内图标被文字压得过小。
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10'
} as const

const sizeClassName = computed(() => sizeClassMap[props.size])
</script>

<template>
  <!--
    图形源已经从原 PNG 转为 public/icons/credit-star.svg；使用同一套路径，
    通过 currentColor 让白色主按钮、黑白主题和普通文本场景自动换色。
  -->
  <span class="credit-icon inline-flex shrink-0 items-center justify-center" :class="sizeClassName" aria-hidden="true">
    <svg class="h-full w-full" viewBox="0 0 1254 1254" fill="none" xmlns="http://www.w3.org/2000/svg">
      <use href="/icons/credit-star.svg#credit-star-icon" fill="currentColor" />
    </svg>
  </span>
</template>
