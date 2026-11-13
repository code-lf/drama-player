import {computed,onMounted,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import type {SessionResult} from '~/features/creation/resultCatalog'
import type {EditingAudio,EditingDraft,EditingOperation,EditingSource} from './types'
import {createPlatformEditingSession} from './platform-editing-session.mjs'
import {applyCandidate} from './fablecut-candidate.mjs'
import {duration,visualDuration} from './timeline-contract.mjs'
import {editingService} from '~/shared/api/services/editingService'
import {videoCompositionService as api,type CompositionOutput,type CompositionJob} from '~/shared/api/services/videoCompositionService'
import {libraryService} from '~/shared/api/services/libraryService'
import {classifyEditingMediaError,initialEditingAudio,summarizeEditingConflict} from './recovery.mjs'

export type EditingAsset=Pick<SessionResult,'key'|'title'|'kind'|'url'|'cover'>&{source?:SessionResult['source']}
const empty=():EditingDraft=>({schema_version:3,revision:0,aspect:'16:9',visuals:[],audio_tracks:[]})
const plain=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
/** 正式编辑壳只保存平台合同，所有手动/AI操作走相同串行命令边界。 */
export function useEditingWorkspace(props:{sessionId:string;assets:EditingAsset[];initialAssetKey?:string;entryCompositionId?:string}){
  const state=shallowRef<any>({candidate:empty(),saved:empty(),state:'saved',undoCount:0,redoCount:0,pending:0})
  const draft=computed<EditingDraft>(()=>state.value.candidate)
  const selected=ref<string|null>(null),position=ref(0),activeAsset=ref(props.initialAssetKey||''),previewAsset=ref(false)
  const query=ref(''),category=ref('all'),notice=ref(''),loading=ref(false),busy=ref(false)
  const outputs=ref<CompositionOutput[]>([]),outputId=ref<string|null>(null),job=ref<CompositionJob|null>(null)
  const media=shallowRef<Array<{clip_id:string;mime:string;bytes:ArrayBuffer}>>([])
  const mediaIssues=ref<Record<string,'retry'|'unavailable'|'decode'>>({})
  const mediaLoading=ref<string[]>([])
  const auditionId=ref(''),auditionUrl=ref('')
  const localAssets=shallowRef<EditingAsset[]>([]),logs=ref<string[]>([])
  const agentMessages=ref<Array<{role:'user'|'assistant';content:string}>>([]),agentBusy=ref(false)
  let pendingAgent:{reply:string;revision:number;reportedFailure?:boolean}|null=null
  const assets=computed(()=>[...props.assets,...localAssets.value].filter((a,i,all)=>all.findIndex(b=>b.key===a.key)===i))
  const visibleAssets=computed(()=>assets.value.filter(a=>(category.value==='all'||category.value===a.kind)&&a.title.toLowerCase().includes(query.value.toLowerCase())))
  const current=computed(()=>assets.value.find(a=>a.key===activeAsset.value))
  const selectedClip=computed(()=>draft.value.visuals.find(c=>c.id===selected.value))
  const total=computed(()=>duration(draft.value))
  const savedLabel=computed(()=>({saved:outputId.value?'已保存':'尚未编辑',saving:'保存中…',failed:'保存失败',conflict:'保存冲突'} as Record<string,string>)[state.value.state]||'保存中…')
  // 初始化读取失败时没有平台会话，不开放导入、保存或AI入口。
  const canEdit=computed(()=>!loading.value&&!busy.value&&!!controller&&state.value.state==='saved')
  const conflictSummary=computed(()=>state.value.state==='conflict'?summarizeEditingConflict(state.value.saved,draft.value):'')
  const exporting=ref(false)
  const canExport=computed(()=>canEdit.value&&!exporting.value&&!!outputId.value&&draft.value.visuals.length>0&&
    !(job.value?.plan.revision===draft.value.revision&&['queued','rendering'].includes(job.value.status)))
  let controller:ReturnType<typeof createPlatformEditingSession>|null=null,kernel:any,alive=true,poll:ReturnType<typeof setTimeout>|undefined,generation=0
  const buffers=new Map<string,{bytes:ArrayBuffer;mime:string}>()
  const mediaRequests=new Map<string,Promise<{bytes:ArrayBuffer;mime:string}>>()
  const message=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。'
  async function directory(){outputs.value=(await api.outputs(props.sessionId)).outputs}
  function start(initial:EditingDraft,key:string|null){
    // 显式切稿时，不把旧稿对话带入新稿，也不让旧导出轮询覆盖新稿状态。
    if(outputId.value!==key){agentMessages.value=[];logs.value=[];job.value=null;clearTimeout(poll)}
    controller?.dispose();outputId.value=key
    controller=createPlatformEditingSession({sessionId:props.sessionId,outputId:key,initial:plain(initial),
      apply:(saved:EditingDraft,ops:EditingOperation[])=>applyCandidate(saved,ops,kernel),transport:editingService,
      onChange:(value:any)=>{
        if(!alive)return
        const previous=state.value.saved.revision
        state.value=value;outputId.value=controller?.outputId()||key
        if(value.error)notice.value=value.error.message
        if(value.saved.revision!==previous){logs.value.push(`已保存第 ${value.saved.revision} 版：${value.saved.visuals.length} 个画面片段。`);void directory()}
        // 只在真实平台保存回执成功后展示AI的完成说明，不用候选冒充落库。
        if(pendingAgent&&value.state==='saved'&&value.saved.revision===pendingAgent.revision){agentMessages.value.push({role:'assistant',content:pendingAgent.reply});pendingAgent=null;agentBusy.value=false}
        if(pendingAgent&&['failed','conflict'].includes(value.state)&&!pendingAgent.reportedFailure){pendingAgent.reportedFailure=true;agentMessages.value.push({role:'assistant',content:'编辑尚未保存，已保留候选。请先处理保存失败或修订冲突。'});agentBusy.value=false}
        void syncMedia(value.candidate)
      }})
    state.value=controller.queue.snapshot();void syncMedia(initial)
  }
  onMounted(async()=>{
    loading.value=true
    try{
      kernel=(await import('~/third-party/fablecut/edit-ops-browser.mjs')).default
      await directory()
      const asset=assets.value.find(a=>a.key===props.initialAssetKey)
      const compositionId=props.entryCompositionId||(asset?.source?.kind==='composition'?asset.source.id:null)
      const found=compositionId?outputs.value.find(o=>o.job_ids.includes(compositionId)):null
      if(found){const value=await editingService.read(props.sessionId,found.id);start(value.draft,found.id);await restoreExport(found.id)}else start(empty(),null)
    }catch(e){notice.value=message(e)}finally{loading.value=false}
  })
  function submit(ops:EditingOperation[]){try{if(!controller)return false;controller.queue.submit(plain(ops));previewAsset.value=false;return true}catch(e){notice.value=message(e);return false}}
  function candidate(value:{expected_revision:number;operations:EditingOperation[]}){
    if(value.expected_revision!==draft.value.revision||!canEdit.value){notice.value='草稿正在保存，请完成后继续拖动。';state.value={...state.value,candidate:plain(draft.value)};return}
    // 本地合同拒绝时也确认回退，否则隔离页会一直等候选回执、后续无法拖动。
    if(!submit(value.operations))state.value={...state.value,candidate:plain(draft.value)}
  }
  async function switchDraft(key:string){
    if(!canEdit.value||exporting.value||agentBusy.value)return
    loading.value=true
    try{if(key){const value=await editingService.read(props.sessionId,key);start(value.draft,key);await restoreExport(key)}else{start(empty(),null);job.value=null};selected.value=null;previewAsset.value=false}
    catch(e){notice.value=message(e)}finally{loading.value=false}
  }
  /** 仅在用户明确确认后读取并丢弃候选；失败时保留原候选，不重放旧操作。 */
  async function reloadConflict(){
    const key=outputId.value
    if(!key||!controller||loading.value||state.value.state!=='conflict')return
    loading.value=true
    try{
      const fresh=await editingService.read(props.sessionId,key)
      if(!alive||key!==outputId.value)return
      pendingAgent=null;agentBusy.value=false;selected.value=null;previewAsset.value=false
      controller.queue.reloadConfirmed(fresh.draft)
      notice.value=''
      await restoreExport(key)
    }catch(e){if(alive)notice.value=message(e)}finally{loading.value=false}
  }
  const token=(source:EditingSource)=>JSON.stringify(source)
  /** 素材身份由服务端核权，浏览器不使用元数据中的临时预览网址。并发刷新复用读取。 */
  async function readMedia(source:EditingSource,kind:'audio'|'video'|'image'){
    const key=token(source),cached=buffers.get(key)
    if(cached)return cached
    const active=mediaRequests.get(key)
    if(active)return active
    const request=(async()=>{
      const bytes=await editingService.media(source)
      const b=new Uint8Array(bytes)
      const tag=(offset:number,size:number)=>String.fromCharCode(...b.slice(offset,offset+size))
      const mime=kind==='video'?'video/mp4':kind==='image'?
        (b[0]===137&&tag(1,3)==='PNG'?'image/png':b[0]===255&&b[1]===216?'image/jpeg':tag(8,4)==='WEBP'?'image/webp':''):
        (tag(0,4)==='RIFF'&&tag(8,4)==='WAVE'?'audio/wav':tag(0,4)==='OggS'?'audio/ogg':tag(4,4)==='ftyp'?'audio/mp4':
          tag(0,3)==='ID3'||(b[0]===255&&(b[1]&224)===224)?'audio/mpeg':'')
      if(!mime||!bytes.byteLength)throw Object.assign(new Error('无法识别预览格式。'),{code:'editing_decode'})
      return {bytes,mime}
    })()
    mediaRequests.set(key,request)
    try{return await request}finally{if(mediaRequests.get(key)===request)mediaRequests.delete(key)}
  }
  async function syncMedia(value:EditingDraft,retryId?:string){
    const epoch=++generation
    const entries=[...value.visuals,...value.audio_tracks]
    const keys=new Set(entries.map(clip=>token(clip.source)))
    for(const key of buffers.keys())if(!keys.has(key))buffers.delete(key)
    const retry=entries.find(clip=>clip.id===retryId)
    const retriedKey=retry&&token(retry.source)
    if(retriedKey)buffers.delete(retriedKey)
    const activeIds=new Set(entries.map(clip=>clip.id))
    const retained=Object.fromEntries(Object.entries(mediaIssues.value).filter(([id])=>activeIds.has(id)&&id!==retryId))
    mediaIssues.value=retained
    media.value=entries.flatMap(clip=>{const entry=buffers.get(token(clip.source));return entry?[{clip_id:clip.id,...entry}]:[]})
    const pending=entries.filter(clip=>!buffers.has(token(clip.source))&&(!retained[clip.id]||token(clip.source)===retriedKey))
    mediaLoading.value=pending.map(clip=>clip.id)
    // 单项渐进回填。失败不跳出循环，旧稿迟到的结果不进当前轨道。
    for(const clip of pending){
      if(!alive||epoch!==generation)return
      try{
        const key=token(clip.source),loaded=await readMedia(clip.source,'kind' in clip?clip.kind:'audio')
        if(!alive||epoch!==generation)return
        buffers.set(key,loaded)
        media.value=[...media.value.filter(item=>item.clip_id!==clip.id),{clip_id:clip.id,...loaded}]
        if(mediaIssues.value[clip.id]){const issues={...mediaIssues.value};delete issues[clip.id];mediaIssues.value=issues}
      }catch(e){if(alive&&epoch===generation)mediaIssues.value={...mediaIssues.value,[clip.id]:classifyEditingMediaError(e)}}
      finally{if(alive&&epoch===generation)mediaLoading.value=mediaLoading.value.filter(id=>id!==clip.id)}
    }
  }
  /** 与主预览互斥；试听使用已核权轨道字节，关闭时释放对象地址。 */
  function auditionTrack(id:string){
    const item=media.value.find(value=>value.clip_id===id)
    if(!item||mediaIssues.value[id])return
    stopAudition();auditionId.value=id
    auditionUrl.value=URL.createObjectURL(new Blob([item.bytes],{type:item.mime}))
    previewAsset.value=true
  }
  function stopAudition(){if(auditionUrl.value)URL.revokeObjectURL(auditionUrl.value);auditionUrl.value='';auditionId.value=''}
  watch(previewAsset,value=>{if(!value)stopAudition()})
  async function addAsset(asset:EditingAsset,role?:EditingAudio['role']){
    if(!canEdit.value)return
    if(asset.kind==='audio'&&(!role||!total.value)){notice.value='请先添加画面片段并选择音轨用途。';return}
    busy.value=true
    try{
      let source:EditingSource
      if(asset.source?.kind==='image'||asset.source?.kind==='video'){
        if(!asset.source.result_id)throw new Error('素材缺少固定结果身份。')
        source={type:'task',task_id:asset.source.id,result_id:asset.source.result_id}
      }else if(asset.source?.kind==='reference'&&asset.source.item_id)source={type:'library',item_id:asset.source.item_id,version_id:asset.source.id}
      else if(asset.source?.kind==='music'&&Number.isInteger(asset.source.audio_index)){
        const item=await libraryService.saveResult('music',asset.source.id,String(asset.source.audio_index),'music'),version=item.versions.find(v=>v.version_no===1)
        if(!version)throw new Error('音乐固定版本不可用。');source={type:'library',item_id:item.id,version_id:version.id}
      }else throw new Error('此素材缺少可编辑固定引用，请通过本地导入或高级入口采用。')
      const id=crypto.randomUUID()
      if(asset.kind==='audio'){
        if(!total.value||source.type!=='library')throw new Error('请先添加画面片段。')
        const item=await libraryService.detail(source.item_id),version=item.versions.find(v=>v.id===source.version_id),length=Math.floor(Number(version?.media.duration_sec)*1000)
        if(!Number.isFinite(length)||length<=0)throw new Error('音乐尚无真实时长，请等待解析。')
        if(!role)return
        submit([{type:'set_audio',role,track:initialEditingAudio(id,role,source,length,total.value)}])
      }else{
        let length=4000
        if(asset.kind==='video'){
          if(source.type==='task')length=(await api.inspect(source.task_id,source.result_id)).duration_ms
          else{const item=await libraryService.detail(source.item_id);length=Math.floor(Number(item.versions.find(v=>v.id===source.version_id)?.media.duration_sec)*25)*40}
          if(!Number.isFinite(length)||length<40)throw new Error('视频时长不可用。')
        }
        submit([{type:'add_visual',before_id:null,clip:asset.kind==='image'?{id,kind:'image',source,duration_ms:4000}:{id,kind:'video',source,trim_start_ms:0,trim_end_ms:length,original_volume:1}}])
      }
    }catch(e){notice.value=message(e)}finally{busy.value=false}
  }
  async function importLocal(file:File){
    if(!canEdit.value)return
    busy.value=true
    try{
      const item=await libraryService.upload(file,'other'),version=item.versions.find(v=>v.version_no===1)
      if(!version||!['image','video','audio'].includes(item.media_type))throw new Error('上传素材类型暂不支持剪辑。')
      localAssets.value=[...localAssets.value,{key:`reference:${version.id}`,title:item.name,kind:item.media_type as EditingAsset['kind'],url:libraryService.previewUrl(version.preview_url),source:{kind:'reference',id:version.id,item_id:item.id}}]
    }catch(e){notice.value=message(e)}finally{busy.value=false}
  }
  function split(){
    const clip=selectedClip.value;if(!clip)return
    const start=draft.value.visuals.slice(0,draft.value.visuals.indexOf(clip)).reduce((sum,c)=>sum+visualDuration(c),0)
    // 播放头必须在选中片段内部，避免越界时返回晦涩的整数/帧校验文案。
    if(position.value-start<40||position.value-start>visualDuration(clip)-40){notice.value='请先把播放头移到选中片段内部，再点击分割。';return}
    submit([{type:'split_visual',clip_id:clip.id,at_ms:Math.round((position.value-start)/40)*40,right_id:crypto.randomUUID()}])
  }
  function setAudio(role:'bgm'|'narration',patch:Record<string,unknown>){const track=draft.value.audio_tracks.find(t=>t.role===role);if(track)submit([{type:'set_audio',role,track:{...plain(track),...patch} as any}])}
  /** 文本交给既有Deep Agents理解；仅将已核权可固定的素材身份交给工具，不带临时网址。 */
  async function askAgent(instruction:string){
    if(!instruction.trim()||agentBusy.value||!canEdit.value)return
    const revision=draft.value.revision,output=outputId.value,history=plain(agentMessages.value)
    agentMessages.value.push({role:'user',content:instruction});agentBusy.value=true
    try{
      const sources:Array<{source:EditingSource;title:string}>=[]
      for(const a of assets.value){
        let source:EditingSource|undefined
        if((a.source?.kind==='image'||a.source?.kind==='video')&&a.source.result_id)source={type:'task',task_id:a.source.id,result_id:a.source.result_id}
        else if(a.source?.kind==='reference'&&a.source.item_id)source={type:'library',item_id:a.source.item_id,version_id:a.source.id}
        if(source)sources.push({source,title:a.title})
      }
      const response=await editingService.assist(props.sessionId,{request_id:crypto.randomUUID(),output_id:output,expected_revision:revision,message:instruction,conversation:history,selected_clip_id:selected.value,sources})
      if(!alive)return
      if(outputId.value!==output||draft.value.revision!==revision||state.value.state!=='saved')throw new Error('处理中剪辑稿已改变，本次建议未应用，请基于最新稿重新发送。')
      if(response.kind==='question'){agentMessages.value.push({role:'assistant',content:response.reply});agentBusy.value=false;return}
      pendingAgent={reply:response.reply,revision:revision+1}
      controller!.queue.submit(plain(response.operations),{actor:'agent',expectedRevision:response.expected_revision})
    }catch(e){pendingAgent=null;agentBusy.value=false;notice.value=message(e)}
  }
  const agentDisabledReason=computed(()=>agentBusy.value?'剪辑助手处理中，请稍候':!canEdit.value?'请先处理当前剪辑或保存状态。':
    agentMessages.value.length>=30?'本次剪辑对话较长，请重新打开工作台继续。':'')
  /** 只串行处理发起请求；任务已受理后仍允许编辑下一版。 */
  async function exportVideo(){
    if(!canExport.value||!controller)return
    exporting.value=true
    try{const result=await controller.exportExplicitly();if(alive){job.value=result;void pollJob(result.id)}}
    catch(e){if(alive)notice.value=message(e)}finally{exporting.value=false}
  }
  /** 恢复仅GET已有任务，绝不因刷新或开工作台派发合成。 */
  async function restoreExport(key:string){
    const history=await api.outputJobs(props.sessionId,key)
    if(!alive||outputId.value!==key)return
    job.value=history.find(j=>j.plan.schema_version===3&&j.plan.revision===draft.value.revision)||null
    if(job.value&&['queued','rendering'].includes(job.value.status))void pollJob(job.value.id)
  }
  /** 只允许显式重试已知失败的原快照，不重新购买媒体，也不把未知状态当失败。 */
  async function retryExport(){
    if(!canEdit.value||exporting.value||job.value?.status!=='failed')return
    exporting.value=true
    try{const result=await api.retry(job.value.id);if(alive){job.value=result;notice.value='';void pollJob(result.id)}}
    catch(e){if(alive)notice.value=message(e)}finally{exporting.value=false}
  }
  /** 迟到轮询不得覆写新任务，任务恢复或切换也不能留下重复定时器。 */
  async function pollJob(id:string){
    if(!alive||job.value?.id!==id)return
    clearTimeout(poll)
    try{
      const result=await api.read(id)
      if(!alive||job.value?.id!==id)return
      job.value=result
      if(['queued','rendering'].includes(result.status))poll=setTimeout(()=>void pollJob(id),2000)
      else if(result.status==='failed')notice.value=result.error_message
      else notice.value='导出完成，可播放或下载成片。'
    }catch(e){if(alive&&job.value?.id===id)notice.value=message(e)}
  }
  onBeforeUnmount(()=>{alive=false;generation++;controller?.dispose();clearTimeout(poll);buffers.clear();mediaRequests.clear();stopAudition();media.value=[]})
  return {state,draft,selected,position,activeAsset,previewAsset,query,category,notice,loading,busy,outputs,outputId,job,media,mediaIssues,mediaLoading,auditionId,auditionUrl,auditionTrack,stopAudition,logs,agentMessages,agentBusy,agentDisabledReason,askAgent,assets,visibleAssets,current,selectedClip,total,savedLabel,canEdit,canExport,exporting,conflictSummary,reloadConflict,
    retryMedia:(id:string)=>syncMedia(draft.value,id),markDecode:(id:string)=>{if(media.value.some(item=>item.clip_id===id))mediaIssues.value={...mediaIssues.value,[id]:'decode'}},
    submit,candidate,switchDraft,addAsset,importLocal,split,setAudio,exportVideo,retryExport,undo:()=>controller?.queue.undo(),redo:()=>controller?.queue.redo(),retry:()=>controller?.queue.retry()}
}
