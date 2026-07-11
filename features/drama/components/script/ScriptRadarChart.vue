<script setup lang="ts">
type RadarDimension = {
  label: string
  value: number
}

const props = defineProps<{
  dimensions: RadarDimension[]
}>()

const chartEl = ref<HTMLDivElement | null>(null)
let chartInstance: import('echarts').ECharts | null = null
let resizeObserver: ResizeObserver | null = null

async function renderChart() {
  if (!chartEl.value) return

  // ECharts 依赖浏览器 DOM 和 canvas，Nuxt SSR 阶段不能直接 import 初始化。
  // 这里放在客户端运行时动态加载，避免刷新/构建时出现 window 未定义或 500。
  const echarts = await import('echarts')
  chartInstance ||= echarts.init(chartEl.value)

  const safeDimensions = props.dimensions.length
    ? props.dimensions
    : [
        { label: '故事结构', value: 82 },
        { label: '人物动机', value: 76 },
        { label: '短剧节奏', value: 78 },
        { label: '制作难度', value: 72 },
        { label: '商业钩子', value: 75 }
      ]

  chartInstance.setOption(
    {
      animation: true,
      animationDuration: 420,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      radar: {
        center: ['50%', '54%'],
        radius: '58%',
        splitNumber: 4,
        indicator: safeDimensions.map((item) => ({
          name: item.label,
          max: 100
        })),
        axisName: {
          color: '#475569',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 18,
          padding: [2, 4]
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
  <div ref="chartEl" class="h-52 w-full" />
</template>
