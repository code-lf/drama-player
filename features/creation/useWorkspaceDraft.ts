import {ref,watch,onBeforeUnmount,onMounted,type Ref} from 'vue'
import type {CreationDraft,WorkspaceDraftResponse} from './types'
import {creationService} from '~/shared/api/services/creationService'

/** 修订号只属于账号和作用域；迟到响应只确认保存，不回填输入或附件。 */
export function useWorkspaceDraft(owner:Ref<string|undefined>,scope:Ref<string>,ready:Ref<boolean>,snapshot:()=>CreationDraft,apply:(value:CreationDraft,isCurrent?:()=>boolean)=>Promise<void>){
  const state=ref<'loading'|'saving'|'saved'|'error'|'conflict'|'local'>('local'),conflict=ref<WorkspaceDraftResponse|null>(null)
  // 展示状态可能提前变为本地或冲突；恢复是否结束必须独立覆盖异步素材／参数回填。
  const restoring=ref(false),restored=ref(false)
  // 对外仅给出可操作的错误分类，不把接口地址、私有草稿或原异常堆栈推给用户。
  const failure=ref('')
  function failedMessage(error:unknown,reading=false){
    const status=Number((error as {statusCode?:number;status?:number})?.statusCode||(error as {status?:number})?.status)
    return status===429?'草稿保存请求较频繁，请稍后重试。':status===401?'登录已失效，请重新登录后保存草稿。':
      reading?'草稿读取失败，请重试恢复；本地输入仍保留。':'草稿保存失败，请重试保存；未提交生成。'
  }
  let epoch=0,revision=0,baseline='',hydrating=true,loadedScope='',loadedOwner:string|undefined,timer:ReturnType<typeof setTimeout>|undefined,pending:Promise<void>|null=null
  const clone=()=>JSON.parse(JSON.stringify(snapshot())) as CreationDraft
  const key=()=>`liv-workspace-draft:${owner.value}:${scope.value}`
  const sameContext=()=>scope.value===loadedScope&&owner.value===loadedOwner
  const backup=()=>{
    if(!owner.value||!sameContext()||hydrating)return
    try{
      const content=clone()
      // 备份同时记录编辑基线；未编辑的旧备份不能在服务端自动更新后冒充本地冲突。
      if(JSON.stringify(content)===baseline)localStorage.removeItem(key())
      else localStorage.setItem(key(),JSON.stringify({revision,content,baseline}))
    }catch{/* 禁用存储时仍保留内存及云端草稿。 */}
  }
  async function load(){
    const current=++epoch;clearTimeout(timer);hydrating=true;restored.value=false;failure.value='';conflict.value=null;revision=0;baseline=''
    if(!owner.value||!ready.value){state.value='local';restoring.value=false;return}
    loadedScope=scope.value;loadedOwner=owner.value
    restoring.value=true
    state.value='loading'
    try{
      const beforeRead=JSON.stringify(snapshot())
      const remote=await creationService.readDraft(scope.value);if(current!==epoch)return
      revision=remote.revision
      // 网络恢复期间发生的新输入优先保留；已有云端内容必须显式选择，不能迟到覆盖。
      if(JSON.stringify(snapshot())!==beforeRead&&JSON.stringify(snapshot())!==JSON.stringify(remote.content)){baseline=JSON.stringify(remote.content);hydrating=false;if(remote.content){conflict.value=remote;state.value='conflict'}else{state.value='local';timer=setTimeout(()=>void flush(),800)}return}
      let local:null|{revision:number;content:CreationDraft;baseline?:string}=null
      try{local=JSON.parse(localStorage.getItem(key())||'null')}catch{/* 损坏备份不阻断云端恢复。 */}
      if(local?.baseline&&JSON.stringify(local.content)===local.baseline){local=null;localStorage.removeItem(key())}
      if(local&&JSON.stringify(local.content)!==JSON.stringify(remote.content)&&local.revision!==remote.revision){conflict.value=remote;state.value='conflict';await apply(local.content,()=>current===epoch)}
      else if(local&&local.revision===remote.revision&&JSON.stringify(local.content)!==JSON.stringify(remote.content)){await apply(local.content,()=>current===epoch);if(current===epoch)state.value='local'}
      else if(remote.content){await apply(remote.content,()=>current===epoch);if(current===epoch)state.value='saved'}
      else state.value='local'
      if(current!==epoch)return
      baseline=JSON.stringify(remote.content);hydrating=false
      if(state.value==='local')timer=setTimeout(()=>void flush(),800)
    }catch(error){if(current===epoch){state.value='error';failure.value=failedMessage(error,true);hydrating=true}}
    finally{if(current===epoch){restoring.value=false;restored.value=state.value!=='error'}}
  }
  async function flush(){
    clearTimeout(timer)
    // 失败不能被另一个等待保存的调用变成无限重发；切换账号/作用域后也不能续写旧快照。
    if(pending){const waitingEpoch=epoch;await pending;if(waitingEpoch===epoch&&!hydrating&&!conflict.value&&state.value!=='error'&&JSON.stringify(snapshot())!==baseline)await flush();return}
    if(hydrating||!owner.value||!ready.value||!sameContext()||conflict.value)return
    const content=clone(),serialized=JSON.stringify(content),current=epoch,saveScope=scope.value
    if(serialized===baseline){state.value='saved';failure.value='';return}
    backup();state.value='saving'
    pending=(async()=>{try{const result=await creationService.saveDraft(saveScope,revision,content);if(current!==epoch)return;revision=result.revision;baseline=serialized;state.value='saved';failure.value='';if(JSON.stringify(snapshot())===serialized){try{localStorage.removeItem(key())}catch{/* 云端已存，不影响成功状态。 */}}}catch(error){if(current!==epoch)return;const value=(error as any)?.data?.detail||(error as any)?.data?.data?.detail;if(value?.code==='WORKSPACE_DRAFT_CONFLICT'){conflict.value=value;state.value='conflict';failure.value=''}else{state.value='error';failure.value=failedMessage(error)}}finally{pending=null}})()
    await pending
  }
  /** 冲突必须由用户选择；保留本地时使用最新修订再写入，而非强制覆盖。 */
  async function resolve(useRemote:boolean){const value=conflict.value;if(!value)return;revision=value.revision;conflict.value=null;if(useRemote&&value.content){hydrating=true;await apply(value.content);baseline=JSON.stringify(snapshot());hydrating=false;state.value='saved';try{localStorage.removeItem(key())}catch{}}else{baseline='';await flush()}}
  /** 保存失败只重试当前本地稿；读取失败才重新恢复，不能用重读覆盖用户刚改的内容。 */
  async function retry(){if(hydrating||!restored.value||!sameContext())await load();else await flush()}
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
    if(conflict.value)throw new Error('草稿与其他页面有冲突，请先选择保留本地或使用云端，再确认执行。')
    if(state.value==='error')throw new Error(failure.value||'草稿保存失败，请重试保存；未提交生成。')
    const saveScope=scope.value,saveOwner=owner.value,saveRevision=revision,saveEpoch=epoch,content=clone()
    return async()=>{
      if(!saveOwner)return
      const extra={...content.parameters.extra};delete extra.workspace_tool
      const cleared={...content,prompt:'',references:[],segments:[],reference_names:{},parameters:{...content.parameters,extra}}
      try{const saved=await creationService.saveDraft(saveScope,saveRevision,cleared);if(saveEpoch===epoch&&owner.value===saveOwner&&scope.value===saveScope){
        revision=saved.revision;baseline=JSON.stringify(cleared)
        // 仅原稿尚未变化时回填提交后的空稿；用户中途输入的新内容继续保留并备份。
        if(JSON.stringify(snapshot())===JSON.stringify(content)){hydrating=true;try{await apply(cleared,()=>saveEpoch===epoch)}finally{if(saveEpoch===epoch)hydrating=false}}
        backup()
      }}
      catch{/* 后续修订可能已被另一标签页保存，保留新内容，不强制覆盖。 */}
    }
  }
  return{state,restoring,restored,conflict,failure,flush,retry,resolve,freezeForSubmit}
}
