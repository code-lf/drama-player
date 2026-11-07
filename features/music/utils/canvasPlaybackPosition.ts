/** 仅保存本页紧凑播放器切换工具前的进度，不保存URL到磁盘、不恢复自动播放。 */
const positions=new Map<string,number>()
export function rememberCanvasPosition(url:string,position:number){
  if(!url||!Number.isFinite(position)||position<0)return
  positions.delete(url);positions.set(url,position)
  // 限制内存中的私人文件标识数量；页面刷新自然清空。
  if(positions.size>32)positions.delete(positions.keys().next().value!)
}
export function readCanvasPosition(url:string){return positions.get(url)||0}
