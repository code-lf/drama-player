import { request, buildProductImagePayload, buildProductVideoPayload, mapProductVideoTask } from '~/shared/api/adapters/httpAdapter'

/** 合规候选经服务端校验后必须人工核对，不能被会话免确认设置跳过。 */
export interface CreationRun { response_phase?:'queued'|'thinking'|'responding'; requires_manual_confirmation?: boolean; reference_previews?: Record<string, import('~/features/creation/types').WorkspacePreview>; /** 真实原文读取来源；不携带正文、签名地址或费用许可。 */ document_reads?:Array<{item_id:string;version_id:string;name:string;version_no:number;start:number;end:number;chars:number}> }
/** 根图只公开阶段和待恢复命令身份，不将服务器执行参数或许可交给客户端重建。 */
export type FlowAction='plan'|'edit'|'quote'|'prepare'|'confirm'|'materialize'|'compose'|'retry_composition'
export interface CreationRun {flow_runtime?:{engine:'langgraph';version:string;skill_version:number;phase:string;sequence:number;events?:import('~/features/creation/processEvents').ProcessEvent[];pending_command?:{action:FlowAction;request_id:string}}}
import type { ProductImageGeneratePayload } from '~/entities/product-image/types'
import type { ProductVideoCreatePayload } from '~/entities/product-video/types'
import type { MusicQuote, MusicTask } from '~/shared/api/services/musicService'
import type { WorkspaceSource } from '~/features/creation/types'
import type { CreationCatalog, CreationDraft, CreationEntryType, CreationMessage, CreationSession, CreationTarget, DirectorPreview, SkillExecution } from '~/features/creation/types'

