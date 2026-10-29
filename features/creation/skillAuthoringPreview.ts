/** 技能助手仅可修改文字；预览与应用共用同一字段白名单。 */
export const authoringTextFields=['label','description','category','requirement','prompt_prefix','prompt_suffix','instructions','document'] as const
// 结构化文字仍沿用相同候选预览和整体冲突门禁，绝不扩展模型/素材权限字段。
const authoringFields=[...authoringTextFields,'public_guide','text_resources'] as const
export interface AuthoringMessage {role:'user'|'assistant';content:string}
import type {SkillFlow} from './skillExecutionFlow'
export interface AuthoringProposal {base:Record<string,any>;candidate:Record<string,any>;flow?:SkillFlow|null;base_flow?:SkillFlow|null}
/** PostgreSQL JSONB可能重排对象键；比较内容而非键顺序，数组顺序仍保留。 */
export function stableSkillSnapshot(value:any):string{
  function ordered(item:any):any{if(Array.isArray(item))return item.map(ordered);if(item&&typeof item==='object')return Object.fromEntries(Object.keys(item).sort().map(key=>[key,ordered(item[key])]));return item}
  return JSON.stringify(ordered(value))
}
/** 只取实际发生变化的文字，模型回传的权限/模型字段不能借预览进入草稿。 */
export function authoringChanges(proposal:AuthoringProposal){
  const display=(value:any)=>value&&typeof value==='object'?JSON.stringify(value,null,2):String(value||'')
  return authoringFields.filter(key=>Object.prototype.hasOwnProperty.call(proposal.candidate,key)&&stableSkillSnapshot(proposal.base[key])!==stableSkillSnapshot(proposal.candidate[key])).map(key=>({key,before:display(proposal.base[key]),after:display(proposal.candidate[key])}))
}
/** 必须仍是发起修改时的原稿；应用失败不产生部分修改。 */
export function applyAuthoringProposal(current:Record<string,any>,proposal:AuthoringProposal){
  if(stableSkillSnapshot(current)!==stableSkillSnapshot(proposal.base))throw new Error('草稿已修改，请重新整理，未覆盖当前内容。')
  const next={...current}
  for(const change of authoringChanges(proposal))next[change.key]=JSON.parse(JSON.stringify(proposal.candidate[change.key]))
  return next
}
