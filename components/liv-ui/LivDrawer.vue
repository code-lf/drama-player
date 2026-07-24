<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  width?: 'sm' | 'md' | 'lg'
  closeLabel?: string
}>(), {
  description: '',
  width: 'md',
  closeLabel: '关闭抽屉'
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const contentClass = computed(() => ({
  sm: 'max-w-[420px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[680px]'
}[props.width]))
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :title="title"
    :description="description"
    :close="{ 'aria-label': closeLabel }"
    :ui="{
      content: `${contentClass} ring-1 ring-default`,
      header: 'border-b border-default px-5 py-4',
      title: 'text-lg font-bold tracking-normal text-highlighted',
      description: 'mt-1 text-sm leading-5 text-muted',
      body: 'min-h-0 overflow-auto px-5 py-4',
      footer: 'justify-end gap-2 border-t border-default px-5 py-3'
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </USlideover>
</template>
