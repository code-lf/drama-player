import {request} from '~/shared/api/adapters/httpAdapter'

/** 一个成片的片段清单，不把片段数量当独立成片数量。 */
export interface CompositionClip {
  id:string;task_id:string;result_id:string;trim_start_ms:number;trim_end_ms:number;keep_audio:boolean
}
/** 首版只开放真实存在的直切、留边、25fps 能力，不提供虚假转场开关。 */
export interface CompositionPlan {
  schema_version:1;revision:number;clips:CompositionClip[]
  output:{width:number;height:number;fps:25;fit:'contain';transition:'cut'}
}
export interface CompositionJob {
  id:string;status:'queued'|'rendering'|'succeeded'|'failed';attempt:number;plan:CompositionPlan
  error_message:string;required_credits:number
  output:{public_url?:string;duration_ms?:number;frame_count?:number;size_bytes?:number;mime_type?:string}
}
/** 成片数与每条成片的片段数独立保存，合成任务只引用本成片的明确业务编号。 */
export interface CompositionOutput {id:string;title:string;draft_revision:number;clip_count:number;job_ids:string[]}
export interface CompositionOutputs {schema_version:1;revision:number;output_count:number;outputs:CompositionOutput[];created_output_id?:string}
/** 来源绑定只描述固定方案与业务状态，不包含报价签名或执行许可。 */
// 重试来源仅用于打开原有核价/确认卡；读取不会重提任务或继承费用授权。
export interface CompositionGeneration {draft_revision:number;generation:null|{id:string;run_id:string;plan_revision:number;item_ids:string[];phase:'waiting_generation'|'ready_to_compose'|'needs_rebind';items:Array<{id:string;title:string}>;statuses:Array<{item_id:string;status:string;retry_run_id?:string|null}>}}
/** 创建仅由确认按钮调用；刷新与轮询只 GET，不自动执行或重试。 */
export const videoCompositionService={
  // 画布节点使用服务端固定绑定；GET不新增成片，POST也仅建计划、不派发合成。
  canvasOutputs:(session:string)=>request<CompositionOutputs&{outputs:Array<CompositionOutput&{canvas_node_id?:string}>}>(`/creation/sessions/${session}/canvas-compositions`),
  canvasBinding:(session:string,node:string,create=false)=>request<{node_id:string;output_id:string|null}>(`/creation/sessions/${session}/canvas/nodes/${encodeURIComponent(node)}/composition`,create?{method:'POST'}:undefined),
  generation:(session:string,id:string)=>request<CompositionGeneration>(`/creation/sessions/${session}/composition-outputs/${id}/generation`),
  bindGeneration:(session:string,id:string,body:{expected_revision:number;request_id:string;run_id:string;plan_revision:number;item_ids:string[]})=>request<CompositionGeneration>(`/creation/sessions/${session}/composition-outputs/${id}/generation`,{method:'PUT',body}),
  materialize:(session:string,id:string,expected_revision:number)=>request<{revision:number;plan:CompositionPlan}>(`/creation/sessions/${session}/composition-outputs/${id}/generation/materialize`,{method:'POST',body:{expected_revision}}),
  clearGeneration:(session:string,id:string,body:{expected_revision:number;request_id:string})=>request<CompositionGeneration>(`/creation/sessions/${session}/composition-outputs/${id}/generation/clear`,{method:'POST',body}),
  outputs:(session:string)=>request<CompositionOutputs>(`/creation/sessions/${session}/composition-outputs`),
  addOutput:(session:string,body:{expected_revision:number;request_id:string;title:string})=>request<CompositionOutputs>(`/creation/sessions/${session}/composition-outputs`,{method:'POST',body}),
  editOutputs:(session:string,body:{expected_revision:number;request_id:string;order_ids:string[];titles:Record<string,string>;removed_ids:string[]})=>request<CompositionOutputs>(`/creation/sessions/${session}/composition-outputs`,{method:'PATCH',body}),
  outputDraft:(session:string,id:string)=>request<{revision:number;plan:CompositionPlan|null}>(`/creation/sessions/${session}/composition-outputs/${id}/draft`),
  saveOutputDraft:(session:string,id:string,expected_revision:number,plan:CompositionPlan)=>request<{revision:number;plan:CompositionPlan}>(`/creation/sessions/${session}/composition-outputs/${id}/draft`,{method:'PUT',body:{expected_revision,plan}}),
  createOutputJob:(session:string,id:string,expected_revision:number)=>request<CompositionJob>(`/creation/sessions/${session}/composition-outputs/${id}/jobs`,{method:'POST',body:{expected_revision}}),
  outputJobs:(session:string,id:string)=>request<CompositionJob[]>(`/creation/sessions/${session}/composition-outputs/${id}/jobs`),
  draft:(session:string)=>request<{revision:number;plan:CompositionPlan|null}>(`/creation/sessions/${session}/composition-draft`),
  saveDraft:(session:string,expected_revision:number,plan:CompositionPlan)=>request<{revision:number;plan:CompositionPlan}>(`/creation/sessions/${session}/composition-draft`,{method:'PUT',body:{expected_revision,plan}}),
  // 返回实际解码画面容量，而非浏览器容器时长或模型目标时长。
  inspect:(task:string,result:string)=>request<{duration_ms:number;frame_count:number;fps:25;has_audio:boolean}>(`/creation/composition-sources/${task}/inspect`,{method:'POST',query:{result_id:result}}),
  create:(request_id:string,plan:CompositionPlan)=>request<CompositionJob>('/creation/video-compositions',{method:'POST',body:{request_id,plan}}),
  read:(id:string)=>request<CompositionJob>(`/creation/video-compositions/${id}`),
  list:(offset=0,limit=20)=>request<CompositionJob[]>('/creation/video-compositions',{query:{offset,limit}}),
  retry:(id:string)=>request<CompositionJob>(`/creation/video-compositions/${id}/retry`,{method:'POST'}),
}
