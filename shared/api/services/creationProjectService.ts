import {request,mapDramaProjectCard} from '~/shared/api/adapters/httpAdapter'
import type {CreationProjectPage,CreationProjectKind} from '~/features/projects/types'

interface DirectoryItem {
  id:string;kind:'creation'|'drama';title:string;cover_url:string;updated_at:string;created_at:string
  sessions:Array<{id:string;title:string}>
  drama:Parameters<typeof mapDramaProjectCard>[0]|null
}
/** 后端先关联去重、统一分页；不再拼接各自前一百条会话和某页短剧。 */
export const creationProjectService={
  async list(limit=20,offset=0,kind:CreationProjectKind='all',signal?:AbortSignal):Promise<CreationProjectPage>{
    const page=await request<{items:DirectoryItem[];total:number;offset:number;limit:number}>('/creation/projects',{query:{limit,offset,kind},signal})
    return {...page,items:page.items.map(row=>({
      ...(row.drama?mapDramaProjectCard(row.drama):{projectId:'',status:'conversation',currentStage:'',genre:'',tags:[],entryIntent:'general' as const,effectiveMode:'general' as const,style:'',aspectRatio:'',resolution:'',totalEpisodes:0,completedStoryboards:0,totalStoryboards:0,analysisProgress:0}),
      id:row.id,kind:row.kind,title:row.title,coverImageUrl:row.cover_url||'',sessions:row.sessions,
      updatedAt:row.updated_at,createdAt:row.created_at,
    }))}
  },
}
