/** 仅用正式原文中唯一、逐字一致的证据定位；不模糊猜段落或采纳旧版本偏移。 */
export function locateReviewText(source:string,quote:string):{start:number;end:number}|null{
  if(!quote.trim())return null
  const start=source.indexOf(quote)
  if(start<0||source.indexOf(quote,start+1)>=0)return null
  return {start,end:start+quote.length}
}
