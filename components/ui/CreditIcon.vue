<script setup lang="ts">
import BrandSparkIcon from '~/components/ui/BrandSparkIcon.vue'

interface Props {
  /** 统一控制积分图标尺寸，避免各业务页面重复维护宽高。 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

</script>

<template>
  <!-- 积分入口与 AI 能力入口共用同一品牌图形，积分语义仍由 CreditIcon 组件承载。 -->
  <BrandSparkIcon :size="props.size" />
</template>
