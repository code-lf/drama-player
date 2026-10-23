import type {DramaProjectCard} from '~/entities/drama/types'

/** 目录标识带类型前缀，不能拿会话 ID 调用短剧删除接口。底层业务表不合并。 */
export interface CreationProjectCard extends DramaProjectCard {
  isFavorite?:boolean
  deletedAt?:string|null
  kind: 'creation' | 'drama'
  sessions: Array<{id:string;title:string}>
}
export interface CreationProjectPage {items:CreationProjectCard[];total:number;offset:number;limit:number}
export type CreationProjectKind = 'all' | 'creation' | 'drama'

/** 关联短剧默认继续最近对话，独立短剧仍进入专业工作流。 */
export function projectDestination(item:CreationProjectCard){
  return item.sessions.length ? `/dashboard?session=${encodeURIComponent(item.sessions[0]!.id)}` : `/drama/${encodeURIComponent(item.projectId)}?from=dashboard-projects`
}
