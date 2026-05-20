<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import type { StoryboardRow } from '~/entities/storyboard/types'
import type { WorkflowNode, WorkflowNodeType } from '~/entities/canvas/types'
import { useStoryboardStudioStore } from '~/features/storyboard/store/useStoryboardStudioStore'

interface NodeActionItem {
  key: string
  label: string
}

interface NodeCallbacks {
  onAddPrev?: (nodeId: string) => void
  onAddNext?: (nodeId: string) => void
  storyboardRows?: StoryboardRow[]
  onQuickAddRequest?: (payload: { nodeId: string; side: 'left' | 'right'; clientX: number; clientY: number }) => void
  onLongPressLinkStart?: (payload: { nodeId: string; side: 'left' | 'right'; clientX: number; clientY: number }) => void
}

const props = defineProps<NodeProps>()
const storyboardStore = useStoryboardStudioStore()

const workflowNode = computed(() => props.data?.workflowNode as WorkflowNode | undefined)
const callbacks = computed(() => (props.data ?? {}) as NodeCallbacks)
// 节点选中态：用于高亮边框和控制两侧加号显示
const isNodeSelected = computed(() => Boolean(props.selected))
const storyboardRows = computed(() => callbacks.value.storyboardRows ?? [])

const scriptViewMode = ref<'table' | 'creative'>('table')
const showFullscreen = ref(false)

const isScriptNode = computed(() => workflowNode.value?.type === 'script')
const isGeneratedScriptNode = computed(() => Boolean(isScriptNode.value && workflowNode.value?.nodeConfig.scriptGenerated))

const nodeActionMap: Record<WorkflowNodeType, NodeActionItem[]> = {
  text: [
    { key: 'self', label: '自己编写内容' },
    { key: 'text-video', label: '文生视频' },
    { key: 'image-prompt', label: '图片反推提示词' },
    { key: 'text-music', label: '文字生音乐' }
  ],
  image: [
    { key: 'img2img', label: '图生图' },
    { key: 'upscale', label: '图片高清' }
  ],
  video: [
    { key: 'head-tail', label: '首尾帧生成视频' },
    { key: 'first-frame', label: '首帧生成视频' }
  ],
  videoCompose: [{ key: 'compose-tip', label: '空空如也，请连接视频节点后操作' }],
  audio: [{ key: 'audio-video', label: '音频生视频' }],
  resource: [
    { key: 'upload', label: '上传本地资源' },
    { key: 'library', label: '从图库选择' }
  ],
  script: [
    { key: 'script-plot', label: '剧本生成分镜脚本' },
    { key: 'script-video-ref', label: '视频参考生成分镜脚本' },
    { key: 'script-role', label: '角色生成分镜脚本' }
  ],
  storyboard: []
}

const nodeIconMap: Record<WorkflowNodeType, string> = {
  text: '≡',
  image: '△',
  video: '▶',
  videoCompose: '✂',
  audio: '♫',
  resource: '↥',
  script: '▦',
  storyboard: '▤'
}

const actionItems = computed(() => {
  if (!workflowNode.value) return []
  return nodeActionMap[workflowNode.value.type] ?? []
})

const scriptTableRows = computed(() => [...storyboardRows.value].sort((a, b) => a.shotNo - b.shotNo))

function switchScriptView(mode: 'table' | 'creative'): void {
  scriptViewMode.value = mode
}

function openFullscreen(): void {
  showFullscreen.value = true
}

function closeFullscreen(): void {
  showFullscreen.value = false
}

function switchToRewriteMode(): void {
  storyboardStore.switchWorkMode('rewrite')
}

function switchToStoryboardMode(): void {
  storyboardStore.switchWorkMode('storyboard')
}

function chooseScriptInputMode(mode: 'plot' | 'videoRef' | 'roleRef'): void {
  storyboardStore.switchScriptInputMode(mode)
}

const LONG_PRESS_MS = 320
let plusPressTimer: ReturnType<typeof setTimeout> | null = null
const plusPressed = ref<{
  side: 'left' | 'right'
  nodeId: string
  longTriggered: boolean
  clientX: number
  clientY: number
} | null>(null)

