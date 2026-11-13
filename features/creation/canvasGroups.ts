import type {CreativeLayout,CreativeNode,CreativeEdge} from './agentCanvas'

/** 收起只隐藏成员和相连的线，保留真实节点、业务状态及原坐标；展开不重建任务。 */
export function collapsedGroupMembers(layout:Pick<CreativeLayout,'groups'>){
  return new Set((layout.groups||[]).filter(group=>group.collapsed).flatMap(group=>group.members))
}

/** 用组框替换生产成员端点，再去重；折叠或切换资产分类不改变真实来源。 */
export function productionBoundaryLinks(edges:CreativeEdge[],groups:ReadonlyArray<{id:string;members:string[]}>){
  const memberGroup=new Map(groups.flatMap(group=>group.members.map(member=>[member,group.id] as const)))
  const unique=new Map<string,{id:string;source:string;target:string}>()
  for(const edge of edges){
    if(!edge.data?.lineage||!memberGroup.has(edge.source)&&!memberGroup.has(edge.target))continue
    const source=memberGroup.get(edge.source)||edge.source,target=memberGroup.get(edge.target)||edge.target
    if(source===target)continue
    const id=`${source}:${target}`
    unique.set(id,{id,source,target})
  }
  return [...unique.values()]
}

/** 生产资产与按集分镜共用原画布组框，保留各自业务身份。 */
export function syncAssetDefinitionGroup(layout:CreativeLayout,nodes:CreativeNode[]){
  const candidates=new Map<string,CreativeNode[]>()
  for(const node of nodes){
    const {productionAsset,productionShot,standaloneShot}=node.data
    const id=productionAsset?`group:auto-assets-${productionAsset.extractionId}`:productionShot?`group:auto-shots-${productionShot.projectId}-${productionShot.episodeNo}`:standaloneShot?`group:auto-storyboard-${standaloneShot.groupId}`:''
    if(id)candidates.set(id,[...(candidates.get(id)||[]),node])
  }
  let changed=false
  const seen=new Set(layout.auto_group_keys||[]),occupied=new Set((layout.groups||[]).flatMap(group=>group.members))
  for(const [id,items] of candidates){
    const group=layout.groups?.find(item=>item.id===id)
    if(!group&&seen.has(id))continue // 用户明确解组后不自动吸回。
    const members=items.map(item=>item.id).filter(key=>!group?.excluded_members?.includes(key)&&(!occupied.has(key)||group?.members.includes(key)))
    if(!members.length||members.length>200)continue
    if(group){for(const key of members)if(!group.members.includes(key)){group.members.push(key);occupied.add(key);changed=true}}
    else if((layout.groups||[]).length<100){const {productionShot,standaloneShot}=items[0]!.data;(layout.groups||=[]).push({id,title:standaloneShot?.groupTitle||(productionShot?`第 ${productionShot.episodeNo} 集 · 分镜`:'资产'),members});members.forEach(key=>occupied.add(key));changed=true}
    if(!seen.has(id)&&layout.groups?.some(group=>group.id===id)){seen.add(id);changed=true}
  }
  if(changed)layout.auto_group_keys=[...seen]
  return changed
}

/** 历史自动组的泛化类型名仅作回退；优先展示真实成片/首项名称，手工组名不改写。 */
export function canvasGroupLabel(group:{id:string;title:string;members:string[]},nodes:CreativeNode[]){
  if(!group.id.startsWith('group:auto-')||!['分镜图片','分镜视频','音乐素材','视频与成片'].includes(group.title))return group.title
  const members=nodes.filter(node=>group.members.includes(node.id))
  const title=(members.find(node=>node.data.source?.kind==='composition')||members[0])?.data.title
  return title?`${title}${members.length>1&&!members.some(node=>node.data.source?.kind==='composition')?' 等':''}`:group.title
}

/** 同批素材与其真实成片归组，仅改变布局；不推测相邻节点属于同一需求。 */
export function syncAutomaticGroups(layout:CreativeLayout,nodes:CreativeNode[],edges:CreativeEdge[]){
  const candidates=new Map<string,{title:string;members:string[]}>()
  for(const node of nodes){
    if(!node.data.runId||!['image','video','audio'].includes(node.data.kind)||node.data.manual)continue
    const key=`group:auto-${node.data.runId}`
    const group=candidates.get(key)||{title:node.data.kind==='image'?'分镜图片':node.data.kind==='audio'?'音乐素材':'分镜视频',members:[]}
    group.members.push(node.id);candidates.set(key,group)
  }
  for(const node of nodes.filter(n=>n.data.source?.kind==='composition')){
    const parents=edges.filter(e=>e.target===node.id&&!e.data?.lineage).map(e=>e.source)
    const group=[...candidates.values()].find(g=>parents.length&&parents.every(id=>g.members.includes(id)))
    if(group){group.members.push(node.id);group.title='视频与成片'}
  }
  const seen=new Set(layout.auto_group_keys||[]),occupied=new Set((layout.groups||[]).flatMap(g=>g.members))
  let changed=false
  for(const [id,candidate] of candidates){
    const existing=layout.groups?.find(g=>g.id===id)
    if(seen.has(id)&&!existing)continue // 已解组不得在刷新时复活。
    const members=[...new Set(candidate.members)].filter(key=>!existing?.excluded_members?.includes(key)&&(!occupied.has(key)||existing?.members.includes(key)))
    if(!existing&&members.length<2)continue
    if(!existing&&(layout.groups?.length||0)>=100)continue
    if(members.length>200)continue
    if(existing){for(const key of members)if(!existing.members.includes(key)){existing.members.push(key);occupied.add(key);changed=true}}
    else{(layout.groups||=[]).push({id,title:candidate.title,members});members.forEach(key=>occupied.add(key));changed=true}
    if(!seen.has(id)){seen.add(id);changed=true}
  }
  if(changed)layout.auto_group_keys=[...seen]
  return changed
}

