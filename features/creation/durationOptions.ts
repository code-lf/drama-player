/** 将服务端的离散时长或范围步长展开为合法秒数，滑动、键盘和旧入口共用。 */
export function allowedDurations(rule: unknown, floor = 1, ceiling = 120): number[] {
  if (!rule || typeof rule !== 'object') return []
  const r = rule as { min?: number; max?: number; step?: number; enum?: number[]; values?: number[] }
  const discrete = Array.isArray(rule) ? rule : r.enum || r.values
  if (Array.isArray(discrete) && discrete.length) {
    return [...new Set(discrete.map(Number).filter(n => Number.isInteger(n) && n >= floor && n <= ceiling))].sort((a,b) => a-b)
  }
  const min = Math.max(floor, Number(r.min)), max = Math.min(ceiling, Number(r.max)), step = Number(r.step ?? 1)
  if (![min,max,step].every(Number.isInteger) || step < 1 || max < min) return []
  // 步长从原始下界计算；技能最小时长不能把5秒步长平移成7、12秒。
  const start = Number(r.min) + Math.max(0, Math.ceil((min-Number(r.min))/step))*step
  return Array.from({length: Math.max(0, Math.floor((max-start)/step)+1)},(_,i)=>start+i*step)
}

/** 恢复历史值或切换模型时选最近合法值，相同距离保留较短档，不创造中间秒数。 */
export function nearestDurationIndex(values: number[], value: number): number {
  return values.reduce((best,n,index)=>Math.abs(n-value)<Math.abs(values[best]!-value)?index:best,0)
}

/** 按服务端协议排除当前参考素材不支持的时长，不扩大模型原有合法档位。 */
export function referenceDurationValues(values: number[], constraints: unknown, references: Array<{media_type?: string; purpose?: string}>): number[] {
  if (!Array.isArray(constraints)) return values
  const counts: Record<string, number> = {min_images: 0, min_videos: 0, min_audios: 0}
  for (const reference of references) {
    if (reference.media_type === 'video' || reference.purpose === 'reference_video') counts.min_videos!++
    else if (reference.media_type === 'audio') counts.min_audios!++
    else if (reference.media_type === 'image') counts.min_images!++
  }
  const excluded = new Set<number>()
  for (const rule of constraints) {
    // 未识别的条件不自行猜测；服务端最终校验仍是提交边界。
    if (!rule?.when || !Array.isArray(rule.excluded)) continue
    const conditions = Object.entries(rule.when)
    if (conditions.length && conditions.every(([key, count]) => key in counts && Number.isInteger(count) && counts[key]! >= Number(count))) {
      for (const seconds of rule.excluded) if (Number.isInteger(seconds)) excluded.add(seconds)
    }
  }
  return values.filter(seconds => !excluded.has(seconds))
}
