import { request, buildProductImagePayload, buildProductVideoPayload, mapProductVideoTask } from '~/shared/api/adapters/httpAdapter'

/** 合规候选经服务端校验后必须人工核对，不能被会话免确认设置跳过。 */
export interface CreationRun { response_phase?:'queued'|'thinking'|'responding'; requires_manual_confirmation?: boolean; reference_previews?: Record<string, import('~/features/creation/types').WorkspacePreview> }
import type { ProductImageGeneratePayload } from '~/entities/product-image/types'
import type { ProductVideoCreatePayload } from '~/entities/product-video/types'
import type { MusicQuote, MusicTask } from '~/shared/api/services/musicService'
import type { WorkspaceSource } from '~/features/creation/types'
import type { CreationCatalog, CreationDraft, CreationEntryType, CreationMessage, CreationSession, CreationTarget, DirectorPreview, SkillExecution } from '~/features/creation/types'

/** 会话只保存用户需求及任务编号，报价/扣点继续走现有业务服务。 */
export const creationService = {
  /** 阶段翻页只保存答案；提交后再由既有 advance 领取一次文字分析。 */
  beginStage: (id:string) => request<CollectionStage>(`/creation/runs/${id}/stage`,{method:'POST'}),
  saveStage: (id:string, body:{expected_revision:number;request_id:string;answers:Record<string,unknown>},submit=false) => request<CollectionStage>(`/creation/runs/${id}/stage${submit?'/submit':''}`,{method:submit?'POST':'PATCH',body}),
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
  startRun: (draft: CreationDraft, request_id: string, session_id?: string,current_source?:WorkspaceSource,parent_run_id?:string|null) => request<CreationRun>('/creation/runs', {method:'POST',body:{draft,request_id,session_id,current_source,parent_run_id,mode:draft.skill?'skill':'chat',deferred:true}}),
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
  catalog: (entry: CreationEntryType) => request<CreationCatalog>('/creation/catalog', { query: { entry } }),
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
export interface CollectionStage {definition:{id:string;title:string;fields:Array<{id:string;label:string;kind:'text'|'single'|'multiple'|'reference';required:boolean;options:string[]}>};answers:Record<string,unknown>;revision:number;status:'collecting'|'submitted'}
export interface CreationRun {collection_stage?:CollectionStage}
export interface MvAlignment {id:string;version_id:string;status:string;source:string;duration_ms:number;cues:MvLyricCue[];lyrics:string;input_revision:string;error:string;can_retry:boolean}
export interface CreationRun { task_input?:{schema_version:1;revision:number;prompt:string;skill:string;skill_version:number;target:CreationTarget;parameters:Partial<CreationDraft['parameters']>;references:CreationDraft['references']}; response_started_at?:string|null;response_finished_at?:string|null;response_elapsed_ms?:number|null;response_first_text_at?:string|null; stream_seq?:number; parent_run_id?:string|null;generation_prompt?:string; discussion?:Array<{user:string;reply:string}>; awaiting_calls?:number; executed_request?:unknown; question_revision?:number; created_at?:string; stream_text?:string; id: string; session_id?:string|null; status: string; calls: number; skill: string; version: number; draft: CreationDraft; restored_answer?:string; question?: {text:string;options:string[];kind?:'text'|'single'|'multiple'|'reference';label?:string;field_id?:string}; answers: Array<{question:string;answer:string}>; error?: string; preview?: DirectorPreview; revision?:number; card?:{type:'reply'|'proposal';text:string;skill?:string;target?:string;model?:string} }
