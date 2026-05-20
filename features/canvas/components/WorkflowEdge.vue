<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'

interface EdgeCallbacks {
  onDeleteEdge?: (edgeId: string) => void
  onSelectEdge?: (edgeId: string) => void
  isSelected?: boolean
  isActiveSource?: boolean
}

const props = defineProps<EdgeProps>()

const hoverEdge = ref(false)
const canShowDelete = ref(false)
const keepVisible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const callbacks = computed(() => (props.data ?? {}) as EdgeCallbacks)
const gradientId = computed(() => `edge-gradient-${props.id.replace(/[^a-zA-Z0-9_-]/g, '')}`)
const edgeSelected = computed(() => Boolean(props.selected || callbacks.value.isSelected))
const edgeActive = computed(() => Boolean(edgeSelected.value || callbacks.value.isActiveSource))

const edgePathInfo = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition
  })
)

const edgePath = computed(() => edgePathInfo.value[0])
const labelX = computed(() => edgePathInfo.value[1])
const labelY = computed(() => edgePathInfo.value[2])

const centerBtnStyle = computed(() => ({
  transform: `translate(-50%, -50%) translate(${labelX.value}px, ${labelY.value}px)`
}))

function clearShowTimer(): void {
  if (!showTimer) return
  clearTimeout(showTimer)
  showTimer = null
}

function clearHideTimer(): void {
  if (!hideTimer) return
  clearTimeout(hideTimer)
  hideTimer = null
}

function handleEdgeEnter(): void {
  hoverEdge.value = true
  clearShowTimer()
  clearHideTimer()

  // 鼠标在线上悬停 2 秒后再显示剪刀
  showTimer = setTimeout(() => {
    canShowDelete.value = true
  }, 1000)
}

function handleEdgeLeave(): void {
  hoverEdge.value = false
  clearShowTimer()
  clearHideTimer()

  // 从线条移动到剪刀按钮时，给一个缓冲时间避免图标瞬间消失
  hideTimer = setTimeout(() => {
    if (!keepVisible.value) {
      canShowDelete.value = false
    }
  }, 140)
}

function handleDeleteEnter(): void {
  clearHideTimer()
  keepVisible.value = true
  canShowDelete.value = true
}

function handleDeleteLeave(): void {
  keepVisible.value = false
  if (!hoverEdge.value) {
    canShowDelete.value = false
  }
}

function deleteEdge(): void {
  callbacks.value.onDeleteEdge?.(props.id)
}

function selectEdge(): void {
  callbacks.value.onSelectEdge?.(props.id)
}
</script>

<template>
  <g @mouseenter="handleEdgeEnter" @mouseleave="handleEdgeLeave" @click.stop="selectEdge">
    <defs>
      <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6ad9ff" />
        <stop offset="45%" stop-color="#9fe6ff" />
        <stop offset="100%" stop-color="#8a74ff" />
        <animate attributeName="x1" values="0%;100%;0%" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="x2" values="100%;200%;100%" dur="1.8s" repeatCount="indefinite" />
      </linearGradient>
    </defs>

    <BaseEdge
      :id="id"
      :path="edgePath"
      :style="{
        stroke: edgeActive ? `url(#${gradientId})` : hoverEdge ? '#63ddff' : '#8ba1bd',
        strokeWidth: edgeActive ? 2.8 : hoverEdge ? 2.4 : 1.6,
        transition: 'all .2s ease'
      }"
    />

    <EdgeLabelRenderer>
      <div class="nodrag nopan pointer-events-none absolute inset-0">
        <div
          class="pointer-events-auto absolute rounded-full border border-white/25 bg-[#1a1f2c]/95 px-2 py-1 transition"
          :class="canShowDelete ? 'opacity-100' : 'opacity-0'"
          :style="centerBtnStyle"
          @mouseenter="handleDeleteEnter"
          @mouseleave="handleDeleteLeave"
        >
          <button
            class="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 text-xs text-white transition hover:border-rose-400 hover:text-rose-300"
            title="删除连线"
            @click.stop="deleteEdge"
          >
            ✂
          </button>
        </div>
      </div>
    </EdgeLabelRenderer>
  </g>
</template>
