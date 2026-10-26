/** 视频只使用扣除工具栏、说明、产物条和媒体内边距后的空间，保持真实比例。 */
export function fitVideoViewport(width:number,height:number,ratio:number,maxHeight:number){
  if(![width,height,ratio,maxHeight].every(Number.isFinite)||width<=0||height<=0||ratio<=0||maxHeight<=0)return {width:0,height:0}
  const fittedHeight=Math.min(height,maxHeight,width/ratio)
  return {width:fittedHeight*ratio,height:fittedHeight}
}
