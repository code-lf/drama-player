import {request} from '~/shared/api/adapters/httpAdapter'
import type {EditingCommand,EditingDraft,EditingReceipt,EditingSource} from '~/features/editing/types'
import type {CompositionJob} from './videoCompositionService'

/** 新剪辑仍用原会话/成片/任务接口，GET不建稿，显式命令才保存，显式导出才派发。 */
export const editingService = {
  // AI仅返回候选，原队列以actor=agent及相同修订实际保存，支持同一份撤销历史。
  assist:(session:string,data:{request_id:string;output_id:string|null;expected_revision:number;message:string;conversation:Array<{role:'user'|'assistant';content:string}>;selected_clip_id:string|null;sources:Array<{source:EditingSource;title:string}>})=>request<{kind:'edits'|'question';expected_revision:number;operations:import('~/features/editing/types').EditingOperation[];reply:string}>(`/creation/sessions/${encodeURIComponent(session)}/editing-assistant`,{method:'POST',body:data,timeout:200000}),
  media:(source:EditingSource)=>request<ArrayBuffer>('/creation/editing-media',{method:'POST',body:{source},responseType:'arrayBuffer'}),
  read:(session:string,output:string)=>request<{output_id:string;revision:number;draft:EditingDraft}>(`/creation/sessions/${encodeURIComponent(session)}/composition-outputs/${encodeURIComponent(output)}/editing-draft`),
  apply:(session:string,output:string|null,command:EditingCommand)=>request<EditingReceipt>(`/creation/sessions/${encodeURIComponent(session)}/editing-commands`,{method:'POST',body:{output_id:output,command}}),
  // 与原服务共用任务边界；这里只读取任务身份/状态，不把v3快照误作旧clips数组消费。
  export:(session:string,output:string,revision:number)=>request<Omit<CompositionJob,'plan'>&{plan:EditingDraft}>(`/creation/sessions/${encodeURIComponent(session)}/composition-outputs/${encodeURIComponent(output)}/jobs`,{method:'POST',body:{expected_revision:revision}}),
}
