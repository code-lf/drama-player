/** 比例以后台白名单与当前清晰度尺寸表的交集为准；无联动规则的旧模型保持原能力。 */
export function imageRatioOptions(schema: Record<string, any>, resolution: string): string[] {
  const base = (schema.aspect_ratio || schema.aspect_ratios || []).map(String)
  const byResolution = schema.aspect_ratios_by_resolution
  if (!byResolution || typeof byResolution !== 'object') return base
  const values = byResolution[resolution.toUpperCase()]
  // 有联动合同但缺少该清晰度时明确不可选，不能回退全部比例。
  return Array.isArray(values) ? base.filter((ratio: string) => values.includes(ratio)) : []
}
