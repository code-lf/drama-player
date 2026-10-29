/** 仅展示真实服务状态；待核对不等于失败，也不能由展示触发重试。 */
export interface ProcessEvent {id:string;title:string;description?:string;status:'processing'|'succeeded'|'failed'|'unknown'}

/** 兼容没有阶段记录的旧草稿，不补造设置元数据、保存正文等历史操作。 */
export function authoringProcessEvents(value:{status:string;events?:ProcessEvent[]}):ProcessEvent[]{
  // 候选已返回属于内部收据，不占用用户处理记录；保存状态只在出错时提醒。
  if(value.events?.length)return value.events.filter(event=>event.id!=='candidate')
  if(value.status==='ready')return []
  return [{id:'author',title:value.status==='processing'?'整理技能内容':value.status==='failed'?'本次整理失败，原稿保留':'整理候选已返回',status:value.status==='processing'?'processing':value.status==='failed'?'failed':'succeeded'}]
}
