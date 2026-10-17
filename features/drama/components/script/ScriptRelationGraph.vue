<script setup lang="ts">
import { Focus, Maximize2, ZoomIn, ZoomOut } from '@lucide/vue'

export type ScriptRelationNode = {
  key: string
  name: string
  role: string
  /**
   * x/y 保留为后端兼容字段。新版关系图采用“当前人物居中”的自适应布局，
   * 不再直接信任模型坐标，避免多个人物落在同一位置产生叠影。
   */
  x: number
  y: number
  tone: 'hero' | 'danger' | 'success' | 'purple' | 'orange' | 'sky'
}

export type ScriptRelationLink = {
  from: string
  to: string
  label: string
  color: string
  direction?: 'forward' | 'both' | 'none'
}

const props = defineProps<{
  nodes: ScriptRelationNode[]
  links: ScriptRelationLink[]
  selectedKey?: string
}>()

const emit = defineEmits<{
  (event: 'select', characterKey: string): void
}>()

const chartEl = ref<HTMLDivElement | null>(null)
const rootEl = ref<HTMLDivElement | null>(null)
const zoom = ref(1)
let chartInstance: import('echarts').ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const toneStyleMap: Record<ScriptRelationNode['tone'], { border: string; bg: string; text: string; shadow?: string }> = {
  hero: { border: '#7db4ff', bg: '#EEF2FF', text: '#4F46E5', shadow: 'rgba(59,130,246,0.22)' },
  danger: { border: '#fecaca', bg: '#fff1f2', text: '#dc2626' },
  success: { border: '#bbf7d0', bg: '#f0fdf4', text: '#047857' },
  purple: { border: '#ddd6fe', bg: '#f5f3ff', text: '#7c3aed' },
  orange: { border: '#fed7aa', bg: '#fff7ed', text: '#ea580c' },
  sky: { border: '#C7D2FE', bg: '#EEF2FF', text: '#4F46E5' }
}

type PixelNode = ScriptRelationNode & {
  px: number
  py: number
  width: number
  height: number
}

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function uniqueNodes() {
  const seenKeys = new Set<string>()
  const seenNames = new Set<string>()
  return props.nodes.filter((node) => {
    const key = String(node.key || '').trim()
    const name = String(node.name || '').trim()
    if (!key || !name || seenKeys.has(key) || seenNames.has(name)) return false
    seenKeys.add(key)
    seenNames.add(name)
    return true
  })
}

function buildPixelNodes(width: number, height: number) {
  /**
   * 当前人物固定在画布中心，其余人物按椭圆环绕：
   * - 不再使用模型生成的重复坐标；
   * - 横向画布采用更宽的半径，充分利用空间；
   * - 人物较多时自动缩小节点，仍保留足够安全边距。
   */
  // 必须使用真实画布尺寸计算节点位置。此前强制按 760px 布局，
  // 在右侧体检面板挤压主内容时会把人物节点排到可视区之外。
  const safeWidth = Math.max(width, 320)
  const safeHeight = Math.max(height, 320)
  const rows = uniqueNodes()
  const selectedIndex = Math.max(0, rows.findIndex((node) => node.key === props.selectedKey))
  const selectedNode = rows[selectedIndex] || rows[0]
  const surrounding = rows.filter((node) => node.key !== selectedNode?.key)
  const dense = rows.length > 6
  const centerX = safeWidth / 2
  const centerY = safeHeight / 2
  const radiusX = Math.min(safeWidth * 0.34, 390)
  const radiusY = Math.min(safeHeight * 0.32, 145)

  return rows.map<PixelNode>((node) => {
    const isSelected = node.key === selectedNode?.key
    const width = isSelected ? (dense ? 142 : 156) : (dense ? 122 : 136)
    const height = isSelected ? 70 : 62
    if (isSelected) {
      return { ...node, width, height, px: centerX, py: centerY }
    }

    const index = surrounding.findIndex((item) => item.key === node.key)
    // 三个外围人物采用“上、右下、左下”的稳定三角形。
    // 这样外围人物之间的关系线会沿三角形边缘通过，不会从中央人物白色节点下方穿过。
    const startAngle = -90
    const angle = (startAngle + (360 / Math.max(1, surrounding.length)) * index) * (Math.PI / 180)
    const px = centerX + Math.cos(angle) * radiusX
    const py = centerY + Math.sin(angle) * radiusY
    return {
      ...node,
      width,
      height,
      px: clamp(px, width / 2 + 34, safeWidth - width / 2 - 34),
      py: clamp(py, height / 2 + 48, safeHeight - height / 2 - 64)
    }
  })
}

