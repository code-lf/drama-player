import type {CreationRun,VideoPlan} from '~/shared/api/services/creationService'
import type {SessionResult} from './resultCatalog'

/** 改稿页只回看同一已授权会话的原作品；草稿不冒充新任务完成，未知/失败任务不作为结果。 */
export function workbenchMedia(runId:string,plan:VideoPlan,runs:CreationRun[]):Array<{itemId:string;inherited:boolean;result:SessionResult}>{
  const current=runs.find(run=>run.id===runId)
  const session=current?.session_id
  const lineage:Array<{id:string;plan:VideoPlan}>=[{id:runId,plan}]
  const seen=new Set([runId])
  let parent=current?.revision_parent
  // 有限追溯并拒绝循环或跨会话来源；只读取现有记录，不创建任务或补写授权。
  while(parent&&session&&lineage.length<20&&!seen.has(parent)){
    const run=runs.find(value=>value.id===parent&&value.session_id===session)
    if(!run?.creative_plan)break
    lineage.push({id:run.id,plan:run.creative_plan});seen.add(parent);parent=run.revision_parent
  }
  return plan.items.flatMap(item=>{
    for(const ancestor of lineage){
      const task=ancestor.plan.batch?.items.find(value=>value.item_id===item.id&&value.status==='succeeded'&&value.task_id)
      const media=task?.results?.find(value=>value.status==='succeeded'&&value.id&&value.video_url)
      if(!task||!media)continue
      return [{itemId:item.id,inherited:ancestor.id!==runId,result:{key:`video:${task.task_id}:${media.id}`,messageId:'',versionKey:media.id,kind:'video' as const,title:item.title,summary:item.title,url:media.video_url,source:{kind:'video' as const,id:task.task_id,result_id:media.id}}}]
    }
    return []
  })
}
