<script setup lang="ts">
import { nodeTypeOrder } from '~/shared/constants/canvas'
import type { WorkflowNodeType } from '~/entities/canvas/types'
import StudioNodeTypeMenu from '~/features/studio/components/StudioNodeTypeMenu.vue'

const emit = defineEmits<{
  addNode: [type: WorkflowNodeType]
}>()

const showNodeMenu = ref(false)
const showHelpMenu = ref(false)
const showContactMenu = ref(false)

const menuTypes = computed(() => nodeTypeOrder.filter((type) => ['text', 'image', 'video', 'videoCompose', 'audio', 'script', 'resource'].includes(type)))

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

    <div v-if="showNodeMenu" class="absolute left-[62px] top-0" @mouseleave="showNodeMenu = false">
      <StudioNodeTypeMenu :allowed-types="menuTypes" title="添加节点" @select="addNode" />
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
