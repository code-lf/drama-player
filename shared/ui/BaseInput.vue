<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  full?: boolean
  tone?: 'pill' | 'panel'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  placeholder: '',
  full: false,
  tone: 'pill'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const containerClassName = computed(() => {
  // 输入框统一走组件外壳，后续页面不再直接拼裸 input 样式。
  if (props.tone === 'panel') {
    return 'rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 transition focus-within:border-neon/55 focus-within:shadow-[0_0_0_1px_rgba(69,215,255,0.18)]'
  }

  return 'rounded-full border border-borderSoft bg-white/60 dark:bg-white/5 px-4 py-2.5 backdrop-blur-sm transition focus-within:border-neon/55 focus-within:shadow-[0_0_0_1px_rgba(69,215,255,0.18)]'
})
</script>

<template>
  <label class="block" :class="full ? 'w-full' : ''">
    <span v-if="label" class="mb-2 block text-[11px] uppercase tracking-[0.2em] text-textMuted">
      {{ label }}
    </span>
    <div :class="containerClassName">
      <input
        v-bind="$attrs"
        v-model="model"
        :placeholder="placeholder"
        class="w-full border-none bg-transparent text-sm text-textMain outline-none placeholder:text-textMuted"
      />
    </div>
  </label>
</template>