/** 会话只保存用户需求及任务编号，报价/扣点继续走现有业务服务。 */
export const creationService = {
  // 原技能重新整理只创建新文字轮次，服务端固定版本/素材并强制重新确认费用。
  retryPlanning:(id:string,request_id:string,expected_calls:number)=>request<CreationRun>(`/creation/runs/${id}/retry-planning`,{method:'POST',body:{request_id,expected_calls}}),
  // 恢复必须由明确点击触发，刷新、历史读取及订阅不得调用此写接口。
  resumeFlow:(id:string,pending:{action:FlowAction;request_id:string})=>request<CreationRun>(`/creation/runs/${id}/flow/resume`,{method:'POST',body:pending}),
  // 计划编辑/核价不授予费用许可，读取也不会自动提交任务。
  videoPlan: (id:string) => request<VideoPlan>(`/creation/runs/${id}/video-plan`),
  // 图片计划使用独立协议；保存只更新修订/选择，不能误走视频报价或单图生成入口。
  imagePlan: (id:string) => request<ImageCreativePlan>(`/creation/runs/${id}/image-plan`),
  saveImagePlan: (id:string,body:ImagePlanEditCommand) => request<ImageCreativePlan>(`/creation/runs/${id}/image-plan`,{method:'PATCH',body}),
  // 逐张真实核价只接受已保存修订，不传客户端金额，也不授予生成许可。
  quoteImagePlan: (id:string,body:{expected_revision:number;request_id:string}) => request<ImageCreativePlan>(`/creation/runs/${id}/image-plan/quote`,{method:'POST',body}),
  // 一次人工确认先固定本批次输入，再提交同一修订及报价；读取不会调用这两个入口。
  prepareImageBatch: (id:string,body:VideoBatchCommand) => request<ImageCreativePlan>(`/creation/runs/${id}/image-plan/prepare-execution`,{method:'POST',body}),
  confirmImageBatch: (id:string,body:VideoBatchCommand) => request<ImageCreativePlan>(`/creation/runs/${id}/image-plan/confirm`,{method:'POST',body}),
  // 正式准备不收费；只有独立确认点击才调用 confirm，不由恢复/轮询触发。
  prepareVideoBatch:(id:string,body:VideoBatchCommand)=>request<VideoPlan>(`/creation/runs/${id}/video-plan/prepare-execution`,{method:'POST',body}),
  confirmVideoBatch:(id:string,body:VideoBatchCommand)=>request<VideoPlan>(`/creation/runs/${id}/video-plan/confirm`,{method:'POST',body}),
  // 重试只产生待核价草案，后续仍需重新展示合计并确认，不携带旧费用许可。
  retryVideoBatch:(id:string,body:{expected_revision:number;request_id:string;item_ids:string[]})=>request<{run_id:string;plan:VideoPlan}>(`/creation/runs/${id}/video-plan/retry`,{method:'POST',body}),
  /** 图片失败重试仅建立待核价计划，不能沿用原批次许可直接生成。 */
  retryImageBatch:(id:string,body:{expected_revision:number;request_id:string;item_ids:string[]})=>request<{run_id:string;plan:ImageCreativePlan}>(`/creation/runs/${id}/image-plan/retry`,{method:'POST',body}),
  // 工作台编辑成功作品只创建新草案；仍走原计划核价和费用确认。
  reviseCompletedVideo:(id:string,body:{expected_revision:number;request_id:string;selected_ids:string[];items:Array<{id:string;title:string;prompt:string;parameters?:Partial<import('~/features/creation/agentCanvas').CreativeNodeParameters>}>})=>request<{run_id:string}>(`/creation/runs/${id}/video-plan/revise-completed`,{method:'POST',body}),
  composeVideoBatch:(id:string,expected_revision:number)=>request<import('./videoCompositionService').CompositionJob>(`/creation/runs/${id}/video-plan/compose-all`,{method:'POST',body:{expected_revision}}),
  saveVideoPlan: (id:string, body:{expected_revision:number;request_id:string;selected_ids:string[];items:Array<{id:string;title:string;prompt:string;parameters?:Partial<import('~/features/creation/agentCanvas').CreativeNodeParameters>}>}) => request<VideoPlan>(`/creation/runs/${id}/video-plan`,{method:'PATCH',body}),
  quoteVideoPlan: (id:string, body:{expected_revision:number;request_id:string}) => request<VideoPlan>(`/creation/runs/${id}/video-plan/quote`,{method:'POST',body}),
  /** 阶段翻页只保存答案；提交后再由既有 advance 领取一次文字分析。 */
  beginStage: (id:string) => request<CollectionStage>(`/creation/runs/${id}/stage`,{method:'POST'}),
  stageText: (id:string,body:{expected_revision:number;request_id:string;answers:Record<string,unknown>;text:string;cursor?:number}) => request<CollectionStage>(`/creation/runs/${id}/stage/text`,{method:'POST',body}),
  saveStage: (id:string, body:{expected_revision:number;request_id:string;answers:Record<string,unknown>;cursor?:number},submit=false) => request<CollectionStage>(`/creation/runs/${id}/stage${submit?'/submit':''}`,{method:submit?'POST':'PATCH',body}),
  /** 复用统一鉴权请求读取持久化事件流，不将认证令牌拼到 URL。 */
  async observeRun(id:string,signal:AbortSignal,onState:(state:CreationRun)=>void,minCalls=0){
    let attempt=0
    let finished=false
    while(!signal.aborted&&!finished){
    try{
    const stream=await request<ReadableStream<Uint8Array>>(`/creation/runs/${id}/events`,{responseType:'stream',signal,query:{min_calls:minCalls}})
    const reader=stream.getReader(),decoder=new TextDecoder()
    let buffered=''
    try{
      while(!signal.aborted){
        const value=await reader.read()
        if(value.done)break
        buffered+=decoder.decode(value.value,{stream:true})
        let end:number
        while((end=buffered.indexOf('\n\n'))>=0){
          const frame=buffered.slice(0,end);buffered=buffered.slice(end+2)
          const data=frame.split('\n').filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n')
          if(data){
            const state=JSON.parse(data) as CreationRun
            if(state.calls>=minCalls||state.status==='cancelled'){finished=state.status!=='planning';attempt=0;onState(state)}
          }
        }
      }
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    }catch{if(signal.aborted)return}
    if(!signal.aborted&&!finished){
      // 断线先读取已持久化状态；等待卡已落盘时不再困在旧的思考动画。
      try{const state=await creationService.run(id);if(!signal.aborted&&(state.calls>=minCalls||state.status==='cancelled')){onState(state);finished=state.status!=='planning'}}catch{/* 网络仍不可用时按退避重连。 */}
    }
    if(!signal.aborted&&!finished){
      // 断线后只重连只读事件，不重放模型请求、执行许可或自动生成倒计时。
      await new Promise<void>(resolve=>{
        const complete=()=>{clearTimeout(timer);signal.removeEventListener('abort',complete);resolve()}
        const timer=setTimeout(complete,Math.min(15000,1000*2**Math.min(attempt++,4)))
        signal.addEventListener('abort',complete,{once:true})
      })
    }
    }
  },
  runs: (id:string) => request<CreationRun[]>(`/creation/sessions/${id}/runs`),
  advanceRun: (id:string) => request<CreationRun>(`/creation/runs/${id}/advance`,{method:'POST'}),
  cancelMedia: (kind:string,id:string) => request(`/creation/tasks/${kind}/${id}/cancel`,{method:'POST'}),
  rules: (id:string) => request<{revision:number;rules:{image:boolean;audio:boolean;video:boolean;cooldown:boolean;threshold:number}}>(`/creation/sessions/${id}/confirmation-rules`),
  saveRules: (id:string,revision:number,rules:Record<string,unknown>) => request(`/creation/sessions/${id}/confirmation-rules`,{method:'PUT',body:{revision,rules}}),
  authorize: (id:string,kind:string,payload:unknown,expected_credits:number,automatic=false) => request<{id:string;credits:number;countdown:number;revision:number}>(`/creation/runs/${id}/permission`,{method:'POST',body:{kind,payload,expected_credits,automatic}}),
  revoke: (run:string,id:string) => request(`/creation/runs/${run}/permission/${id}`,{method:'DELETE'}),
  activity: (session: string) => request<Record<string,{phase:string;label:string;progress:number|null;can_cancel?:boolean;cancel_reason?:string;progress_source?:string;progress_updated_at?:string}>>(`/creation/sessions/${session}/activity`),
  // 草稿与确定性编辑仅保存数据，绝不经过生成、报价或账务入口。
  readDraft: (scope: string) => request<import('~/features/creation/types').WorkspaceDraftResponse>('/creation/drafts', {query:{scope}}),
  saveDraft: (scope: string, revision: number, content: CreationDraft) => request<import('~/features/creation/types').WorkspaceDraftResponse>('/creation/drafts', {method:'PUT',query:{scope},body:{revision,content}}),
  sourceMedia: (source: import('~/features/creation/types').WorkspaceSource) => request<Blob>('/creation/source-media', {query:{source:JSON.stringify(source)},responseType:'blob'}),
  saveArtifact: (session: string, file: Blob, source: import('~/features/creation/types').WorkspaceSource, operations: Record<string,unknown>[], requestId: string) => {
    const body=new FormData();body.append('file',file,'编辑作品.png');body.append('source',JSON.stringify(source));body.append('operations',JSON.stringify(operations));body.append('request_id',requestId)
    return request<import('~/features/creation/types').WorkspaceArtifact>(`/creation/sessions/${session}/artifacts`,{method:'POST',body})
  },
  imageTask: (payload: ProductImageGeneratePayload) => request<{batch_id:string}>('/creation/tasks/image',{method:'POST',body:buildProductImagePayload(payload)}),
  videoTask: async (payload: ProductVideoCreatePayload) => mapProductVideoTask(await request('/creation/tasks/video',{method:'POST',body:buildProductVideoPayload(payload)})),
  // 音乐工作台与图片、视频一样携带配方快照；旧音乐工具继续使用独立接口。
  musicTask: (operation:string, inputs:Record<string,unknown>, rights_confirmed:boolean, request_id:string, quote:MusicQuote, creation_context:string) => request<MusicTask>('/creation/tasks/music',{method:'POST',body:{operation,inputs,rights_confirmed,request_id,quote:quote.quote,signature:quote.signature,creation_context}}),
  // 文字规划只保存状态与问题，媒体收费仍需下一次显式点击生成。
  // 文本节点显式使用既有chat模式；不依赖上一次选中的媒体技能，也不获得媒体执行权限。
  startRun: (draft: CreationDraft, request_id: string, session_id?: string,current_source?:WorkspaceSource,parent_run_id?:string|null,mode?:'chat'|'skill') => request<CreationRun>('/creation/runs', {method:'POST',body:{draft,request_id,session_id,current_source,parent_run_id,mode:mode??(draft.skill?'skill':'chat'),deferred:true}}),
  run: (id: string) => request<CreationRun>(`/creation/runs/${id}`),
  runByRequest: (id:string) => request<CreationRun>(`/creation/runs/by-request/${id}`),
  savePreview: (id:string,preview:DirectorPreview) => request<DirectorPreview>(`/creation/runs/${id}/preview`,{method:'PATCH',body:{title:preview.title,script:preview.script,expected_revision:preview.preview_revision||0}}),
  previousQuestion: (id:string,expected_calls:number,expected_revision?:number) => request<CreationRun>(`/creation/runs/${id}/back`,{method:'POST',body:{expected_calls,expected_revision}}),
  answerRun: (id: string, expected_calls: number, answer: string,expected_revision?:number,draft?:CreationDraft) => request<CreationRun>(`/creation/runs/${id}/answer`, {method:'POST',body:{expected_calls,answer,expected_revision,draft}}),
  cancelRun: (id: string) => request<CreationRun>(`/creation/runs/${id}/cancel`, {method:'POST'}),
  mv: (draft: CreationDraft) => request<DirectorPreview>('/creation/mv/prepare',{method:'POST',body:draft}),
  // 对齐由平台承担且按固定歌曲去重；刷新只 GET，不重放创建或明确重试。
  startMvAlignment: (draft:CreationDraft,retry=false) => request<MvAlignment>('/creation/mv/alignments',{method:'POST',body:{draft,retry}}),
  mvAlignment: (id:string,confirmation='') => request<MvAlignment>(`/creation/mv/alignments/${id}`,{query:{confirmation}}),
  confirmMvAlignment: (id:string,lyrics:string,cues:MvLyricCue[],input_revision:string) => request<{alignment_id:string;confirmation:string;lyrics:string}>(`/creation/mv/alignments/${id}/confirm`,{method:'POST',body:{lyrics,cues,input_revision}}),
  // 只读取或补建平台内含歌词；外部音频没有转写能力时明确手填。
  mvLyrics: (draft: CreationDraft) => request<{status:string;source:string;lyrics:string;timing_mode:string;can_transcribe:boolean}>('/creation/mv/lyrics',{method:'POST',body:draft}),
  attachMv: (project: string, run_id: string) => request(`/creation/mv/projects/${project}/attach`,{method:'POST',body:{run_id}}),
  // MV 来源导入只接收音频地址，不伪造用户授权勾选；服务端仍验证下载安全与真实媒体。
  importAudio: (url: string) => request<import('~/entities/library/types').LibraryItem>('/creation/mv/audio-import',{method:'POST',body:{url}}),
  // 本人试用会话需要载入冻结技能；普通目录不携带或公开试用配置。
  catalog: (entry: CreationEntryType, session_id?:string) => request<CreationCatalog>('/creation/catalog', { query: { entry, ...(session_id?{session_id}:{}) } }),
  publicCatalog: (entry: CreationEntryType) => request<CreationCatalog>('/creation/public-catalog', {query:{entry}}),
  // 免费编译配方，返回真实素材校验后的提示词和固定版本；不创建生成任务。
  directorFile: (draft:CreationDraft,file:File) => {
    const body=new FormData();body.append('file',file);body.append('draft',JSON.stringify(draft))
    return request<DirectorPreview>('/drama/director-draft/file',{method:'POST',body})
  },
  prepareSkill: (draft: CreationDraft) => request<{ draft: CreationDraft; execution: SkillExecution; creation_context: string }>('/creation/skills/prepare', { method: 'POST', body: draft }),
  route: (draft: CreationDraft) => request<{ skill: string; target: CreationTarget; reason: string }>('/creation/route-preview', { method: 'POST', body: draft }),
  // 侧栏默认少量，项目目录按后端上限读取一百条会话。
  sessions: (limit = 30, offset = 0) => request<CreationSession[]>('/creation/sessions', { query: { limit, offset } }),
  session: (id: string, signal?: AbortSignal) => request<CreationSession>(`/creation/sessions/${id}`, { signal }),
  // 名称由服务端校验并持久化，保存成功后再更新侧栏显示。
  renameSession: (id: string, title: string) => request<CreationSession>(`/creation/sessions/${id}`, { method: 'PATCH', body: { title } }),
  create: (session: Pick<CreationSession, 'id' | 'entry' | 'title' | 'skill'>) => request<CreationSession>('/creation/sessions', { method: 'POST', body: session }),
  message: (id: string, request_id: string, content: CreationDraft, task_type: CreationTarget | '' = '', task_id = '') => request<CreationMessage>(`/creation/sessions/${id}/messages`, { method: 'POST', body: { request_id, content, task_type, task_id } }),
  bind: (id: string, message: string, task_type: CreationTarget, task_id: string) => request<CreationMessage>(`/creation/sessions/${id}/messages/${message}/task`, { method: 'PATCH', body: { task_type, task_id } }),
  director: (draft: CreationDraft, entry_intent: 'ad' | 'general') => request<DirectorPreview>('/drama/director-draft', { method: 'POST', body: { ...draft, input_mode:draft.parameters.extra.director_input_mode==='script'?'script':'idea', entry_intent, duration_sec: draft.parameters.durationSec, style: draft.parameters.style } }),
}
/** 对齐时间为原歌曲毫秒，片段偏移仅在创建制作快照时应用。 */
export interface MvLyricCue {sort_index:number;start_ms:number;end_ms:number;text:string}
/** 阶段定义仅描述表单，不包含工具地址或费用授权。 */
export interface CollectionStage {definition:{id:string;title:string;fields:Array<{id:string;label:string;kind:'text'|'single'|'multiple'|'reference';required:boolean;options:string[]}>};answers:Record<string,unknown>;revision:number;cursor?:number;notes?:string[];feedback?:string;status:'collecting'|'submitted'}
export interface CreationRun {collection_stage?:CollectionStage}
/** 计划总量独立于所选条目；内部签名/工具入参不由客户端管理。 */
export interface VideoPlanItem {id:string;title:string;prompt:string;parameters:Partial<CreationDraft['parameters']>;references:CreationDraft['references'];creative?:{hook_description?:string}|null}
/** 图片计划与视频计划分开类型；每张固定count=1，总需求及所选条目独立保存。 */
export type ImagePlanParameters=Partial<Pick<import('~/features/creation/agentCanvas').CreativeNodeParameters,'model'|'style'|'styleId'|'aspectRatio'|'resolution'|'quality'>>
export interface ImagePlanItem {id:string;sort_index:number;title:string;prompt:string;parameters:ImagePlanParameters&{count:1};references:CreationDraft['references'];creative?:Record<string,unknown>|null;content_source?:string}
export interface ImagePlanPrice {id:string;plan_revision:number;item_ids:string[];items:Array<{id:string;title:string;credits:number;model:string;aspect_ratio:string;resolution:string;quality:string}>;total_credits:number;current_balance:number;sufficient:boolean;expires_at:number;expired:boolean;execution_available:boolean}
export interface ImageCreativePlan {schema_version:1;revision:number;target:'image';plan_type:'product_set'|'detail_page';total_count:number;selected_ids:string[];items:ImagePlanItem[];status:string;skill:string;skill_version:number;unverified_facts:string[];quote:ImagePlanPrice|null;execution_available:boolean;batch_supported?:boolean}
/** 客户端不能传引用、价格、总需求数或执行许可；相同请求号用于同一保存的网络重试。 */
export interface ImagePlanEditCommand {expected_revision:number;request_id:string;selected_ids:string[];items?:Array<{id:string;title:string;prompt:string;parameters?:ImagePlanParameters}>}
export interface CreationRun {image_plan?:ImageCreativePlan}
/** 图阶段来自统一服务端投影；前端保存图片计划时不能保留过期的根图阶段。 */
export interface ImageCreativePlan {flow_runtime?:CreationRun['flow_runtime']}
export interface ImageCreativePlan {retry_of?:string}
export interface ImageBatchItem {retry_run_id?:string}
/** 每张图片直接读取原图片任务，业务成功和文件可交付分别展示。 */
export interface ImageBatchItem {item_id:string;task_id:string;status:string;delivery_status:string;progress?:number|null;detail?:string;error?:string;error_code?:string;results:Array<{id:string;status:string;image_url:string}>}
export interface ImageCreativePlan {batch?:{request_id:string;quote_id:string;plan_revision:number;total_credits:number;items:ImageBatchItem[];completed?:number;generated_count?:number;failed?:number;unknown?:number;selected_count?:number}}
export interface VideoPlan {schema_version:number;revision:number;total_count:number;selected_ids:string[];items:VideoPlanItem[];status:string;allocation_note:string;unverified_facts?:string[];quote?:{id:string;plan_revision:number;item_ids:string[];items:Array<{id:string;title:string;credits:number;model:string;duration_sec:number;aspect_ratio:string;resolution:string}>;total_credits:number;current_balance:number;sufficient:boolean;expires_at:number;expired:boolean;execution_available:boolean}|null}
// 改稿来源仅用于同会话恢复已保存提示词，不是执行许可。
export interface CreationRun {mode?:'chat'|'skill';creative_plan?:VideoPlan;superseded_by?:string;revision_parent?:string;retry_of?:string}
/** 命令只绑定服务端修订和报价，不传客户端计算的金额或执行签名。 */
export interface VideoBatchCommand {expected_revision:number;quote_id:string;request_id:string}
export interface VideoBatchItem {item_id:string;task_id:string;status?:string;progress?:number|null;detail?:string;error?:string;retry_run_id?:string|null;results?:Array<{id:string;status:string;video_url:string;cover_url?:string}>}
export interface VideoPlan {flow_runtime?:CreationRun['flow_runtime'];batch_supported?:boolean;batch?:{request_id:string;quote_id:string;plan_revision:number;items:VideoBatchItem[];completed?:number;failed?:number;selected_count?:number}}
export interface MvAlignment {id:string;version_id:string;status:string;source:string;duration_ms:number;cues:MvLyricCue[];lyrics:string;input_revision:string;error:string;can_retry:boolean}
export interface CreationRun { task_input?:{schema_version:1;revision:number;prompt:string;skill:string;skill_version:number;target:CreationTarget;parameters:Partial<CreationDraft['parameters']>;references:CreationDraft['references']}; response_started_at?:string|null;response_finished_at?:string|null;response_elapsed_ms?:number|null;response_first_text_at?:string|null; stream_seq?:number; parent_run_id?:string|null;generation_prompt?:string; discussion?:Array<{user:string;reply:string}>; awaiting_calls?:number; executed_request?:unknown; question_revision?:number; created_at?:string; stream_text?:string; id: string; session_id?:string|null; status: string; calls: number; skill: string; version: number; draft: CreationDraft; restored_answer?:string; question?: {text:string;options:string[];kind?:'text'|'single'|'multiple'|'reference';label?:string;field_id?:string}; answers: Array<{question:string;answer:string}>; error?: string; preview?: DirectorPreview; revision?:number; card?:{type:'reply'|'proposal';text:string;skill?:string;target?:string;model?:string} }
