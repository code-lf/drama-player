import type {CreativeLayout} from './agentCanvas'

export interface GroupMemberBox{id:string;x:number;y:number;width:number;height:number}
/** 分组使用绝对节点坐标，不重设业务引用；框选、成组、移动都不会授予生成许可。 */
export function groupBounds(members:GroupMemberBox[]){
  if(!members.length)return undefined
  const x=Math.min(...members.map(n=>n.x))-24,y=Math.min(...members.map(n=>n.y))-56
  return {x,y,width:Math.max(...members.map(n=>n.x+n.width))-x+24,height:Math.max(...members.map(n=>n.y+n.height))-y+24}
}
/** 一期不允许嵌套/交叉分组；重新打组明确将选中节点移入新组，旧组不足两项则解散。 */
export function groupMembers(layout:CreativeLayout,ids:string[],id:string,title:string){
  const members=[...new Set(ids)]
  if(members.length<2)return false
  const selected=new Set(members)
  layout.groups=[...(layout.groups||[]).map(g=>({...g,members:g.members.filter(key=>!selected.has(key))})).filter(g=>g.members.length>=2),{id,title,members}]
  return true
}
/** 整体平移共用一个被钳制的位移，不能逐节点截断导致组内相对位置变形。 */
export function moveGroup(members:GroupMemberBox[],dx:number,dy:number){
  if(!members.length||!Number.isFinite(dx)||!Number.isFinite(dy))return {}
  const x=Math.max(-100000-Math.min(...members.map(n=>n.x)),Math.min(dx,100000-Math.max(...members.map(n=>n.x))))
  const y=Math.max(-100000-Math.min(...members.map(n=>n.y)),Math.min(dy,100000-Math.max(...members.map(n=>n.y))))
  return Object.fromEntries(members.map(n=>[n.id,{x:n.x+x,y:n.y+y}]))
}
/** 水平/垂直排列只写选中成员布局，不移动组外节点；保留可读标题与素材间距。 */
export function arrangeGroup(members:GroupMemberBox[],axis:'horizontal'|'vertical'){
  const rows=[...members].sort((a,b)=>axis==='horizontal'?a.x-b.x||a.y-b.y:a.y-b.y||a.x-b.x)
  if(!rows.length)return {}
  let x=Math.min(...rows.map(n=>n.x)),y=Math.min(...rows.map(n=>n.y))
  const result:Record<string,{x:number;y:number}>={}
  for(const node of rows){result[node.id]={x,y};if(axis==='horizontal')x+=node.width+72;else y+=node.height+72}
  // 极端大画布不能写入后端拒绝的坐标；拒绝本次排版，原位置保留。
  return Object.values(result).some(p=>Math.abs(p.x)>100000||Math.abs(p.y)>100000)?{}:result
}
