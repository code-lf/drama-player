<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

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
  triggerClass: ''
})

const emit = defineEmits<{ select: [item: BaseMenuItem] }>()

// Nuxt UI 菜单负责浮层定位与键盘行为，业务项仍保留原组件图标与禁用原因。
const menuItems = computed(() => props.items.map(item => ({
  ...item,
  color: item.danger ? 'error' as const : 'neutral' as const,
  title: item.disabled ? item.disabledReason : undefined,
  onSelect: () => {
    if (!item.disabled) emit('select', item)
  }
})))
</script>

<template>
  <UDropdownMenu
    :items="menuItems"
    :content="{
      align: align === 'left' ? 'start' : 'end',
      sideOffset: 6,
      collisionPadding: 12
    }"
    :ui="{ content: 'rounded-2xl p-1.5 shadow-xl bg-[#25262b] ring-[#414249]', item: 'rounded-lg text-sm' }"
  >
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      square
      size="sm"
      :class="['base-menu-trigger', triggerClass]"
      aria-label="更多操作"
      @click.stop
    >
      <slot name="trigger"><UIcon name="i-lucide-ellipsis" class="size-4" /></slot>
    </UButton>
    <template #item-leading="{ item }">
      <component :is="item.icon" v-if="item.icon" :size="16" />
    </template>
  </UDropdownMenu>
</template>

<style scoped>
.base-menu-trigger {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}
</style>
