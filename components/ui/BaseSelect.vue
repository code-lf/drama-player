<script setup lang="ts">
import { computed } from 'vue'

export interface BaseSelectOption {
  label: string
  value: string
  description?: string
  badge?: string
  disabled?: boolean
  preview?: '16:9' | '4:3' | '3:4' | '9:16' | '21:9'
}

const props = withDefaults(defineProps<{
  modelValue?: string
  options: BaseSelectOption[]
  label?: string
  placeholder?: string
  full?: boolean
  disabled?: boolean
  tone?: 'pill' | 'panel' | 'light' | 'dashboard'
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
  emptyText?: string
}>(), {
  modelValue: '',
  label: '',
  placeholder: '请选择',
  full: false,
  disabled: false,
  tone: 'pill',
  align: 'left',
  size: 'md',
  emptyText: '当前暂无可选项'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const selectedOption = computed(() => props.options.find(option => option.value === props.modelValue))

const selectClass = computed(() => {
  // 旧版 BaseSelect 在栅格中默认占满整列；Nuxt UI 外层不能使用 inline-flex 收缩，
  // 否则带标签的比例、清晰度等控件会只按文字宽度显示。
  const classes = ['base-select', 'w-full']
  if (props.full) classes.push('w-full')
  if (props.tone === 'pill') classes.push('base-select--pill')
  if (props.tone === 'panel') classes.push('base-select--panel')
  // 创作入口使用与大号任务选择器相同的视觉密度，避免参数项显得过小。
  if (props.tone === 'dashboard') classes.push('base-select--dashboard')
  return classes.join(' ')
})

const previewClassMap: Record<NonNullable<BaseSelectOption['preview']>, string> = {
  '16:9': 'h-2.5 w-5',
  '4:3': 'h-3 w-4',
  '3:4': 'h-4 w-3',
  '9:16': 'h-5 w-2.5',
  '21:9': 'h-2 w-6'
}
</script>

<template>
  <div class="base-select-wrap" :class="{ 'w-full': full }">
    <span v-if="label" class="base-select-label">{{ label }}</span>
    <USelect
      :model-value="modelValue"
      :items="options"
      value-key="value"
      label-key="label"
      description-key="description"
      :placeholder="placeholder"
      :disabled="disabled"
      :size="size"
      :class="selectClass"
      :content="{
        align: align === 'left' ? 'start' : 'end',
        sideOffset: 6,
        collisionPadding: 12
      }"
      :ui="{
        base: 'rounded-md bg-white font-semibold text-highlighted',
        // 下拉层需要独立的最小宽度；不能跟随紧凑触发器缩到只剩一两个汉字。
        content: 'min-w-[180px] rounded-md shadow-xl',
        viewport: 'p-1.5',
        item: 'min-h-9 rounded-md px-2.5 py-2',
        itemLabel: 'whitespace-nowrap text-sm font-semibold',
        itemDescription: 'mt-0.5 text-xs text-muted'
      }"
      @update:model-value="emit('update:modelValue', String($event || ''))"
    >
      <template #default>
        <span v-if="selectedOption?.preview" class="base-select-preview" :class="previewClassMap[selectedOption.preview]" />
        <span class="truncate">{{ selectedOption?.label || placeholder }}</span>
        <UBadge v-if="selectedOption?.badge" :label="selectedOption.badge" color="primary" variant="soft" size="xs" />
      </template>
      <template #item-leading="{ item }">
        <span v-if="item.preview" class="base-select-preview" :class="previewClassMap[item.preview]" />
      </template>
      <template #empty>{{ emptyText }}</template>
    </USelect>
  </div>
</template>

<style scoped>
.base-select-wrap{position:relative;display:flex;width:100%;min-width:0;align-items:center}
.base-select-label{position:absolute;z-index:1;top:5px;left:11px;color:var(--liv-ui-muted);font-size:11px;font-weight:600;pointer-events:none}
.base-select-wrap:has(.base-select-label) :deep(button){min-height:52px;padding-top:20px}
.base-select{min-width:140px}
.base-select--pill :deep(button){border-radius:999px}
.base-select--panel :deep(button){min-height:56px;background:var(--color-panel-soft)}
/* 创作入口的比例和清晰度控件与前两个任务控件保持同一高度、标签位置和字号。 */
.base-select-wrap:has(.base-select--dashboard) .base-select-label{top:10px;left:16px;color:#7b8aa3;font-size:12px;font-weight:700}
.base-select--dashboard :deep(button){min-height:60px;border-radius:12px;border-color:#dfe7f2;background:#fff;padding:23px 16px 8px;color:#0f172a;font-size:14px;font-weight:700}
.base-select-preview{display:inline-block;flex:0 0 auto;border:1px solid #64748b;border-radius:2px}
</style>
