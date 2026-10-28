/** 只处理系统任务说明，历史返回的接入术语也不能直接展示给用户；不改写用户需求或作品。 */
export function taskStatusText(value:string){
  return value.replace(/供应商正在处理作品/g,'正在生成作品').replace(/供应商反馈[：:]\s*/g,'').replace(/供应商进度/g,'生成进度').replace(/供应商|上游|\bToAPIs?\b/gi,'生成服务')
}

/** 系统长错误只收敛已知模板；完整原因仍保留在接口和提示浮层中。 */
export function compactTaskFailure(value:string){
  const text=taskStatusText(value)
  const retry=text.match(/正在尝试\s*(\d+)\/(\d+)/)
  if(retry)return `生成遇到问题，正在重试 ${retry[1]}/${retry[2]}`
  if(/安全审核|内容审核/.test(text))return '未通过安全审核，请修改需求'
  if(/生成服务暂时异常/.test(text))return '生成失败，请稍后重试'
  if(/生成服务当前任务较多/.test(text))return '任务较多，请稍后重试'
  if(/生成服务响应超时/.test(text))return '响应超时，请稍后查看状态'
  if(/生成参数或参考素材暂不受支持/.test(text))return '参数或素材不支持，请调整后重试'
  if(/当前视频模型.*暂无可用渠道/.test(text))return '当前规格暂不可用，请调整后重试'
  // 长原因在可展开详情中完整保留；摘要不能让一条失败通知占满消息区。
  return text.length>48?'生成未完成，请查看详情':text||'生成失败，请稍后重试'
}

/** 只有真实排队或运行状态可以宣告提交成功，尚未读到状态不能伪装成成功。 */
export function isSubmittedTask(status:string){
  return ['queued','submitting','in_progress','processing','pending','running'].includes(status)
}

/** 多结果任务只完成一部分时，结果卡和进行态同时保留；真正终态才让结果卡接替。 */
export function showTaskNotice(status:string,hasResults:boolean){
  return !hasResults||!['completed','success','succeeded'].includes(status)
}

/** 左侧通知以原任务状态为准，百分比只接受与画布共用的真实活动数据。 */
export function taskNoticeState(status:string,detail='',progress?:number|null,hasTask=true,hasRetryNotice=false){
  const live=['queued','pending','in_progress','processing','running'].includes(status)
  const percent=typeof progress==='number'&&Number.isFinite(progress)&&progress>=0&&progress<=100?progress:null
  if(status==='status_unavailable')return {kind:'sync',text:'正在同步任务状态'}
  if(live){
    const retry=/正在尝试\s*\d+\/\d+/.test(detail)
    const stage=retry?compactTaskFailure(detail):['queued','pending'].includes(status)?'排队中':'正在生成作品'
    return {kind:'running',text:`${stage}${percent===null?'':` · ${percent}%`}`}
  }
  if(['failed','needs_review','result_error'].includes(status)||hasRetryNotice)return {kind:'failed',text:compactTaskFailure(detail)}
  if(status==='submitting')return {kind:'submitted',text:'任务已提交 · 右侧查看进度'}
  if(status==='result_pending')return {kind:'running',text:'正在读取生成结果'}
  if(['completed','success','succeeded'].includes(status))return {kind:'completed',text:'生成已完成'}
  return {kind:'idle',text:status==='cancelled'?'已取消，原作品保留':hasTask?'正在读取任务状态':'需求已保存，请核对报价'}
}
