<script setup lang="ts">
type RadarDimension = {
  label: string
  value: number
  weight?: number
}

const props = defineProps<{
  dimensions: RadarDimension[]
}>()

const chartEl = ref<HTMLDivElement | null>(null)
const hasRadarData = computed(() => props.dimensions.length >= 3)
let chartInstance: import('echarts').ECharts | null = null
let resizeObserver: ResizeObserver | null = null

async function renderChart() {
  // 单维或双维数据无法形成雷达面，继续绘制只会产生误导性的直线。
  if (!hasRadarData.value) {
    chartInstance?.dispose()
    chartInstance = null
    return
  }
  if (!chartEl.value) return

  // ECharts 依赖浏览器 DOM 和 canvas，Nuxt SSR 阶段不能直接 import 初始化。
  // 这里放在客户端运行时动态加载，避免刷新/构建时出现 window 未定义或 500。
  const echarts = await import('echarts')
  chartInstance ||= echarts.init(chartEl.value)

  const safeDimensions = props.dimensions

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function formatWeight(weight?: number) {
    if (!weight) return ''
    return `${Math.round(weight * 100)}%`
  }

  chartInstance.setOption(
    {
      animation: true,
      animationDuration: 420,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderWidth: 0,
        padding: [10, 12],
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter: () => {
          const rows = safeDimensions.map((item) => {
            const weight = formatWeight(item.weight)
            return `<div style="display:flex;justify-content:space-between;gap:24px;line-height:24px"><span>${escapeHtml(item.label)}</span><b>${Math.round(item.value)}分${weight ? ` · ${weight}` : ''}</b></div>`
          }).join('')
          return `<div style="min-width:190px"><div style="margin-bottom:4px;font-weight:700">维度评分</div>${rows}</div>`
        }
      },
      radar: {
        center: ['50%', '52%'],
        radius: '53%',
        splitNumber: 4,
        indicator: safeDimensions.map((item) => ({
          name: item.label,
          max: 100
        })),
        axisName: {
          color: '#475569',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 17,
          padding: [2, 4],
          // 常态只显示维度名称，分数与权重仅在悬停雷达图形时通过 Tooltip 展示。
          formatter: (name: string) => name,
          rich: {
            label: { color: '#334155', fontSize: 12, fontWeight: 700, lineHeight: 17 }
          }
        },
        axisLine: {
          lineStyle: {
            color: '#d9e6f7'
          }
        },
        splitLine: {
          lineStyle: {
            color: '#d9e6f7'
          }
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(15,103,255,0.035)', 'rgba(15,103,255,0.015)']
          }
        }
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: safeDimensions.map((item) => item.value),
              name: '剧本体检',
              areaStyle: {
                color: 'rgba(15,103,255,0.18)'
              },
              lineStyle: {
                color: '#0f67ff',
                width: 3
              },
              itemStyle: {
                color: '#0f67ff'
              },
              symbol: 'circle',
              symbolSize: 4
            }
          ]
        }
      ]
    },
    true
  )
}

onMounted(async () => {
  await renderChart()
  if (chartEl.value) {
    // 右侧体检卡会随着浏览器宽度变化，ResizeObserver 能让雷达图自动适配容器。
    resizeObserver = new ResizeObserver(() => chartInstance?.resize())
    resizeObserver.observe(chartEl.value)
  }
})

watch(
  () => props.dimensions,
  async () => {
    await nextTick()
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
  <div v-if="hasRadarData" ref="chartEl" class="h-52 w-full" />
  <div v-else class="flex h-52 w-full flex-col items-center justify-center rounded-[14px] border border-dashed border-[#cfe0f6] bg-[#f8fbff] px-5 text-center">
    <p class="text-sm font-semibold text-[#475569]">体检维度数据不足</p>
    <p class="mt-2 text-xs leading-5 text-[#94a3b8]">请免费重试当前体检节点，系统不会用单一维度绘制误导性的雷达图。</p>
  </div>
</template>
