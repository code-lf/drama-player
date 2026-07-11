<script setup lang="ts">
export type ScriptRelationNode = {
  key: string
  name: string
  role: string
  /**
   * 这里继续使用 0-100 的设计稿百分比坐标。
   * 组件内部会根据真实容器宽高转换成像素坐标，并自动留出安全边距，防止节点被裁切。
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
}

const props = defineProps<{
  nodes: ScriptRelationNode[]
  links: ScriptRelationLink[]
}>()

const chartEl = ref<HTMLDivElement | null>(null)
let chartInstance: import('echarts').ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const toneStyleMap: Record<ScriptRelationNode['tone'], { border: string; bg: string; text: string; shadow?: string }> = {
  hero: { border: '#7db4ff', bg: '#eff6ff', text: '#0f67ff', shadow: 'rgba(59,130,246,0.22)' },
  danger: { border: '#fecaca', bg: '#fff1f2', text: '#dc2626' },
  success: { border: '#bbf7d0', bg: '#f0fdf4', text: '#047857' },
  purple: { border: '#ddd6fe', bg: '#f5f3ff', text: '#7c3aed' },
  orange: { border: '#fed7aa', bg: '#fff7ed', text: '#ea580c' },
  sky: { border: '#bfdbfe', bg: '#eff6ff', text: '#2563eb' }
}

type PixelNode = ScriptRelationNode & {
  px: number
  py: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function buildPixelNodes(width: number, height: number) {
  /**
   * ECharts 的 graph 自动缩放会让外围节点贴边甚至被裁切。
   * 这里采用“设计百分比坐标 -> 容器像素坐标”的方式，明确给四周留下节点半径和额外呼吸空间。
   */
  const safeWidth = Math.max(width, 760)
  const safeHeight = Math.max(height, 420)
  const padX = 96
  const padY = 58

  return props.nodes.map<PixelNode>((node) => {
    const isHero = node.key === 'hero'
    const nodeWidth = isHero ? 154 : 134
    const nodeHeight = isHero ? 70 : 62
    const px = padX + (node.x / 100) * (safeWidth - padX * 2)
    const py = padY + (node.y / 100) * (safeHeight - padY * 2)

    return {
      ...node,
      width: nodeWidth,
      height: nodeHeight,
      px: clamp(px, nodeWidth / 2 + 18, safeWidth - nodeWidth / 2 - 18),
      py: clamp(py, nodeHeight / 2 + 18, safeHeight - nodeHeight / 2 - 18)
    }
  })
}

function buildLineElement(link: ScriptRelationLink, from: PixelNode, to: PixelNode) {
  const midX = (from.px + to.px) / 2
  const midY = (from.py + to.py) / 2
  const dx = to.px - from.px
  const dy = to.py - from.py
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1)

  // 关系标签沿连线法线方向稍微偏移，避免压在线条正中间导致可读性下降。
  const labelOffset = 12
  const labelX = midX + (-dy / length) * labelOffset
  const labelY = midY + (dx / length) * labelOffset

  return [
    {
      type: 'line',
      silent: true,
      shape: {
        x1: from.px,
        y1: from.py,
        x2: to.px,
        y2: to.py
      },
      style: {
        stroke: link.color,
        lineWidth: 2.4,
        opacity: 0.72
      }
    },
    {
      type: 'group',
      silent: true,
      x: labelX,
      y: labelY,
      children: [
        {
          type: 'rect',
          shape: { x: -34, y: -12, width: 68, height: 24, r: 12 },
          style: {
            fill: 'rgba(255,255,255,0.92)',
            shadowBlur: 8,
            shadowColor: 'rgba(15,23,42,0.08)'
          }
        },
        {
          type: 'text',
          style: {
            x: 0,
            y: 1,
            text: link.label,
            fill: link.color,
            font: '700 13px sans-serif',
            align: 'center',
            verticalAlign: 'middle'
          }
        }
      ]
    }
  ]
}

function buildNodeElement(node: PixelNode) {
  const tone = toneStyleMap[node.tone]
  const x = node.px - node.width / 2
  const y = node.py - node.height / 2

  return {
    type: 'group',
    x,
    y,
    children: [
      {
        type: 'rect',
        shape: {
          x: 0,
          y: 0,
          width: node.width,
          height: node.height,
          r: node.height / 2
        },
        style: {
          fill: tone.bg,
          stroke: tone.border,
          lineWidth: node.key === 'hero' ? 2.4 : 1.6,
          shadowBlur: node.key === 'hero' ? 18 : 6,
          shadowColor: tone.shadow || 'rgba(15,23,42,0.05)'
        }
      },
      {
        type: 'text',
        style: {
          x: node.width / 2,
          y: node.height / 2 - 9,
          text: node.name,
          fill: tone.text,
          font: `${node.key === 'hero' ? '800 19px' : '800 16px'} sans-serif`,
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
          opacity: 0.92
        }
      }
    ]
  }
}

async function renderChart() {
  if (!chartEl.value) return

  // 这里仍然使用 ECharts，但不用 graph 自动布局，而是使用 graphic 精准绘制设计稿式关系板。
  const echarts = await import('echarts')
  chartInstance ||= echarts.init(chartEl.value)

  const width = chartEl.value.clientWidth || 900
  const height = chartEl.value.clientHeight || 420
  const pixelNodes = buildPixelNodes(width, height)
  const nodeMap = new Map(pixelNodes.map((node) => [node.key, node]))

  const lineElements = props.links.flatMap((link) => {
    const from = nodeMap.get(link.from)
    const to = nodeMap.get(link.to)
    if (!from || !to) return []
    return buildLineElement(link, from, to)
  })

  const nodeElements = pixelNodes.map(buildNodeElement)

  chartInstance.setOption(
    {
      animationDurationUpdate: 260,
      // graphic 是 ECharts 的低层图形绘制能力，适合这种“固定 UI 构图”。
      graphic: {
        elements: [...lineElements, ...nodeElements]
      }
    },
    true
  )
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

watch(
  () => [props.nodes, props.links],
  () => {
    void renderChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div
    class="h-full min-h-[420px] w-full overflow-hidden rounded-[18px] border border-[#e2e8f0] bg-[radial-gradient(circle,#dbeafe_1px,transparent_1px)] [background-size:22px_22px]"
  >
    <div ref="chartEl" class="h-full min-h-[420px] w-full" />
  </div>
</template>
