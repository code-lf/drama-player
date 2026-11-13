import type {DramaCanvasCard} from './dramaCanvasGraph'

/** 只接收已读取的业务成果，不从用户文字猜角色、数量或镜头关系。 */
interface ProductionNode {id:string;position:{x:number;y:number};data:DramaCanvasCard}
interface ProductionEdge {id:string;source:string;target:string}
export interface ProductionGroup {
  id:string;title:string;members:string[]
  /** 分类用于资产/分镜容器的页签，不另建一份任务或执行状态。 */
  sections:Array<{key:string;title:string;members:string[]}>
}

/**
 * 将旧能力的只读结果映射为现有画布需要的真实成员及分组。
 * 分组容器不是生产节点，旧投影中的“分镜组”连接点只用于还原来源线。
 * 本函数不读取项目、不保存、不提交；只有明确绑定的画布制作快照才可调用。
 */
export function groupProductionGraph(projectId:string,episode:number,graph:{nodes:ProductionNode[];edges:ProductionEdge[]}){
  if(!/^[a-zA-Z0-9-]{1,36}$/.test(projectId)||!Number.isSafeInteger(episode)||episode<1||episode>9999){
    throw new Error('制作分组需要有效的项目身份与集数。')
  }
  const byId=new Map(graph.nodes.map(node=>[node.id,node]))
  if(byId.size!==graph.nodes.length)throw new Error('制作成果包含重复节点身份，不能合并为同一项。')
  const connectors=new Set(graph.nodes.filter(node=>['分镜组','场次分镜组'].includes(node.data.kind)).map(node=>node.id))
  const nodes=graph.nodes.filter(node=>!connectors.has(node.id)).map(node=>({...node,position:{...node.position}}))
  const visible=new Set(nodes.map(node=>node.id))
  const outgoing=new Map<string,string[]>()
  for(const edge of graph.edges){
    if(!byId.has(edge.source)||!byId.has(edge.target))continue
    outgoing.set(edge.source,[...(outgoing.get(edge.source)||[]),edge.target])
  }
  const edges:ProductionEdge[]=[],seen=new Set<string>()
  // 仅穿透原有分组连接点，不按坐标/相邻关系推断生产来源；环保护防止异常历史数据卡死。
  for(const source of nodes){
    const queue=[...(outgoing.get(source.id)||[])],visited=new Set<string>()
    for(let cursor=0;cursor<queue.length;cursor++){
      const target=queue[cursor]!
      if(visited.has(target))continue
      visited.add(target)
      if(connectors.has(target)){queue.push(...(outgoing.get(target)||[]));continue}
      const id=JSON.stringify([source.id,target])
      if(target!==source.id&&visible.has(target)&&!seen.has(id)){seen.add(id);edges.push({id,source:source.id,target})}
    }
  }
  const groups:ProductionGroup[]=[]
  const assets=nodes.filter(node=>node.data.step==='setting')
  const shots=nodes.filter(node=>node.data.kind==='分镜'||node.data.kind==='镜头视频')
  // 空阶段不画空组框；设定已存在但尚未出图的真实资产仍是合法成员。
  if(assets.length)groups.push({id:`group:drama-${projectId}-assets`,title:'资产',members:assets.map(node=>node.id),
    sections:[['role','角色'],['prop','道具'],['scene','场景']].map(([key,title])=>({key:key!,title:title!,members:assets.filter(node=>node.data.kind===title).map(node=>node.id)}))})
  if(shots.length)groups.push({id:`group:drama-${projectId}-e${episode}`,title:`第 ${episode} 集分镜`,members:shots.map(node=>node.id),
    sections:[{key:'shots',title:'分镜',members:shots.filter(node=>node.data.kind==='分镜').map(node=>node.id)},
      {key:'videos',title:'镜头视频',members:shots.filter(node=>node.data.kind==='镜头视频').map(node=>node.id)}]})
  return {nodes,edges,groups}
}
