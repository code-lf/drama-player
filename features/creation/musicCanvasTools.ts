import type {WorkspaceSource} from './types'

export interface CanvasMusicToolOption {code:string;name:string}
export interface CanvasMusicTask {id:string;provider_task_id?:string|null;status?:string|null}
export interface CanvasMusicTrack {status?:string|null;audio_url?:string|null;url?:string|null;audio?:string|null}
export interface CanvasMusicToolRequest {operation:string;sourceTaskId:string;sourceAudioIndex:number}

const readyStatuses=new Set(['completed','succeeded','success'])
// 旧音乐接口的曲目终态为complete，任务本身仍必须满足原完成状态合同。
const readyTrackStatuses=new Set(readyStatuses)
readyTrackStatuses.add('complete')

/** 只向当前原歌曲节点返回服务端启用的操作，处理结果和其他任务不能借用入口。 */
export function listCanvasMusicTools(kind:string|undefined,source:WorkspaceSource|undefined,taskId:string|undefined,options:CanvasMusicToolOption[]):CanvasMusicToolOption[]{
  if(kind!=='audio'||source?.kind!=='music'||source.result_id||!source.id||source.id!==taskId||!Number.isInteger(source.audio_index)||(source.audio_index??-1)<0)return[]
  const seen=new Set<string>()
  return options.flatMap(option=>{
    const code=String(option.code||'').trim(),name=String(option.name||'').trim()
    if(!code||!name||seen.has(code))return[]
    seen.add(code)
    return[{code,name}]
  })
}

/** 执行入口再次核对任务、平台白名单和原歌曲序号；菜单点击本身不发送或授权费用。 */
export function resolveCanvasMusicTool(operation:string,source:WorkspaceSource|undefined,task:CanvasMusicTask|undefined,tracks:CanvasMusicTrack[],options:CanvasMusicToolOption[]):CanvasMusicToolRequest|undefined{
  if(!operation||!task?.id||!task.provider_task_id||!readyStatuses.has(String(task.status||'').toLowerCase()))return
  if(source?.kind!=='music'||source.result_id||source.id!==task.id||!Number.isInteger(source.audio_index)||(source.audio_index??-1)<0)return
  if(!options.some(option=>option.code===operation))return
  const index=source.audio_index!,track=tracks[index]
  if(!track||track.status&&!readyTrackStatuses.has(String(track.status).toLowerCase())||!(track.audio_url||track.url||track.audio))return
  return{operation,sourceTaskId:task.id,sourceAudioIndex:index}
}