function rectangleBoundaryPoint(from: PixelNode, to: PixelNode): Point {
  /**
   * 关系线只绘制到胶囊节点边界，不再从节点中心穿过。
   * 这是修复“白色节点背景遮住关系线”和重叠残影的关键。
   */
  const dx = to.px - from.px
  const dy = to.py - from.py
  const halfWidth = from.width / 2 + 2
  const halfHeight = from.height / 2 + 2
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 0.0001)
  return { x: from.px + dx * scale, y: from.py + dy * scale }
}

function buildArrow(point: Point, from: Point, color: string, reverse = false) {
  const dx = point.x - from.x
  const dy = point.y - from.y
  const length = Math.max(Math.hypot(dx, dy), 1)
  const direction = reverse ? -1 : 1
  const ux = (dx / length) * direction
  const uy = (dy / length) * direction
  const size = 9
  const wing = 4.5
  return {
    type: 'polygon',
    silent: true,
    shape: {
      points: [
        [point.x, point.y],
        [point.x - ux * size - uy * wing, point.y - uy * size + ux * wing],
        [point.x - ux * size + uy * wing, point.y - uy * size - ux * wing]
      ]
    },
    style: { fill: color, opacity: 0.82 }
  }
}

function buildLineElement(link: ScriptRelationLink, from: PixelNode, to: PixelNode) {
  const start = rectangleBoundaryPoint(from, to)
  const end = rectangleBoundaryPoint(to, from)
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(Math.hypot(dx, dy), 1)

  // 标签完全移到连线法线外侧，避免标签的浅色底再次遮住关系线。
  const labelOffset = 24
  const labelX = midX + (-dy / length) * labelOffset
  const labelY = midY + (dx / length) * labelOffset
  const direction = link.direction || 'both'
  const elements: Array<Record<string, unknown>> = [
    {
      type: 'line',
      silent: true,
      shape: { x1: start.x, y1: start.y, x2: end.x, y2: end.y },
      style: { stroke: link.color, lineWidth: 2.2, opacity: 0.74 }
    }
  ]

  if (direction === 'forward' || direction === 'both') elements.push(buildArrow(end, start, link.color))
  if (direction === 'both') elements.push(buildArrow(start, end, link.color))
  elements.push({
    type: 'group',
    silent: true,
    x: labelX,
    y: labelY,
    children: [
      {
        type: 'rect',
        shape: { x: -38, y: -12, width: 76, height: 24, r: 8 },
        style: { fill: 'rgba(248,250,252,0.96)', stroke: `${link.color}33`, lineWidth: 1 }
      },
      {
        type: 'text',
        style: {
          x: 0,
          y: 1,
          text: link.label,
          fill: link.color,
          font: '700 12px sans-serif',
          align: 'center',
          verticalAlign: 'middle'
        }
      }
    ]
  })
  return elements
}

function buildNodeElement(node: PixelNode) {
  const tone = toneStyleMap[node.tone]
  const isSelected = node.key === props.selectedKey
  const x = node.px - node.width / 2
  const y = node.py - node.height / 2

  return {
    type: 'group',
    x,
    y,
    cursor: 'pointer',
    onclick: () => emit('select', node.key),
    children: [
      {
        type: 'rect',
        shape: { x: 0, y: 0, width: node.width, height: node.height, r: node.height / 2 },
        style: {
          fill: tone.bg,
          stroke: isSelected ? '#4F46E5' : tone.border,
          lineWidth: isSelected ? 3 : 1.6,
          shadowBlur: isSelected ? 18 : 5,
          shadowColor: isSelected ? 'rgba(15,103,255,0.22)' : tone.shadow || 'rgba(15,23,42,0.05)'
        }
      },
      {
        type: 'text',
        style: {
          x: node.width / 2,
          y: node.height / 2 - 9,
          text: node.name,
          fill: tone.text,
          font: `${isSelected ? '800 18px' : '800 16px'} sans-serif`,
          align: 'center',
          verticalAlign: 'middle'
        }
      },
      {
        type: 'text',
        style: {
          x: node.width / 2,
          y: node.height / 2 + 15,
          text: node.role,
          fill: tone.text,
          font: '600 12px sans-serif',
          align: 'center',
          verticalAlign: 'middle',
          opacity: 0.9
        }
      }
    ]
  }
}

