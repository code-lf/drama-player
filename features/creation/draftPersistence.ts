import type {CreationDraft} from './types'

/** 首页未发送文字仅留本页内存；会话草稿继续完整保存，模型及素材偏好不受影响。 */
export function persistentDraft(value:CreationDraft,scope:string):CreationDraft{
  return scope.startsWith('entry:')?{...value,prompt:'',segments:[]}:value
}
