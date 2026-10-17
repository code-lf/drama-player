/** 本地确定性图片编辑：只处理已核验来源，不访问模型或计费接口。 */
export type ImageEdit = {type:'rotate';degrees:number}|{type:'resize';width:number;height:number}|{type:'crop';x:number;y:number;width:number;height:number}|{type:'text';text:string;x:number;y:number;size:number;color:string}|{type:'draw'|'erase';points:Array<{x:number;y:number}>;size:number;color:string}
export function validCanvasSize(width:number,height:number){return Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=16000&&height<=16000&&width*height<=40_000_000}
export function editDimensions(width:number,height:number,edit:ImageEdit){
  if(edit.type==='resize'||edit.type==='crop')return{width:Math.round(edit.width),height:Math.round(edit.height)}
  if(edit.type==='rotate'&&Math.abs(edit.degrees)%180===90)return{width:height,height:width}
  return{width,height}
}
/** 按下即留下圆点，单击也能批注；长笔迹与实时预览共用同一笔触。 */
export function paintStroke(ctx:CanvasRenderingContext2D,points:Array<{x:number;y:number}>,size:number,color:string){
  if(!points.length)return
  ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=size;ctx.lineJoin=ctx.lineCap='round'
  if(points.length===1){ctx.beginPath();ctx.arc(points[0]!.x,points[0]!.y,size/2,0,Math.PI*2);ctx.fill();return}
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()
}
/** 每次重放操作生成新画布；撤销不改写源图，尺寸校验在分配像素前执行。 */
export function renderEditLayers(image:HTMLImageElement,edits:ImageEdit[]){
  let canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
  if(!validCanvasSize(canvas.width,canvas.height))throw new Error('图片尺寸超出本地编辑限制。')
  canvas.getContext('2d')!.drawImage(image,0,0)
  let annotations=document.createElement('canvas');annotations.width=canvas.width;annotations.height=canvas.height
  for(const edit of edits){
    // 批注单独成层，橡皮只擦批注透明度，绝不擦穿或涂白原图。
    if(edit.type==='draw'||edit.type==='erase'||edit.type==='text'){
      const ctx=annotations.getContext('2d')!;ctx.save()
      if(edit.type==='text'){ctx.font=`${edit.size}px sans-serif`;ctx.fillStyle=edit.color;ctx.textBaseline='top';edit.text.split('\n').forEach((line,index)=>ctx.fillText(line,edit.x,edit.y+index*edit.size*1.25))}
      else{ctx.globalCompositeOperation=edit.type==='erase'?'destination-out':'source-over';paintStroke(ctx,edit.points,edit.size,edit.color)}
      ctx.restore();continue
    }
    canvas.getContext('2d')!.drawImage(annotations,0,0)
    const size=editDimensions(canvas.width,canvas.height,edit)
    if(!validCanvasSize(size.width,size.height))throw new Error('尺寸需为正整数且不超过四千万像素。')
    const next=document.createElement('canvas');next.width=size.width;next.height=size.height;const ctx=next.getContext('2d')!
    if(edit.type==='crop'){
      if(edit.x<0||edit.y<0||edit.x+edit.width>canvas.width||edit.y+edit.height>canvas.height)throw new Error('裁剪范围超出图片。')
      ctx.drawImage(canvas,edit.x,edit.y,edit.width,edit.height,0,0,next.width,next.height)
    }else if(edit.type==='rotate'){ctx.translate(next.width/2,next.height/2);ctx.rotate(edit.degrees*Math.PI/180);ctx.drawImage(canvas,-canvas.width/2,-canvas.height/2)}
    else ctx.drawImage(canvas,0,0,next.width,next.height)
    canvas=next
    annotations=document.createElement('canvas');annotations.width=canvas.width;annotations.height=canvas.height
  }
  return{base:canvas,annotations}
}
/** 预览与下载共用同一合成结果，撤销/重做通过重放图层操作恢复。 */
export function renderEdits(image:HTMLImageElement,edits:ImageEdit[]){const{base,annotations}=renderEditLayers(image,edits);base.getContext('2d')!.drawImage(annotations,0,0);return base}
