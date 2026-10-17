import { request } from '~/shared/api/adapters/httpAdapter'
import type { SystemSkill } from '~/features/creation/types'
import type { LibraryReference } from '~/entities/library/types'

/** 私有技能与平台技能共用目录；保存使用版本号防止覆盖并发编辑。 */
export interface SkillRecipe { base_code: string; expected_version: number; config: Record<string, any>; references: LibraryReference[] }
export const skillCenterService = {
  resources: () => request<{ help_url: string; follow_qr: string; user_skills_enabled: boolean; creator_document_codes: string[] }>('/creation/skills/resources'),
  watermark: () => request<{ enabled: boolean }>('/creation/skills/watermark-preference'),
  saveWatermark: (enabled: boolean) => request('/creation/skills/watermark-preference', { method:'PUT', body:{enabled} }),
  list: () => request<{ skills: SystemSkill[]; user_skills_enabled: boolean }>('/creation/skills'),
  detail: (key: string) => request<SystemSkill>(`/creation/skills/${encodeURIComponent(key)}`),
  save: (recipe: SkillRecipe, key?: string) => request<SystemSkill>(key ? `/creation/skills/${encodeURIComponent(key)}` : '/creation/skills', { method: key ? 'PUT' : 'POST', body: recipe }),
  archive: (key: string) => request(`/creation/skills/${encodeURIComponent(key)}/archive`, { method: 'POST' }),
  favorite: (key: string, enabled: boolean) => request(`/creation/skills/${encodeURIComponent(key)}/favorite`, { method: 'PUT', body: { enabled } }),
  export: (key: string) => request<{ format: string; license: string; skill: SkillRecipe }>(`/creation/skills/${encodeURIComponent(key)}/export`),
  importPreview: (content: string) => request<SkillRecipe>('/creation/skills/import-preview', { method: 'POST', body: { content } }),
  assist: (base_code: string, description: string) => request<SkillRecipe>('/creation/skills/assist',{method:'POST',body:{base_code,description}}),
}
