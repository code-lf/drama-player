/** 选项默认直接回答；只有无选项或模型明确要求编辑时展示专用输入框。 */
export function questionNeedsText(question?: {options?:string[];requires_input?:boolean;kind?:string}|null) {
  if(!question)return false
  if(question.requires_input)return true
  return question.kind!=='reference' && !(question.options||[]).some(option=>!/^自由补充/.test(option))
}

/** 多选统一在确定时组装答案；切换勾选不覆盖用户已经填写的补充文字。 */
export function multipleQuestionAnswer(selected:string[], supplement:string) {
  return [...Array.from(new Set(selected)),supplement.trim()].filter(Boolean).join('、')
}

/** 普通偏好题仅预选待确认答案；事实、授权、素材及要求补充文本的题不猜测，点击下一步才保存。 */
export function preferredQuestionOption(field:{id?:string;kind:string;options?:string[];text?:string;label?:string;requires_input?:boolean}){
  if(!['single','multiple'].includes(field.kind)||field.requires_input)return undefined
  const context=`${field.id||''} ${field.text||field.label||''}`
  if(/确认|同意|授权|付费|费用|扣费|扣点|积分|采购|重新生成|重试|停止|删除|安全|合规|真实|实际支持|已上传|copyright|consent|payment|purchase|retry|confirm/i.test(context))return undefined
  const options=field.options||[]
  // 文件选择/自由补充不是可预填事实；缺少有效选项就交用户填写。
  const candidates=options.filter(value=>!/(上传|已提供|已有素材|自行输入|自由补充|其他|授权|付费|扣费|确认生成|重新生成)/.test(value))
  return candidates.find(value=>/推荐|建议/.test(value))||candidates[0]
}

/** 上传选项是本地素材动作，不是已经提供素材的文字回答；否定和稍后上传仍是普通答案。 */
export function isQuestionUploadOption(option:string){
  if(/稍后|稍等|暂不|不上传|无需|无参考|没有|AI|直接生成/.test(option))return false
  return /^(?:我(?:要|选择)?|选择)?上传(?:图片|参考图|商品图|商品参考图|照片)/.test(option.trim())
}

/** 兼容已落库但被模型误标为文字题的缺图问题，只补素材入口，不代替服务端素材校验。 */
export function questionNeedsReference(question?:{kind?:string;options?:string[];text?:string}|null){
  if(!question)return false
  return question.kind==='reference'||(question.options||[]).some(isQuestionUploadOption)||/(?:未收到|未提供|缺少)[^。\n]{0,25}(?:参考图|图片)|请(?:实际)?上传(?:图片|商品图|参考图)/.test(question.text||'')
}
