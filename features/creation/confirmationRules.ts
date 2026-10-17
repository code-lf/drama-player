/** 普通方案直接展示一次确认；回复、已执行任务和导演流程不创建重复卡片。 */
export function canShowGenerationConfirmation(run:{status:string;card?:{type:string;target?:string;skill?:string}|null;draft:{skill:string;parameters?:{workflow?:string}};executed_request?:unknown}|null,submitted=false){
  return !!run&&run.status==='ready'&&run.card?.type==='proposal'&&run.card.target!=='drama'&&!run.draft.skill.startsWith('mv-')&&!run.card.skill?.startsWith('mv-')&&run.draft.parameters?.workflow!=='director'&&!run.executed_request&&!submitted
}
/** 零积分也是有效报价；缺失、负数及非有限数值不能被当成可确认的价格。 */
export function hasValidGenerationQuote(hasQuote:boolean,credits:unknown){
  return hasQuote&&typeof credits==='number'&&Number.isFinite(credits)&&credits>=0
}
