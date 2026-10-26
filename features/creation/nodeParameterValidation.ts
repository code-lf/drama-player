import type {CreationCatalog} from './types'
import type {CreativeNodeParameters} from './agentCanvas'
import {imageRatioOptions} from './imageRatioOptions'
import {allowedDurations,referenceDurationValues} from './durationOptions'

/** 仅做真实目录预检，不报价、不修正用户规格；服务端仍保留最终权限和模型校验。 */
export function nodeParameterError(value:CreativeNodeParameters,kind:'image'|'video',catalog:CreationCatalog|null,references:Array<{media_type?:string;purpose?:string}>=[],skill='free'){
  const profile=catalog?.profiles[kind==='video'?'product_video':'product_image']
  const configured=catalog?.skills?.find(row=>row.id===skill)
  const options=profile?[profile.model,...(profile.supports_user_model_selection?profile.allowed_models.filter(row=>row.code!==profile.model.code):[])]:[]
  const models=catalog?.skill_models?.[`${skill}:${kind}`]||options.filter(row=>configured?.model_strategy==='fixed'?row.code===configured.default_model:configured?.model_strategy==='candidates'?(configured.allowed_models||[]).includes(row.code):true)
  const model=models.find(row=>row.code===value.model) as {input_schema?:Record<string,any>}|undefined
  if(!model)return '当前模型不可用，请重新选择'
  const schema=model.input_schema||profile?.input_schema||{}
  if(!imageRatioOptions(schema,value.resolution).includes(value.aspectRatio))return '当前画幅不受所选模型支持，请调整'
  const resolutions=(schema.resolution||schema.resolutions||[]).map((resolution:string)=>kind==='image'?resolution.toUpperCase():resolution.toLowerCase())
  // 480P/480p及1K/1k只是目录显示大小写不同，不能据此误报规格冲突；不改写用户快照或降档。
  if(resolutions.length&&!resolutions.some(resolution=>resolution.toLowerCase()===String(value.resolution||'').toLowerCase()))return '当前清晰度不受所选模型支持，请调整'
  if(kind==='video'){
    const durations=referenceDurationValues(allowedDurations(schema.duration_sec||schema.duration,1,30),schema.duration_constraints,references)
    if(!durations.includes(value.durationSec))return '当前时长或参考素材组合不受所选模型支持，请调整'
  }else if(!(schema.quality||['low','medium','high']).includes(value.quality))return '当前质量不受所选模型支持，请调整'
  return ''
}
