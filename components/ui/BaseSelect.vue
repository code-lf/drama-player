<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue'
import { useFloatingLayer } from './useFloatingLayer'

export interface BaseSelectOption {
  label: string
  value: string
  description?: string
  badge?: string
  disabled?: boolean
  preview?: '16:9' | '4:3' | '3:4' | '9:16' | '21:9'
}

interface Props {
  modelValue?: string
  options: BaseSelectOption[]
  label?: string
  placeholder?: string
  full?: boolean
  disabled?: boolean
  tone?: 'pill' | 'panel' | 'light'
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
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

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const { anchorRef: rootRef, layerRef: menuRef, layerStyle, updatePosition, containsTarget } = useFloatingLayer(
  isOpen,
  { align: props.align, maxHeight: 320 },
)

watch(isOpen, async (newVal) => {
  if (!newVal) return
  await updatePosition()
})

/**
 * BaseSelect 的菜单包在 Transition + Teleport 中：打开状态先变化，真实菜单 DOM 会晚一个渲染节拍挂载。
 * 只监听 isOpen 时，极少数浏览器帧里可能拿不到 menuRef，浮层就会暂时落在 body 左上角。
 * 因此再监听一次菜单元素本身；它真正出现后重新测量，可以稳定贴合触发按钮。
 */
watch(menuRef, (element) => {
  if (element && isOpen.value) void updatePosition()
}, { flush: 'post' })

const selectedOption = computed(() => {
  return props.options.find((option) => option.value === props.modelValue)
})

const previewClassMap: Record<NonNullable<BaseSelectOption['preview']>, string> = {
  // 这些比例示意图只负责传达画幅方向，让下拉更像设计工具而不是纯文字菜单。
  '16:9': 'h-2.5 w-5',
  '4:3': 'h-3 w-4',
  '3:4': 'h-4 w-3',
  '9:16': 'h-5 w-2.5',
  '21:9': 'h-2 w-6'
}

function resolvePreviewClass(preview?: BaseSelectOption['preview']): string {
  if (!preview) return ''
  return previewClassMap[preview]
}

const triggerClassName = computed(() => {
  // 统一收口选择器的两套外观，避免页面里继续散落不同风格的边框与阴影。
  if (props.tone === 'panel') {
    return [
      'min-h-[68px] rounded-2xl px-4 py-3',
      'border border-borderSoft bg-panelSoft transition-all duration-200',
      isOpen.value ? 'border-neon/55 shadow-[0_0_0_1px_rgba(69,215,255,0.18)]' : 'hover:border-neon/35'
    ]
  }

  if (props.tone === 'light') {
    return [
      'min-h-[38px] rounded-[10px] px-3 py-2',
      'border border-[#e2e8f2] bg-white text-[#172033] transition-all duration-150',
      isOpen.value ? 'border-[#9bbcff] shadow-[0_0_0_2px_rgba(23,104,255,0.08)]' : 'hover:border-[#b7c8e5]'
    ]
  }

  if (props.size === 'sm') {
    return [
      'min-h-[40px] rounded-[14px] px-3 py-2',
      'border border-borderSoft bg-panelSoft/80 backdrop-blur-sm transition-all duration-200',
      isOpen.value ? 'border-neon/55 shadow-[0_0_0_1px_rgba(69,215,255,0.18)]' : 'hover:border-neon/35'
    ]
  }

  return [
    'min-h-[48px] rounded-full px-4 py-2.5',
    'border border-borderSoft bg-panelSoft/80 backdrop-blur-sm transition-all duration-200',
    isOpen.value ? 'border-neon/55 shadow-[0_0_0_1px_rgba(69,215,255,0.18)]' : 'hover:border-neon/35'
  ]
})

function toggleDropdown(): void {
  // 即便后端暂时没给选项，也允许用户点开看到空态，避免误以为控件失效。
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function closeDropdown(): void {
  isOpen.value = false
}

function selectOption(optionValue: string): void {
  emit('update:modelValue', optionValue)
  closeDropdown()
}

function handlePointerDown(event: PointerEvent): void {
  if (containsTarget(event.target)) return
  closeDropdown()
}

function handleKeyboard(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeDropdown()
  }
}

onMounted(() => {
  // 使用全局事件关闭浮层，解决点击外部区域后下拉无法收起的问题。
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('keydown', handleKeyboard)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('keydown', handleKeyboard)
})
</script>

<template>
  <div ref="rootRef" class="relative" :class="[full ? 'w-full' : '', isOpen ? 'z-[140]' : 'z-[1]']">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 text-left"
      :class="[triggerClassName, disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer']"
      :aria-expanded="isOpen"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <div class="min-w-0 flex-1">
        <p v-if="label" class="text-[11px] font-bold tracking-normal text-textMuted">
          {{ label }}
        </p>
        <div class="mt-1 flex items-center gap-2">
          <span
            v-if="selectedOption?.preview"
            class="shrink-0 rounded-[3px] border border-[#0f172a]/70 bg-transparent"
            :class="resolvePreviewClass(selectedOption?.preview)"
          />
          <span class="truncate text-sm font-semibold" :class="tone === 'light' ? 'text-[#172033]' : 'text-textMain'">
            {{ selectedOption?.label || placeholder }}
          </span>
          <span
            v-if="selectedOption?.badge"
            class="rounded-full border border-neon/25 bg-neon/10 px-2 py-0.5 text-[10px] font-medium text-neon"
          >
            {{ selectedOption.badge }}
          </span>
        </div>
        <p v-if="tone === 'panel' && selectedOption?.description" class="mt-1 truncate text-xs text-textMuted">
          {{ selectedOption.description }}
        </p>
      </div>

