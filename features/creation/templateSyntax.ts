import type { ComposerSegment } from './types'

/** 预设语法为 {{字段名:默认值}}，实际提交去掉语法，仅保留用户编辑后的文本。 */
export function templateSegments(source: string): Array<Extract<ComposerSegment, { type: 'text' }>> {
  const parts: Array<Extract<ComposerSegment, { type: 'text' }>> = []
  let position = 0
  for (const match of source.matchAll(/\{\{([^{}:：]+)[:：]([^{}]+)\}\}/g)) {
    if (match.index! > position) parts.push({ type: 'text', text: source.slice(position, match.index) })
    parts.push({ type: 'text', field: match[1]!.trim(), text: match[2]! })
    position = match.index! + match[0].length
  }
  if (position < source.length) parts.push({ type: 'text', text: source.slice(position) })
  return parts
}
