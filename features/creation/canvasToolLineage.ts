import type {SessionResult} from './resultCatalog'
import type {WorkspaceSource} from './types'

/** 按完整业务身份找编辑前原图，不将同任务的另一结果或另一媒体当作对比来源。 */
export function canvasParentImage(source:WorkspaceSource,results:SessionResult[]){
  const same=(a:WorkspaceSource,b:WorkspaceSource)=>a.kind===b.kind&&a.id===b.id&&a.result_id===b.result_id&&a.audio_index===b.audio_index
  const current=results.find(result=>result.kind==='image'&&same(result.source,source))
  if(!current?.parentSource)return undefined
  const parent=results.find(result=>result.kind==='image'&&same(result.source,current.parentSource!))
  return parent?.url||undefined
}
