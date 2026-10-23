/** 确认卡只公开本次核准的计量时长，不暴露供应商成本或用参考秒价拼出总价。 */
export function videoQuoteSummary(quote:unknown):string {
  const value=quote as {outputDurationSeconds?:number;referenceVideoSeconds?:number}|null
  const output=value?.outputDurationSeconds,reference=value?.referenceVideoSeconds
  if(typeof output!=='number'||!Number.isFinite(output)||output<=0)return ''
  if(typeof reference!=='number'||!Number.isFinite(reference)||reference<0)return ''
  return `输出 ${output} 秒 · ${reference>0?`参考视频 ${reference} 秒（计费时长）`:'无参考视频'}`
}
