/** 画布镜头只处理可见几何，不改变素材、任务、费用或节点业务状态。 */
export interface CreativeViewportArea {width:number;height:number;leftInset?:number;bottomInset?:number;dockHeight?:number;toolHeight?:number;obstructions?:CreativeBounds[]}
export interface CreativeBounds {x:number;y:number;width:number;height:number}
export interface CreativeCamera {x:number;y:number;zoom:number}
// 与服务端布局合同保持一致；总览大图可缩到0.1%，单节点定位仍优先可读比例。
export const CREATIVE_MIN_ZOOM=.001

/** 将画幅规格转换成真实宽高比；无法识别时返回空值并按最大媒体卡片预留。 */
export function creativeAspectRatio(value?:string|number){
  if(typeof value==='number')return Number.isFinite(value)&&value>0?value:undefined
  const match=String(value||'').trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if(!match)return undefined
  const width=Number(match[1]),height=Number(match[2])
  return width>0&&height>0?width/height:undefined
}

/** 新媒体节点尚未挂载时，按节点宽度、画幅和CSS媒体上限预估真实避让边界。 */
export function creativeEstimatedNodeBounds(kind:'text'|'image'|'video'|'audio'|'compose',width=280,aspectRatio?:string|number,maxMediaHeight=420):CreativeBounds{
  const nodeWidth=Number.isFinite(width)&&width>0?width:280
  const mediaLimit=Number.isFinite(maxMediaHeight)&&maxMediaHeight>0?maxMediaHeight:420
  const ratio=creativeAspectRatio(aspectRatio)
  const heading=32,bodyMinimum=180,layoutSafety=16
  if(['image','video','compose'].includes(kind)){
    // 竖版媒体可能高于节点宽；预估时同时遵守节点 max-height，避免按空白草案尺寸占位。
    const mediaHeight=ratio?Math.min(mediaLimit,nodeWidth/ratio):mediaLimit
    return {x:0,y:0,width:nodeWidth,height:heading+Math.max(bodyMinimum,mediaHeight)+layoutSafety}
  }
  // 长文字节点存在内部滚动，音频节点带播放器；各自预留其常态卡片高度。
  return {x:0,y:0,width:nodeWidth,height:kind==='text'?400:kind==='audio'?300:360}
}

/** 将右键屏幕坐标还原为画布世界坐标，供新增节点在点击附近排布。 */
export function creativeCanvasPoint(clientX:number,clientY:number,rect:{left:number;top:number},camera:CreativeCamera){
  const zoom=Number.isFinite(camera.zoom)&&camera.zoom>0?camera.zoom:1
  return{x:(clientX-rect.left-camera.x)/zoom,y:(clientY-rect.top-camera.y)/zoom}
}

