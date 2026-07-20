<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFloatingLayer } from './useFloatingLayer'

const props = withDefaults(defineProps<{
  text: string
  align?: 'left' | 'right'
  width?: number
}>(), { align: 'left', width: 260 })

const isOpen = ref(false)
const { anchorRef, layerRef, layerStyle, updatePosition } = useFloatingLayer(isOpen, {
  align: props.align,
  minWidth: props.width,
  maxHeight: 180,
  gap: 7,
})

watch(isOpen, open => {
  if (open) void updatePosition()
})

/**
 * 只有存在说明文字时才展示浮层。
 * 锁定按钮可用时会传入空字符串；如果仍然打开 Tooltip，页面会出现一个没有内容的黑色小块。
 */
function openTooltip(): void {
  if (!props.text.trim()) return
  isOpen.value = true
}
</script>

<template>
  <span
    ref="anchorRef"
    class="tooltip-anchor"
    tabindex="0"
    @mouseenter="openTooltip"
    @mouseleave="isOpen = false"
    @focus="openTooltip"
    @blur="isOpen = false"
  ><slot /></span>
  <Teleport to="body">
    <div v-if="isOpen" ref="layerRef" class="tooltip-layer" :style="layerStyle" role="tooltip">{{ text }}</div>
  </Teleport>
</template>

<style scoped>
.tooltip-anchor{display:inline-flex;align-items:center;outline:none}
.tooltip-layer{border:1px solid rgba(37,59,91,.14);border-radius:9px;background:#18233a;padding:9px 11px;color:#fff;font-size:12px;line-height:18px;box-shadow:0 12px 30px rgba(15,35,65,.2);white-space:normal}
</style>