async function renderChart() {
  if (!chartEl.value) return
  const echarts = await import('echarts')
  chartInstance ||= echarts.init(chartEl.value)

  const width = chartEl.value.clientWidth || 900
  const height = chartEl.value.clientHeight || 420
  const pixelNodes = buildPixelNodes(width, height)
  const nodeMap = new Map(pixelNodes.map((node) => [node.key, node]))
  const lineElements = props.links.flatMap((link) => {
    const from = nodeMap.get(link.from)
    const to = nodeMap.get(link.to)
    if (!from || !to || from.key === to.key) return []
    return buildLineElement(link, from, to)
  })
  const nodeElements = pixelNodes.map(buildNodeElement)
  const scaledX = (width * (1 - zoom.value)) / 2
  const scaledY = (height * (1 - zoom.value)) / 2

  chartInstance.setOption({
    animationDurationUpdate: 260,
    graphic: {
      elements: [{
        type: 'group',
        x: scaledX,
        y: scaledY,
        scaleX: zoom.value,
        scaleY: zoom.value,
        children: [...lineElements, ...nodeElements]
      }]
    }
  }, true)
}

function updateZoom(next: number) {
  zoom.value = clamp(next, 0.8, 1.35)
  void renderChart()
}

function resetView() {
  zoom.value = 1
  void renderChart()
}

async function toggleFullscreen() {
  if (!rootEl.value) return
  if (document.fullscreenElement) await document.exitFullscreen()
  else await rootEl.value.requestFullscreen()
}

onMounted(async () => {
  await renderChart()
  if (chartEl.value) {
    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize()
      void renderChart()
    })
    resizeObserver.observe(chartEl.value)
  }
})

watch(() => [props.nodes, props.links, props.selectedKey], () => void renderChart(), { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div
    ref="rootEl"
    class="relative h-full min-h-[420px] w-full overflow-hidden rounded-[18px] border border-[#e2e8f0] bg-[radial-gradient(circle,#E0E7FF_1px,transparent_1px)] [background-size:22px_22px]"
  >
    <div ref="chartEl" class="h-full min-h-[420px] w-full" />

    <div class="absolute right-3 top-3 flex items-center gap-1 rounded-[10px] border border-[#dbe7f7] bg-white/95 p-1 shadow-sm">
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-[7px] text-[#475569] hover:bg-[#eef5ff] hover:text-[#4F46E5]" title="缩小" @click="updateZoom(zoom - 0.1)"><ZoomOut class="h-4 w-4" /></button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-[7px] text-[#475569] hover:bg-[#eef5ff] hover:text-[#4F46E5]" title="恢复居中" @click="resetView"><Focus class="h-4 w-4" /></button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-[7px] text-[#475569] hover:bg-[#eef5ff] hover:text-[#4F46E5]" title="放大" @click="updateZoom(zoom + 0.1)"><ZoomIn class="h-4 w-4" /></button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-[7px] text-[#475569] hover:bg-[#eef5ff] hover:text-[#4F46E5]" title="全屏查看" @click="toggleFullscreen"><Maximize2 class="h-4 w-4" /></button>
    </div>

    <div class="absolute bottom-3 left-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-[#dbe7f7] bg-white/94 px-3 py-2 text-xs text-[#64748b] shadow-sm">
      <span class="font-semibold text-[#334155]">关系图例</span>
      <span class="flex items-center gap-1.5"><i class="h-0.5 w-4 bg-[#ef4444]" />敌对 / 压迫</span>
      <span class="flex items-center gap-1.5"><i class="h-0.5 w-4 bg-[#4F46E5]" />守护 / 合作</span>
      <span class="flex items-center gap-1.5"><i class="h-0.5 w-4 bg-[#7c3aed]" />价值观关联</span>
      <span class="flex items-center gap-1.5"><i class="h-0.5 w-4 bg-[#f59e0b]" />依附 / 利益</span>
    </div>
  </div>
</template>
