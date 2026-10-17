import {ref,watch,onBeforeUnmount,onMounted,type Ref} from 'vue'
import type {CreationDraft,WorkspaceDraftResponse} from './types'
import {creationService} from '~/shared/api/services/creationService'

/** 修订号只属于账号和作用域；迟到响应只确认保存，不回填输入或附件。 */
export function useWorkspaceDraft(owner:Ref<string|undefined>,scope:Ref<string>,ready:Ref<boolean>,snapshot:()=>CreationDraft,apply:(value:CreationDraft,isCurrent?:()=>boolean)=>Promise<void>){
  const state=ref<'loading'|'saving'|'saved'|'error'|'conflict'|'local'>('local'),conflict=ref<WorkspaceDraftResponse|null>(null)
  // 展示状态可能提前变为本地或冲突；恢复是否结束必须独立覆盖异步素材／参数回填。
  const restoring=ref(false),restored=ref(false)
  let epoch=0,revision=0,baseline='',hydrating=true,loadedScope='',loadedOwner:string|undefined,timer:ReturnType<typeof setTimeout>|undefined,pending:Promise<void>|null=null
  const clone=()=>JSON.parse(JSON.stringify(snapshot())) as CreationDraft
  const key=()=>`liv-workspace-draft:${owner.value}:${scope.value}`
  const sameContext=()=>scope.value===loadedScope&&owner.value===loadedOwner
  const backup=()=>{if(!owner.value||!sameContext()||hydrating)return;try{localStorage.setItem(key(),JSON.stringify({revision,content:clone()}))}catch{/* 禁用存储时仍保留内存及云端草稿。 */}}
  async function load(){
    const current=++epoch;clearTimeout(timer);hydrating=true;restored.value=false;conflict.value=null;revision=0;baseline=''
    if(!owner.value||!ready.value){state.value='local';restoring.value=false;return}
    loadedScope=scope.value;loadedOwner=owner.value
    restoring.value=true
    state.value='loading'
    try{
      const beforeRead=JSON.stringify(snapshot())
      const remote=await creationService.readDraft(scope.value);if(current!==epoch)return
      revision=remote.revision
      // 网络恢复期间发生的新输入优先保留；已有云端内容必须显式选择，不能迟到覆盖。
      if(JSON.stringify(snapshot())!==beforeRead){baseline=JSON.stringify(remote.content);hydrating=false;if(remote.content){conflict.value=remote;state.value='conflict'}else{state.value='local';timer=setTimeout(()=>void flush(),800)}return}
      let local:null|{revision:number;content:CreationDraft}=null
      try{local=JSON.parse(localStorage.getItem(key())||'null')}catch{/* 损坏备份不阻断云端恢复。 */}
      if(local&&JSON.stringify(local.content)!==JSON.stringify(remote.content)&&local.revision!==remote.revision){conflict.value=remote;state.value='conflict';await apply(local.content,()=>current===epoch)}
      else if(local&&local.revision===remote.revision&&JSON.stringify(local.content)!==JSON.stringify(remote.content)){await apply(local.content,()=>current===epoch);if(current===epoch)state.value='local'}
      else if(remote.content){await apply(remote.content,()=>current===epoch);if(current===epoch)state.value='saved'}
      else state.value='local'
      if(current!==epoch)return
      baseline=JSON.stringify(remote.content);hydrating=false
      if(state.value==='local')timer=setTimeout(()=>void flush(),800)
    }catch{if(current===epoch){state.value='error';hydrating=true}}
    finally{if(current===epoch){restoring.value=false;restored.value=state.value!=='error'}}
  }
  async function flush(){
    clearTimeout(timer)
    if(pending){await pending;if(!hydrating&&JSON.stringify(snapshot())!==baseline)await flush();return}
    if(hydrating||!owner.value||!ready.value||!sameContext()||conflict.value)return
    const content=clone(),serialized=JSON.stringify(content),current=epoch,saveScope=scope.value
    if(serialized===baseline)return
    backup();state.value='saving'
    pending=(async()=>{try{const result=await creationService.saveDraft(saveScope,revision,content);if(current!==epoch)return;revision=result.revision;baseline=serialized;state.value='saved';if(JSON.stringify(snapshot())===serialized){try{localStorage.removeItem(key())}catch{/* 云端已存，不影响成功状态。 */}}}catch(error){if(current!==epoch)return;const value=(error as any)?.data?.detail||(error as any)?.data?.data?.detail;if(value?.code==='WORKSPACE_DRAFT_CONFLICT'){conflict.value=value;state.value='conflict'}else state.value='error'}finally{pending=null}})()
    await pending
  }
  /** 冲突必须由用户选择；保留本地时使用最新修订再写入，而非强制覆盖。 */
  async function resolve(useRemote:boolean){const value=conflict.value;if(!value)return;revision=value.revision;conflict.value=null;if(useRemote&&value.content){hydrating=true;await apply(value.content);baseline=JSON.stringify(snapshot());hydrating=false;state.value='saved';try{localStorage.removeItem(key())}catch{}}else{baseline='';await flush()}}
  watch([owner,scope,ready],()=>void load(),{flush:'post'})
  watch(snapshot,()=>{if(hydrating||!owner.value||!ready.value||!sameContext())return;backup();clearTimeout(timer);timer=setTimeout(()=>void flush(),800)},{deep:true})
  // 站内导航发生前保存旧作用域；浏览器关闭时依靠本地账号备份补偿异步请求。
  onBeforeRouteUpdate(async()=>{await flush()})
  onBeforeRouteLeave(async()=>{await flush()})
  const blur=()=>{backup();void flush()}
  onMounted(()=>{void load();window.addEventListener('blur',blur);window.addEventListener('pagehide',blur)})
  onBeforeUnmount(()=>{backup();void flush();clearTimeout(timer);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur);epoch++})
  /** 提交冻结当前云端修订；只有该修订仍有效时清空，迟到响应绝不恢复已发送附件。 */
  async function freezeForSubmit(){
    await flush()
    if(hydrating||!ready.value||!sameContext())throw new Error('草稿仍在恢复，请稍候再提交。')
    if(state.value==='error'||conflict.value)throw new Error('请先重试保存或处理草稿冲突，再提交创作。')
    const saveScope=scope.value,saveOwner=owner.value,saveRevision=revision,content=clone()
    return async()=>{
      if(!saveOwner)return
      const extra={...content.parameters.extra};delete extra.workspace_tool
      const cleared={...content,prompt:'',references:[],segments:[],reference_names:{},parameters:{...content.parameters,extra}}
      try{const saved=await creationService.saveDraft(saveScope,saveRevision,cleared);if(owner.value===saveOwner&&scope.value===saveScope){revision=saved.revision;baseline=JSON.stringify(cleared)}try{localStorage.removeItem(`liv-workspace-draft:${saveOwner}:${saveScope}`)}catch{}}
      catch{/* 后续修订可能已被另一标签页保存，保留新内容，不强制覆盖。 */}
    }
  }
  return{state,restoring,restored,conflict,flush,retry:load,resolve,freezeForSubmit}
}
