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
  // 声音与画面分别校验，改短成片后不会偷偷裁切或挪动用户选定的音轨。
  const tracks=plan.audio_tracks||[]
  if(tracks.length>2||new Set(tracks.map(track=>track.id)).size!==tracks.length||new Set(tracks.map(track=>track.role)).size!==tracks.length)errors.push('旁白与背景音乐各限一条，音轨编号不能重复。')
  for(const track of tracks){
    const label=track.role==='narration'?'旁白':'背景音乐'
    if(!['narration','bgm'].includes(track.role)||![track.trim_start_ms,track.trim_end_ms,track.start_ms].every(Number.isInteger)||track.trim_start_ms<0||track.start_ms<0||track.trim_end_ms<=track.trim_start_ms||track.trim_end_ms>180000)errors.push(`${label}的入点和切点需为有效的递增毫秒数。`)
    if(!Number.isFinite(track.volume)||track.volume<0||track.volume>1)errors.push(`${label}音量需为 0～100%。`)
    if(track.start_ms+track.trim_end_ms-track.trim_start_ms>total)errors.push(`${label}超出成片时长，请调整音轨切点或入点。`)
    if(!track.reference?.item_id||!track.reference?.version_id)errors.push(`${label}缺少固定版本，请重新选择。`)
  }
  const {width,height}=plan.output
  if(![width,height].every(value=>Number.isInteger(value)&&value>=64&&value<=1920&&value%2===0))errors.push('输出宽高须为 64～1920 范围内的偶数。')
  if(plan.output.fps!==25||plan.output.fit!=='contain'||plan.output.transition!=='cut')errors.push('当前仅支持 25fps 留边直切合成。')
  return errors
}

/** 用户可见状态取真实业务记录，排队/处理中没有编造百分比。 */
export function compositionStatus(job:Pick<CompositionJob,'status'>):string{
  return {queued:'等待合成',rendering:'正在合成',succeeded:'合成完成',failed:'合成失败'}[job.status]||'状态待确认'
}
/** 历史和新时间轴成片共用只读展示，不把第三版快照回写成旧合同。 */
export function compositionDisplayClips(plan:import('~/shared/api/services/videoCompositionService').CompositionJob['plan']):Array<{id:string;task_id?:string;result_id?:string;reference?:{item_id:string;version_id:string}}>{
  return plan.schema_version===3?plan.visuals.map(clip=>({id:clip.id,...(clip.source.type==='task'?{task_id:clip.source.task_id,result_id:clip.source.result_id}:{reference:{item_id:clip.source.item_id,version_id:clip.source.version_id}})})):plan.clips
}
/** 新合同固定画幅，旧合同仍用原像素比例，不凭文件是否就绪猜规格。 */
export function compositionDisplayRatio(plan:import('~/shared/api/services/videoCompositionService').CompositionJob['plan']){
  return plan.schema_version===3?({'16:9':16/9,'9:16':9/16,'1:1':1}[plan.aspect]):plan.output.width/plan.output.height
}
