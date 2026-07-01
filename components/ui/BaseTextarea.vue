<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({
  inheritAttrs: false
})

interface Props {
  placeholder?: string
  full?: boolean
  size?: 'md' | 'lg' | 'xl'
  frame?: 'default' | 'plain'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  full: false,
  size: 'xl',
  frame: 'default'
})

const model = defineModel<string>({ default: '' })

const textareaHeightClassName = computed(() => {
  if (props.size === 'md') return 'min-h-[120px]'
  if (props.size === 'lg') return 'min-h-[180px]'
  return 'min-h-[220px]'
})

const containerClassName = computed(() => {
  if (props.frame === 'plain') {
    return [
      'rounded-none border-none bg-transparent px-0 py-0 shadow-none',
      props.disabled ? 'cursor-not-allowed opacity-60' : ''
    ]
  }
  return [
    'rounded-[22px] border border-borderSoft bg-transparent px-5 py-4 transition focus-within:border-neon/60',
    props.disabled ? 'cursor-not-allowed opacity-60 bg-panelSoft/50' : ''
  ]
})
</script>

<template>
  <div :class="[full ? 'w-full' : 'w-auto', 'h-full flex flex-col']">
    <div :class="containerClassName" class="relative group flex-1 flex flex-col">
      <textarea
        ref="textareaRef"
        v-bind="$attrs"
        v-model="model"
        :placeholder="placeholder"
        class="w-full flex-1 resize-none border-none bg-transparent text-[15px] leading-8 text-textMain outline-none placeholder:text-textMuted custom-scrollbar pr-2"
        :class="[textareaHeightClassName, disabled ? 'cursor-not-allowed' : '']"
        :disabled="disabled"
      />
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  background-color: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0);
  border-radius: 4px;
  transition: background-color 0.3s;
}
.group:hover .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.4);
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(148, 163, 184, 0.6);
}
</style>
