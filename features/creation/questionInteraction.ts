/** 选项默认直接回答；只有无选项或模型明确要求编辑时展示专用输入框。 */
export function questionNeedsText(question?: {options?:string[];requires_input?:boolean;kind?:string}|null) {
  if(!question)return false
  if(question.requires_input)return true
  return question.kind!=='reference' && !(question.options||[]).some(option=>!/^自由补充/.test(option))
}
