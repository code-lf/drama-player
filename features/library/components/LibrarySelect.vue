<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from '@lucide/vue'

export interface SelectOption {
  label: string
  value: string | number
  badge?: string
  desc?: string
}

const props = withDefaults(defineProps<{
  modelValue?: string | number
  options: SelectOption[]
  placeholder?: string
  prefix?: string
  size?: 'xs' | 'sm' | 'md'
  block?: boolean
  disabled?: boolean
  align?: 'left' | 'right'
}>(), {
  modelValue: '',
  placeholder: '请选择',
  prefix: '',
  size: 'sm',
  block: false,
  disabled: false,
  align: 'left'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const selectedOption = computed(() => {
  return props.options.find(opt => String(opt.value) === String(props.modelValue))
})

const displayLabel = computed(() => {
  return selectedOption.value?.label || props.placeholder
})

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function selectOption(option: SelectOption) {
  emit('update:modelValue', String(option.value))
  emit('change', String(option.value))
  isOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative inline-block text-left select-none"
    :class="{ 'w-full': block }"
  >
    <!-- 触发器按钮 -->
    <button
      type="button"
      :disabled="disabled"
      class="group inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/80 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      :class="[
        size === 'xs' ? 'h-7 px-2.5 text-xs' : size === 'sm' ? 'h-9 px-3 text-xs' : 'h-10 px-3.5 text-sm',
        block ? 'w-full' : '',
        isOpen ? 'border-blue-500 ring-2 ring-blue-500/15' : ''
      ]"
      @click="toggle"
    >
      <span class="inline-flex items-center gap-1.5 truncate">
        <span v-if="prefix" class="text-slate-400 font-normal shrink-0">{{ prefix }}</span>
        <span class="truncate font-semibold text-slate-800">{{ displayLabel }}</span>
        <span
          v-if="selectedOption?.badge"
          class="ml-1 inline-flex items-center rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600"
        >
          {{ selectedOption.badge }}
        </span>
      </span>

      <ChevronDown
        class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600"
        :class="{ 'rotate-180 text-blue-600': isOpen }"
      />
    </button>

    <!-- 下拉弹出面板 -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 focus:outline-hidden"
        :class="[
          align === 'right' ? 'right-0' : 'left-0',
          block ? 'w-full' : 'min-w-[140px] max-w-[240px]'
        ]"
      >
        <div
          v-for="option in options"
          :key="String(option.value)"
          class="group/item flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors"
          :class="[
            String(option.value) === String(modelValue)
              ? 'bg-blue-50 text-blue-600 font-bold'
              : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
          ]"
          @click="selectOption(option)"
        >
          <div class="flex flex-col min-w-0 pr-2">
            <span class="truncate">{{ option.label }}</span>
            <span v-if="option.desc" class="text-[10px] text-slate-400 font-normal truncate mt-0.5">{{ option.desc }}</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span
              v-if="option.badge"
              class="rounded-sm bg-slate-100 px-1 py-0.2 text-[9px] font-semibold text-slate-600 group-hover/item:bg-blue-100 group-hover/item:text-blue-700"
            >
              {{ option.badge }}
            </span>
            <Check
              v-if="String(option.value) === String(modelValue)"
              class="h-3.5 w-3.5 text-blue-600 shrink-0"
            />
          </div>
        </div>

        <div v-if="options.length === 0" class="py-3 text-center text-xs text-slate-400">
          暂无选项
        </div>
      </div>
    </Transition>
  </div>
</template>
