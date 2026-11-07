/** POST、事件流及断线读取统一收敛；不同会话、旧调用、旧问题和旧正文快照不得回写。 */
export interface RunSnapshot{id:string;session_id?:string|null;status:string;calls:number;awaiting_calls?:number;question_revision?:number;stream_seq?:number}
export function canAcceptRun(current:RunSnapshot|null|undefined,next:RunSnapshot){
  if(!current||current.id!==next.id||current.session_id!==next.session_id)return false
  // 取消可能先于下一次调用计数落盘，不能被 awaiting_calls 挡住而永远停在思考中。
  if(next.calls<(next.status==='cancelled'?current.calls:Math.max(current.calls,current.awaiting_calls||0)))return false
  if(next.calls===current.calls){
    if((next.question_revision||0)<(current.question_revision||0))return false
    if(current.status!=='planning'&&next.status==='planning')return false
    if(current.status==='cancelled'&&next.status!=='cancelled')return false
    if(current.status==='planning'&&next.status==='planning'&&(next.stream_seq||0)<(current.stream_seq||0))return false
  }
  return true
}
/** 创建首个会话允许服务器分配编号，其余请求必须留在发起时的会话。 */
export function sameRunScope(expected:string|null|undefined,current:string|null|undefined,assigned?:string|null){return expected?current===expected:!current||!!assigned&&current===assigned}
/** 列表只原位追加新产物，轮询先后变化不重排已有缩略图。 */
export function appendResultKeys(previous:string[],available:string[]){const present=new Set(available),known=new Set(previous);return [...previous.filter(key=>present.has(key)),...available.filter(key=>!known.has(key))]}
/** 选中作品不会因其他结果到达而改变，未选中的新来源单独提示。 */
export function unreadResultKeys(previous:string[],available:string[],selected:string){const known=new Set(previous);return available.filter(key=>!known.has(key)&&key!==selected)}
/** 停止确认前持续占用响应态；媒体任务是否运行不参与此门闩，不会顺带取消作品。 */
export function assistantInteraction(state:{preparing:boolean;requesting:boolean;stopping:boolean;phase?:string;countdown:boolean;annotating:boolean}){
  return {working:state.preparing||state.requesting||state.stopping||state.phase==='planning'||state.countdown||state.annotating,
    canStop:!state.preparing&&!state.stopping&&(state.countdown||['planning','waiting'].includes(state.phase||''))}
}
/** 等待用户是进行中的可暂停对话，不是模型仍在请求；刷新从服务端运行状态恢复。 */
export function awaitingCreationDecision(run:{status:string;executed_request?:unknown;superseded_by?:string;card?:{type:string}|null;image_plan?:{status:string}|null;creative_plan?:{status:string}|null}|null|undefined,submitted=false){
  // 确认提交返回的任务早于运行快照刷新时，真实任务引用已足以结束旧确认态。
  if(submitted||!run||run.executed_request||run.superseded_by||['cancelled','failed'].includes(run.status))return false
  return run.status==='waiting'||run.status==='ready'&&run.card?.type==='proposal'||
    ['ready','replied'].includes(run.status)&&(run.image_plan?.status==='draft'||run.creative_plan?.status==='draft')
}
/** 保存响应只确认提交时的来源与编辑快照，不能清空后来切换作品或新增的编辑。 */
export function sameSavedEdit(source:unknown,operations:unknown,currentSource:unknown,currentOperations:unknown){return JSON.stringify(source)===JSON.stringify(currentSource)&&JSON.stringify(operations)===JSON.stringify(currentOperations)}
/** 自由创作配方只属于自由入口；旧云草稿也要修复此组合，不清空会话或素材。 */
export function conversationEntry<T extends string>(entry:T,skill:string):T|'free'{return skill==='free'?'free':entry}
/** 已完成但文件未同步只重读原任务；重试用新的有限预算，不创建任何任务。 */
export function resultReadState(status:string,renderable:boolean,attempt:number){
  if(!['completed','success','succeeded'].includes(status)||renderable)return {status,detail:''}
  return attempt<=5?{status:'result_pending',detail:'正在读取生成结果'}:{status:'result_error',detail:'结果暂未读取成功，请刷新状态重试。'}
}
/** 媒体首次进入终态后重读真实账户；不使用单个任务余额快照覆盖并行任务的余额。 */
export function shouldRefreshTaskBalance(previous:string|undefined,current:string){
  return previous!==current&&['failed','cancelled','completed','success','succeeded','result_error'].includes(current)
}
