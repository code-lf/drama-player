/** 框选始终以原图归一化坐标保存，缩放画布不改变实际裁剪位置。 */
export interface CropBox {x:number;y:number;width:number;height:number}
export const clampUnit=(value:number)=>Math.max(0,Math.min(1,value))
export function cropFromPoints(a:{x:number;y:number},b:{x:number;y:number}):CropBox{return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)}}
/** 按比例居中裁切，不把人物或商品拉伸成另一种宽高比。 */
export function centeredRatio(width:number,height:number,ratio:number):CropBox{
  if(!width||!height||!Number.isFinite(ratio)||ratio<=0)throw new Error('图片比例无效')
  const original=width/height,w=original>ratio?ratio/original:1,h=original>ratio?1:original/ratio
  return{x:(1-w)/2,y:(1-h)/2,width:w,height:h}
}
export function pixelCrop(box:CropBox,width:number,height:number){const x=Math.round(clampUnit(box.x)*width),y=Math.round(clampUnit(box.y)*height);return{type:'crop' as const,x,y,width:Math.min(width-x,Math.max(1,Math.round(box.width*width))),height:Math.min(height-y,Math.max(1,Math.round(box.height*height)))}}
