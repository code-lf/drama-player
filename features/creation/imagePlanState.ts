import type {ImageCreativePlan,ImagePlanEditCommand,ImagePlanParameters} from '~/shared/api/services/creationService'

/** 图片编辑白名单独立于共享媒体表单，不能把视频时长/count/extra提交给图片计划。 */
export function editableImageParameters(value:ImagePlanParameters):ImagePlanParameters{
  const keys=['model','style','styleId','aspectRatio','resolution','quality'] as const
  return Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]])) as ImagePlanParameters
}
/** 保存只包含当前编辑项；总数、其他图片、引用和费用许可均由服务端原计划保留。 */
export function imageItemCommand(plan:ImageCreativePlan,id:string,prompt:string,parameters:ImagePlanParameters,requestId:string):ImagePlanEditCommand{
  const item=plan.items.find(value=>value.id===id)
  if(!item)throw new Error('图片方案已不存在，请刷新核对。')
  return {expected_revision:plan.revision,request_id:requestId,selected_ids:[...plan.selected_ids],
    items:[{id,title:item.title,prompt,parameters:editableImageParameters(parameters)}]}
}
/** 未发布执行能力不冒充可生成；历史停止/替代/已提交的快照只允许查看。 */
export function canEditImagePlan(run:{status:string;executed_request?:unknown;superseded_by?:string},plan:ImageCreativePlan){
  return run.status==='replied'&&!run.executed_request&&!run.superseded_by&&plan.status==='draft'
}
/** 刷新将未执行图片计划恢复为当前可核对轮次，不恢复费用许可或自动核价。 */
export function hasUnsubmittedImagePlan(run:{status:string;executed_request?:unknown;superseded_by?:string;image_plan?:ImageCreativePlan}){
  return !!run.image_plan&&canEditImagePlan(run,run.image_plan)
}
/** 仅排队/执行/有限文件等待继续只读轮询，提交未知或文件超时须显式核对。 */
export function imagePlanNeedsPolling(plan:ImageCreativePlan){
  // 异步报价尚未创建批次时也要只读同步，不能让确认卡永久停在准备状态。
  return (plan.status==='draft'&&plan.quote_delivery==='pending')||(plan.status==='submitted'&&!!plan.batch?.items.some(item=>['queued','processing','pending','submitting','result_pending'].includes(item.delivery_status)))
}
/** 排队不冒充已开始生成；混合批次只要有实际执行项，就显示生成中。 */
export function imagePlanDeliveryLabel(plan:ImageCreativePlan){
  const states=(plan.batch?.items||[]).map(item=>item.delivery_status)
  if(states.some(state=>['processing','result_pending'].includes(state)))return '图片生成中'
  if(states.includes('submitting'))return '正在提交图片任务'
  if(states.some(state=>['queued','pending'].includes(state)))return '图片任务排队中'
  if(plan.batch?.unknown)return '图片任务待核对'
  if(plan.batch?.failed)return '图片任务结果'
  return plan.batch?.completed===plan.batch?.selected_count?'图片已生成':'图片任务结果'
}
/** 刷新可恢复已提交的图片批次，不重新取得费用许可。 */
export function hasSubmittedImagePlan(run:{image_plan?:ImageCreativePlan}){
  return run.image_plan?.status==='submitted'&&!!run.image_plan.batch
}
