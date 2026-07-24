<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeLabel?: string
  flush?: boolean
}>(), {
  description: '',
  width: 'md',
  closeLabel: '关闭弹窗',
  flush: false
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

// 宽度沿用原业务弹窗分级，交互壳、遮罩、焦点锁定和关闭行为由 UModal 提供。
const contentClass = computed(() => ({
  sm: 'max-w-[480px]',
  md: 'max-w-[720px]',
  lg: 'max-w-[900px]',
  xl: 'max-w-[1120px]',
  full: 'h-[min(900px,calc(100vh-32px))] max-w-[min(1520px,calc(100vw-32px))]'
}[props.width]))
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :close="{ 'aria-label': closeLabel }"
    :ui="{
      content: `${contentClass} rounded-lg ring-1 ring-default shadow-2xl`,
      header: 'min-h-0 border-b border-default px-5 py-4 sm:px-6',
      title: 'text-lg font-bold tracking-normal text-highlighted',
      description: 'mt-1 text-sm leading-5 text-muted',
      body: flush ? 'min-h-0 overflow-hidden p-0' : 'min-h-0 overflow-auto px-5 py-4 sm:px-6',
      footer: 'justify-end gap-2 border-t border-default px-5 py-3 sm:px-6'
    }"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="$slots.icon" #header="{ close }">
      <div class="liv-dialog-header-copy">
        <div class="liv-dialog-icon"><slot name="icon" /></div>
        <div class="min-w-0 flex-1">
          <h2 class="m-0 text-lg font-bold text-highlighted">{{ title }}</h2>
          <p v-if="description" class="mt-1 text-sm leading-5 text-muted">{{ description }}</p>
        </div>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" square :aria-label="closeLabel" @click="close" />
      </div>
    </template>
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </UModal>
</template>

<style scoped>
.liv-dialog-header-copy{display:flex;width:100%;align-items:flex-start;gap:12px}
.liv-dialog-icon{display:flex;width:40px;height:40px;flex:0 0 40px;align-items:center;justify-content:center;border-radius:8px;background:#1768ff;color:#fff;box-shadow:0 8px 18px rgba(23,104,255,.2)}
</style>
