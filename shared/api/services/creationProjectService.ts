import {request,mapDramaProjectCard} from '~/shared/api/adapters/httpAdapter'
import type {CreationProjectPage,CreationProjectKind} from '~/features/projects/types'

interface DirectoryItem {
  is_favorite?:boolean;deleted_at?:string|null
  id:string;kind:'creation'|'drama';title:string;cover_url:string;updated_at:string;created_at:string
  sessions:Array<{id:string;title:string}>
  drama:Parameters<typeof mapDramaProjectCard>[0]|null
}
/** 后端先关联去重、统一分页；不再拼接各自前一百条会话和某页短剧。 */
export const creationProjectService={
  /** 使用带类型的目录身份，不把会话编号提交给短剧接口。 */
  patch(item:{id:string},body:{title?:string;is_favorite?:boolean;cover?:{item_id:string;version_id:string;purpose:string}|null}){const [kind,key]=item.id.split(':');return request(`/creation/projects/${kind}/${key}`,{method:'PATCH',body})},
  /** 必须取得对应项目的软删除回执，不能把任意2xx当作删除成功。 */
  async archive(item:{id:string}){
    const [kind,key]=item.id.split(':')
    const result=await request<{id:string;is_deleted:boolean}>(`/creation/projects/${kind}/${key}`,{method:'DELETE'})
    if(result.id!==item.id||result.is_deleted!==true)throw new Error('服务未确认该项目已移入回收站，请刷新核对后重试。')
    return result
  },
  restore(item:{id:string}){const [kind,key]=item.id.split(':');return request(`/creation/projects/${kind}/${key}/restore`,{method:'POST'})},
  async list(limit=20,offset=0,kind:CreationProjectKind='all',signal?:AbortSignal,trash=false):Promise<CreationProjectPage>{
    const page=await request<{items:DirectoryItem[];total:number;offset:number;limit:number}>('/creation/projects',{query:{limit,offset,kind,trash},signal})
    return {...page,items:page.items.map(row=>({
      ...(row.drama?mapDramaProjectCard(row.drama):{projectId:'',status:'conversation',currentStage:'',genre:'',tags:[],entryIntent:'general' as const,effectiveMode:'general' as const,style:'',aspectRatio:'',resolution:'',totalEpisodes:0,completedStoryboards:0,totalStoryboards:0,analysisProgress:0}),
      id:row.id,kind:row.kind,title:row.title,coverImageUrl:row.cover_url||'',sessions:row.sessions,isFavorite:!!row.is_favorite,deletedAt:row.deleted_at||null,
      updatedAt:row.updated_at,createdAt:row.created_at,
    }))}
  },
}