/** 编辑版本优先在来源附近找空位；空间拥挤时仍保证落点不与现有卡片重叠。 */
export function creativeNearbyPosition(preferred:CreativeBounds,occupied:CreativeBounds[],limits?:CreativeBounds,maxBottom?:number){
  const originX=Number.isFinite(preferred.x)?preferred.x:0,originY=Number.isFinite(preferred.y)?preferred.y:0
  const width=Number.isFinite(preferred.width)&&preferred.width>0?preferred.width:280
  const height=Number.isFinite(preferred.height)&&preferred.height>0?preferred.height:360
  const boxes=occupied.filter(box=>[box.x,box.y,box.width,box.height].every(Number.isFinite)&&box.width>0&&box.height>0)
  // 有可见区限制时，节点完整卡片必须在安全矩形内；碰撞检测仍保留卡片间距。
  const inLimits=(x:number,y:number)=>((!limits||x>=limits.x&&y>=limits.y&&x+width<=limits.x+limits.width&&y+height<=limits.y+limits.height)&&(maxBottom===undefined||y+height<=maxBottom))
  const free=(x:number,y:number)=>inLimits(x,y)&&!boxes.some(box=>x<box.x+box.width+48&&x+width+48>box.x&&y<box.y+box.height+48&&y+height+48>box.y)
  // 输入器锚定在选中节点下方；竖版结果需要更细的纵向步长，才能在输入器上方找近邻空位。
  const stepX=width+96,stepY=maxBottom===undefined?height+96:Math.min(height+96,144)
  for(let radius=0;radius<=32;radius++){
    const candidates:Array<{x:number;y:number;distance:number}>=[]
    for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue
      const x=originX+dx*stepX,y=originY+dy*stepY
      candidates.push({x,y,distance:(x-originX)**2+(y-originY)**2})
    }
    const result=candidates.sort((a,b)=>a.distance-b.distance).find(point=>free(point.x,point.y))
    if(result)return{x:result.x,y:result.y}
  }
  // 密集画布超过局部搜索圈后，分别找同列下方、同行左右的安全边界，再取距离最近的一侧。
  const horizontal=boxes.filter(box=>originX<box.x+box.width+48&&originX+width+48>box.x)
  const vertical=boxes.filter(box=>originY<box.y+box.height+48&&originY+height+48>box.y)
  const candidates=[
    {x:originX,y:Math.max(originY,...horizontal.map(box=>box.y+box.height+48))},
    {x:Math.max(originX,...vertical.map(box=>box.x+box.width+48)),y:originY},
    {x:Math.min(originX,...vertical.map(box=>box.x-width-48)),y:originY},
  ].filter(point=>free(point.x,point.y))
  candidates.sort((a,b)=>(a.x-originX)**2+(a.y-originY)**2-((b.x-originX)**2+(b.y-originY)**2))
  if(!candidates.length&&limits&&maxBottom===undefined){
    // 可见区被现有卡片占满时保留全画布最近空位，随后由取景器平移避开浮层，不覆盖作品。
    return creativeNearbyPosition(preferred,occupied)
  }
  // 对任意有限节点集合，扩展到最右侧的空列必然可用；此兜底避免异常超密集布局仍发生重叠。
  if(candidates[0])return candidates[0]
  // 搜索极端密集时仍守住输入器上缘，逐列向右寻找不会覆盖作品的安全落点。
  const safeY=maxBottom===undefined?originY:Math.min(originY,maxBottom-height)
  let safeX=originX
  while(boxes.some(box=>safeX<box.x+box.width+48&&safeX+width+48>box.x&&safeY<box.y+box.height+48&&safeY+height+48>box.y))safeX=Math.max(safeX+width+48,...boxes.filter(box=>safeY<box.y+box.height+48&&safeY+height+48>box.y).map(box=>box.x+box.width+48))
  return{x:safeX,y:safeY}
}

/** 派生节点优先完整落在扣除聊天、工具和底部输入器后的当前可见区，避免新结果被浮层遮住。 */
export function creativeVisibleNearbyPosition(preferred:CreativeBounds,occupied:CreativeBounds[],area:CreativeViewportArea,camera:CreativeCamera){
  const zoom=Number.isFinite(camera.zoom)&&camera.zoom>0?camera.zoom:1,margin=16
  const preferredLeft=preferred.x*zoom+camera.x,preferredTop=preferred.y*zoom+camera.y
  // 优先在离来源最近且放得下整张结果的安全块内定位，避免被较大的另一块区域牵走。
  const fitting=creativeVisibleRegions(area).filter(region=>region.width>=preferred.width*zoom+margin*2&&region.height>=preferred.height*zoom+margin*2).map(region=>{
    const left=Math.max(region.left+margin,Math.min(preferredLeft,region.left+region.width-margin-preferred.width*zoom))
    const top=Math.max(region.top+margin,Math.min(preferredTop,region.top+region.height-margin-preferred.height*zoom))
    return {region,distance:(left-preferredLeft)**2+(top-preferredTop)**2}
  }).sort((a,b)=>a.distance-b.distance)
  const visible=fitting[0]?.region||creativeVisibleArea(area)
  const limits={
    x:(visible.left+margin-camera.x)/zoom,
    y:(visible.top+margin-camera.y)/zoom,
    width:(visible.width-margin*2)/zoom-preferred.width,
    height:(visible.height-margin*2)/zoom-preferred.height,
  }
  // 把屏幕悬浮层换算到画布坐标并作为临时占位，避免新节点落在缩小聊天卡/任务列表下面。
  const blocked=(area.obstructions||[]).filter(box=>[box.x,box.y,box.width,box.height].every(Number.isFinite)&&box.width>0&&box.height>0).map(box=>({
    x:(box.x-margin-camera.x)/zoom,
    y:(box.y-margin-camera.y)/zoom,
    width:(box.width+margin*2)/zoom,
    height:(box.height+margin*2)/zoom,
  }))
  // 视口小于节点时无法仅靠改坐标解决；保留原近邻算法，后续镜头会缩放到节点安全区。
  if(limits.width<0||limits.height<0)return creativeNearbyPosition(preferred,[...occupied,...blocked])
  const maxX=limits.x+limits.width,maxY=limits.y+limits.height
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
  const visiblePreference={...preferred,x:clamp(preferred.x,limits.x,maxX),y:clamp(preferred.y,limits.y,maxY)}
  const nearby=creativeNearbyPosition(visiblePreference,[...occupied,...blocked],{x:limits.x,y:limits.y,width:limits.width+preferred.width,height:limits.height+preferred.height})
  const fitsVisible=nearby.x>=limits.x&&nearby.y>=limits.y&&nearby.x<=maxX&&nearby.y<=maxY
  if(fitsVisible)return nearby
  // 当前视口被密集节点挤满时，不要从被裁到视口边缘的坐标继续无界搜索；回到来源附近找最近空位，由调用方共同取景。
  return creativeNearbyPosition(preferred,[...occupied,...blocked])
}

