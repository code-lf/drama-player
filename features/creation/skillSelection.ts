import type { SystemSkill } from './types'

/** 仅显式选技能时确定新流程；历史恢复、模板及旧广告导演草稿不在这里重写。 */
export function selectedSkillWorkflow(spec?: SystemSkill): 'direct' | 'director' | undefined {
  if (spec?.id === 'ad' && spec.kind !== 'user') return 'direct'
  return spec?.workflows?.length === 1 ? spec.workflows[0] : undefined
}
