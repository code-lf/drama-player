<script setup lang="ts">
import { useStoryboardStudioStore } from '~/features/storyboard/store/useStoryboardStudioStore'
import { useCanvasStore } from '~/features/canvas/store/useCanvasStore'
import type { StoryboardRow } from '~/entities/storyboard/types'

const props = defineProps<{
  rows: StoryboardRow[]
  loading: boolean
}>()

const studioStore = useStoryboardStudioStore()
const canvasStore = useCanvasStore()

const mode = ref<'table' | 'card'>('table')
const showModeMenu = ref(false)
const isFullscreen = ref(false)
const showArrangeMenu = ref(false)
const activeCardId = ref('')

const panelPosition = ref({ x: 560, y: 120 })
const dragging = ref(false)
let offsetX = 0
let offsetY = 0

const tableHeaders = ['镜号', '时长', '画面描述', '角色', '景别', '动作', '情绪', '音效', '分镜提示词', '视频运动提示词']

const sortedRows = computed(() => [...props.rows].sort((a, b) => a.shotNo - b.shotNo))

const panelStyle = computed(() => {
  if (isFullscreen.value) return {}

  return {
    left: `${panelPosition.value.x}px`,
    top: `${panelPosition.value.y}px`,
    width: '980px',
    height: '500px'
  }
})

const arrangeClass = computed(() => {
  if (studioStore.arrangeMode === 'horizontal') {
    return 'flex gap-3 overflow-x-auto overflow-y-hidden'
  }

  if (studioStore.arrangeMode === 'vertical') {
    return 'flex flex-col gap-3 overflow-y-auto'
  }

  return 'grid grid-cols-2 gap-3 xl:grid-cols-3'
})

const selectedCount = computed(() => studioStore.selectedShotCount)
const totalCount = computed(() => sortedRows.value.length)
const linkedScriptNodeId = computed(() => canvasStore.nodes.find((node) => node.type === 'script')?.id ?? '')
// 分镜工作区由 storyboard 节点驱动定位，保证它在流程图里可被连线
const storyboardNode = computed(() => canvasStore.nodes.find((node) => node.type === 'storyboard'))
const storyboardNodeId = computed(() => storyboardNode.value?.id ?? '')
const isStoryboardSelected = computed(() => canvasStore.selectedNodeId === storyboardNodeId.value)
const isStoryboardPanelActive = computed(() => isStoryboardSelected.value || canvasStore.selectedNodeId === linkedScriptNodeId.value)

watch(
  sortedRows,
  (rows) => {
    // 同步总镜头数给脚本配置区，保证“已选脚本 x/x”实时准确
    studioStore.setTotalShotCount(rows.length)

    // 首次进入时默认全选，便于直接执行“批量生成视频”
    if (studioStore.selectedShotCount === 0 && rows.length > 0) {
      studioStore.replaceSelectedShots(rows.map((row) => row.id))
    }
  },
  { immediate: true }
)

function switchMode(nextMode: 'table' | 'card'): void {
  mode.value = nextMode
  showModeMenu.value = false
}

function onDragMove(event: MouseEvent): void {
  if (!dragging.value || isFullscreen.value) return

  panelPosition.value.x = Math.max(80, event.clientX - offsetX)
  panelPosition.value.y = Math.max(70, event.clientY - offsetY)

  // 拖动面板时同步更新 storyboard 节点坐标，让连线端点跟随面板移动
  if (storyboardNodeId.value) {
    canvasStore.updateNodePosition(storyboardNodeId.value, panelPosition.value.x, panelPosition.value.y + 200)
  }
}

function stopDrag(): void {
  dragging.value = false
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', stopDrag)
}

function startDrag(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  if (isFullscreen.value) return

  dragging.value = true
  offsetX = event.clientX - panelPosition.value.x
  offsetY = event.clientY - panelPosition.value.y

  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', stopDrag)
}

function isSelected(shotId: string): boolean {
  return studioStore.selectedShotIds.includes(shotId)
}

function toggleShot(shotId: string): void {
  studioStore.toggleShotSelection(shotId)
}

function setArrangeMode(modeValue: 'grid' | 'horizontal' | 'vertical'): void {
  studioStore.setArrangeMode(modeValue)
  showArrangeMenu.value = false
}

function runTopAction(action: string): void {
  // 前端阶段：操作按钮先做交互占位，后续接真实批处理接口
  // eslint-disable-next-line no-console
  console.info('[livliv] 创意视图批量操作（前端占位）', {
    action,
    selected: studioStore.selectedShotIds
  })
}

