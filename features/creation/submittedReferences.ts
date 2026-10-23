import type { ComposerReference, ComposerSegment } from './types'

/** 仅移走发送时的对象；等待响应期间新增或替换的同版本附件也不能误删。 */
export function remainingReferences(current: ComposerReference[], sent: ComposerReference[]) {
  const submitted = new Set(sent)
  return current.filter(reference => !submitted.has(reference))
}

/** 本轮参考与新附件按固定版本合并，保留原始顺序，不丢失新选版本。 */
export function mergeRoundReferences(round: ComposerReference[], current: ComposerReference[]) {
  return [...round.filter(item => !current.some(value => value.version_id === item.version_id)), ...current]
}

/** 发送期间继续编辑时，把已移走附件的旧标签转成同文文本，避免云草稿出现悬空引用。 */
export function submittedTextSegments(segments:ComposerSegment[],remaining:ComposerReference[]){
  const versions=new Set(remaining.map(item=>item.version_id))
  return segments.map(part=>part.type==='reference'&&!versions.has(part.version_id)?{type:'text' as const,text:part.label}:part)
}
