// 白色彗尾为原88单位的3.5倍；用单个区间入场、前进、离场，不循环铺多个虚线光点。
export const CREATIVE_EDGE_TAIL_LENGTH=308
export function creativeEdgeBeam(sourceX:number,sourceY:number,targetX:number,targetY:number){
  const tail=CREATIVE_EDGE_TAIL_LENGTH/1000
  const point=(progress:number)=>({x:sourceX+(targetX-sourceX)*progress,y:sourceY+(targetY-sourceY)*progress})
  const source=point(0),first=point(tail),last=point(1-tail),target=point(1)
  return {keyTimes:`0;${tail/(1+tail)};${1/(1+tail)};1`,
    dashValues:`0 0 0 1;0 0 ${tail} ${1-tail};0 ${1-tail} ${tail} 0;0 1 0 0`,
    coordinates:[{attribute:'x1',values:[source.x,source.x,last.x,target.x].join(';')},
      {attribute:'y1',values:[source.y,source.y,last.y,target.y].join(';')},
      {attribute:'x2',values:[source.x,first.x,target.x,target.x].join(';')},
      {attribute:'y2',values:[source.y,first.y,target.y,target.y].join(';')}]}
}
/** 连线光流只表达来源→目标方向；活动状态仅改变视觉强度/速度，不改变业务状态。 */
export function creativeEdgeMotion(id:string,sourceX:number,sourceY:number,targetX:number,targetY:number,active=false){
  // 用曲线端点距离估计节奏，短线不闪、长线不拖太慢；无逐帧JS与DOM测量。
  const distance=Math.hypot(targetX-sourceX,targetY-sourceY)
  const previous=Math.max(active?1.6:3.2,Math.min(active?4:7,(Number.isFinite(distance)?distance:400)/(active?220:130)))
  // 计入整段长尾入场/离场距离，使亮点实际速度为原来的3.5倍，而非只缩短循环时间。
  const seconds=previous*(1+CREATIVE_EDGE_TAIL_LENGTH/1000)/3.5
  // 按稳定身份错开相位，避免多根线同时闪动；刷新不重新抽取随机值。
  let hash=2166136261;for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0
  return {'--creative-flow-duration':`${seconds.toFixed(2)}s`,'--creative-flow-delay':`${(-seconds*(hash%1000)/1000).toFixed(2)}s`}
}
