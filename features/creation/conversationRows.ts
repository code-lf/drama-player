import type {CreationMessage} from './types'
import type {CreationRun} from '~/shared/api/services/creationService'
import type {CanvasActivity} from './drama/canvasActivity'
/** 活动流程与历史共享同一时间轴；结果挂在发起流程下，不按完成时间另插一条。 */
export function groupConversation(messages:CreationMessage[],history:CreationRun[],active:CreationRun|null,sessionId?:string,activities:CanvasActivity[]=[]){
  const runs=new Map(history.filter(run=>run.session_id===sessionId).map(run=>[run.id,run]))
  if(active && active.session_id===sessionId)runs.set(active.id,active)
  const rows:Array<{key:string;time:number;run?:CreationRun;activity?:CanvasActivity;active:boolean;media:CreationMessage[];linked:boolean}>=Array.from(runs.values(),run=>({key:run.id,time:Date.parse(run.created_at||'')||0,run,active:run.id===active?.id,media:[],linked:true}))
  for(const media of messages){
    const id=String(media.content.parameters.extra?.creation_run_id||'')
    const parent=rows.find(row=>row.key===id)
    if(parent)parent.media.push(media)
    else rows.push({key:media.id,time:Date.parse(media.created_at)||0,active:false,media:[media],linked:false})
  }
  // 文稿操作进入同一时间线，但不插入或截断连续的模型回答。
  // 行键也用于成果容器的 CSS 选择器，版本复合键不能保留冒号。
  for(const activity of activities)rows.push({key:`activity-${activity.id.replaceAll(':','-')}`,time:Date.parse(activity.created_at)||0,activity,active:false,media:[],linked:false})
  // 浏览器时间只精确到毫秒；同一时刻先展示文稿，再展示使用该文稿的操作。
  return rows.sort((a,b)=>a.time-b.time||Number(b.activity?.kind==='script_file')-Number(a.activity?.kind==='script_file')||a.key.localeCompare(b.key))
}

/** 仅服务端声明的自动接续连接到同一回答；新指令或缺失父轮不猜测合并。 */
export function continuousAnswers(rows:ReturnType<typeof groupConversation>){
  const groups:Array<{key:string;rows:typeof rows}>=[]
  let previous:typeof groups[number]|undefined
  for(const row of rows){
    const parent=row.run?.auto_continuation?.parent_id
    if(parent&&previous?.rows.some(item=>item.run?.id===parent))previous.rows.push(row)
    else{
      const group={key:row.key,rows:[row]}
      groups.push(group)
      if(!row.activity)previous=group
    }
  }
  return groups
}