      <ChevronDown
        class="h-4 w-4 shrink-0 text-textMuted transition duration-200"
        :class="isOpen ? 'rotate-180 text-neon' : ''"
      />
    </button>

    <Teleport to="body">
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-120 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div
          v-if="isOpen"
          ref="menuRef"
          class="overflow-hidden border p-2 shadow-[0_22px_56px_rgba(15,35,65,0.22)]"
          :class="tone === 'light' ? 'rounded-xl border-[#e2e8f2] bg-white' : 'rounded-3xl border-borderSoft bg-panel/95 backdrop-blur-xl'"
          :style="layerStyle"
        >
            <div v-if="options.length === 0" class="px-3 py-5 text-center text-sm" :class="tone === 'light' ? 'text-[#7b8798]' : 'text-textMuted'">
          {{ emptyText }}
        </div>

        <div v-else class="max-h-[320px] overflow-y-auto pr-1">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="group flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition"
            :class="[
              tone === 'light' ? 'rounded-lg' : 'rounded-2xl',
              option.value === modelValue
                ? (tone === 'light' ? 'bg-[#eef4ff] text-[#1768ff]' : 'bg-neon/12 text-textMain shadow-[inset_0_0_0_1px_rgba(69,215,255,0.18)]')
                : (tone === 'light' ? 'text-[#536177] hover:bg-[#f5f8fc] hover:text-[#172033]' : 'text-textMuted hover:bg-panelSoft/80 hover:text-textMain'),
              option.disabled ? 'cursor-not-allowed opacity-45' : ''
            ]"
            :disabled="option.disabled"
            @click="selectOption(option.value)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  v-if="option.preview"
                  class="shrink-0 rounded-[3px] border border-[#0f172a]/70 bg-transparent"
                  :class="resolvePreviewClass(option.preview)"
                />
                <span class="truncate text-sm font-semibold">{{ option.label }}</span>
                <span
                  v-if="option.badge"
                  class="rounded-full border border-borderSoft/80 bg-panelSoft px-2 py-0.5 text-[10px] text-textMuted"
                >
                  {{ option.badge }}
                </span>
              </div>
              <p v-if="option.description" class="mt-1 line-clamp-2 text-xs leading-5" :class="tone === 'light' ? 'text-[#8a96a8]' : 'text-textMuted'">
                {{ option.description }}
              </p>
            </div>

            <span
              v-if="option.value === modelValue"
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon/15 text-neon"
            >
              <Check class="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
