/** 模型明确无需创意审核时才直达真实费用确认；数量不是审核门槛，不代替收费确认。 */
export function canReadQuickQuote(plan:{review_required?:boolean;status:string;items:unknown[];selected_ids:string[];quote?:unknown;batch?:unknown;batch_supported?:boolean}){
  return plan.review_required===false&&plan.status==='draft'&&plan.items.length>0&&
    plan.selected_ids.length>0&&!plan.quote&&!plan.batch&&plan.batch_supported===true
}
