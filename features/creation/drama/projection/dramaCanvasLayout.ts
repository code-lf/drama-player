/** 画布布局是独立视图偏好，不写入角色、镜头或生产关系；只接受真实节点的有限坐标。 */
export function normalizeDramaLayout(value: unknown): Record<string, {x: number; y: number}> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).slice(0, 2000).flatMap(([key, raw]) => {
    const point = raw as {x?: unknown; y?: unknown} | null
    return point && typeof point.x === 'number' && typeof point.y === 'number'
      && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 100000 && Math.abs(point.y) <= 100000
      ? [[key, {x: point.x, y: point.y}]] : []
  }))
}
