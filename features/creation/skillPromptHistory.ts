import type {ComposerSegment,ComposerReference} from './types'

export type PromptSnapshot={prompt:string;segments:ComposerSegment[]}
export type PromptUndoEntry={before:PromptSnapshot;after:PromptSnapshot;/** 仅技能试用记录示例替换，执行许可与报价绝不恢复。 */trial?:{beforeReferences:ComposerReference[];afterVersions:string[];beforeExampleIds:string[];afterExampleIds:string[];beforeCount?:number;afterCount?:number;beforeStyle:{style:string;styleId:string};afterStyle:{style:string;styleId:string}}}
// 仅在当前页面内保存最近100次技能填入，不落浏览器存储，不缓存账号或内部配方。
const HISTORY_LIMIT=100
const copy=(value:PromptSnapshot):PromptSnapshot=>({prompt:value.prompt,segments:value.segments.map(part=>({...part}))})
/** 比较文字及可编辑字段；相同示例重复使用不制造无意义撤销步骤。 */
export function matchesPromptSnapshot(a:PromptSnapshot,b:PromptSnapshot){return a.prompt===b.prompt&&JSON.stringify(a.segments)===JSON.stringify(b.segments)}
export function pushPromptUndo(history:PromptUndoEntry[],before:PromptSnapshot,after:PromptSnapshot){return matchesPromptSnapshot(before,after)?history:[...history,{before:copy(before),after:copy(after)}].slice(-HISTORY_LIMIT)}
/** 撤销只恢复提示词，不恢复已移除的素材引用，也不恢复旧报价或执行授权。 */
export function restorePromptSnapshot(value:PromptSnapshot,versions:string[]):PromptSnapshot{
  const parts=value.segments.filter(part=>part.type==='text'||versions.includes(part.version_id)).map(part=>({...part}))
  return {prompt:value.segments.length?parts.map(part=>part.type==='text'?part.text:part.label).join(''):value.prompt,segments:parts}
}
