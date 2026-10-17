import type {CreationMessage} from './types'
import type {CreationRun} from '~/shared/api/services/creationService'
/** 活动流程与历史共享同一时间轴；结果挂在发起流程下，不按完成时间另插一条。 */
export function groupConversation(messages:CreationMessage[],history:CreationRun[],active:CreationRun|null,sessionId?:string){
  const runs=new Map(history.filter(run=>run.session_id===sessionId).map(run=>[run.id,run]))
  if(active && active.session_id===sessionId)runs.set(active.id,active)
  const rows:Array<{key:string;time:number;run?:CreationRun;active:boolean;media:CreationMessage[];linked:boolean}>=Array.from(runs.values(),run=>({key:run.id,time:Date.parse(run.created_at||'')||0,run,active:run.id===active?.id,media:[],linked:true}))
  for(const media of messages){
    const id=String(media.content.parameters.extra?.creation_run_id||'')
    const parent=rows.find(row=>row.key===id)
    if(parent)parent.media.push(media)
    else rows.push({key:media.id,time:Date.parse(media.created_at)||0,active:false,media:[media],linked:false})
  }
  return rows.sort((a,b)=>a.time-b.time||a.key.localeCompare(b.key))
}
