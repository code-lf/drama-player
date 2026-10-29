/** 侧栏每次显示八条；多取一条仅判断是否还有下一页，不提前显示探测项。 */
export const SESSION_PAGE_SIZE = 8

export function appendSessionPage<T extends {id:string}>(current:T[], page:T[]) {
  const batch=page.slice(0,SESSION_PAGE_SIZE)
  // 新会话插入或列表刷新可能使页边界重叠，稳定标识去重但不篡改会话顺序。
  const merged=new Map(current.map(item=>[item.id,item]))
  for(const item of batch)merged.set(item.id,item)
  return {sessions:[...merged.values()],consumed:batch.length,hasMore:page.length>SESSION_PAGE_SIZE}
}
