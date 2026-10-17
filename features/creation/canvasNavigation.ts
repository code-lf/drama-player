/** 缩放围绕鼠标所在图片位置，平移只作用于查看，不修改像素。 */
export function zoomAt(zoom:number,pan:{x:number;y:number},point:{x:number;y:number},delta:number){
  const next=Math.max(25,Math.min(400,Math.round(zoom*Math.exp(-delta*.002))))
  const ratio=next/zoom
  return{zoom:next,pan:{x:point.x-(point.x-pan.x)*ratio,y:point.y-(point.y-pan.y)*ratio}}
}
/** 模型列表只整理展示文字，不改变实际模型编码及参数。 */
export function modelDisplayName(value:string){return value.replace(/\s*[（(]\s*ToAPIs?\s*[)）]/gi,'').replace(/\bToAPIs?\b/gi,'').trim()}
/** 清理历史配置中的接入名称，展示功能介绍而非内部渠道。 */
export function modelDescription(value:string){return value.replace(/\bToAPIs?\b\s*/gi,'').replace(/供应商|上游/g,'生成服务').trim()}
