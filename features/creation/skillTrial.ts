import type {ComposerReference,SystemSkill} from './types'
/** 只识别明确的图片输出数量，不把文案中的卖点数、镜头数或商品数量当作生成数量。 */
export function trialImageCount(text:string,current:number,manual:boolean,max=4){
  const match=text.match(/(?:目标生成图片数量|输出数量|生成图片数量)\s*[：:]\s*(\d+)\s*张/)
  if(!match)return current
  const count=Number(match[1])
  if(count<1||count>max)throw Error(`示例需要${count}张图片，当前单批上限为${max}张，请调整示例数量或使用分批计划。`)
  if(manual&&count!==current)throw Error(`示例为${count}张，但你已选择${current}张。请先将示例数量与参数调整一致后再试用；本次未替换草稿。`)
  return count
}
/** 替换上一次试用带入的示例，保留用户自己的素材；只使用目录签发的已发布固定版本。 */
export function skillTrialReferences(row:SystemSkill,current:ComposerReference[],previousIds:string[]) {
  const samples=row.example_references||[]
  if(samples.some(ref=>!ref.available||!ref.preview_url||!ref.name||ref.media_type!=='image'))throw Error('示例参考图已失效，请刷新技能或上传自己的商品图。')
  const own=current.filter(ref=>!previousIds.includes(ref.version_id))
  const examples=samples.map(ref=>({item_id:ref.item_id,version_id:ref.version_id,purpose:ref.purpose||'reference',name:ref.name!,media_type:ref.media_type!,preview_url:ref.preview_url!}))
  const merged=[...own,...examples.filter(ref=>!own.some(value=>value.version_id===ref.version_id))]
  if(merged.length>12)throw Error('已有素材与示例合计超过12项，请先移除部分素材。')
  return {references:merged,exampleIds:examples.filter(ref=>!own.some(value=>value.version_id===ref.version_id)).map(ref=>ref.version_id)}
}
