/** 只拦截明确冲突，不凭商品名称猜风格；历史任务与既有作品不修改。 */
export function continuationStyleConflict(style:string,latest:string,previous:string){
  if(!style)return false
  const photo=/商业摄影|商品摄影|产品摄影|写实摄影|真实摄影|实拍风格/
  const cartoon=/卡通|动漫|动画|漫画/
  // 最新输入已有明确方向时优先于历史；普通“再做一张”才沿用原方案风格判断。
  const demand=photo.test(latest)||cartoon.test(latest)?latest:previous+'\n'+latest
  return (cartoon.test(style)&&photo.test(demand)&&!cartoon.test(demand)) || (photo.test(style)&&cartoon.test(demand)&&!photo.test(demand))
}