function openCardDetail(rowId: string): void {
  activeCardId.value = rowId
}

function focusLinkedScriptNode(): void {
  // 点击分镜卡片时同时聚焦分镜节点（连线主体）与脚本节点（配置面板主体）
  if (storyboardNodeId.value) {
    canvasStore.setSelectedNode(storyboardNodeId.value)
  }
}

const activeCard = computed(() => sortedRows.value.find((row) => row.id === activeCardId.value))

onBeforeUnmount(() => {
  stopDrag()
})

watch(
  storyboardNode,
  (node) => {
    if (!node || isFullscreen.value) return

    // 面板左上角与节点锚点保持固定偏移，保证连线视觉连接到卡片左侧中部
    panelPosition.value = {
      x: node.position.x,
      y: Math.max(70, node.position.y - 200)
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => canvasStore.selectedNodeId,
  (selectedNodeId) => {
    // 选中分镜卡片时，让下方配置区切到脚本节点交互（显示“重新生成/生成分镜”）
    if (!selectedNodeId || selectedNodeId !== storyboardNodeId.value || !linkedScriptNodeId.value) return
    canvasStore.setSelectedNode(linkedScriptNodeId.value)
  }
)
</script>

<template>
  <section
    class="panel-glass z-20 rounded-2xl p-3"
    :class="[
      isFullscreen ? 'fixed inset-4' : 'absolute',
      isStoryboardPanelActive ? 'border border-neon/70 shadow-[0_0_0_1px_rgba(60,221,255,0.35),0_18px_55px_rgba(33,166,255,0.2)]' : ''
    ]"
    :style="panelStyle"
    @mousedown.stop="focusLinkedScriptNode"
    @click.stop
  >
    <header class="mb-2 flex cursor-move items-center justify-between border-b border-borderSoft/70 pb-2" @mousedown="startDrag">
      <p class="truncate text-lg font-semibold">我在盛唐写天下</p>

      <div class="relative flex items-center gap-2">
        <button class="rounded-md px-2 py-1 text-sm text-white/90 transition hover:bg-white/10" @click="showModeMenu = !showModeMenu">
          {{ mode === 'table' ? '脚本视图' : '创意视图' }} {{ showModeMenu ? '▴' : '▾' }}
        </button>

        <button class="rounded-md px-2 py-1 text-sm text-white/90 transition hover:bg-white/10" @click="isFullscreen = !isFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>

        <div v-if="showModeMenu" class="panel-glass absolute right-[96px] top-9 w-[120px] rounded-lg p-1">
          <button
            class="w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10"
            :class="mode === 'table' ? 'text-neon' : ''"
            @click="switchMode('table')"
          >
            脚本视图
          </button>
          <button
            class="w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/10"
            :class="mode === 'card' ? 'text-neon' : ''"
            @click="switchMode('card')"
          >
            创意视图
          </button>
        </div>
      </div>
    </header>

    <div v-if="loading" class="h-[390px] animate-pulse rounded-xl bg-panelSoft" />

    <template v-else>
      <div v-if="mode === 'table'" class="h-[calc(100%-42px)] overflow-auto rounded-xl border border-borderSoft">
        <table class="min-w-[1400px] table-fixed border-collapse text-xs">
          <thead class="sticky top-0 bg-[#2f3136] text-left text-textMuted">
            <tr>
              <th v-for="header in tableHeaders" :key="header" class="whitespace-nowrap border-b border-borderSoft px-3 py-2">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedRows" :key="row.id" class="border-b border-borderSoft/70 align-top">
              <td class="px-3 py-2">{{ row.shotNo }}</td>
              <td class="px-3 py-2">{{ row.durationSec }}s</td>
              <td class="px-3 py-2">{{ row.sceneDescription }}</td>
              <td class="px-3 py-2">{{ row.role }}</td>
              <td class="px-3 py-2">{{ row.shotType }}</td>
              <td class="px-3 py-2">{{ row.action }}</td>
              <td class="px-3 py-2">{{ row.mood }}</td>
              <td class="px-3 py-2">{{ row.soundFx }}</td>
              <td class="px-3 py-2">{{ row.storyboardPrompt }}</td>
              <td class="px-3 py-2">{{ row.cameraPrompt }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="relative h-[calc(100%-42px)] overflow-hidden">
        <div class="mb-2 flex items-center justify-center">
          <div class="panel-glass relative flex items-center gap-1 rounded-xl px-2 py-1">
            <button class="rounded-md px-3 py-1 text-sm hover:bg-white/10" @click="showArrangeMenu = !showArrangeMenu">宫格/排列</button>
            <button class="rounded-md px-3 py-1 text-sm hover:bg-white/10" @click="runTopAction('regenerate')">重新生成</button>
            <button class="rounded-md px-3 py-1 text-sm hover:bg-white/10" @click="runTopAction('batchVideo')">批量生成视频</button>
            <button class="rounded-md px-3 py-1 text-sm hover:bg-white/10" @click="runTopAction('ungroup')">解组</button>
            <button class="rounded-md px-3 py-1 text-sm hover:bg-white/10" @click="runTopAction('download')">批量下载</button>

            <div v-if="showArrangeMenu" class="panel-glass absolute left-0 top-11 w-[160px] rounded-xl p-1">
              <button class="mb-1 w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white/10" @click="setArrangeMode('grid')">宫格排列</button>
              <button class="mb-1 w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white/10" @click="setArrangeMode('horizontal')">水平排列</button>
              <button class="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white/10" @click="setArrangeMode('vertical')">垂直排列</button>
            </div>
          </div>
        </div>

        <div class="h-[calc(100%-118px)] overflow-auto rounded-xl border border-borderSoft p-2">
          <div :class="arrangeClass">
            <article
              v-for="row in sortedRows"
              :key="row.id"
              class="relative rounded-xl border border-borderSoft bg-panelSoft p-3 text-left"
              :class="studioStore.arrangeMode === 'horizontal' ? 'w-[300px] shrink-0' : ''"
              @click="openCardDetail(row.id)"
            >
              <label class="absolute left-3 top-3 flex items-center gap-2 text-xs">
                <input type="checkbox" :checked="isSelected(row.id)" @change.stop="toggleShot(row.id)" />
                <span class="rounded-full bg-black px-2 py-1">{{ row.shotNo }}</span>
              </label>

              <span class="absolute right-3 top-3 rounded-md bg-black px-2 py-1 text-xs">{{ row.durationSec.toFixed(2) }}s</span>

              <div class="mt-8 h-28 rounded-lg border border-white/10 bg-black/20" />

              <div class="mt-2 rounded-lg bg-black/10 p-2">
                <span class="rounded bg-white/10 px-2 py-1 text-xs">{{ row.role }}</span>
                <p class="mt-2 line-clamp-2 text-sm">{{ row.sceneDescription }}</p>
                <p class="mt-1 line-clamp-1 text-xs text-textMuted">{{ row.shotType }} · {{ row.mood }}</p>
                <p class="mt-1 text-xs text-textMuted">场景 {{ row.shotNo }}</p>
              </div>
            </article>
          </div>
        </div>

        <div class="mt-2 flex items-center justify-center">
          <div class="panel-glass flex w-[820px] items-center gap-2 rounded-xl px-3 py-2 text-sm">
            <button class="rounded-md px-2 py-1 text-textMuted hover:bg-white/10">✕</button>
            <div class="rounded-md border border-borderSoft px-2 py-1">{{ studioStore.modelName }}</div>
            <div class="rounded-md border border-borderSoft px-2 py-1">{{ studioStore.resolution }}</div>
            <div class="rounded-md border border-borderSoft px-2 py-1">{{ studioStore.cameraPreset }}</div>
            <div class="ml-auto text-textMuted">已选{{ selectedCount }}/{{ totalCount }}</div>
            <button class="rounded-full bg-neon px-3 py-1 text-slate-900" @click="runTopAction('runBatch')">↑</button>
          </div>
        </div>
      </div>
    </template>
  </section>

  <!-- 镜头卡片详情浮层 -->
  <div v-if="activeCard" class="fixed bottom-24 left-1/2 z-40 w-[640px] -translate-x-1/2">
    <section class="panel-glass rounded-xl p-3">
      <div class="mb-2 flex items-center gap-2">
        <button class="rounded-md border border-borderSoft px-3 py-1 text-sm">标记</button>
        <button class="rounded-md border border-borderSoft px-3 py-1 text-sm">聚焦</button>
      </div>
      <p class="text-sm">{{ activeCard.sceneDescription }}</p>
      <p class="mt-2 text-xs text-textMuted">{{ activeCard.storyboardPrompt }}</p>
      <div class="mt-2 flex items-center gap-2 text-xs text-textMuted">
        <span>{{ studioStore.modelName }}</span>
        <span>{{ studioStore.resolution }}</span>
        <span>{{ studioStore.cameraPreset }}</span>
        <span class="ml-auto">{{ studioStore.selectedShotCount }} 张</span>
      </div>
    </section>
  </div>
</template>
