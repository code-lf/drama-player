import { callApi } from '~/shared/api/client'
import {request} from '~/shared/api/adapters/httpAdapter'
import type {SystemAnnouncement} from '~/entities/announcement/types'

export const announcementService = {
  /** 时间线按服务端稳定顺序逐页读取，不把初始五条当成全部公告。 */
  async feed(offset=0,signal?:AbortSignal){
    const result=await request<{items:Array<Record<string,any>>;total:number;next_offset:number|null}>('/announcements/feed',{query:{offset,limit:10},signal})
    return {...result,items:result.items.map(row=>({id:row.id,title:row.title,content:row.content,level:row.level,placement:row.placement,linkText:row.link_text,linkUrl:row.link_url,isPinned:row.is_pinned,dismissible:row.dismissible,sortOrder:row.sort_order,startsAt:row.starts_at,endsAt:row.ends_at,createdAt:row.created_at,updatedAt:row.updated_at} as SystemAnnouncement))}
  },
  async getActive(placement = 'global') {
    return callApi('announcement/active', (adapter) => adapter.getActiveAnnouncements(placement))
  }
}
