<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useFloatingLayer } from './useFloatingLayer'

export interface BaseMenuItem {
  key: string
  label: string
  icon?: Component
  disabled?: boolean
  danger?: boolean
  /** 禁用时解释原因，避免用户只看到灰按钮却不知道下一步该做什么。 */
  disabledReason?: string
}

const props = withDefaults(defineProps<{
  items: BaseMenuItem[]
  align?: 'left' | 'right'
  width?: number
  triggerClass?: string
}>(), {
  align: 'right',
  width: 168,
  triggerClass: '',
})

const emit = defineEmits<{ select: [item: BaseMenuItem] }>()
const isOpen = ref(false)
const { anchorRef, layerRef, layerStyle, updatePosition, containsTarget } = useFloatingLayer(isOpen, {
  align: props.align,
  minWidth: props.width,
  maxHeight: 360,
})

watch(isOpen, open => {
  if (open) void updatePosition()
})

function choose(item: BaseMenuItem): void {
  if (item.disabled) return
  isOpen.value = false
  emit('select', item)
}

function closeWhenOutside(event: PointerEvent): void {
  if (!containsTarget(event.target)) isOpen.value = false
}

function closeWithEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') isOpen.value = false
}

onMounted(() => {
  window.addEventListener('pointerdown', closeWhenOutside)
  window.addEventListener('keydown', closeWithEscape)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeWhenOutside)
  window.removeEventListener('keydown', closeWithEscape)
})
</script>

<template>
  <span ref="anchorRef" class="base-menu-anchor" :class="triggerClass">
    <button class="base-menu-trigger" type="button" :aria-expanded="isOpen" aria-label="更多操作" @click.stop="isOpen = !isOpen">
      <slot name="trigger" />
    </button>
  </span>

  <!--
    菜单挂到 body 并使用 fixed 坐标，从根源上避开卡片 overflow、抽屉与 sticky 底栏的裁切。
    位置算法会根据屏幕剩余空间自动向上或向下展开。
  -->
  <Teleport to="body">
    <div v-if="isOpen" ref="layerRef" class="base-menu-layer" :style="layerStyle" @click.stop>
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="base-menu-item"
        :class="{ danger: item.danger, disabled: item.disabled }"
        :disabled="item.disabled"
        :title="item.disabled ? item.disabledReason : ''"
        @click="choose(item)"
      >
        <component :is="item.icon" v-if="item.icon" :size="16" />
        <span>{{ item.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.base-menu-anchor{display:inline-flex}
.base-menu-trigger{display:inline-flex;align-items:center;justify-content:center}
.base-menu-layer{overflow:auto;border:1px solid #e2e8f2;border-radius:12px;background:#fff;padding:6px;box-shadow:0 18px 48px rgba(15,35,65,.2)}
.base-menu-item{display:flex;width:100%;align-items:center;gap:9px;border-radius:8px;padding:9px 10px;color:#334155;font-size:13px;line-height:20px;text-align:left;transition:background .15s,color .15s}
.base-menu-item:hover{background:#f3f6fb;color:#1768ff}
.base-menu-item.danger{color:#dc354b}.base-menu-item.danger:hover{background:#fff2f4}
.base-menu-item.disabled{cursor:not-allowed;color:#a7b0be;background:transparent}
</style>
