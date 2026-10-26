/** 聊天浮窗仅管理几何，不保存对话、采购许可或任务状态。 */
export const CHAT_WINDOW_LIMITS={inset:8,minWidth:320,maxWidth:560,minHeight:320,maxHeight:820} as const
export type ChatWindowRect={x:number;y:number;width:number;height:number}
/** 小卡独立限制尺寸，不借用大窗320px下限，拖动始终限制在工作区。 */
export function clampMiniChat(rect:ChatWindowRect,area:{width:number;height:number}):ChatWindowRect{
  const inset=8,width=Math.min(280,Math.max(1,area.width-inset*2)),height=Math.min(88,Math.max(1,area.height-inset*2))
  return {x:Math.max(inset,Math.min(rect.x,area.width-width-inset)),y:Math.max(inset,Math.min(rect.y,area.height-height-inset)),width,height}
}
/** 最小化保留当前对话窗左下锚点，而不是跳到画布固定角落。 */
export function minimizeChatWindow(rect:ChatWindowRect,area:{width:number;height:number}){
  return clampMiniChat({...rect,y:rect.y+rect.height-88},area)
}
/** 窗口缩小时优先保证标题、恢复按钮及底部输入可达，不让浮窗越界。 */
export function clampChatWindow(rect:ChatWindowRect,area:{width:number;height:number}):ChatWindowRect{
  const {inset,minWidth,maxWidth,minHeight,maxHeight}=CHAT_WINDOW_LIMITS
  const availableWidth=Math.max(1,area.width-inset*2),availableHeight=Math.max(1,area.height-inset*2)
  const width=Math.min(availableWidth,Math.max(Math.min(minWidth,availableWidth),Math.min(maxWidth,rect.width)))
  const height=Math.min(availableHeight,Math.max(Math.min(minHeight,availableHeight),Math.min(maxHeight,rect.height)))
  return {x:Math.max(inset,Math.min(rect.x,area.width-width-inset)),y:Math.max(inset,Math.min(rect.y,area.height-height-inset)),width,height}
}
