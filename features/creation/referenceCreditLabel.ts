/** 目录参考价只用于输入框提示，不乘取整单价，不产生报价许可或供应商调用。 */
export function referenceCreditLabel(reference?: {credits: string; unit: string} | null): string {
  const value = Number(reference?.credits)
  if (!reference || !Number.isFinite(value) || value <= 0) return '补全条件后报价'
  const unit = ({second: '秒', image: '张', request: '次'} as Record<string, string>)[reference.unit]
  return unit ? `参考 ${Math.ceil(value)} 积分／${unit}起` : '补全条件后报价'
}

/** 输入框只展示已有积分数值；说明留给读屏与悬停，没有数值就不占位，不解析模型名称。 */
export function compactCreditNumber(label:string):string {
  const match=label.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:积分|点)/)
  if(!match)return ''
  const value=Number(match[1].replaceAll(',',''))
  return Number.isFinite(value)&&value>=0?String(Math.ceil(value)):''
}