/** 输入器以所选节点底边为锚点；只做横向防遮挡，不把纵向位置吸回屏幕底部。 */
export function creativePromptPosition(area:CreativeViewportArea,bounds:CreativeBounds,camera:CreativeCamera,width=680){
  const left=Math.min(Math.max(8,area.leftInset||0)+16,Math.max(8,area.width-240))
  const available=Math.max(0,area.width-left-16)
  const editorWidth=Math.min(width,available)
  const top=(bounds.y+bounds.height)*camera.zoom+camera.y+12
  const preferredLeft=Math.max(left,Math.min((bounds.x+bounds.width/2)*camera.zoom+camera.x-editorWidth/2,area.width-editorWidth-16))
  const promptHeight=Math.max(1,area.dockHeight||280),verticalBottom=top+promptHeight
  const blockers=(area.obstructions||[]).filter(box=>[box.x,box.y,box.width,box.height].every(Number.isFinite)&&box.width>0&&box.height>0&&top<box.y+box.height+12&&verticalBottom>box.y-12)
  if(!blockers.length)return {left:preferredLeft,top,width:editorWidth}
  // 提示词框默认紧贴节点；若与可拖动对话卡交叠，只横移到最近可用区并尽量保留原宽度。
  let segments=[{left,right:area.width-16}]
  for(const box of blockers){
    const cutLeft=box.x-12,cutRight=box.x+box.width+12
    segments=segments.flatMap(segment=>cutRight<=segment.left||cutLeft>=segment.right?[segment]:[
      ...(cutLeft>segment.left?[{left:segment.left,right:cutLeft}]:[]),
      ...(cutRight<segment.right?[{left:cutRight,right:segment.right}]:[]),
    ])
  }
  const choices=segments.filter(segment=>segment.right-segment.left>=Math.min(220,editorWidth)).map(segment=>{
    const nextWidth=Math.min(editorWidth,segment.right-segment.left)
    const nextLeft=Math.max(segment.left,Math.min(preferredLeft,segment.right-nextWidth))
    return {left:nextLeft,width:nextWidth,cost:Math.abs(nextLeft-preferredLeft)+(editorWidth-nextWidth)*4}
  }).sort((a,b)=>a.cost-b.cost)
  return choices.length?{...choices[0]!,top}:{left:preferredLeft,top,width:editorWidth}
}

/** 将画布可视区扣除聊天和任务浮层，再切成不互相重叠的安全矩形。 */
function creativeVisibleRegions(area:CreativeViewportArea){
  const left=Math.max(24,Math.min(area.leftInset||0,Math.max(0,area.width-240)))+24
  const toolSpace=Math.max(0,(area.toolHeight||0)+24-64)
  // 窄屏状态小卡仍保留原坐标；取景预留其真实底部遮挡，不让保存/发送被盖住。
  const usableHeight=Math.max(0,area.height-(area.bottomInset||0))
  const remaining=usableHeight-(area.dockHeight||0)-(64+toolSpace)-28
  // 作品工具位于节点上方（top64已预留），节点底边只留12px接输入框，不再保留旧底栏空档。
  // 节点工具已按真实高度预留上方区域，不再叠加旧工作台底栏的额外空档。
  const mediaHeight=area.toolHeight?usableHeight-(area.dockHeight||0)-(64+toolSpace)-40:usableHeight-(area.dockHeight||0)-152-toolSpace
  const base={left,top:64+toolSpace,width:Math.max(140,area.width-left-72),height:Math.max(Math.min(80,Math.max(1,remaining)),mediaHeight)}
  // 悬浮卡等遮挡物把可视区切成若干块；取最大连续安全矩形，取景与派生定位共用同一结果。
  let regions=[base]
  for(const obstruction of area.obstructions||[]){
    if(![obstruction.x,obstruction.y,obstruction.width,obstruction.height].every(Number.isFinite)||obstruction.width<=0||obstruction.height<=0)continue
    const padding=12,blocked={left:obstruction.x-padding,top:obstruction.y-padding,right:obstruction.x+obstruction.width+padding,bottom:obstruction.y+obstruction.height+padding}
    regions=regions.flatMap(region=>{
      const right=region.left+region.width,bottom=region.top+region.height
      const left=Math.max(region.left,blocked.left),top=Math.max(region.top,blocked.top),cutRight=Math.min(right,blocked.right),cutBottom=Math.min(bottom,blocked.bottom)
      if(cutRight<=left||cutBottom<=top)return [region]
      const pieces=[
        {left:region.left,top:region.top,width:region.width,height:top-region.top},
        {left:region.left,top:cutBottom,width:region.width,height:bottom-cutBottom},
        {left:region.left,top,width:left-region.left,height:cutBottom-top},
        {left:cutRight,top,width:right-cutRight,height:cutBottom-top},
      ]
      return pieces.filter(piece=>piece.width>=1&&piece.height>=1)
    })
  }
  return regions.length?regions:[base]
}