function clearPlusPressTimer(): void {
  if (!plusPressTimer) return
  clearTimeout(plusPressTimer)
  plusPressTimer = null
}

function finishPlusPress(): void {
  clearPlusPressTimer()
  plusPressed.value = null
  window.removeEventListener('mouseup', handlePlusMouseUp)
}

function startPlusPress(event: MouseEvent, side: 'left' | 'right'): void {
  if (!workflowNode.value) return

  const target = event.currentTarget as HTMLElement | null
  const rect = target?.getBoundingClientRect()
  const centerX = rect ? rect.left + rect.width / 2 : event.clientX
  const centerY = rect ? rect.top + rect.height / 2 : event.clientY

  plusPressed.value = {
    side,
    nodeId: workflowNode.value.id,
    longTriggered: false,
    clientX: centerX,
    clientY: centerY
  }

  clearPlusPressTimer()
  plusPressTimer = setTimeout(() => {
    if (!plusPressed.value) return
    plusPressed.value.longTriggered = true
    callbacks.value.onLongPressLinkStart?.({
      nodeId: plusPressed.value.nodeId,
      side: plusPressed.value.side,
      clientX: plusPressed.value.clientX,
      clientY: plusPressed.value.clientY
    })
  }, LONG_PRESS_MS)

  window.addEventListener('mouseup', handlePlusMouseUp)
}

function handlePlusMouseUp(): void {
  if (!plusPressed.value) return

  const pressed = plusPressed.value

  // 短按：弹节点选择列表并自动连线
  if (!pressed.longTriggered) {
    callbacks.value.onQuickAddRequest?.({
      nodeId: pressed.nodeId,
      side: pressed.side,
      clientX: pressed.clientX,
      clientY: pressed.clientY
    })
  }

  finishPlusPress()
}
</script>

