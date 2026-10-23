/** 选项默认直接回答；只有无选项或模型明确要求编辑时展示专用输入框。 */
export function questionNeedsText(question?: {options?:string[];requires_input?:boolean;kind?:string}|null) {
  if(!question)return false
  if(question.requires_input)return true
  return question.kind!=='reference' && !(question.options||[]).some(option=>!/^自由补充/.test(option))
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
