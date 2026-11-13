import {ref,watch,onBeforeUnmount} from 'vue'
import type {request as ApiRequest} from '~/shared/api/adapters/httpAdapter'
import type {AssetCategory,CanvasAssetExtraction,CanvasScriptState} from './scriptDocument'

/** 仅负责新画布文本提取；账号、文稿变化与卸载均隔离迟到响应，不重复挂载原短剧轮询。 */
export function useCanvasAssetExtraction(options:{sessionId:()=>string;document:()=>CanvasScriptState|undefined;active:()=>boolean;request:typeof ApiRequest}){
  const extraction=ref<CanvasAssetExtraction|null>(null),busy=ref(false),error=ref('')
  let serial=0,disposed=false,timer:ReturnType<typeof setTimeout>|undefined,command:{key:string;id:string}|undefined
  const current=(token:number)=>!disposed&&options.active()&&token===serial
  function schedule(token:number){
    clearTimeout(timer)
    // 只有真实已受理的提取才轮询；没有任务时不创建常驻计时器。
    if(current(token)&&['queued','running'].includes(extraction.value?.status||''))timer=setTimeout(()=>{void load(token)},2000)
  }
  async function load(token=serial){
    const doc=options.document(),sid=options.sessionId()
    if(!doc?.document||!current(token))return
    try{
      const value=await options.request<{extraction:CanvasAssetExtraction|null}>(`/creation/sessions/${sid}/asset-extraction`)
      if(!current(token))return
      const result=value.extraction
      extraction.value=result?.document_id===doc.document.id&&result.document_revision===doc.revision?result:null
      error.value='';schedule(token)
    }catch{if(current(token))error.value='资产提取状态暂时无法读取，请重试读取；不会重复提交。'}
  }
  async function submit(categories:AssetCategory[]){
    const doc=options.document(),sid=options.sessionId(),token=serial
    if(!doc?.document||!current(token)||busy.value||['queued','running'].includes(extraction.value?.status||'')||!categories.length)return
    const key=JSON.stringify([sid,doc.revision,[...categories].sort()])
    if(command?.key!==key)command={key,id:crypto.randomUUID()}
    busy.value=true;error.value=''
    try{
      const value=await options.request<{extraction:CanvasAssetExtraction}>(`/creation/sessions/${sid}/asset-extraction`,{method:'POST',body:{expected_document_revision:doc.revision,request_id:command.id,categories}})
      if(!current(token))return
      if(value.extraction?.document_id!==doc.document.id||value.extraction.document_revision!==doc.revision)throw new Error('资产提取回执与当前剧本不一致，请重新读取状态。')
      extraction.value=value.extraction;command=undefined;schedule(token)
    }catch(cause){if(current(token))error.value=(cause as Error).message||'提取请求未确认，请读取状态后重试。'}
    finally{if(current(token))busy.value=false}
  }
  watch(()=>[options.sessionId(),options.document()?.document?.id,options.document()?.revision],()=>{
    serial++;clearTimeout(timer);extraction.value=null;busy.value=false;error.value='';command=undefined
    if(options.document()?.document)void load(serial)
  },{immediate:true})
  onBeforeUnmount(()=>{disposed=true;serial++;clearTimeout(timer)})
  return {extraction,busy,error,submit,reload:()=>load(serial)}
}
