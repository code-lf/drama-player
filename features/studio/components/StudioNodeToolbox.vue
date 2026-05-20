<script setup lang="ts">
import { nodeTypeOrder, nodeTypePreset } from '~/shared/constants/canvas'
import type { WorkflowNodeType } from '~/entities/canvas/types'

const emit = defineEmits<{
  addNode: [type: WorkflowNodeType]
}>()

const showNodeMenu = ref(false)
const showHelpMenu = ref(false)
const showContactMenu = ref(false)

// 基础节点分组：脚本节点属于“添加节点”，方便按你的工作流先写脚本再下游生成
const basicNodeList = computed(() => nodeTypeOrder.filter((type) => ['text', 'image', 'video', 'videoCompose', 'audio', 'script'].includes(type)))
// 资源分组首期只保留素材类节点；分镜工作区改为全局面板，不再单独作为节点添加
const resourceNodeList = computed(() => nodeTypeOrder.filter((type) => ['resource'].includes(type)))

function addNode(type: WorkflowNodeType): void {
  emit('addNode', type)
  showNodeMenu.value = false
}
</script>

<template>
  <aside class="absolute left-4 top-40 z-30">
    <div class="panel-glass flex w-[64px] flex-col items-center gap-1.5 rounded-2xl py-3">
      <button
        class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-3xl text-white transition hover:bg-white/30"
        title="添加节点"
        @mouseenter="showNodeMenu = true"
        @click="showNodeMenu = !showNodeMenu"
      >
        {{ showNodeMenu ? '×' : '+' }}
      </button>

      <button class="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10" title="打开工具箱">
        ⛓
      </button>
      <button class="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10" title="我的素材">
        ◈
      </button>
      <button class="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10" title="历史记录">
        ◷
      </button>
      <button class="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10" title="使用课程">
        ?
      </button>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10"
        title="快捷键与客服"
        @mouseenter="showHelpMenu = true"
      >
        ☎
      </button>
    </div>

    <div
      v-if="showNodeMenu"
      class="panel-glass absolute left-[62px] top-0 w-[240px] rounded-2xl px-4 py-3"
      @mouseleave="showNodeMenu = false"
    >
      <p class="mb-2 text-sm text-textMuted">添加节点</p>
      <div class="space-y-1">
        <button
          v-for="nodeType in basicNodeList"
          :key="nodeType"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
          @click="addNode(nodeType)"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs text-neon">{{ nodeTypePreset[nodeType].icon }}</span>
          <span>
            <span class="block text-sm font-semibold">{{ nodeTypePreset[nodeType].label }}</span>
            <small class="text-xs text-textMuted">{{ nodeTypePreset[nodeType].description }}</small>
          </span>
        </button>
      </div>

      <p class="mb-2 mt-3 text-sm text-textMuted">添加资源</p>
      <div class="space-y-1">
        <button
          v-for="nodeType in resourceNodeList"
          :key="nodeType"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
          @click="addNode(nodeType)"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs text-neon">{{ nodeTypePreset[nodeType].icon }}</span>
          <span class="text-sm font-semibold">{{ nodeTypePreset[nodeType].label }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="showHelpMenu"
      class="panel-glass absolute left-[62px] bottom-0 w-[120px] rounded-xl p-2"
      @mouseleave="showHelpMenu = false"
    >
      <button class="mb-1 w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10">使用教程</button>
      <button class="w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10">快捷键</button>

      <div class="mt-2 border-t border-borderSoft pt-2">
        <button
          class="w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10"
          @mouseenter="showContactMenu = true"
        >
          联系客服
        </button>
      </div>
    </div>

    <div
      v-if="showContactMenu"
      class="panel-glass absolute left-[188px] bottom-0 w-[130px] rounded-xl p-2"
      @mouseleave="showContactMenu = false"
    >
      <button class="mb-1 w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10">联系客服</button>
      <button class="mb-1 w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10">联系销售</button>
      <button class="w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10">关注公众号</button>
    </div>
  </aside>
</template>
