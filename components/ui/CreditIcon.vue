<script setup lang="ts">
import { CREATIVE_POINT_URL, CREATIVE_POINT_FALLBACK } from '~/shared/constants/creativePoint'
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
const imageSource = ref(CREATIVE_POINT_URL)
// 只回退一次，避免本地资源也失败时触发无限重试。
function useLocalFallback() {
  if (imageSource.value !== CREATIVE_POINT_FALLBACK) imageSource.value = CREATIVE_POINT_FALLBACK
}
</script>

<template>
  <!-- 灵感点仅替换视觉标记；积分名称、余额和扣费逻辑不变。 -->
  <span class="credit-icon inline-flex shrink-0 items-center justify-center" :class="sizeClassName" aria-hidden="true">
    <img :src="imageSource" class="h-full w-full object-contain" width="128" height="128" alt="" decoding="async" @error="useLocalFallback" />
  </span>
</template>
