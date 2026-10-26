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
  return plan.status==='submitted'&&!!plan.batch?.items.some(item=>['queued','processing','pending','submitting','result_pending'].includes(item.delivery_status))
}
/** 刷新可恢复已提交的图片批次，不重新取得费用许可。 */
export function hasSubmittedImagePlan(run:{image_plan?:ImageCreativePlan}){
  return run.image_plan?.status==='submitted'&&!!run.image_plan.batch
}
