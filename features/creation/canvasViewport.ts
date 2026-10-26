/** 画布镜头只处理可见几何，不改变素材、任务、费用或节点业务状态。 */
export interface CreativeViewportArea {width:number;height:number;leftInset?:number;bottomInset?:number;dockHeight?:number;toolHeight?:number}
export interface CreativeBounds {x:number;y:number;width:number;height:number}
export interface CreativeCamera {x:number;y:number;zoom:number}
// 与服务端布局合同保持一致；总览大图可缩到0.1%，单节点定位仍优先可读比例。
export const CREATIVE_MIN_ZOOM=.001

/** 输入器以所选节点底边为锚点；只做横向防遮挡，不把纵向位置吸回屏幕底部。 */
export function creativePromptPosition(area:CreativeViewportArea,bounds:CreativeBounds,camera:CreativeCamera,width=680){
  const left=Math.min(Math.max(8,area.leftInset||0)+16,Math.max(8,area.width-240))
  const available=Math.max(0,area.width-left-16)
  const editorWidth=Math.min(width,available)
  return {left:Math.max(left,Math.min((bounds.x+bounds.width/2)*camera.zoom+camera.x-editorWidth/2,area.width-editorWidth-16)),
    top:(bounds.y+bounds.height)*camera.zoom+camera.y+12,width:editorWidth}
}

/** 聊天悬浮层与右下输入区均为遮挡，定位时使用剩余区域而不是整屏中心。 */
export function creativeVisibleArea(area:CreativeViewportArea){
  const left=Math.max(24,Math.min(area.leftInset||0,Math.max(0,area.width-240)))+24
  const toolSpace=Math.max(0,(area.toolHeight||0)+24-64)
  // 窄屏状态小卡仍保留原坐标；取景预留其真实底部遮挡，不让保存/发送被盖住。
  const usableHeight=Math.max(0,area.height-(area.bottomInset||0))
  const remaining=usableHeight-(area.dockHeight||0)-(64+toolSpace)-28
  // 作品工具位于节点上方（top64已预留），节点底边只留12px接输入框，不再保留旧底栏空档。
  // 节点工具已按真实高度预留上方区域，不再叠加旧工作台底栏的额外空档。
  const mediaHeight=area.toolHeight?usableHeight-(area.dockHeight||0)-(64+toolSpace)-40:usableHeight-(area.dockHeight||0)-152-toolSpace
  return {left,top:64+toolSpace,width:Math.max(140,area.width-left-72),height:Math.max(Math.min(80,Math.max(1,remaining)),mediaHeight)}
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
