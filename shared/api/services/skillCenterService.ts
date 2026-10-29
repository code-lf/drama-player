import { request } from '~/shared/api/adapters/httpAdapter'
import type { SystemSkill, CreationCatalog } from '~/features/creation/types'
import type { LibraryReference } from '~/entities/library/types'
import type {AuthoringMessage,AuthoringProposal} from '~/features/creation/skillAuthoringPreview'
import type {SkillFlow} from '~/features/creation/skillExecutionFlow'

/** 私有技能与平台技能共用目录；保存使用版本号防止覆盖并发编辑。 */
/** 检查意见只作对话展示，不写入技能配置或执行授权。 */
export interface SkillRecipe { base_code: string; expected_version: number; config: Record<string, any>; references: LibraryReference[]; review?: string }
/** 超时只允许显式结束本次等待，不代表供应商已取消或可以自动重发。 */
export interface SkillAuthoringResult {accepted_at?:string;recovery_available?:boolean;ended_by_user?:boolean;late_response_received?:boolean;events?:import('~/features/creation/processEvents').ProcessEvent[]}
/** 整理命令仅携带文字候选；processing恢复只读，不自动再次调用模型。 */
export interface SkillAuthoringResult {request_id:string;source_revision:number;operation:'edit'|'convert';status:'processing'|'ready'|'failed';description:string;base_references:LibraryReference[];base_config:Record<string,any>;base_flow?:SkillFlow|null;base_mode?:'document'|'steps';error?:string;result?:SkillRecipe & {execution_flow?:SkillFlow}}
/** 编辑草稿不是已发布技能，也不包含任务执行许可。 */
export interface SkillDraft {id:string;revision:number;recipe:SkillRecipe;editing_key:string;conversation?:AuthoringMessage[];proposal?:AuthoringProposal|null;execution_flow?:SkillFlow|null;authoring_mode?:'document'|'steps';authoring_references?:LibraryReference[];acknowledged_authoring?:string;authoring?:SkillAuthoringResult;completion?:{skill_key:string;version:number}}
export const skillCenterService = {
  endAuthoringWait:(id:string,body:{expected_revision:number;request_id:string})=>request<SkillAuthoringResult>(`/creation/skills/drafts/${encodeURIComponent(id)}/end-authoring-wait`,{method:'POST',body}),
  // 冻结草稿直接进入空画布；与完成接口分离，不创建正式版本或媒体授权。
  trialDraft:(id:string,body:{expected_revision:number;request_id:string})=>request<{session:{id:string};skill:SystemSkill}>(`/creation/skills/drafts/${encodeURIComponent(id)}/trial`,{method:'POST',body}),
  draftAssist:(id:string,body:{request_id:string;expected_revision:number;description:string;operation:'edit'|'convert'})=>request<SkillAuthoringResult>(`/creation/skills/drafts/${encodeURIComponent(id)}/assist`,{method:'POST',body}),
  authoringCapabilities:(base_code:string)=>request<{models:Array<{code:string;target:string;name?:string}>;styles?:CreationCatalog['styles']}>('/creation/skills/authoring-capabilities',{query:{base_code}}),
  finishDraft: (id:string, body:{expected_revision:number;request_id:string}) => request<{skill:SystemSkill;draft_id:string;revision:number}>(`/creation/skills/drafts/${encodeURIComponent(id)}/finish`,{method:'POST',body}),
  readDraft: (id:string) => request<SkillDraft>(`/creation/skills/drafts/${encodeURIComponent(id)}`),
  writeDraft: (id:string, body:{expected_revision:number;request_id:string;recipe:SkillRecipe;editing_key:string;conversation?:AuthoringMessage[];proposal?:AuthoringProposal|null;execution_flow?:SkillFlow|null;authoring_mode?:'document'|'steps';authoring_references?:LibraryReference[];acknowledged_authoring?:string}) => request<SkillDraft>(`/creation/skills/drafts/${encodeURIComponent(id)}`,{method:'PUT',body}),
  resources: () => request<{ help_url: string; follow_qr: string; user_skills_enabled: boolean; creator_document_codes: string[] }>('/creation/skills/resources'),
  watermark: () => request<{ enabled: boolean }>('/creation/skills/watermark-preference'),
  saveWatermark: (enabled: boolean) => request('/creation/skills/watermark-preference', { method:'PUT', body:{enabled} }),
  list: () => request<{ skills: SystemSkill[]; user_skills_enabled: boolean }>('/creation/skills'),
  detail: (key: string) => request<SystemSkill>(`/creation/skills/${encodeURIComponent(key)}`),
  save: (recipe: SkillRecipe, key?: string) => request<SystemSkill>(key ? `/creation/skills/${encodeURIComponent(key)}` : '/creation/skills', { method: key ? 'PUT' : 'POST', body: recipe }),
  archive: (key: string) => request(`/creation/skills/${encodeURIComponent(key)}/archive`, { method: 'POST' }),
  favorite: (key: string, enabled: boolean) => request(`/creation/skills/${encodeURIComponent(key)}/favorite`, { method: 'PUT', body: { enabled } }),
  // 旧导出默认兼容历史编辑器，制造机显式请求保留原始 Markdown。
  export: (key: string, preserveMarkdown = false) => request<{ format: string; license: string; skill: SkillRecipe }>(`/creation/skills/${encodeURIComponent(key)}/export`, {query:preserveMarkdown?{preserve_markdown:true}:{}}),
  importPreview: (content: string,base_code?:string) => request<SkillRecipe>('/creation/skills/import-preview', { method: 'POST', body: { content,...(base_code?{base_code}:{}) } }),
  assist: (base_code: string, description: string, current_config?: Record<string,any>, conversation?:AuthoringMessage[],references?:LibraryReference[]) => request<SkillRecipe>('/creation/skills/assist',{method:'POST',body:{base_code,description,current_config,conversation,references}}),
}
