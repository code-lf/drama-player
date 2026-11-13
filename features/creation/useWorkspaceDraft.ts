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
  /** 服务端序列化可重排对象键；键顺序不是内容修订，数组顺序仍严格保留。 */
  function fingerprint(value:unknown):string{
    return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
      ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
  }
  /** 按共同基线合并独立字段；文本与引用各自成组，避免正文和结构化内容错配。 */
  function mergeDraft(base:CreationDraft|null,local:CreationDraft,remote:CreationDraft|null):CreationDraft|null{
    if(!base||!remote)return null
    const groups=[['prompt','segments','original_prompt','generation_prompt'],['references','reference_names'],['entry','skill','skill_version','parameters']]
    const keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])
    const grouped=new Set(groups.flat())
    for(const key of keys)if(!grouped.has(key))groups.push([key])
    const result={...remote} as Record<string,unknown>
    for(const group of groups){
      const pick=(item:CreationDraft)=>Object.fromEntries(group.map(key=>[key,(item as unknown as Record<string,unknown>)[key]]))
      const before=fingerprint(pick(base)),ours=fingerprint(pick(local)),theirs=fingerprint(pick(remote))
      if(ours!==before&&theirs!==before&&ours!==theirs)return null
      const chosen=ours!==before?local:remote
      for(const key of group){if(Object.prototype.hasOwnProperty.call(chosen,key))result[key]=(chosen as unknown as Record<string,unknown>)[key];else delete result[key]}
    }
    return result as unknown as CreationDraft
  }
  function failedMessage(error:unknown,reading=false){
    const status=Number((error as {statusCode?:number;status?:number})?.statusCode||(error as {status?:number})?.status)
    return status===429?'草稿保存请求较频繁，请稍后重试。':status===401?'登录已失效，请重新登录后保存草稿。':
      reading?'草稿读取失败，请重试恢复；本地输入仍保留。':'草稿保存失败，请重试保存；未提交生成。'
  }
  let epoch=0,revision=0,baseline='',hydrating=true,loadedScope='',loadedOwner:string|undefined,timer:ReturnType<typeof setTimeout>|undefined,pending:Promise<void>|null=null
  let channel:BroadcastChannel|undefined
  /** 只通知同账号同会话刷新，不在跨页面消息中传递草稿或凭据。 */
  const announce=()=>channel?.postMessage({owner:loadedOwner,scope:loadedScope})
  const clone=()=>JSON.parse(JSON.stringify(snapshot())) as CreationDraft
  const key=()=>`liv-workspace-draft:${owner.value}:${scope.value}`
  /** 自动同步采用最后成功保存者优先；覆盖前独立保存双方版本，不与普通备份共用键。存储失败时禁止覆盖。 */
  function preserveVersions(local:CreationDraft,remote:WorkspaceDraftResponse):boolean{
    try{
      const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`
      localStorage.setItem(`${key()}:recovery:${id}`,JSON.stringify({created_at:new Date().toISOString(),revision:remote.revision,local,remote:remote.content}))
      return true
    }catch{return false}
  }
  const sameContext=()=>scope.value===loadedScope&&owner.value===loadedOwner
  const backup=()=>{
    if(!owner.value||!sameContext()||hydrating)return
    try{
      const content=clone()
      // 备份同时记录编辑基线；未编辑的旧备份不能在服务端自动更新后冒充本地冲突。
      if(fingerprint(content)===baseline)localStorage.removeItem(key())
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
      const beforeRead=fingerprint(snapshot())
      const remote=await creationService.readDraft(scope.value);if(current!==epoch)return
      revision=remote.revision
      // 网络恢复期间发生的新输入优先保留；已有云端内容必须显式选择，不能迟到覆盖。
      if(fingerprint(snapshot())!==beforeRead&&fingerprint(snapshot())!==fingerprint(remote.content)){
        if(remote.content&&!preserveVersions(clone(),remote))throw new Error('草稿恢复副本保存失败')
        baseline=fingerprint(remote.content);hydrating=false;state.value='local';timer=setTimeout(()=>void flush(),800);return
      }
      let local:null|{revision:number;content:CreationDraft;baseline?:string}=null
      try{local=JSON.parse(localStorage.getItem(key())||'null')}catch{/* 损坏备份不阻断云端恢复。 */}
      // 兼容旧备份未排序的基线，不回写历史业务内容。
      if(local?.baseline){try{if(fingerprint(local.content)===fingerprint(JSON.parse(local.baseline))){local=null;localStorage.removeItem(key())}}catch{/* 损坏基线不能阻断恢复；保留备份正文供冲突选择。 */}}
      // 云端只变化修订、内容仍是本机编辑前的基线时，没有真实并发修改，可用新修订自动保存本机内容。
      let remoteMatchesLocalBaseline=false
      if(local?.baseline){try{remoteMatchesLocalBaseline=fingerprint(JSON.parse(local.baseline))===fingerprint(remote.content)}catch{/* 无法验证旧基线时仍按冲突保护。 */}}
      let merged:CreationDraft|null=null
      if(local?.baseline){try{merged=mergeDraft(JSON.parse(local.baseline),local.content,remote.content)}catch{/* 缺少可靠基线时保留原冲突保护。 */}}
      if(local&&merged&&local.revision!==remote.revision&&!remoteMatchesLocalBaseline){await apply(merged,()=>current===epoch);if(current===epoch)state.value='local'}
      else if(local&&fingerprint(local.content)!==fingerprint(remote.content)&&local.revision!==remote.revision&&!remoteMatchesLocalBaseline){
        if(!preserveVersions(local.content,remote))throw new Error('草稿恢复副本保存失败')
        await apply(local.content,()=>current===epoch);if(current===epoch)state.value='local'
      }
      else if(local&&remoteMatchesLocalBaseline&&fingerprint(local.content)!==fingerprint(remote.content)){await apply(local.content,()=>current===epoch);if(current===epoch)state.value='local'}
      else if(local&&local.revision===remote.revision&&fingerprint(local.content)!==fingerprint(remote.content)){await apply(local.content,()=>current===epoch);if(current===epoch)state.value='local'}
      else if(remote.content){await apply(remote.content,()=>current===epoch);if(current===epoch)state.value='saved'}
      else state.value='local'
      if(current!==epoch)return
      baseline=fingerprint(remote.content);hydrating=false
      if(state.value==='local')timer=setTimeout(()=>void flush(),800)
    }catch(error){if(current===epoch){state.value='error';failure.value=failedMessage(error,true);hydrating=true}}
    finally{if(current===epoch){restoring.value=false;restored.value=state.value!=='error'}}
  }
  async function flush(){
    clearTimeout(timer)
    // 失败不能被另一个等待保存的调用变成无限重发；切换账号/作用域后也不能续写旧快照。
    if(pending){const waitingEpoch=epoch;await pending;if(waitingEpoch===epoch&&!hydrating&&!conflict.value&&state.value!=='error'&&fingerprint(snapshot())!==baseline)await flush();return}
    if(hydrating||!owner.value||!ready.value||!sameContext()||conflict.value)return
    let content=clone(),serialized=fingerprint(content)
    const current=epoch,saveScope=scope.value
    if(serialized===baseline){state.value='saved';failure.value='';return}
    backup();state.value='saving'
    const saveBaseline=baseline
    pending=(async()=>{
      try{
        let result:WorkspaceDraftResponse
        try{result=await creationService.saveDraft(saveScope,revision,content)}
        catch(error){
          const value=(error as any)?.data?.detail||(error as any)?.data?.data?.detail
          if(current!==epoch)return
          // 丢失成功响应或其他页面保存了完全相同的稿，不是真实内容冲突。
          if(value?.code==='WORKSPACE_DRAFT_CONFLICT'&&Number.isInteger(value.revision)&&fingerprint(value.content)===serialized)result=value
          // 只有远端内容与已确认基线完全一致时才安全换修订重试一次；不合并或覆盖他人改稿。
          else if(value?.code==='WORKSPACE_DRAFT_CONFLICT'&&Number.isInteger(value.revision)&&fingerprint(value.content)===saveBaseline)
            result=await creationService.saveDraft(saveScope,value.revision,content)
          // 两端改动互不重叠时，先合并回输入框再按云端最新修订保存；回填期间的新输入绝不覆盖。
          else if(value?.code==='WORKSPACE_DRAFT_CONFLICT'&&Number.isInteger(value.revision)){
            let merged:CreationDraft|null=null
            try{merged=mergeDraft(JSON.parse(saveBaseline),content,value.content)}catch{/* 基线不可用时不能安全合并。 */}
            // 同字段分歧自动保留本轮最新编辑，不再等待选版本；双方副本持久化失败则停止保存。
            if(!merged){if(!preserveVersions(content,value))throw new Error('草稿恢复副本保存失败');merged=content}
            if(fingerprint(snapshot())!==serialized){
              if(!preserveVersions(clone(),value))throw new Error('草稿恢复副本保存失败')
              content=clone();serialized=fingerprint(content);merged=content
            }
            const before=serialized
            // 本机内容原样胜出无需重新加载附件，只有真正合并出新内容时才回填。
            if(fingerprint(merged)!==before){
              hydrating=true
              try{await apply(merged,()=>current===epoch&&fingerprint(snapshot())===before)}finally{if(current===epoch)hydrating=false}
            }
            if(current!==epoch)return
            if(fingerprint(snapshot())!==fingerprint(merged))throw error
            content=clone();serialized=fingerprint(content)
            result=await creationService.saveDraft(saveScope,value.revision,content)
          }
          else throw error
        }
        if(current!==epoch)return
        revision=result.revision;baseline=serialized;state.value='saved';failure.value='';announce()
        if(fingerprint(snapshot())===serialized){try{localStorage.removeItem(key())}catch{/* 云端已存，不影响成功状态。 */}}
      }catch(error){
        if(current!==epoch)return
        const value=(error as any)?.data?.detail||(error as any)?.data?.data?.detail
        if(value?.code==='WORKSPACE_DRAFT_CONFLICT'){
          // 一次重试期间又发生并发保存，不无限争写；保存候选，下一次重试按最新修订继续。
          if(preserveVersions(clone(),value)){revision=value.revision;baseline=fingerprint(value.content)}
          state.value='error';failure.value='草稿同步暂未完成，本地修改已保留，请重试同步。'
        }
        else{state.value='error';failure.value=failedMessage(error)}
      }finally{pending=null}
    })()
    await pending
  }
  /** 冲突必须由用户选择；保留本地时使用最新修订再写入，而非强制覆盖。 */
  async function resolve(useRemote:boolean){const value=conflict.value;if(!value)return;revision=value.revision;conflict.value=null;if(useRemote&&value.content){hydrating=true;await apply(value.content);baseline=fingerprint(snapshot());hydrating=false;state.value='saved';try{localStorage.removeItem(key())}catch{}}else{baseline='';await flush()}}
  /** 保存失败只重试当前本地稿；读取失败才重新恢复，不能用重读覆盖用户刚改的内容。 */
  async function retry(){if(hydrating||!restored.value||!sameContext())await load();else await flush()}
  watch([owner,scope,ready],()=>void load(),{flush:'post'})
  watch(snapshot,()=>{if(hydrating||!owner.value||!ready.value||!sameContext())return;backup();clearTimeout(timer);timer=setTimeout(()=>void flush(),800)},{deep:true})
  // 站内导航发生前保存旧作用域；浏览器关闭时依靠本地账号备份补偿异步请求。
  onBeforeRouteUpdate(async()=>{await flush()})
  onBeforeRouteLeave(async()=>{await flush()})
  const blur=()=>{backup();void flush()}
  /** 空闲页面收到保存通知后读取云端；正在编辑的页面继续走三方合并，避免迟到回填覆盖输入。 */
  async function syncFromOtherPage(){
    if(!owner.value||!ready.value||!sameContext()||hydrating||pending||state.value==='error')return
    const current=epoch,before=fingerprint(snapshot()),previousBaseline=baseline,hadConflict=!!conflict.value
    if(!hadConflict&&before!==baseline)return
    try{
      const remote=await creationService.readDraft(scope.value)
      if(current!==epoch||hydrating||pending||fingerprint(snapshot())!==before||baseline!==previousBaseline||!remote.content||remote.revision<revision)return
      // 已有冲突也要重新核对：其他页面可能已经保存相同内容，或修改可按共同基线合并。
      if(fingerprint(remote.content)===before){revision=remote.revision;baseline=before;conflict.value=null;state.value='saved';backup();return}
      let target=remote.content
      if(hadConflict){
        let merged:CreationDraft|null=null
        try{merged=mergeDraft(JSON.parse(previousBaseline),clone(),remote.content)}catch{/* 缺失可靠基线时不能自动覆盖。 */}
        if(!merged){
          if(!preserveVersions(clone(),remote)){state.value='error';failure.value='恢复副本保存失败，本地修改仍保留，请重试同步。';return}
          revision=remote.revision;baseline=fingerprint(remote.content);conflict.value=null;state.value='local';await flush();return
        }
        target=merged
      }else if(remote.revision<=revision)return
      hydrating=true
      try{
        await apply(target,()=>current===epoch&&fingerprint(snapshot())===before)
        if(current===epoch&&fingerprint(snapshot())===fingerprint(target)){
          revision=remote.revision;baseline=fingerprint(remote.content);conflict.value=null
          state.value=fingerprint(target)===baseline?'saved':'local'
        }
      }finally{
        if(current===epoch){hydrating=false;if(fingerprint(snapshot())!==baseline){backup();clearTimeout(timer);timer=setTimeout(()=>void flush(),800)}}
      }
    }catch{/* 通知只是加速同步，读取失败不覆盖本地稿，正常保存时仍会安全核对。 */}
  }
  onMounted(()=>{void load();window.addEventListener('blur',blur);window.addEventListener('pagehide',blur);window.addEventListener('focus',syncFromOtherPage)
    if(typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel('liv-workspace-draft-sync');channel.onmessage=event=>{if(event.data?.owner===loadedOwner&&event.data?.scope===loadedScope)void syncFromOtherPage()}}
  })
  onBeforeUnmount(()=>{backup();void flush();clearTimeout(timer);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur);window.removeEventListener('focus',syncFromOtherPage);channel?.close();epoch++})
  /** 提交冻结当前云端修订；只有该修订仍有效时清空，迟到响应绝不恢复已发送附件。 */
  async function freezeForSubmit(){
    await flush()
    if(hydrating||!ready.value||!sameContext())throw new Error('草稿仍在恢复，请稍候再提交。')
    if(conflict.value)throw new Error('草稿与其他页面有冲突，请先选择保留本地或使用云端，再确认执行。')
    if(state.value==='error')throw new Error(failure.value||'草稿保存失败，请重试保存；未提交生成。')
    const saveScope=scope.value,saveOwner=owner.value,saveEpoch=epoch,content=clone()
    return async()=>{
      if(!saveOwner)return
      const current=()=>saveEpoch===epoch&&owner.value===saveOwner&&scope.value===saveScope
      // 任务已冻结独立快照；下一条需求不是旧任务的一部分，不能再写空稿覆盖它。
      if(!current()||fingerprint(snapshot())!==fingerprint(content))return
      if(pending)await pending
      if(!current()||conflict.value||state.value==='error'||fingerprint(snapshot())!==fingerprint(content))return
      const extra={...content.parameters.extra};delete extra.workspace_tool
      const cleared={...content,prompt:'',references:[],segments:[],reference_names:{},parameters:{...content.parameters,extra}}
      // 自动清空与普通保存使用同一串行边界，新输入的flush必须等待清空取得新修订。
      pending=(async()=>{try{const saved=await creationService.saveDraft(saveScope,revision,cleared);if(current()){
        revision=saved.revision;baseline=fingerprint(cleared);announce()
        // 仅原稿尚未变化时回填提交后的空稿；用户中途输入的新内容继续保留并备份。
        if(fingerprint(snapshot())===fingerprint(content)){hydrating=true;try{await apply(cleared,()=>saveEpoch===epoch)}finally{if(saveEpoch===epoch)hydrating=false}}
        backup()
      }}
      catch{/* 后续修订可能已被另一标签页保存，保留新内容，不强制覆盖。 */}
      finally{pending=null}})()
      await pending
    }
  }
  return{state,restoring,restored,conflict,failure,flush,retry,resolve,freezeForSubmit}
}
