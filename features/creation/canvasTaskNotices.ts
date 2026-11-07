import type {CreativeNode} from './agentCanvas'

/** 仅按真实成功文件投影最近三批成果；同批多个结果合并提示，不制造新任务或状态。 */
export function canvasCompletionNotices(nodes:CreativeNode[]){
  const groups=new Map<string,{node:CreativeNode;count:number;label:string}>()
  for(const node of nodes){
    const {kind,source,runId,url,status}=node.data
    if(!url||!['succeeded','completed'].includes(status)||!['image','video','audio','compose'].includes(kind))continue
    const composition=source?.kind==='composition'
    const key=composition?`composition:${source.id}`:runId?`${kind}:${runId}`:node.id
    const previous=groups.get(key)
    const count=(previous?.count||0)+1
    const label=composition?'视频合并完成':kind==='image'?'图片生成完成':kind==='audio'?'音乐生成完成':'视频生成完成'
    const unit=kind==='audio'?'首':kind==='image'?'张':'段'
    groups.delete(key);groups.set(key,{node,count,label:count>1?`${count}${unit}${label}`:label})
  }
  return [...groups.values()].slice(-3).reverse()
}
