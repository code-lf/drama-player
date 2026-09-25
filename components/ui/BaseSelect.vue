<script setup lang="ts">
import { computed } from 'vue'

export interface BaseSelectOption {
  label: string
  value: string
  description?: string
  badge?: string
  disabled?: boolean
  // 比例预览直接保存“宽:高”，由组件动态计算形状，不限制固定比例枚举。
  preview?: string
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
  leadingIcon?: 'aspect-ratio' | 'resolution'
}>(), {
  modelValue: '',
  label: '',
  placeholder: '请选择',
  full: false,
  disabled: false,
  tone: 'pill',
  align: 'left',
  size: 'md',
  emptyText: '当前暂无可选项',
  leadingIcon: undefined
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const selectedOption = computed(() => props.options.find(option => option.value === props.modelValue))
// 首页参数选择器使用 Nuxt UI 内置的 Iconify 图标名称。
// USelect 会为前置图标预留独立空间，避免绝对定位遮挡 16:9、720P 等选中值。
const leadingIconName = computed(() => {
  if (props.leadingIcon === 'aspect-ratio') return 'i-lucide-monitor'
  if (props.leadingIcon === 'resolution') return 'i-lucide-video'
  return undefined
})

const selectClass = computed(() => {
  // 旧版 BaseSelect 在栅格中默认占满整列；Nuxt UI 外层不能使用 inline-flex 收缩，
  // 否则带标签的比例、清晰度等控件会只按文字宽度显示。
  const classes = ['base-select', 'w-full']
  if (props.full) classes.push('w-full')
  if (props.tone === 'pill') classes.push('base-select--pill')
  if (props.tone === 'panel') classes.push('base-select--panel')
  // 创作入口使用与大号任务选择器相同的视觉密度，避免参数项显得过小。
  if (props.tone === 'dashboard') classes.push('base-select--dashboard')
  // 带图标的首页参数项直接复用“内容类型 / 作品风格”的双列卡片结构。
  if (props.tone === 'dashboard' && leadingIconName.value) classes.push('base-select--dashboard-card')
  return classes.join(' ')
})

function getPreviewStyle(preview?: string): Record<string, string> {
  // 所有比例都按同一个 24px 边界缩放，新增比例无需再补 CSS 类名。
  const [width, height] = String(preview || '').split(':').map(Number)
  if (!width || !height) return {}
  const maxEdge = 24
  const scale = maxEdge / Math.max(width, height)
  return {
    width: `${Math.max(7, Math.round(width * scale))}px`,
    height: `${Math.max(7, Math.round(height * scale))}px`
  }
}
</script>

<template>
  <div class="base-select-wrap" :class="{ 'w-full': full }">
    <span v-if="label && !leadingIconName" class="base-select-label">{{ label }}</span>
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
        <span v-if="leadingIconName" class="dashboard-select-value">
          <span class="dashboard-select-icon" aria-hidden="true">
            <UIcon :name="leadingIconName" class="size-5" />
          </span>
          <span class="min-w-0">
            <span class="dashboard-select-label">{{ label }}</span>
            <span class="dashboard-select-text">{{ selectedOption?.label || placeholder }}</span>
          </span>
        </span>
        <template v-else>
          <span v-if="selectedOption?.preview" class="base-select-preview" :style="getPreviewStyle(selectedOption.preview)" />
          <span class="truncate">{{ selectedOption?.label || placeholder }}</span>
          <UBadge v-if="selectedOption?.badge" :label="selectedOption.badge" color="primary" variant="soft" size="xs" />
        </template>
      </template>
      <template #item-leading="{ item }">
        <span v-if="item.preview" class="base-select-preview" :style="getPreviewStyle(item.preview)" />
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
.base-select--dashboard-card :deep(button){padding:0 14px}
.dashboard-select-value{display:flex;min-width:0;align-items:center;gap:12px;text-align:left}
.dashboard-select-icon{display:grid;height:28px;width:28px;flex:0 0 auto;place-items:center;border-radius:8px;background:#f2f5f9;color:#52627a}
.dashboard-select-label{display:block;color:#7b8aa3;font-size:12px;font-weight:700;line-height:16px}
.dashboard-select-text{display:block;overflow:hidden;color:#111827;font-size:14px;font-weight:900;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.base-select-preview{display:inline-block;flex:0 0 auto;border:1px solid #64748b;border-radius:2px}
</style>
