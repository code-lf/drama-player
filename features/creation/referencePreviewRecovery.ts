import {reactive,watch} from 'vue'
import type {ComposerReference} from './types'
import type {LibraryItem} from '~/entities/library/types'

/** 临时预览失效只重读同一固定版本一次；不修改业务引用、不重生成，也不绕过资料库鉴权。 */
export function createReferencePreviewRecovery(references:()=>ComposerReference[],read:(id:string)=>Promise<LibraryItem>,resolve:(url:string)=>string){
  const entries=reactive(new Map<string,{original:string;url:string;attempted:boolean;failed:boolean}>())
  let disposed=false
  const key=(reference:ComposerReference)=>`${reference.item_id}:${reference.version_id}`
  const state=(reference:ComposerReference)=>{
    const value=entries.get(key(reference))
    return value?.original===reference.preview_url?value:undefined
  }
  const url=(reference:ComposerReference)=>{
    const value=state(reference)
    return value?(value.failed?'':value.url):reference.preview_url||''
  }
  // 来源或地址变化立即废弃旧恢复状态；迟到请求不能重新插回已移除的附件。
  const stop=watch(()=>references().map(row=>`${key(row)}:${row.preview_url}`).join('|'),()=>{
    for(const [id,value] of entries){if(!references().some(row=>key(row)===id&&row.preview_url===value.original))entries.delete(id)}
  },{flush:'sync'})
  async function failed(reference:ComposerReference){
    if(disposed||!reference.preview_url)return
    const id=key(reference),existing=state(reference)
    if(existing?.attempted){existing.failed=true;return}
    const value={original:reference.preview_url,url:'',attempted:true,failed:true}
    entries.set(id,value)
    const request=entries.get(id)
    const current=()=>!disposed&&entries.get(id)===request&&references().some(row=>key(row)===id&&row.preview_url===value.original)
    try{
      const item=await read(reference.item_id)
      if(!current())return
      const version=item.id===reference.item_id&&item.media_type==='image'?item.versions.find(row=>row.id===reference.version_id):undefined
      const fresh=version?.preview_url?resolve(version.preview_url):''
      if(fresh&&fresh!==value.original)entries.set(id,{...value,url:fresh,failed:false})
    }catch{/* 读取被拒绝或文件不可用时保留失败占位，不借用其他版本和历史地址。 */}
  }
  return {url,failed,dispose(){disposed=true;stop();entries.clear()}}
}
