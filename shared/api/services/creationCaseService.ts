import { request } from '~/shared/api/adapters/httpAdapter'
import type { CreationEntryType, CreationTemplate } from '~/features/creation/types'
export interface PublicCreationCase { id:string; title:string; description:string; category?:string; category_label?:string; entries:CreationEntryType[]; cover:string; media_type:'image'|'video'|'audio'; media_url:string; template:CreationTemplate|null }
/** 案例只读公开展示，制作同款仍走原模板准备和报价，不创建收费任务。 */
export const creationCaseService = {
  list: (entry:CreationEntryType) => request<PublicCreationCase[]>('/creation/cases',{query:{entry}}),
  detail: (id:string,entry:CreationEntryType) => request<PublicCreationCase>(`/creation/cases/${id}`,{query:{entry}}),
  authorizations: () => request<Array<{id:string;task_id:string;revoked:boolean}>>('/creation/case-authorizations'),
  authorize: (task_id:string) => request('/creation/case-authorizations',{method:'POST',body:{task_id,confirmed:true}}),
  revoke: (id:string) => request(`/creation/case-authorizations/${id}/revoke`,{method:'POST'}),
}