/** 聊天悬浮层与右下输入区均为遮挡，定位时使用剩余区域而不是整屏中心。 */
export function creativeVisibleArea(area:CreativeViewportArea){
  const regions=creativeVisibleRegions(area)
  const safest=regions.sort((a,b)=>b.width*b.height-a.width*a.height)[0]
  return {left:safest!.left,top:safest!.top,width:safest!.width,height:safest!.height}
}

/** 判断已保存镜头是否仍能看见至少一张节点卡，避免刷新后空画布；不覆盖有效的用户平移/缩放。 */
export function creativeCameraHasVisibleNode(nodes:CreativeBounds[],area:CreativeViewportArea,camera:CreativeCamera,minPixels=8){
  if(!nodes.length||!Number.isFinite(camera.zoom)||camera.zoom<=0)return false
  // 只读恢复要检查每一块安全区，而非仅最大区；节点在较小可见区时不能误判空画布并抢走用户镜头。
  return creativeVisibleRegions(area).some(usable=>{
    const left=Math.max(0,usable.left),top=Math.max(0,usable.top)
    const right=Math.min(area.width,usable.left+usable.width),bottom=Math.min(area.height,usable.top+usable.height)
    if(right<=left||bottom<=top)return false
    return nodes.some(node=>{
      const x=node.x*camera.zoom+camera.x,y=node.y*camera.zoom+camera.y
      const width=node.width*camera.zoom,height=node.height*camera.zoom
      return Math.min(right,x+width)-Math.max(left,x)>=minPixels&&Math.min(bottom,y+height)-Math.max(top,y)>=minPixels
    })
  })
}

/** 只在显式定位或新增任务时调整镜头；保持镜头模式尽量保留用户平移，仅补足被遮挡部分。 */
export function creativeFocusCamera(area:CreativeViewportArea,bounds:CreativeBounds,camera:CreativeCamera,keepCamera=false,maxZoom=1,minZoom=.15):CreativeCamera{
  const visible=creativeVisibleArea(area)
  // 保持镜头时不能把大图总览强行抬回15%，否则第一次点击便移动目标、打断双击。
  // 低高度与小卡同时占位时允许临时低于15%，否则最小缩放本身会把发送按钮推出安全区。
  const preferredMinimum=keepCamera?Math.min(minZoom,camera.zoom):minZoom
  const minimum=area.bottomInset||area.toolHeight?Math.min(preferredMinimum,visible.height/Math.max(1,bounds.height)):preferredMinimum
  const zoom=Math.max(minimum,Math.min(keepCamera?camera.zoom:maxZoom,visible.width/Math.max(1,bounds.width),visible.height/Math.max(1,bounds.height)))
  const centerX=bounds.x+bounds.width/2
  const targetX=visible.left+(visible.width-bounds.width*zoom)/2
  const screenX=keepCamera?Math.max(visible.left,Math.min(bounds.x*camera.zoom+camera.x,visible.left+visible.width-bounds.width*zoom)):targetX
  const screenY=keepCamera?Math.max(visible.top,Math.min(bounds.y*camera.zoom+camera.y,visible.top+visible.height-bounds.height*zoom)):visible.top+(visible.height-bounds.height*zoom)/2
  return {x:keepCamera?screenX-bounds.x*zoom:visible.left+visible.width/2-centerX*zoom,y:screenY-bounds.y*zoom,zoom}
}

/** 新草案优先落在无遮挡区域；派生节点仍位于来源右侧，重叠时逐列向右追加。 */
export function creativeFreePosition(preferred:{x:number;y:number},occupied:Array<{x:number;y:number}>){
  const position={...preferred}
  while(occupied.some(node=>Math.abs(node.x-position.x)<330&&Math.abs(node.y-position.y)<460))position.x+=400
  return position
}