<template>
  <article
    v-if="workflowNode"
    class="group relative rounded-[16px] border bg-[#12151f]/95 shadow-[0_10px_40px_rgba(0,0,0,0.45)] transition"
    :class="[
      isGeneratedScriptNode ? 'w-[860px] px-4 py-3' : 'w-[350px] px-5 py-4',
      isNodeSelected ? 'border-neon shadow-[0_0_0_1px_rgba(60,221,255,0.45),0_16px_50px_rgba(33,166,255,0.26)]' : 'border-white/40 hover:border-neon/80'
    ]"
  >
    <div
      v-if="isGeneratedScriptNode && isNodeSelected"
      class="absolute left-1/2 top-[-62px] z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-borderSoft bg-[#20242f]/95 px-2 py-1.5"
    >
      <button
        class="rounded-md px-5 py-2 text-base font-semibold transition"
        :class="storyboardStore.scriptWorkMode === 'rewrite' ? 'bg-neon/15 text-neon' : 'text-white/90 hover:bg-white/10'"
        @click.stop="switchToRewriteMode"
      >
        重新生成
      </button>
      <button
        class="rounded-md px-5 py-2 text-base font-semibold transition"
        :class="storyboardStore.scriptWorkMode === 'storyboard' ? 'bg-neon/15 text-neon' : 'text-white/90 hover:bg-white/10'"
        @click.stop="switchToStoryboardMode"
      >
        生成分镜
      </button>
      <button class="rounded-md px-3 py-2 text-base text-white/90 transition hover:bg-white/10" @click.stop>
        ↓
      </button>
    </div>

    <template v-if="isGeneratedScriptNode">
      <header class="mb-2 flex items-center justify-between border-b border-borderSoft/70 pb-2">
        <p class="truncate text-[32px] font-bold text-white">{{ workflowNode.nodeConfig.title }}</p>

        <div class="relative flex items-center gap-2">
          <button class="rounded-md px-3 py-1.5 text-sm font-semibold transition" :class="scriptViewMode === 'table' ? 'bg-white/15 text-neon' : 'text-white/90 hover:bg-white/10'" @click="switchScriptView('table')">
            脚本视图
          </button>
          <button class="rounded-md px-3 py-1.5 text-sm font-semibold transition" :class="scriptViewMode === 'creative' ? 'bg-white/15 text-neon' : 'text-white/90 hover:bg-white/10'" @click="switchScriptView('creative')">
            创意视图
          </button>
          <button class="rounded-md px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10" @click="openFullscreen">全屏</button>
        </div>
      </header>

      <div v-if="scriptViewMode === 'table'" class="nowheel nodrag nopan max-h-[360px] overflow-auto rounded-xl border border-borderSoft">
        <table class="min-w-[1200px] table-fixed border-collapse text-xs">
          <thead class="sticky top-0 bg-[#2f3136] text-left text-textMuted">
            <tr>
              <th class="w-16 whitespace-nowrap border-b border-borderSoft px-3 py-2">镜号</th>
              <th class="w-16 whitespace-nowrap border-b border-borderSoft px-3 py-2">时长</th>
              <th class="whitespace-nowrap border-b border-borderSoft px-3 py-2">画面描述</th>
              <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">角色</th>
              <th class="w-28 whitespace-nowrap border-b border-borderSoft px-3 py-2">景别</th>
              <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">动作</th>
              <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">情绪</th>
              <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">音效</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in scriptTableRows" :key="row.id" class="border-b border-borderSoft/70 align-top">
              <td class="px-3 py-2">{{ row.shotNo }}</td>
              <td class="px-3 py-2">{{ row.durationSec }}s</td>
              <td class="px-3 py-2">{{ row.sceneDescription }}</td>
              <td class="px-3 py-2">{{ row.role }}</td>
              <td class="px-3 py-2">{{ row.shotType }}</td>
              <td class="px-3 py-2">{{ row.action }}</td>
              <td class="px-3 py-2">{{ row.mood }}</td>
              <td class="px-3 py-2">{{ row.soundFx }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="nowheel nodrag nopan max-h-[360px] overflow-auto rounded-xl border border-borderSoft p-3">
        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <article v-for="row in scriptTableRows" :key="row.id" class="rounded-xl border border-borderSoft bg-panelSoft p-3 text-left">
            <div class="mb-2 flex items-center justify-between">
              <span class="rounded-full bg-black px-2 py-1 text-xs">{{ row.shotNo }}</span>
              <span class="rounded-md bg-black px-2 py-1 text-xs">{{ row.durationSec.toFixed(2) }}s</span>
            </div>
            <div class="h-20 rounded-lg border border-white/10 bg-black/20" />
            <div class="mt-2 rounded-lg bg-black/10 p-2">
              <span class="rounded bg-white/10 px-2 py-1 text-xs">{{ row.role }}</span>
              <p class="mt-2 line-clamp-2 text-sm">{{ row.sceneDescription }}</p>
              <p class="mt-1 line-clamp-1 text-xs text-textMuted">{{ row.shotType }} · {{ row.mood }}</p>
            </div>
          </article>
        </div>
      </div>
    </template>

    <template v-else>
      <header class="mb-3 flex items-center gap-2 text-sm text-textMuted">
        <span class="text-xs">▦</span>
        <span class="font-semibold">{{ workflowNode.nodeConfig.title }}</span>
      </header>

      <div class="flex min-h-[100px] items-center justify-center text-[72px] text-white/25">
        {{ nodeIconMap[workflowNode.type] }}
      </div>

      <div class="mt-3 text-[28px] text-white/35">.</div>

      <div class="space-y-2 pb-2 pt-1 text-[13px]">
        <p class="text-textMuted">尝试：</p>
        <template v-if="workflowNode.type === 'videoCompose'">
          <p class="text-[22px] text-white/30">{{ nodeIconMap[workflowNode.type] }}</p>
        </template>
        <button
          v-for="item in actionItems"
          :key="item.key"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-white/95 transition hover:bg-white/10"
          @click="
            workflowNode.type === 'script' &&
            chooseScriptInputMode(
              item.key === 'script-video-ref'
                ? 'videoRef'
                : item.key === 'script-role'
                  ? 'roleRef'
                  : 'plot'
            )
          "
        >
          <span class="text-xs text-white/80">▣</span>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </template>

    <button
      class="absolute left-[-13px] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-[#1f2432] text-base text-white opacity-0 transition group-hover:opacity-100 hover:border-neon hover:text-neon"
      :class="isNodeSelected ? '!hidden' : ''"
      @mousedown.stop.prevent="startPlusPress($event, 'left')"
    >
      +
    </button>
    <button
      class="absolute right-[-13px] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-[#1f2432] text-base text-white opacity-0 transition group-hover:opacity-100 hover:border-neon hover:text-neon"
      :class="isNodeSelected ? '!hidden' : ''"
      @mousedown.stop.prevent="startPlusPress($event, 'right')"
    >
      +
    </button>
  </article>

  <Teleport to="body">
    <div v-if="showFullscreen" class="fixed inset-0 z-[120] bg-black/85 p-0" @click.self="closeFullscreen">
      <section class="panel-glass flex h-screen w-screen flex-col rounded-none p-4">
        <header class="mb-2 flex items-center justify-between border-b border-borderSoft/70 pb-2">
          <p class="text-2xl font-bold">{{ workflowNode?.nodeConfig.title }}</p>
          <div class="flex items-center gap-2">
            <button class="rounded-md px-3 py-1.5 text-sm font-semibold transition" :class="scriptViewMode === 'table' ? 'bg-white/15 text-neon' : 'hover:bg-white/10'" @click="switchScriptView('table')">脚本视图</button>
            <button class="rounded-md px-3 py-1.5 text-sm font-semibold transition" :class="scriptViewMode === 'creative' ? 'bg-white/15 text-neon' : 'hover:bg-white/10'" @click="switchScriptView('creative')">创意视图</button>
            <button class="rounded-md px-2 py-1 text-sm hover:bg-white/10" @click="closeFullscreen">关闭</button>
          </div>
        </header>

        <div v-if="scriptViewMode === 'table'" class="nowheel nodrag nopan flex-1 overflow-auto rounded-xl border border-borderSoft">
          <table class="min-w-[1400px] table-fixed border-collapse text-xs">
            <thead class="sticky top-0 bg-[#2f3136] text-left text-textMuted">
              <tr>
                <th class="w-16 whitespace-nowrap border-b border-borderSoft px-3 py-2">镜号</th>
                <th class="w-16 whitespace-nowrap border-b border-borderSoft px-3 py-2">时长</th>
                <th class="whitespace-nowrap border-b border-borderSoft px-3 py-2">画面描述</th>
                <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">角色</th>
                <th class="w-28 whitespace-nowrap border-b border-borderSoft px-3 py-2">景别</th>
                <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">动作</th>
                <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">情绪</th>
                <th class="w-24 whitespace-nowrap border-b border-borderSoft px-3 py-2">音效</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in scriptTableRows" :key="`full-${row.id}`" class="border-b border-borderSoft/70 align-top">
                <td class="px-3 py-2">{{ row.shotNo }}</td>
                <td class="px-3 py-2">{{ row.durationSec }}s</td>
                <td class="px-3 py-2">{{ row.sceneDescription }}</td>
                <td class="px-3 py-2">{{ row.role }}</td>
                <td class="px-3 py-2">{{ row.shotType }}</td>
                <td class="px-3 py-2">{{ row.action }}</td>
                <td class="px-3 py-2">{{ row.mood }}</td>
                <td class="px-3 py-2">{{ row.soundFx }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="nowheel nodrag nopan flex-1 overflow-auto rounded-xl border border-borderSoft p-4">
          <div class="grid grid-cols-5 gap-3">
            <article v-for="row in scriptTableRows" :key="`creative-${row.id}`" class="rounded-xl border border-borderSoft bg-panelSoft p-3 text-left">
              <div class="mb-2 flex items-center justify-between">
                <span class="rounded-full bg-black px-2 py-1 text-xs">{{ row.shotNo }}</span>
                <span class="rounded-md bg-black px-2 py-1 text-xs">{{ row.durationSec.toFixed(2) }}s</span>
              </div>
              <div class="h-24 rounded-lg border border-white/10 bg-black/20" />
              <div class="mt-2 rounded-lg bg-black/10 p-2">
                <span class="rounded bg-white/10 px-2 py-1 text-xs">{{ row.role }}</span>
                <p class="mt-2 line-clamp-2 text-sm">{{ row.sceneDescription }}</p>
                <p class="mt-1 line-clamp-1 text-xs text-textMuted">{{ row.shotType }} · {{ row.mood }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
