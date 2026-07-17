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
  <span class="inline-flex shrink-0 items-center justify-center" :class="sizeClassName" aria-hidden="true">
    <img src="/icons/credit-star-light.png?v=20260715" alt="" class="h-full w-full scale-[1.38] object-contain dark:hidden" draggable="false">
    <img src="/icons/credit-star-dark.png?v=20260715" alt="" class="hidden h-full w-full scale-[1.38] object-contain dark:block" draggable="false">
  </span>
</template>
