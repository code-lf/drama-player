<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

interface Props {
  modelValue?: string
  placeholder?: string
  full?: boolean
  size?: 'md' | 'lg' | 'xl'
  frame?: 'default' | 'plain'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  full: false,
  size: 'xl',
  frame: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const textareaHeightClassName = computed(() => {
  // 通过尺寸枚举控制高度，避免每个页面单独写死高度。
  if (props.size === 'md') return 'min-h-[120px]'
  if (props.size === 'lg') return 'min-h-[180px]'
  return 'min-h-[220px]'
})

const containerClassName = computed(() => {
  // 入口页需要更简洁的单层输入框，因此提供无边框外壳模式复用。
  if (props.frame === 'plain') {
    return 'rounded-none border-none bg-transparent px-0 py-0 shadow-none'
  }

  return 'rounded-[22px] border border-borderSoft bg-transparent px-5 py-5 transition focus-within:border-neon/60'
})
</script>

<template>
  <div :class="[containerClassName, full ? 'w-full' : '']">
    <textarea
      v-bind="$attrs"
      v-model="model"
      :placeholder="placeholder"
      class="w-full resize-none border-none bg-transparent text-[15px] leading-8 text-textMain outline-none placeholder:text-textMuted"
      :class="textareaHeightClassName"
    />
  </div>
</template>
