import {onBeforeUnmount,ref,watch} from 'vue'
import {request} from '~/shared/api/adapters/httpAdapter'

/** 对话只收真实文件元数据及操作回执，完整剧本由阅读器按版本加载。 */
export type CanvasActivity = {id:string;created_at:string;document_id:string;document_revision:number} & (
  {kind:'script_file';title:string;filename:string;size_bytes:number} |
  {kind:'asset_extraction';categories:string[];status:string;summary:string;error_message:string;counts:Record<string,number>})

/** 复用画布回执更新历史，不额外启动轮询，也不在普通会话首屏发请求。 */
export function useCanvasActivity(sessionId:()=>string|undefined){
  const items=ref<CanvasActivity[]>([]),error=ref('')
  let sequence=0
  async function reload(){
    const sid=sessionId(),token=++sequence
    if(!sid)return
    try{
      const value=await request<{items:CanvasActivity[]}>(`/creation/sessions/${sid}/canvas-activity`)
      if(token===sequence&&sid===sessionId()){items.value=value.items;error.value=''}
    }catch{if(token===sequence&&sid===sessionId())error.value='剧本和提取记录暂不可读。'}
  }
  watch(sessionId,()=>{sequence++;items.value=[];error.value=''},{flush:'sync'})
  onBeforeUnmount(()=>{sequence++})
  return {items,error,reload}
}
