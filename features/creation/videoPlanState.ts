import type {VideoPlan} from '~/shared/api/services/creationService'

/** 草案回复不是普通闲聊；刷新后仍恢复为可编辑计划，不重新规划或自动核价。 */
export function hasUnsubmittedVideoPlan(run:{status:string;executed_request?:unknown;superseded_by?:string;creative_plan?:Pick<VideoPlan,'status'|'total_count'>}){
  return run.status==='replied'&&!run.executed_request&&!run.superseded_by&&run.creative_plan?.status==='draft'&&run.creative_plan.total_count>=1
}

/** 只产生内容与选择变更，顺序固定为原计划顺序，不发送素材或模型替换。 */
export function videoPlanChanges(plan:VideoPlan, selected:string[], items:Array<{id:string;title:string;prompt:string}>){
  return {
    selected_ids:plan.items.filter(item=>selected.includes(item.id)).map(item=>item.id),
    items:items.filter(item=>{
      const original=plan.items.find(row=>row.id===item.id)
      return !!original&&(original.title!==item.title||original.prompt!==item.prompt)
    }).map(({id,title,prompt})=>({id,title,prompt})),
  }
}

/** 本地任何待保存变更都立即隐藏旧价，不等待保存响应才撤下失效数字。 */
export function videoPlanDirty(plan:VideoPlan, selected:string[], items:Array<{id:string;title:string;prompt:string}>){
  const changes=videoPlanChanges(plan,selected,items)
  const baseline=plan.items.filter(item=>(plan.selected_ids||plan.items.map(row=>row.id)).includes(item.id)).map(item=>item.id)
  return changes.items.length>0||JSON.stringify(changes.selected_ids)!==JSON.stringify(baseline)
}

/** 仅服务端正式准备完成、未过期且选择一致的合计报价可确认，不以按钮文案判断。 */
export function canConfirmVideoBatch(plan:VideoPlan,nowMs:number,dirty=false,readonly=false){
  const quote=plan.quote
  if(dirty||readonly||plan.batch||plan.status!=='draft'||!plan.batch_supported||!quote?.execution_available||!quote.sufficient||quote.expired||quote.expires_at*1000<=nowMs||quote.plan_revision!==plan.revision)return false
  const selection=plan.selected_ids||plan.items.map(item=>item.id)
  return selection.length>0&&new Set(selection).size===selection.length
    &&JSON.stringify(selection)===JSON.stringify(quote.item_ids)
    &&quote.items.length===selection.length
    &&quote.items.every((item,index)=>item.id===selection[index]&&Number.isInteger(item.credits)&&item.credits>=0)
    &&quote.items.reduce((total,item)=>total+item.credits,0)===quote.total_credits
}

/** 提交后刷新仍可恢复批次，已执行不再等同于“应丢弃的草案”。 */
export function hasSubmittedVideoPlan(run:{creative_plan?:Pick<VideoPlan,'status'|'batch'>}){
  return run.creative_plan?.status==='submitted'&&!!run.creative_plan.batch
}

/** 未知/待核对必须保留，不用成功结果数猜剩下任务失败。 */
export function videoBatchStatus(status?:string){
  return ({queued:'排队中',running:'生成中',succeeded:'已完成',failed:'生成失败',cancelled:'已取消',needs_review:'提交状态待核对'} as Record<string,string>)[status||'']||'正在同步状态'
}

/** 仅明确失败且尚未建立重试草案的条目可新建重试；未知、成功、取消均不推断。 */
export function retryableVideoItems(plan:VideoPlan){
  if(!plan.batch_supported||plan.status!=='submitted')return []
  return (plan.batch?.items||[]).filter(task=>task.status==='failed'&&!task.retry_run_id&&plan.items.some(item=>item.id===task.item_id))
}
