<script setup lang="ts">
import type { WorkflowNodeType } from '~/entities/canvas/types'
import { nodeTypeOrder, nodeTypePreset } from '~/shared/constants/canvas'

interface Props {
  title?: string
  allowedTypes?: WorkflowNodeType[]
}

const props = withDefaults(defineProps<Props>(), {
  title: '添加节点',
  allowedTypes: () => nodeTypeOrder
})

const emit = defineEmits<{
  select: [type: WorkflowNodeType]
}>()

// 统一节点列表分组：脚本放在基础节点，资源放在添加资源分组
const basicNodeList = computed(() =>
  props.allowedTypes.filter((type) => ['text', 'image', 'video', 'videoCompose', 'audio', 'script'].includes(type))
)
const resourceNodeList = computed(() =>
  props.allowedTypes.filter((type) => ['resource'].includes(type))
)
</script>

<template>
  <div class="panel-glass w-[240px] rounded-2xl px-4 py-3">
    <p class="mb-2 text-sm text-textMuted">{{ title }}</p>
    <div class="space-y-1">
      <button
        v-for="nodeType in basicNodeList"
        :key="nodeType"
        class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
        @click="emit('select', nodeType)"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs text-neon">{{ nodeTypePreset[nodeType].icon }}</span>
        <span>
          <span class="block text-sm font-semibold">{{ nodeTypePreset[nodeType].label }}</span>
          <small class="text-xs text-textMuted">{{ nodeTypePreset[nodeType].description }}</small>
        </span>
      </button>
    </div>

    <template v-if="resourceNodeList.length > 0">
      <p class="mb-2 mt-3 text-sm text-textMuted">添加资源</p>
      <div class="space-y-1">
        <button
          v-for="nodeType in resourceNodeList"
          :key="nodeType"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
          @click="emit('select', nodeType)"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs text-neon">{{ nodeTypePreset[nodeType].icon }}</span>
          <span class="text-sm font-semibold">{{ nodeTypePreset[nodeType].label }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
