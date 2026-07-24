<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}>(), { tone: 'neutral' })

// 业务状态色映射到 Nuxt UI 的语义色，避免各页面继续维护独立 Tag 样式。
const badgeColor = computed(() => {
  if (props.tone === 'danger') return 'error'
  if (props.tone === 'purple') return 'secondary'
  return props.tone
})
</script>

<template>
  <UBadge :color="badgeColor" variant="soft" size="sm" class="liv-tag rounded px-2 font-medium">
    <slot />
  </UBadge>
</template>
