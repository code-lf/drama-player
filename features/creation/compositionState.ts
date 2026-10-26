import type {CompositionPlan,CompositionClip,CompositionJob} from '~/shared/api/services/videoCompositionService'

/** 文件晚于终态到达时只有限重读原记录；超出预算显示待核对，不重新合成。 */
export function advanceCompositionReads<T extends {job:CompositionJob}>(rows:T[],attempts:Map<string,number>){
  let poll=false
  const present=new Set(rows.map(row=>row.job.id))
  for(const id of attempts.keys())if(!present.has(id))attempts.delete(id)
  const values=rows.map(row=>{
    let resultUnavailable=false
    if(row.job.status==='succeeded'&&!row.job.output.public_url){
      const count=(attempts.get(row.job.id)||0)+1;attempts.set(row.job.id,count)
      resultUnavailable=count>5;if(!resultUnavailable)poll=true
    }else{attempts.delete(row.job.id);if(['queued','rendering'].includes(row.job.status))poll=true}
    return {...row,resultUnavailable}
  })
  return {rows:values,poll}
}

/** 从完整列表复制后排序，保留片段身份/素材引用，不修改历史或原列表。 */
export function moveCompositionClip(clips:CompositionClip[],id:string,direction:-1|1):CompositionClip[]{
  const result=clips.map(clip=>({...clip}))
  const index=result.findIndex(clip=>clip.id===id),target=index+direction
  if(index<0||target<0||target>=result.length)return result
  ;[result[index],result[target]]=[result[target]!,result[index]!]
  return result
}

/** 前端仅做即时反馈，正式提交仍由服务端校验权限和真实视频容量。 */
export function compositionErrors(plan:CompositionPlan):string[]{
  const errors:string[]=[]
  if(!plan.clips.length||plan.clips.length>24)errors.push('请选择 1～24 个片段。')
  if(new Set(plan.clips.map(clip=>clip.id)).size!==plan.clips.length)errors.push('片段编号不能重复。')
  let total=0
  for(const [index,clip] of plan.clips.entries()){
    if(!Number.isInteger(clip.trim_start_ms)||!Number.isInteger(clip.trim_end_ms)||clip.trim_start_ms<0||clip.trim_end_ms<=clip.trim_start_ms||clip.trim_start_ms%40||clip.trim_end_ms%40){
      errors.push(`片段 ${index+1} 的切点需递增且对齐 40 毫秒。`)
    }
    total+=clip.trim_end_ms-clip.trim_start_ms
  }
  if(total>180000)errors.push('轻量合成最长三分钟，请调整计划，不会自动截短。')
  const {width,height}=plan.output
  if(![width,height].every(value=>Number.isInteger(value)&&value>=64&&value<=1920&&value%2===0))errors.push('输出宽高须为 64～1920 范围内的偶数。')
  if(plan.output.fps!==25||plan.output.fit!=='contain'||plan.output.transition!=='cut')errors.push('当前仅支持 25fps 留边直切合成。')
  return errors
}

/** 用户可见状态取真实业务记录，排队/处理中没有编造百分比。 */
export function compositionStatus(job:Pick<CompositionJob,'status'>):string{
  return {queued:'等待合成',rendering:'正在合成',succeeded:'合成完成',failed:'合成失败'}[job.status]||'状态待确认'
}
