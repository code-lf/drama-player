import type {SystemSkill,SkillHomeShowcase} from './types'

export type ShowcaseSkill = SystemSkill & {home_showcase?:SkillHomeShowcase|null;sort_order?:number}
export const showcaseCategories=[{value:'recommended',label:'推荐技能'},{value:'design',label:'商品设计'},{value:'display',label:'商品展示'},{value:'advertising',label:'广告创作'},{value:'presenter',label:'口播带货'}]
/** 两个用途入口独立分类；标签只描述用途，不混入食品、美妆等商品品类。 */
export const entryShowcaseCategories={
  commerce:[{value:'recommended',label:'推荐'},{value:'design',label:'主图与详情'},{value:'display',label:'商品展示'},{value:'discovery',label:'内容种草'},{value:'presenter',label:'口播带货'}],
  marketing:[{value:'recommended',label:'推荐'},{value:'brand',label:'品牌广告'},{value:'feed',label:'信息流广告'},{value:'creator',label:'达人营销'},{value:'holiday',label:'节日促销'}]
}
/** 显式入口分类优先；没有迁移的旧版本仍按旧分类显示，不能由名称推断执行能力。 */
export function skillEntryCategories(row:ShowcaseSkill,entry:'commerce'|'marketing'){
  const display=row.home_showcase
  if(!display)return []
  if(display.entry_categories!==undefined)return display.entry_categories[entry]||[]
  return entry==='commerce'?[display.category==='advertising'?'discovery':display.category]:[]
}
/** 首页快捷区只放前八个真实推荐，完整目录仍在下方，避免批量上架后把输入框推离首屏。 */
export function quickRecommendedSkills(skills:SystemSkill[],entry:SystemSkill['entries'][number]){
  return skills.filter(row=>row.recommended_entries?.includes(entry)&&row.entries.includes(entry)&&row.is_active!==false&&(!['commerce','marketing'].includes(entry)||!row.home_showcase||skillEntryCategories(row,entry as 'commerce'|'marketing').length)).slice(0,8)
}
/** 明确分列避免浏览器多栏平衡把少量卡片挤进前两列；每列内部保持自然高度。 */
export function showcaseColumnCount(width:number){return width>=1440?5:width>=1024?4:width>=768?3:2}
/** 只显示当前入口可用的平台技能，分类和推荐不通过名称猜测。 */
export function showcaseSkills(skills:ShowcaseSkill[],entry:'commerce'|'marketing'='commerce'){return skills.filter(row=>row.kind!=='user'&&row.is_active!==false&&row.entries.includes(entry)&&skillEntryCategories(row,entry).length).sort((a,b)=>(a.sort_order??100)-(b.sort_order??100)||a.id.localeCompare(b.id))}
/** 复刻只带允许编辑的公开规格，不继承任务、收费许可或其他草稿的 extra。 */
export function replicaParameters(parameters:Record<string,unknown>={}){
  const keys=['model','style','styleId','aspectRatio','durationSec','resolution','count','quality','workflow','templateId']
  return Object.fromEntries(keys.filter(key=>parameters[key]!==undefined).map(key=>[key,parameters[key]]))
}
