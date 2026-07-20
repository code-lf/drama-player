import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface FloatingLayerOptions {
  align?: 'left' | 'right'
  gap?: number
  minWidth?: number
  maxHeight?: number
}

/**
 * 统一计算下拉、菜单和提示气泡的位置。
 *
 * 浮层通过 Teleport 挂到 body 后不再受卡片 overflow 或抽屉层叠上下文影响；
 * 这里使用 fixed 坐标，并在滚动、缩放时重新计算，保证浮层始终贴着触发按钮。
 */
export function useFloatingLayer(
  open: Ref<boolean>,
  options: FloatingLayerOptions = {},
) {
  const anchorRef = ref<HTMLElement | null>(null)
  const layerRef = ref<HTMLElement | null>(null)
  const layerStyle = ref<Record<string, string>>({})
  const placement = ref<'top' | 'bottom'>('bottom')

  async function updatePosition(): Promise<void> {
    if (!open.value || !anchorRef.value || !import.meta.client) return
    await nextTick()
    const anchor = anchorRef.value.getBoundingClientRect()
    const layer = layerRef.value?.getBoundingClientRect()
    const gap = options.gap ?? 8
    const viewportGap = 10
    const maxHeight = Math.min(options.maxHeight ?? 320, window.innerHeight - viewportGap * 2)
    const measuredHeight = Math.min(layer?.height || maxHeight, maxHeight)
    const spaceBelow = window.innerHeight - anchor.bottom - viewportGap
    const spaceAbove = anchor.top - viewportGap
    placement.value = spaceBelow < measuredHeight + gap && spaceAbove > spaceBelow ? 'top' : 'bottom'

    /**
     * Teleport 节点刚挂到 body、尚未写入 fixed 样式时，块级元素会临时占满整个视口。
     * 如果把这一次的 layer.width 当成菜单目标宽度，计算结果会接近屏幕宽度，随后被边界算法挤到 left=10px。
     * 菜单实际宽度应由锚点和调用方声明的最小宽度决定；内容过长由 maxWidth 与内部截断处理。
     */
    const desiredWidth = Math.max(options.minWidth || 0, anchor.width)
    let left = options.align === 'right' ? anchor.right - desiredWidth : anchor.left
    left = Math.max(viewportGap, Math.min(left, window.innerWidth - desiredWidth - viewportGap))
    const top = placement.value === 'top'
      ? Math.max(viewportGap, anchor.top - measuredHeight - gap)
      : Math.min(window.innerHeight - viewportGap, anchor.bottom + gap)

    layerStyle.value = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      minWidth: `${Math.round(Math.max(anchor.width, options.minWidth || 0))}px`,
      maxWidth: `calc(100vw - ${viewportGap * 2}px)`,
      maxHeight: `${Math.round(maxHeight)}px`,
      zIndex: '1000',
    }
  }

  function containsTarget(target: EventTarget | null): boolean {
    const node = target as Node | null
    return Boolean(node && (anchorRef.value?.contains(node) || layerRef.value?.contains(node)))
  }

  function handleViewportChange(): void {
    if (open.value) void updatePosition()
  }

  onMounted(() => {
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleViewportChange)
    window.removeEventListener('scroll', handleViewportChange, true)
  })

  return { anchorRef, layerRef, layerStyle, placement, updatePosition, containsTarget }
}
