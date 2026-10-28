/** 气泡只去掉首尾空白行；保留正文换行和缩进，不改写草稿、历史原文或提交数据。 */
export function userBubbleText(value:string|null|undefined):string{
  return (value??'').replace(/^(?:[\t \u00a0]*\r?\n)+|(?:\r?\n[\t \u00a0]*)+$/gu,'')
}