export interface GroupMemberBox{id:string;x:number;y:number;width:number;height:number}
export interface GroupDropFrame{id:string;x:number;y:number;width:number;height:number}
/** 固定生产组统一预留四列四行；折叠只是视觉状态，排版仍保留展开空间。 */
export const PRODUCTION_GROUP_SIZE={width:1136,height:1088}

/** 在世界坐标中排布不可拖动的生产块；普通节点保留原位，组员按相同位移更新。 */
export function placeFixedDramaBlocks(
  blocks:ReadonlyArray<GroupDropFrame&{members:GroupMemberBox[];sources:string[]}>,
  obstacles:ReadonlyArray<GroupDropFrame>,
){
  const gap=80,limit=100000
  const occupied=[...obstacles],placed=new Map<string,GroupDropFrame>()
  const positions:CreativeLayout['positions']={}
  for(const block of blocks){
    // 已连接的上游必须在组框左侧；不依赖缩放比例、可见卡片数量或折叠高度。
    const sourceRight=block.sources.reduce((right,id)=>{
      const source=placed.get(id)
      return source?Math.max(right,source.x+source.width+gap):right
    },block.x)
    const candidate={...block,x:sourceRight}
    const overlaps=(other:GroupDropFrame)=>candidate.x<other.x+other.width+gap&&
      candidate.x+candidate.width+gap>other.x&&candidate.y<other.y+other.height+gap&&
      candidate.y+candidate.height+gap>other.y
    const anchorX=candidate.x
    // 优先向右错开。接近坐标上限时改用下方空间，避免写入无效布局。
    for(let i=0;i<=occupied.length;i++){
      const hits=occupied.filter(overlaps)
      if(!hits.length)break
      const right=Math.max(...hits.map(other=>other.x+other.width+gap))
      if(right+candidate.width<=limit)candidate.x=right
      else{candidate.x=Math.min(anchorX,limit-candidate.width);candidate.y=Math.max(...hits.map(other=>other.y+other.height+gap))}
    }
    const dx=candidate.x-block.x,dy=candidate.y-block.y
    if((dx||dy)&&!occupied.some(overlaps)&&block.members.every(node=>Math.abs(node.x+dx)<=limit&&Math.abs(node.y+dy)<=limit)){
      for(const node of block.members)positions[node.id]={x:node.x+dx,y:node.y+dy}
      placed.set(block.id,candidate);occupied.push(candidate)
    }else{placed.set(block.id,block);occupied.push(block)}
  }
  return positions
}
/** 松手时按拖动开始前的组框判断归属；不能用随成员拉大的框判断，否则永远拖不出去。 */
export function dropGroupMembers(layout:CreativeLayout,moved:GroupMemberBox[],frames:GroupDropFrame[]){
  let changed=false
  const rejected:string[]=[]
  for(const node of moved){
    const previous=layout.groups?.find(group=>group.members.includes(node.id))
    const x=node.x+node.width/2,y=node.y+node.height/2
    const containing=frames.filter(frame=>x>=frame.x&&x<=frame.x+frame.width&&y>=frame.y&&y<=frame.y+frame.height)
    // 重叠时优先保留原组，再选最小容器；只改变布局成员，不创建任务、素材引用或许可。
    const targetId=containing.find(frame=>frame.id===previous?.id)?.id||containing.sort((a,b)=>a.width*a.height-b.width*b.height)[0]?.id
    const target=layout.groups?.find(group=>group.id===targetId)
    if(target===previous)continue
    if(target&&target.members.length>=200){rejected.push(node.id);continue}
    if(previous){
      previous.members=previous.members.filter(id=>id!==node.id)
      // 自动组必须记住明确拖出的成员，后续任务轮询和刷新不能将其重新吸回。
      if(previous.id.startsWith('group:auto-'))previous.excluded_members=[...new Set([...(previous.excluded_members||[]),node.id])]
    }
    if(target){target.members.push(node.id);target.excluded_members=target.excluded_members?.filter(id=>id!==node.id)}
    changed=true
  }
  if(changed)layout.groups=layout.groups?.filter(group=>group.members.length>0)
  return {changed,rejected}
}
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
