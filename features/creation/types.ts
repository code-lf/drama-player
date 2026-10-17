import type { LibraryReference } from '~/entities/library/types'
import type { GenerationProfile } from '~/shared/api/types'
import type { MusicOperation } from '~/shared/api/services/musicService'

/** 用途入口不限制后续产物；技能才决定一次提交的目标服务。 */
export type CreationEntryType = 'free' | 'drama' | 'commerce' | 'music' | 'image'
export type CreationTarget = 'image' | 'video' | 'music' | 'drama'
export interface SystemSkill { id: string; label: string; target: CreationTarget; entries: CreationEntryType[]; media_types: string[]; version: number; category: string; description: string; requirement: string; cover: string; workflows: Array<'direct' | 'director'>; required_media: string[]; defaults?: Partial<CreationParameterState>; base_code?: string; kind?: 'platform' | 'user'; is_active?: boolean; is_favorite?: boolean; recommended_entries?: CreationEntryType[]; model_strategy?: 'free' | 'candidates' | 'fixed'; default_model?: string; allowed_models?: string[]; minimum_duration_sec?: number; allowed_parameter_keys?: string[]; instructions?: string; examples?: string[]; questions?: string[] }
export interface SkillExecution { code: string; version: number; label: string; workflow: string; target: CreationTarget; steps: string[] }
// 模板字段依旧提交纯文本；字段名只用于前端定位编辑，不提交 HTML。
export type ComposerSegment = { type: 'text'; text: string; field?: string } | { type: 'reference'; version_id: string; label: string }
export interface ComposerReference extends LibraryReference { name: string; media_type: string; preview_url: string; /** 歌曲封面仅用于展示，不能拿音频预览地址当图片。 */ cover_url?: string }
export interface CreationParameterState {
  model: string; style: string; styleId: string; aspectRatio: string; durationSec: number; resolution: string
  count: number; quality: 'low' | 'medium' | 'high'; output: 'auto' | CreationTarget; workflow: 'direct' | 'director'
  templateId: string; selectedTemplateId: string; musicMode: 'create' | 'mv'; musicOperation: string; sourceTask: string; audioIndex: number
  customLyrics: boolean; rightsConfirmed: boolean; sourceUrl: string; extra: Record<string, unknown>
}
export interface CreationDraft {
  entry: CreationEntryType; skill: string; prompt: string; references: LibraryReference[]
  skill_version?: number; original_prompt?: string; generation_prompt?: string
  parameters: CreationParameterState & { reference_types?: string[] }; reference_names: Record<string, string>; segments: ComposerSegment[]
}
export interface CreationMessage { id: string; request_id: string; role: string; content: CreationDraft; task_type: CreationTarget | ''; task_id: string; created_at: string; skill_execution?: SkillExecution }
export interface WorkspaceSource { kind: 'image' | 'video' | 'music' | 'artifact' | 'reference'; id: string; result_id?: string; item_id?: string; audio_index?: number }
export interface WorkspacePreview { available: boolean; name: string; media_type?: string; preview_url?: string }
export interface WorkspaceArtifact { id: string; source: WorkspaceSource; operations: Record<string, unknown>[]; item_id: string; version_id: string; preview_url: string; created_at: string }
export interface WorkspaceDraftResponse { revision: number; content: CreationDraft | null; updated_at?: string }
export interface CreationSession { id: string; entry: CreationEntryType; title: string; skill: string; updated_at: string; messages?: CreationMessage[]; reference_previews?: Record<string, WorkspacePreview>; artifacts?: WorkspaceArtifact[] }
export interface CreationTemplate { id: string; name: string; category: string; cover: string; prompt: string; skill: string; parameters?: Partial<CreationParameterState>; source?: 'image' | 'video'; description?: string; example_image?: string; example_refs?: LibraryReference[]; preview_video?: string; is_featured?: boolean }
export interface CreationCatalog {
  capabilities?: {platform:Record<'image'|'video'|'music',{enabled:boolean;models?:Array<{id:string;code:string;name:string}>;operations?:MusicOperation[]}>;allowed_targets:CreationTarget[]}
  skill_models?: Record<string, Array<{id: string;code: string;name: string;description?: string;input_schema?: Record<string,any>}>>
  templates: CreationTemplate[]
  skills: SystemSkill[]; profiles: Record<string, GenerationProfile | null>; music_operations: MusicOperation[]
  image_templates: Array<{ id: string; name: string; category: string; cover_url: string; description: string; aspect_ratio: string; style_name: string }>
  video_templates: Array<{ id: string; name: string; category: string; cover_url: string; description: string; aspect_ratio: string; duration_sec: number }>
  styles: Array<{ style_id: string; display_name: string; render_medium: string; runtime_style_prefix: string; cover_url?: string }>
}
export interface DirectorPreview { title: string; summary: string; script: string; material_suggestions: string[]; mv_run_id?: string; mv_duration_sec?: number; director_run_id?: string }
