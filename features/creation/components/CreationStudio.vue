<script setup lang="ts">
import {groupConversation} from '../conversationRows'
import {questionNeedsText} from '../questionInteraction'
import {nextHistoryFollow} from '../chatScroll'
import CreationTaskNotice from './CreationTaskNotice.vue'
import {showTaskNotice} from '../taskPresentation'
import CreationSafetyRepair from './CreationSafetyRepair.vue'
import {safetySubmissionMatches} from '../safetySubmission'
import type {ImageSafetyRepair} from '~/entities/product-image/types'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import MusicPlayer from '~/features/music/components/MusicPlayer.vue'
import CreationComposer from './CreationComposer.vue'
import CreationConfirmationCard from './CreationConfirmationCard.vue'
import CreationResultCard from './CreationResultCard.vue'
import CreationRunTime from './CreationRunTime.vue'
import {sessionResults,processingResults} from '../resultCatalog'
import {canAcceptRun,sameRunScope,appendResultKeys,unreadResultKeys,assistantInteraction,conversationEntry} from '../workflowState'
import {canShowGenerationConfirmation} from '../confirmationRules'
import AssistantReply from './AssistantReply.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import CreationResultCanvas, {type CanvasVersion,type AnnotationDraft} from './CreationResultCanvas.vue'
import {useWorkspaceDraft} from '../useWorkspaceDraft'
import type {CreationMessage,WorkspaceSource,CreationDraft,WorkspacePreview} from '../types'
import LibraryPicker from '~/features/library/components/LibraryPicker.vue'
import AssetLibraryPanel from '~/features/library/components/AssetLibraryPanel.vue'
import MusicWorkspacePanel from '~/features/music/components/MusicWorkspacePanel.vue'
import ProductVideoWorkspacePanel from '~/features/product-video/components/ProductVideoWorkspacePanel.vue'
import { useCreationWorkspace } from '../useCreationWorkspace'
import { templateSegments } from '../templateSyntax'
import { creationCaseService, type PublicCreationCase } from '~/shared/api/services/creationCaseService'
import { creationEntries } from '../catalog'
import type { CreationTemplate, ComposerReference, CreationParameterState, ComposerSegment } from '../types'
import type { LibraryItem, LibraryReference, LibraryVersion } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import { productImageService } from '~/shared/api/services/productImageService'
import { productVideoService } from '~/shared/api/services/productVideoService'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { creationService, type CreationRun } from '~/shared/api/services/creationService'
import { request,buildProductImagePayload,buildProductVideoPayload } from '~/shared/api/adapters/httpAdapter'
import type {ProductImageGeneratePayload} from '~/entities/product-image/types'
import type {ProductVideoCreatePayload} from '~/entities/product-video/types'
import type { CreationEntryType } from '../types'
import {canApplyEntryPreference} from '../workbenchRules'
const {auth,requireLogin}=useWorkbenchAuth()
const onboardingOpen=ref(false),onboardingBusy=ref(false),preferenceError=ref(''),onboardingError=ref('')
/** 引导卡只使用本平台现有封面；点击仍走同一账号偏好接口，不触发创作。 */
const onboardingCovers:Partial<Record<CreationEntryType,string>>={drama:'/creation-presets/portrait-wide.png',commerce:'/creation-presets/perfume.png',music:'/landing/case-youth.png',image:'/creation-presets/anime-wide.png'}
let preferenceRevision=0
/** 账号偏好只影响全新入口，不覆盖深链、会话和已输入的草稿。 */
function untouched(){return canApplyEntryPreference(route.path,route.query,prompt.value,references.value.length,!!scriptFile.value)}
/** 只读取当前账号的引导状态；失败明确提供重试，不推断用户已看过。 */
async function loadPreference(){
  const revision=++preferenceRevision,owner=auth.session.user?.id
  onboardingOpen.value=false;preferenceError.value='';onboardingError.value=''
  if(!auth.session.loggedIn)return
  try{
    const value=await request<{onboarding_seen:boolean;default_entry:CreationEntryType}>('/account/creation-preferences')
    if(revision!==preferenceRevision || owner!==auth.session.user?.id)return
    if(untouched()&&value.onboarding_seen&&value.default_entry!=='free')await chooseEntry(value.default_entry)
    onboardingOpen.value=!value.onboarding_seen
  }catch{
    if(revision!==preferenceRevision || owner!==auth.session.user?.id)return
    preferenceError.value='创作模式暂时无法读取，请重试。';notice.value=preferenceError.value
  }
}
/** 用户选择或关闭后才保存已读，保存失败时保留弹窗与错误，不丢失重试入口。 */
async function finishOnboarding(value?:CreationEntryType){
  if(onboardingBusy.value)return
  const owner=auth.session.user?.id,revision=preferenceRevision
  onboardingBusy.value=true;onboardingError.value=''
  try{
    await request('/account/creation-preferences',{method:'PUT',body:{onboarding_seen:true,default_entry:value}})
    if(revision!==preferenceRevision || owner!==auth.session.user?.id)return
    onboardingOpen.value=false
    if(value&&!route.query.session&&!route.query.run&&!prompt.value.trim()&&!references.value.length&&!scriptFile.value)await chooseEntry(value)
  }catch{if(revision===preferenceRevision)onboardingError.value='模式保存失败，请重新选择或稍后重试。'}
  finally{onboardingBusy.value=false}
}
onMounted(loadPreference)
watch(()=>auth.session.user?.id,loadPreference)

const { taskActivity, entry, skill, prompt, segments, references, parameters, scriptFile, catalog, sessions, session, messages, focusedMessage, busy, loading, error, director, directorAccepted,
  musicTasks, taskData, confirmation, selectedSkill, target, models, ratios, resolutions, qualities, estimateLabel, durationRange, musicSources, focused, activeResult, active,
  uploads, dismissUpload, sessionLoading, sessionError, pendingSession, patchParameters, setText, setSkill, chooseEntry, upload, addReference, removeReference, replaceReference, reorder, restore, focusMessage, refreshResults, draft, prepare, submit, continueImage, recordToolTask } = useCreationWorkspace({beforeSubmit:()=>cloudDraft.freezeForSubmit(),beforeScopeChange:()=>cloudDraft.flush(),beforeExecute:authorizeExecution})
const currentSessionTitle = useState<{id:string;title:string}|null>('creation-active-session-title',()=>null)
watch(() => session.value, value => { currentSessionTitle.value=value?{id:value.id,title:value.title}:null }, {immediate:true})
const workspaceElement=ref<HTMLElement|null>(null),chatWidth=ref(390),resizing=ref(false),composerRef=ref<InstanceType<typeof CreationComposer>|null>(null)
const homeComposerExpanded=ref(false),homeDockVisible=ref(false),homeDockStyle=ref<Record<string,string>>({})
const homeComposerSlot=ref<HTMLElement|null>(null),caseHeader=ref<HTMLElement|null>(null),homeComposerHeight=ref(260)
const homeCasesMinHeight=ref(0)
let homeScrollRoot:HTMLElement|null=null
/** 大输入框完全离开内容区且案例标题吸顶后才停靠；保留原位置高度，避免切换反复跳动。 */
function trackHomeDock(){
  if(active.value || entry.value==='drama' || !homeScrollRoot || !homeComposerSlot.value || !caseHeader.value){homeDockVisible.value=false;return}
  // sticky 贴在滚动容器的内边距边界，不能忽略桌面和窄屏不同的顶部留白。
  const rootStyle=getComputedStyle(homeScrollRoot),paddingTop=Number.parseFloat(rootStyle.paddingTop)||0
  const top=homeScrollRoot.getBoundingClientRect().top+paddingTop
  // 少量案例也能到达吸顶点，但不额外制造越过案例后的整屏空白。
  const caseMargin=Number.parseFloat(getComputedStyle(caseHeader.value.parentElement!).marginBottom)||0
  homeCasesMinHeight.value=Math.max(0,homeScrollRoot.clientHeight-paddingTop-(Number.parseFloat(rootStyle.paddingBottom)||0)-caseMargin)
  if(!homeDockVisible.value)homeComposerHeight.value=homeComposerSlot.value.getBoundingClientRect().height
  const visible=homeComposerSlot.value.getBoundingClientRect().bottom<=top && caseHeader.value.getBoundingClientRect().top<=top+1
  if(visible!==homeDockVisible.value)homeComposerExpanded.value=false
  homeDockVisible.value=visible
  updateHomeDock()
}
/** 停靠范围按右侧工作区实际宽度计算，侧栏和窄屏不沿用固定的桌面偏移。 */
function updateHomeDock(){
  const main=workspaceElement.value?.closest('.dashboard-main')
  if(!main)return
  const rect=main.getBoundingClientRect(),width=Math.min(homeComposerExpanded.value?800:435,Math.max(0,rect.width-32))
  homeDockStyle.value={left:`${Math.round(rect.left+(rect.width-width)/2)}px`,width:`${Math.round(width)}px`,bottom:'24px'}
}
/** 展开只改变呈现与焦点，不发送草稿或创建任务。 */
async function expandHomeComposer(){homeComposerExpanded.value=true;updateHomeDock();await nextTick();await composerRef.value?.focusInput()}
watch(homeComposerExpanded,updateHomeDock)
let homeDockObserver:ResizeObserver|undefined
watch(workspaceElement,element=>{
  homeDockObserver?.disconnect()
  homeScrollRoot?.removeEventListener('scroll',trackHomeDock)
  homeScrollRoot=element?.closest('.dashboard-main-content') as HTMLElement|null
  homeScrollRoot?.addEventListener('scroll',trackHomeDock,{passive:true})
  if(element){homeDockObserver=new ResizeObserver(trackHomeDock);homeDockObserver.observe(element);trackHomeDock()}
},{flush:'post'})
onMounted(()=>window.addEventListener('resize',trackHomeDock))
onBeforeUnmount(()=>{homeDockObserver?.disconnect();homeScrollRoot?.removeEventListener('scroll',trackHomeDock);window.removeEventListener('resize',trackHomeDock)})
let resizeStart=0,resizeWidth=390
/** 宽度只影响布局；鼠标捕获保证拖出分隔条仍可调整，键盘左右键同样可用。 */
function setChatWidth(value:number) { chatWidth.value=Math.round(Math.max(320,Math.min(560,(workspaceElement.value?.clientWidth||960)-360,value))) }
function startResize(event:PointerEvent) { if(event.button!==0)return;resizeStart=event.clientX;resizeWidth=chatWidth.value;resizing.value=true;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);event.preventDefault() }
function moveResize(event:PointerEvent) { if(resizing.value)setChatWidth(resizeWidth+event.clientX-resizeStart) }
function finishResize() { resizing.value=false;try{localStorage.setItem('liv-creation-chat-width-v2-compact',String(chatWidth.value))}catch{/* 布局偏好不能影响创作。 */} }
function resizeKey(event:KeyboardEvent) { if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();setChatWidth(event.key==='Home'?320:event.key==='End'?560:chatWidth.value+(event.key==='ArrowLeft'?-20:20));finishResize() }
onMounted(()=>{try{const width=Number(localStorage.getItem('liv-creation-chat-width-v2-compact'));if(Number.isFinite(width)&&width>=320)setChatWidth(width)}catch{/* 禁用存储时使用默认宽度。 */}})
const account = useAccountStore(), route = useRoute()
const canvasRef=ref<InstanceType<typeof CreationResultCanvas>|null>(null),saveBusy=ref(false),canvasSelected=ref(''),mobilePane=ref('chat'),attachmentPreview=ref<WorkspacePreview|null>(null)
const annotationDraft=ref<AnnotationDraft|null>(null),annotationSubmitting=ref(false)
function updateAnnotation(value:AnnotationDraft|null){if(JSON.stringify(annotationDraft.value)!==JSON.stringify(value))confirmation.value=null;annotationDraft.value=value}
async function selectArtifact(id:string){if(canvasRef.value&&!await canvasRef.value.confirmLeave())return;canvasSelected.value=id}
const attachmentDialog=ref<HTMLElement|null>(null)
watch(attachmentPreview,async value=>{if(value){await nextTick();attachmentDialog.value?.focus()}})
const draftScope=computed(()=>typeof route.query.session==='string'?`session:${route.query.session}`:`entry:${entry.value}`)
const draftOwner=computed(()=>auth.session.user?.id),draftReady=computed(()=>!!catalog.value&&!sessionLoading.value&&!sessionError.value&&(!route.query.session||session.value?.id===route.query.session))
/** 云端只恢复固定版本编号；逐项复核访问权限，不能把保存过的地址当作授权。 */
async function applyCloudDraft(value:CreationDraft,isCurrent=()=>true){
  const owner=draftOwner.value,scope=draftScope.value,restored:ComposerReference[]=[]
  // 已发送运行是入口规格的权威快照；旧版自动保存的空草稿默认值不能把“快速”改回“标准”。
  // 新版显式修改的字段单独标记并保留，因此刷新不会吞掉用户发送后的手动调整。
  let restoredParameters=value.parameters
  if(session.value && !messages.value.length){
    const rows=await creationService.runs(session.value.id)
    const latest=rows[rows.length-1]
    if(latest && ['waiting','planning','ready'].includes(latest.status)){
      const edited=new Set(Array.isArray(value.parameters.extra?.user_parameter_keys)?value.parameters.extra.user_parameter_keys:[])
      restoredParameters={...value.parameters}
      for(const key of ['model','aspectRatio','resolution','quality','count'] as const){
        if(!edited.has(key))(restoredParameters as unknown as Record<string,unknown>)[key]=latest.draft.parameters[key]
      }
    }
  }
  for(const reference of value.references){try{const item=await libraryService.detail(reference.item_id),version=item.versions.find(v=>v.id===reference.version_id);if(version)restored.push({...reference,name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}catch{notice.value='部分草稿素材已失效，请重新选择。'}}
  if(!isCurrent()||owner!==draftOwner.value||scope!==draftScope.value)return
  entry.value=value.entry;setSkill(value.skill);patchParameters(restoredParameters);references.value=restored
  const valid=new Set(restored.map(v=>v.version_id));setText(value.prompt,value.segments.filter(v=>v.type==='text'||valid.has(v.version_id)))
}
const cloudDraft=useWorkspaceDraft(draftOwner,draftScope,draftReady,draft,applyCloudDraft)
/** 仅工具栏的真实用户操作标记为参数改动，目录初始化和草稿恢复不冒充手动选择。 */
function selectParameters(patch:Partial<CreationParameterState>){
  const prior=parameters.value.extra.user_parameter_keys
  const keys=[...new Set([...(Array.isArray(prior)?prior:[]),...Object.keys(patch).filter(key=>key!=='extra')])]
  patchParameters({...patch,extra:{...parameters.value.extra,...patch.extra,user_parameter_keys:keys}})
}
const draftStatus=computed(()=>({loading:'正在恢复草稿',saving:'保存中',saved:'已保存',error:'草稿保存失败',conflict:'草稿有冲突',local:'本地草稿'}[cloudDraft.state.value]))
const resultOrder=ref<string[]>([])
const planning = ref<CreationRun | null>(null), planningBusy = ref(false), answerText = ref('')
// 只存在于本次用户点击生命周期；刷新、恢复和历史读取都不能恢复提交意图。
const safetyDirectBusy=ref(false)
const assistantHistory=ref<CreationRun[]>([])
// 旧记录不改写数据库；有已保存完整方案时，用它显示结果摘要，不再只展示确认短句。
const availableResults=computed(()=>sessionResults(messages.value,taskData,Object.fromEntries([...assistantHistory.value,...(planning.value?[planning.value]:[])].map(run=>[run.id,run.task_input?.prompt||run.generation_prompt||'']))))
// 首次恢复按服务端历史顺序，正常运行才按真实到达次序原位追加，避免并行读取打乱历史。
watch(()=>availableResults.value.map(item=>item.key),keys=>{resultOrder.value=sessionLoading.value?keys:appendResultKeys(resultOrder.value,keys)},{flush:'sync'})
// 没有作品或执行任务时只展示可读对话；布局切换不销毁编辑器与播放器。
const chatCollapsed=ref(false)
const hasMedia=computed(()=>allResults.value.length>0||messages.value.some(item=>item.task_id&&!['failed','cancelled'].includes(taskData[item.id]?.status||'')))
const allResults=computed(()=>{const byKey=new Map(availableResults.value.map(item=>[item.key,item]));return resultOrder.value.map(key=>byKey.get(key)).filter((item):item is NonNullable<typeof item>=>!!item)})
const unreadResults=ref<string[]>([]),viewedVersions=new Map<string,string>()
const resultGroup=ref('')
watch(()=>focused.value?.id,()=>{resultGroup.value=''},{flush:'sync'})
let knownResults=new Set<string>()
/** 编辑版本归回同一原始产物，缩略图栏不重复堆叠每次保存。 */
const selectedResultKey=computed(()=>{
  let source=canvasVersions.value.find(item=>item.key===canvasSelected.value)?.source||canvasVersions.value[0]?.source
  const visited=new Set<string>()
  while(source?.kind==='artifact'&&!visited.has(source.id)){visited.add(source.id);source=session.value?.artifacts?.find(item=>item.id===source!.id)?.source}
  return allResults.value.find(item=>item.messageId===focused.value?.id&&item.source.kind===source?.kind&&item.source.id===source?.id&&item.source.result_id===source?.result_id&&item.source.audio_index===source?.audio_index)?.key||''
})
watch(()=>allResults.value.map(item=>item.key),keys=>{
  if(!sessionLoading.value&&knownResults.size)unreadResults.value=[...new Set([...unreadResults.value,...unreadResultKeys([...knownResults],keys,selectedResultKey.value)])]
  knownResults=new Set(keys)
})
watch(()=>session.value?.id,()=>{knownResults=new Set();resultOrder.value=availableResults.value.map(item=>item.key);unreadResults.value=[];viewedVersions.clear()})
/** 先询问未保存编辑，再切换已有产物；不会改变下一轮输入或重新生成。 */
async function chooseSessionResult(key:string){
  const item=allResults.value.find(value=>value.key===key),sid=session.value?.id
  if(!item||busy.value||key===selectedResultKey.value)return
  if(canvasRef.value&&!await canvasRef.value.confirmLeave())return
  if(session.value?.id!==sid)return
  await focusMessage(item.messageId)
  if(session.value?.id!==sid)return
  resultGroup.value=key
  const remembered=viewedVersions.get(key)
  chooseCanvas(remembered&&canvasVersions.value.some(value=>value.key===remembered)?remembered:item.versionKey)
  unreadResults.value=unreadResults.value.filter(value=>value!==key)
}
const canvasVersions=computed<CanvasVersion[]>(()=>{
  const versions:CanvasVersion[]=[]
  const task=activeResult.value
  for(const [index,image] of (task?.images?.results||[]).entries())if(image.imageUrl)versions.push({key:image.id,title:`图片 · 版本 ${index+1}`,kind:'image',url:image.imageUrl,source:{kind:'image',id:task!.images!.id,result_id:image.id}})
  for(const [index,video] of (task?.video?.results||[]).entries())if(video.videoUrl)versions.push({key:video.id,title:`视频 · 版本 ${index+1}`,kind:'video',url:video.videoUrl,cover:video.coverUrl,source:{kind:'video',id:task!.video!.id,result_id:video.id}})
  for(const [index,song] of songs.value.entries())versions.push({key:`song:${index}`,title:String(song.title||`音乐 · 版本 ${index+1}`),kind:'audio',url:String(song.audio_url||song.url||song.audio||''),cover:String(song.image_url||song.cover_url||''),lyrics:String(song.lyrics||''),alignment:song.aligned_lyrics,source:{kind:'music',id:sourceTask.value!.id,audio_index:index}})
  // 分轨、剪辑和歌词视频等目录结果未必包含 music 数组，仍保留真实可播放文件。
  if(!songs.value.length&&sourceTask.value)for(const [index,link] of mediaLinks.value.entries())versions.push({key:`media:${index}`,title:`处理结果 · ${index+1}`,kind:link.video?'video':'audio',url:link.url,source:{kind:'music',id:sourceTask.value.id}})
  const base=allResults.value.find(value=>value.key===resultGroup.value&&value.messageId===focused.value?.id)||allResults.value.find(value=>value.messageId===focused.value?.id)
  // 每个原始结果独立拥有版本菜单，其他结果由底部缩略图切换。
  if(base)versions.splice(0,versions.length,...versions.filter(value=>value.key===base.versionKey))
  for(const [index,artifact] of (session.value?.artifacts||[]).entries()){
    // 只在当前来源任务下展示派生链，避免另一作品的编辑版本混入。
    let root=artifact.source
    const visited=new Set<string>()
    while(root.kind==='artifact'&&!visited.has(root.id)){visited.add(root.id);const parent=session.value?.artifacts?.find(v=>v.id===root.id);if(!parent)break;root=parent.source}
    if(base&&(root.kind!==base.source.kind||root.id!==base.source.id||root.result_id!==base.source.result_id||root.audio_index!==base.source.audio_index))continue
    if(root.id!==task?.images?.id&&root.id!==task?.video?.id&&artifact.id!==canvasSelected.value)continue
    const prior=versions.find(v=>v.source.id===artifact.source.id&&v.source.result_id===artifact.source.result_id)
    versions.push({key:artifact.id,title:`编辑后 · 版本 ${index+1}`,kind:'image',url:libraryService.previewUrl(artifact.preview_url),parentUrl:prior?.url,source:{kind:'artifact',id:artifact.id}})
  }
  return versions
})
const musicToolOptions=computed(()=>sourceTask.value?.provider_task_id&&songs.value.length?(catalog.value?.music_operations||[]).filter(v=>v.enabled&&!!v.fields.task_id&&!['sample','addStem','addVocals','addInstrumental'].includes(v.operation)).map(v=>({code:v.operation,name:v.label})):[])
const selectedMusicOperation=ref('')
/** 音乐工具只将当前曲目固定为 MV 来源，不直接提交视频或扣点。 */
async function makeMusicMv(){if(!sourceTask.value||busy.value)return;const taskId=sourceTask.value.id,index=Number(canvasSelected.value.split(':')[1]||0);entry.value='music';setSkill('mv-visual');mvSource.value=`${taskId}:${index}`;await selectMvSong();if(references.value.some(item=>item.media_type==='audio')){setText('请为这首歌设计视觉 MV。',[{type:'text',text:'请为这首歌设计视觉 MV。'}]);composerRef.value?.focusInput()}}
async function chooseHistory(id:string){
  // 失败提示是只读通知，不能点它覆盖右侧正在查看的作品。
  if(['failed','needs_review','result_error'].includes(taskData[id]?.status||''))return
  if(canvasRef.value&&!await canvasRef.value.confirmLeave())return
  canvasSelected.value='';await focusMessage(id)
}
function chooseCanvas(key:string){canvasSelected.value=key;const index=images.value.findIndex(v=>v.id===key),videoIndex=videos.value.findIndex(v=>v.id===key);if(index>=0)selectedResult.value=index;else if(videoIndex>=0){selectedResult.value=videoIndex;void chooseVideo(videoIndex)}}
async function saveCanvas(value:{file:Blob;source:WorkspaceSource;operations:Record<string,unknown>[];requestId:string}){
  if(!session.value||saveBusy.value)return;const sid=session.value.id;saveBusy.value=true
  try{const artifact=await creationService.saveArtifact(sid,value.file,value.source,value.operations,value.requestId);if(session.value?.id!==sid)return;session.value.artifacts=[...(session.value.artifacts||[]).filter(v=>v.id!==artifact.id),artifact];if(canvasRef.value?.markSaved(value.source,value.operations))canvasSelected.value=artifact.id;notice.value='已保存派生版本，原作品保持不变，未扣积分。'}catch(cause){error.value=(cause as Error).message}finally{saveBusy.value=false}
}
/** 选择 AI 工具只绑定明确来源并填写草稿，不自动报价、提交或扣点。 */
async function canvasAI(action:string,source:WorkspaceSource){
  if(busy.value)return
  error.value='';notice.value=''
  const text=prompt.value
  try{
    if(source.kind==='image')await continueImage(source.id,source.result_id!,action==='image_to_video')
    else if(source.kind==='artifact'){const artifact=session.value?.artifacts?.find(v=>v.id===source.id);if(!artifact)throw new Error('派生版本不可用');const item=await libraryService.detail(artifact.item_id),version=item.versions.find(v=>v.id===artifact.version_id);if(!version)throw new Error('派生版本不可用');parameters.value={...parameters.value,templateId:'',selectedTemplateId:'',workflow:'direct',output:action==='image_to_video'?'video':'image'};director.value=null;directorAccepted.value=false;setSkill(action==='image_to_video'?'animate':'edit');references.value=[{item_id:item.id,version_id:version.id,purpose:'reference',name:item.name,media_type:'image',preview_url:libraryService.previewUrl(version.preview_url)}]}
    else if(source.kind==='video'){const item=await libraryService.saveResult('product_video',source.id,source.result_id!,'other'),version=item.versions[0]!;setSkill('showcase');references.value=[{item_id:item.id,version_id:version.id,purpose:'reference_video',name:item.name,media_type:'video',preview_url:libraryService.previewUrl(version.preview_url)}]}
    if(error.value)return
    const instructions:Record<string,string>={background:'请调整这张图片的背景：',style:'请调整这张图片的风格：',edit:'请修改这张图片：',image_to_video:'让这张图片动起来：',video_reference:'参考这段视频继续创作：'}
    const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id'])delete extra[key]
    patchParameters({extra:{...extra,workspace_tool:{action,source}}});planning.value=null
    const instruction=instructions[action]||'',next=!text.trim()||Object.values(instructions).includes(text.trim())?instruction:`${instruction}\n${text}`
    setText(next,[{type:'text',text:next}]);mobilePane.value='chat';await composerRef.value?.focusInput()
    // 已明确改用作品工具时移除旧规划深链，刷新不能重新打开过期规划或报错。
    if(route.query.run){const query={...route.query};delete query.run;await navigateTo({path:route.path,query})}
  }catch(cause){error.value=(cause as Error).message}
}
function previewReference(version:string){const value=session.value?.reference_previews?.[version];if(value?.available)attachmentPreview.value={...value,preview_url:libraryService.previewUrl(value.preview_url||'')};else notice.value='该历史素材已失效或无权访问，原任务快照保持不变。'}
const { $siteAsset: siteAsset } = useNuxtApp()
const pickerOpen = ref(false), audioPickerOpen = ref(false), audioItems = ref<LibraryItem[]>([]), audioQuery = ref('')
const assetBrowserOpen=ref(false)
const assetScope = ref('personal'), assetCategory = ref(''), assetMedia = ref(''), assetCategories = ref<Array<{ code: string; name: string }>>([])
const showMusicTools = ref(false), showVideoTools = ref(false), selectedResult = ref(0), notice = ref('')
const workspaceToast=useToast()
// 工作区轻量通知复用右上角深色 Toast，不再在页面顶部绘制一套悬浮提示。
watch(notice,text=>{if(!text)return;workspaceToast.add({title:text,color:'neutral',ui:{root:'liv-workspace-toast'},...(text===preferenceError.value?{actions:[{label:'重试',onClick:()=>void loadPreference()}]}:{})});notice.value=''})
const entryInfo = computed(() => creationEntries.find(item => item.id === entry.value)!)
const pendingUserAnswer=ref('')
/** 参考图仍通过现有授权上传链持久化，不把本地预览当作已上传素材。 */
async function uploadQuestionReference(file:File|null|undefined){if(file)await upload([file])}
const selectedAnswers=ref<string[]>([])
// 不从问题正文猜测输入意图；旧记录有选项默认只展示选项。
const questionInputExpanded=ref(false)
const questionNeedsInput=computed(()=>questionInputExpanded.value||questionNeedsText(planning.value?.question))
/** 旧流程已落库的用途/画幅问题只显示原规格摘要，不再要求用户重复选择。 */
const knownFormatQuestion=computed(()=>{
  const options=planning.value?.question?.options || []
  return !!parameters.value.aspectRatio && options.length>=2 && options.every(option=>/\d+\s*[:：]\s*\d+/.test(option))
})
const selectedParameterSummary=computed(()=>`${models.value.find(item=>item.code===parameters.value.model)?.name || parameters.value.model || '待选模型'} · ${parameters.value.aspectRatio} · ${parameters.value.resolution} · ${{low:'快速',medium:'标准',high:'精细'}[parameters.value.quality]}`)
/** 问题卡内明确选项使用回答接口；底部自由输入仍作为需求修订，两个入口不混用。 */
function chooseAnswer(option:string){
  if(planningBusy.value||stoppingAssistant.value)return
  // 只有服务器提供且用户明确点击的切换项才改变技能，保留已有需求和有效素材。
  const nextSkill=catalog.value?.skills.find(item=>option==='切换到「'+item.label+'」')
  if(nextSkill&&planning.value?.question?.options?.includes(option)){
    void switchQuestionSkill(nextSkill.id)
    return
  }
  if(planning.value?.question?.kind==='multiple'){
    selectedAnswers.value=selectedAnswers.value.includes(option)?selectedAnswers.value.filter(item=>item!==option):[...selectedAnswers.value,option]
    answerText.value=selectedAnswers.value.join('、')
  }else void answerPlanning(option)
}
/** 专项跨媒体创建新协商轮次，绝不继承旧报价或执行许可。 */
async function switchQuestionSkill(id:string){
  const run=planning.value,item=catalog.value?.skills.find(row=>row.id===id)
  if(!run||!item)return
  const text=[run.generation_prompt||run.draft.original_prompt||run.draft.prompt,...run.answers.map(row=>row.question+'：'+row.answer)].join('\n')
  const retained={aspectRatio:parameters.value.aspectRatio,quality:parameters.value.quality,count:parameters.value.count}
  if(!item.entries.includes(entry.value))entry.value=item.entries[0]||'free'
  setSkill(id);patchParameters(retained);setText(text,[{type:'text',text}])
  confirmation.value=null;await planDemand()
}
async function previousQuestion(){
  const run=planning.value;if(!run||!canReviseQuestion.value)return
  stopCountdown();confirmation.value=null;quotedProposalKey='';proposalQuoteError.value='';error.value='';assistantAccepted.value=false
  const epoch=++assistantEpoch;planningBusy.value=true
  try{const value=await creationService.previousQuestion(run.id,run.calls,run.question_revision);if(epoch===assistantEpoch){planning.value=value;answerText.value=value.restored_answer||'';await nextTick();questionInputExpanded.value=true}}
  catch{error.value='暂时无法返回上一步，请刷新对话后重试。'}finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
watch(()=>`${planning.value?.id}:${planning.value?.calls}:${planning.value?.question_revision}`,()=>{selectedAnswers.value=[];questionInputExpanded.value=false})

const historyElement=ref<HTMLElement|null>(null),followLatest=ref(true)
const historyContentElement=ref<HTMLElement|null>(null)
let historyResizeObserver:ResizeObserver|undefined,historyScrollFrame=0
/** 挂载及异步排版完成后再定位；不在骨架阶段对不存在的消息容器滚动。 */
function scrollHistoryBottom(force=false){
  if(force)followLatest.value=true
  cancelAnimationFrame(historyScrollFrame)
  historyScrollFrame=requestAnimationFrame(()=>{
    const el=historyElement.value
    if(el&&followLatest.value)el.scrollTop=el.scrollHeight
  })
}
watch([historyElement,historyContentElement,sessionLoading],async()=>{
  historyResizeObserver?.disconnect()
  if(sessionLoading.value||!historyElement.value)return
  await nextTick()
  if(!historyElement.value||sessionLoading.value)return
  scrollHistoryBottom(true)
  // 结果缩略图、建议正文和流式回复晚到都会改变高度，不能只盯消息数量。
  historyResizeObserver=new ResizeObserver(()=>scrollHistoryBottom())
  // 草稿状态行或编辑器高度变化会压缩视口，也必须补齐底部位置。
  historyResizeObserver.observe(historyElement.value!)
  if(historyContentElement.value)historyResizeObserver.observe(historyContentElement.value)
},{flush:'post'})
onBeforeUnmount(()=>{historyResizeObserver?.disconnect();cancelAnimationFrame(historyScrollFrame)})
/** 运行与媒体绑定同一消息组，避免生成后再次显示一遍相同的用户需求。 */
const conversationRows=computed(()=>groupConversation(messages.value,assistantHistory.value,planning.value,session.value?.id))
/** 内容增长引发的滚动事件不代表用户上翻；只有真实向上输入才暂停跟随。 */
function trackHistory(){const el=historyElement.value;if(el)followLatest.value=nextHistoryFollow(followLatest.value,el.scrollHeight-el.scrollTop-el.clientHeight)}
function historyWheel(event:WheelEvent){if(event.deltaY<0)followLatest.value=false}
function historyKey(event:KeyboardEvent){
  const target=event.target as HTMLElement
  if(target.closest('input,textarea,[contenteditable=true]'))return
  if(['ArrowUp','PageUp','Home'].includes(event.key)||(event.key===' '&&event.shiftKey))followLatest.value=false
}
let historyTouchY=0
function historyTouchStart(event:TouchEvent){historyTouchY=event.touches[0]?.clientY||0}
function historyTouchMove(event:TouchEvent){const y=event.touches[0]?.clientY||0;if(y>historyTouchY)followLatest.value=false;historyTouchY=y}
function historyScrollbar(event:PointerEvent){if(event.target===historyElement.value)followLatest.value=false}
function latest(){const el=historyElement.value;if(el){el.scrollTo({top:el.scrollHeight,behavior:'smooth'});followLatest.value=true}}
watch(()=>[conversationRows.value.length,allResults.value.length,planning.value?.status,planning.value?.stream_text,planning.value?.card?.text],async()=>{await nextTick();scrollHistoryBottom()},{flush:'post'})
/** 切换会话时清除本页瞬时状态；历史记录留在原会话，旧异步响应由 epoch 隔离。 */
watch(()=>session.value?.id,(id,previous)=>{
  if(id===previous||planning.value?.session_id===id)return
  ++assistantEpoch;assistantStream?.abort();planning.value=null;planningBusy.value=false;stoppingAssistant.value=false;explicitSkillBoundary.value=false;videoSwitch.value=null;answerText.value='';assistantAccepted.value=false;stopCountdown();followLatest.value=true
})

/** 恢复待回答流程只读取持久化状态，不重放模型，也不自动恢复倒计时。 */
watch(()=>session.value?.id,async id=>{
  assistantHistory.value=[]
  if(!id)return
  try{
    const rows=await creationService.runs(id)
    if(session.value?.id!==id)return
    assistantHistory.value=rows
    const latest=rows[rows.length-1]
    if(!route.query.run&&!planning.value&&latest&&!latest.executed_request&&['waiting','planning','ready'].includes(latest.status)){
      planning.value=latest;assistantDraft=JSON.stringify(latest.draft)
    }
  }catch{/* 助手历史加载失败不阻断媒体作品。 */}
})
const rulesOpen=ref(false),rulesBusy=ref(false),rulesRevision=ref(0),rulesLoaded=ref(false),rulesError=ref('')
const rules=ref({image:false,audio:false,video:false,cooldown:true,threshold:100})
// 弹窗使用独立草稿，取消不改变确认卡和已保存的会话规则。
const rulesDraft=ref({...rules.value})
const confirmationRuleKind=computed(()=>confirmation.value?.target==='music'?'audio':confirmation.value?.target==='video'?'video':'image')
const confirmationRuleChecked=computed(()=>rulesLoaded.value&&rules.value[confirmationRuleKind.value])
const countdown=ref<number|null>(null)
let countdownTimer:ReturnType<typeof setInterval>|undefined
let permissionTicket:{run:string;id:string;fingerprint:string}|null=null
/** 页面恢复只读取规则，绝不恢复倒计时；任意草稿变化撤销旧授权。 */
function stopCountdown(){
  if(countdownTimer)clearInterval(countdownTimer)
  countdown.value=null
  if(permissionTicket){const ticket=permissionTicket;permissionTicket=null;void creationService.revoke(ticket.run,ticket.id).catch(()=>{})}
}
onBeforeUnmount(stopCountdown)
/** 未读到服务器规则禁止保存，不能把默认值误写回会话。 */
async function loadConfirmationRules(){
  const id=session.value?.id
  rulesLoaded.value=false;rulesError.value=''
  if(!id)return
  try{const value=await creationService.rules(id);if(session.value?.id===id){rules.value=value.rules;rulesDraft.value={...value.rules};rulesRevision.value=value.revision;rulesLoaded.value=true}}
  catch{if(session.value?.id===id)rulesError.value='设置读取失败，请重试。'}
}
watch(()=>session.value?.id,()=>{stopCountdown();rules.value={image:false,audio:false,video:false,cooldown:true,threshold:100};rulesRevision.value=0;void loadConfirmationRules()})
// 事件流只恢复助手阶段及最终卡片，不从重连事件恢复自动执行或内部思考过程。
let assistantStream:AbortController|undefined
/** POST 和订阅共用单调调用序号；迟到的 planning 快照不能覆盖已落盘的等待/完成状态。 */
function applyAssistantState(state:CreationRun){
  const current=planning.value
  if(!canAcceptRun(current,state))return
  planning.value=state
}
// 监听原始值而非每次新建数组；正文快照更新不能反复重建 SSE 连接并触发限流。
watch([()=>planning.value?.id,()=>planning.value?.status],([id,status])=>{
  assistantStream?.abort()
  if(!id||status!=='planning')return
  const controller=new AbortController();assistantStream=controller
  void creationService.observeRun(id,controller.signal,state=>{if(!controller.signal.aborted)applyAssistantState(state)},planning.value?.awaiting_calls||0).catch(()=>{/* 只读恢复由订阅服务处理，不重放创建请求。 */})
})
onBeforeUnmount(()=>assistantStream?.abort())
watch([prompt,parameters,references,skill],stopCountdown,{deep:true})
// 设置草稿改变即撤销旧倒计时；重新打开从服务器读取，取消关闭不残留未保存规则。
watch(rules,stopCountdown,{deep:true})
watch(rulesDraft,stopCountdown,{deep:true})
watch(rulesOpen,async open=>{if(open){await loadConfirmationRules();rulesDraft.value={...rules.value}}})
async function saveConfirmationRules(){
  if(!session.value||rulesBusy.value||!rulesLoaded.value)return
  stopCountdown();rulesBusy.value=true
  const id=session.value.id,next={...rulesDraft.value}
  try{await creationService.saveRules(id,rulesRevision.value,next);if(session.value?.id===id){rules.value=next;rulesRevision.value++;rulesOpen.value=false}}catch{rulesError.value='确认设置保存失败或已被其他页面修改，请刷新后重试。'}finally{rulesBusy.value=false}
}
/** 卡片勾选立即保存同一会话规则；保存成功才更新显示，不触发当前任务自动提交。 */
async function changeConfirmationRule(enabled:boolean){
  const id=session.value?.id
  if(!id||!rulesLoaded.value||rulesBusy.value||busy.value)return
  stopCountdown();rulesBusy.value=true;rulesError.value=''
  const next={...rules.value,[confirmationRuleKind.value]:enabled}
  try{await creationService.saveRules(id,rulesRevision.value,next);if(session.value?.id===id){rules.value=next;rulesDraft.value={...next};rulesRevision.value++}}
  catch{if(session.value?.id===id)rulesError.value='确认设置未保存，请重试或打开会话设置刷新。'}
  finally{rulesBusy.value=false}
}
function executionPayload(){
  const value=confirmation.value;if(!value)throw new Error('请先取得有效报价。')
  if(value.target==='image')return buildProductImagePayload(value.payload as ProductImageGeneratePayload)
  if(value.target==='video')return buildProductVideoPayload(value.payload as ProductVideoCreatePayload)
  const payload=value.payload as {operation:string;inputs:Record<string,unknown>;creationContext:string}
  return {operation:payload.operation,inputs:payload.inputs,rights_confirmed:value.draft.parameters.rightsConfirmed,request_id:value.requestId,creation_context:payload.creationContext}
}
/** 执行前服务端核验许可；手动按钮不受免确认规则限制，自动模式必须再次核准总价。 */
async function authorizeExecution(){
  const value=confirmation.value,run=planning.value
  if(!value||value.target==='drama')return
  if(!run||run.status!=='ready')throw new Error('请先让助手核对创作方案。')
  const payload=executionPayload(),fingerprint=JSON.stringify(payload)
  if(permissionTicket?.fingerprint===fingerprint)return
  const granted=await creationService.authorize(run.id,value.target,payload,value.credits,false)
  permissionTicket={run:run.id,id:granted.id,fingerprint}
}
async function maybeAutoExecute(){
  const value=confirmation.value,run=planning.value
  if(run?.requires_manual_confirmation)return
  if(!value||!run||value.target==='drama'||!value.sufficient||!Number.isFinite(value.credits))return
  const kind=value.target==='music'?'audio':value.target
  if(!rulesLoaded.value||!rules.value[kind]||value.credits>rules.value.threshold)return
  const fingerprint=JSON.stringify(executionPayload())
  try{
    const granted=await creationService.authorize(run.id,value.target,executionPayload(),value.credits,true)
    if(confirmation.value!==value||fingerprint!==JSON.stringify(executionPayload())){void creationService.revoke(run.id,granted.id);return}
    permissionTicket={run:run.id,id:granted.id,fingerprint};countdown.value=granted.countdown
    if(!granted.countdown){await submit();return}
    countdownTimer=setInterval(()=>{if(countdown.value===null)return;countdown.value--;if(countdown.value<=0){if(countdownTimer)clearInterval(countdownTimer);countdown.value=null;void submit()}},1000)
  }catch{error.value='此方案需要手动确认，请核对报价后生成。'}
}
// 真实执行状态决定按钮形态；媒体提交后的供应商任务没有暂停接口，不伪造取消成功。
const mediaRunning=computed(()=>messages.value.some(item=>!!item.task_id&&['queued','submitting','in_progress','processing','pending','running'].includes(taskData[item.id]?.status||'')))
let assistantEpoch=0
const stoppingAssistant=ref(false),explicitSkillBoundary=ref(false)
// 媒体已经提交后继续运行；停止按钮只结束助手响应，不顺带取消作品任务。
const assistantInteractionState=computed(()=>assistantInteraction({preparing:busy.value,requesting:planningBusy.value||safetyDirectBusy.value,stopping:stoppingAssistant.value,phase:planning.value?.status,countdown:countdown.value!==null,annotating:annotationSubmitting.value}))
const canStopWork=computed(()=>assistantInteractionState.value.canStop)
const assistantAccepted=ref(false)
const proposalQuoteBusy=ref(false),proposalQuoteError=ref('')
let quotedProposalKey='',userInitiatedRun=''
let assistantDraft=''
let pendingSafetySource=''
let pendingSafetyKind:'image'|'video'='image'
let pendingSafetyEdited=false
const autoSafetyRepairMessageIds=ref<string[]>([])
// 恢复时只为最新一条审核失败读取／整理建议，不给所有旧失败铺空卡或批量调用 AI。
function safetyFailure(item:CreationMessage){return ['image','video'].includes(item.task_type)&&taskData[item.id]?.status==='failed'&&(taskData[item.id]?.images?.errorCode||taskData[item.id]?.video?.errorCode)==='CONTENT_POLICY_VIOLATION'}
const latestSafetyMessageId=computed(()=>[...messages.value].reverse().find(safetyFailure)?.id)
let observedSafetyScope='',observedSafetyStates=new Map<string,string>()
/** 仅在当前会话真实观察到运行转审核失败时整理一次，不对刷新历史批量调用 AI。 */
watch(()=>messages.value.map(item=>({id:item.id,status:taskData[item.id]?.status||'',code:taskData[item.id]?.images?.errorCode||taskData[item.id]?.video?.errorCode})),items=>{
  const scope=session.value?.id||''
  if(scope!==observedSafetyScope){observedSafetyScope=scope;observedSafetyStates=new Map();autoSafetyRepairMessageIds.value=[]}
  for(const item of items){
    if(['queued','submitting','in_progress','processing','pending','running'].includes(observedSafetyStates.get(item.id)||'')&&item.status==='failed'&&item.code==='CONTENT_POLICY_VIOLATION'&&!autoSafetyRepairMessageIds.value.includes(item.id))autoSafetyRepairMessageIds.value.push(item.id)
    if(item.status)observedSafetyStates.set(item.id,item.status)
  }
},{deep:true})

/** 建议框确认同时表达重新提交意图；后台核价一致后走新的人工执行许可，不再二次点击。 */
async function adoptSafetyRepair(item:CreationMessage,candidate:ImageSafetyRepair & {edited?:boolean},restore:()=>void){
  if(busy.value||workInProgress.value||candidate.status!=='ready'||!item.task_id){restore();return}
  // 原失败需求可被用户明确确认的建议替换，但不得覆盖正在编写的其他新草稿。
  if(prompt.value.trim()&&prompt.value.trim()!==item.content.prompt.trim()){error.value='请先保留或清空输入框草稿，再确认建议。';restore();return}
  stopCountdown();confirmation.value=null;permissionTicket=null
  const source=item.content as CreationDraft
  references.value=[]
  const {model,aspectRatio,resolution,quality,count,durationSec}=source.parameters||parameters.value
  setSkill(source.skill);entry.value=conversationEntry(entry.value,source.skill)
  patchParameters({model,aspectRatio,resolution,quality,count,durationSec,extra:{requirement_boundary:true}})
  explicitSkillBoundary.value=true;pendingSafetySource=item.task_id;pendingSafetyKind=item.task_type==='video'?'video':'image';pendingSafetyEdited=!!candidate.edited
  setText(candidate.prompt,[])
  const priorRunId=planning.value?.id,sid=session.value?.id
  const original={target:pendingSafetyKind,credits:taskData[item.id]?.images?.requiredCredits??taskData[item.id]?.video?.requiredCredits??NaN,parameters:{...source.parameters}}
  safetyDirectBusy.value=true
  try{
    await planDemand()
    const run=planning.value,epoch=assistantEpoch
    if(!run||run.id===priorRunId||session.value?.id!==sid||run.status!=='ready'||run.draft.prompt!==candidate.prompt)return
    quotedProposalKey=`${run.id}:${run.question_revision??run.calls}`
    await quoteAssistantPlan(false)
    if(epoch!==assistantEpoch||session.value?.id!==sid||planning.value?.id!==run.id||planning.value.status!=='ready')return
    const quote=confirmation.value
    if(!quote)return
    if(!safetySubmissionMatches(original,quote)){
      error.value='模型、规格或报价已变化，或积分不足，请核对后确认。'
      return
    }
    // submit 内部仍复核实时报价、申请新许可，并复用原有幂等提交和扣点流程。
    await submit()
  }finally{
    safetyDirectBusy.value=false
    // 未建立新轮次时恢复原建议；已接收的新需求由对应消息与确认卡继续承载。
    if(session.value?.id===sid&&(!planning.value||planning.value.id===priorRunId))restore()
  }
}
watch([prompt,skill,parameters,references],()=>{assistantAccepted.value=false},{deep:true})
const workInProgress=computed(()=>assistantInteractionState.value.working)
const stopReason=computed(()=>canStopWork.value?'停止整理需求，保留当前草稿':mediaRunning.value?'任务已提交，暂不支持暂停；关闭页面不会取消生成。':'请求处理中，暂不能中断；不会自动重复提交。')
const videoSwitch = ref<{batch:string;result:string;text:string} | null>(null)
const audition=ref<{url:string;title:string}|null>(null)
function clearAudition(){if(audition.value)URL.revokeObjectURL(audition.value.url);audition.value=null}
onBeforeUnmount(clearAudition)
async function receiveFiles(files:File[]){
  const audio=files.find(file=>file.type.startsWith('audio/'))
  if(entry.value==='music' && !skill.value.startsWith('mv-') && audio){clearAudition();audition.value={url:URL.createObjectURL(audio),title:audio.name};return}
  // 新上传是外部来源，不能继承上一首本人歌曲的使用确认。
  if(audio&&skill.value.startsWith('mv-')){patchParameters({rightsConfirmed:false,sourceTask:'',extra:{...parameters.value.extra,mv_song_version:''}})}
  await upload(files)
}
const mvSource = ref(''), mvUrl = ref('')
const mvPickerOpen=ref(false)
const mvSourceMode=ref<'owned'|'link'>('owned')
/** 来源互斥：切换时清空另一种输入，只允许一个明确的提交来源。 */
watch(mvSourceMode,mode=>{if(mode==='owned')mvUrl.value='';else mvSource.value=''})
const validMvLink=computed(()=>{try{const url=new URL(mvUrl.value.trim());return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password}catch{return false}})
const canUseMvSource=computed(()=>!busy.value&&(mvSourceMode.value==='owned'?!!mvSource.value:validMvLink.value))
async function confirmMvSource(){if(!canUseMvSource.value)return;if(mvSourceMode.value==='owned')await selectMvSong();else await importMvUrl()}
/** 已生成歌曲保存真实音频版本，不把供应商临时 URL 直接交给导演或队列。 */
async function selectMvSong() {
  if(!mvSource.value || busy.value)return
  busy.value=true
  try {
    const [taskId,index]=mvSource.value.split(':')
    const item=await libraryService.saveResult('music',taskId!,index,'other')
    const version=item.versions[0]!
    const songs=(musicTasks.value.find(task=>task.id===taskId)||(sourceTask.value?.id===taskId?sourceTask.value:undefined))?.result.music
    const song=Array.isArray(songs)?songs[Number(index)] as Record<string,unknown> | undefined:undefined
    // 显式选择只固定本次制作来源，不再记录或伪造授权勾选；兼容旧草稿字段置为 false。
    patchParameters({sourceTask:mvSource.value,rightsConfirmed:false,extra:{...parameters.value.extra,mv_song_version:version.id,mv_lyrics:String(song?.lyrics||''),mv_start_sec:0,mv_end_sec:Math.min(30,version.media.duration_sec||30)}})
    references.value=[{item_id:item.id,version_id:version.id,purpose:'reference',name:String(song?.title||item.name),media_type:'audio',preview_url:libraryService.previewUrl(version.preview_url),cover_url:String(song?.image_large_url||song?.image_url||'')}]
    mvPickerOpen.value=false
  }catch(cause){error.value=(cause as Error).message}finally{busy.value=false}
}
async function importMvUrl(){
  if(busy.value || !validMvLink.value)return
  busy.value=true
  try{const item=await creationService.importAudio(mvUrl.value.trim());const version=item.versions[0]!;patchParameters({sourceTask:'',rightsConfirmed:false,extra:{...parameters.value.extra,mv_song_version:''}});references.value=[{item_id:item.id,version_id:version.id,purpose:'reference',name:item.name,media_type:'audio',preview_url:libraryService.previewUrl(version.preview_url)}];mvPickerOpen.value=false}catch(cause){error.value=(cause as Error).message}finally{busy.value=false}
}
/** 规划请求显式触发，刷新只读取状态，不重新调用文字模型或生成。 */
async function planDemand() {
  if(!requireLogin())return
  if(safetyDirectBusy.value&&!pendingSafetySource)return
  if (planningBusy.value || stoppingAssistant.value || planning.value?.status==='planning' || !prompt.value.trim()) return
  scrollHistoryBottom(true)
  // 修复历史“图片入口＋自由创作”草稿，不能让合法自由对话被入口校验挡住。
  entry.value=conversationEntry(entry.value,skill.value)
  // 新需求撤销旧报价及许可，技能边界只来自用户主动选择，不包含助手推荐。
  stopCountdown();confirmation.value=null;error.value=''
  const sid=session.value?.id,previous=planning.value||assistantHistory.value.at(-1)
  const boundary=explicitSkillBoundary.value||parameters.value.extra.requirement_boundary===true
  const parent=!boundary&&previous?.session_id===sid&&[previous.draft.skill,previous.card?.skill].includes(skill.value)?previous.id:null
  const requestDraft=draft(),extra={...requestDraft.parameters.extra}
  for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool','requirement_boundary','safety_repair_source','safety_repair_edited'])delete extra[key]
  if(pendingSafetySource){extra.safety_repair_source=pendingSafetySource;extra.safety_repair_kind=pendingSafetyKind;extra.safety_repair_edited=pendingSafetyEdited;pendingSafetySource='';pendingSafetyEdited=false}
  requestDraft.parameters={...requestDraft.parameters,extra}
  assistantAccepted.value=false;assistantDraft=JSON.stringify(draft())
  const epoch=++assistantEpoch
  planningBusy.value=true
  try {
    const started=await creationService.startRun(requestDraft,crypto.randomUUID(),sid,undefined,parent)
    if(epoch!==assistantEpoch||!sameRunScope(sid,session.value?.id,started.session_id))return
    explicitSkillBoundary.value=false
    if(parameters.value.extra.requirement_boundary){const extra={...parameters.value.extra};delete extra.requirement_boundary;patchParameters({extra})}
    if(planning.value)assistantHistory.value=[...assistantHistory.value.filter(item=>item.id!==planning.value!.id),planning.value]
    planning.value=started
    userInitiatedRun=started.id
    if(prompt.value===started.draft.prompt)setText('',[])
    await routerRun(started.id,started.session_id)
    const result=await creationService.advanceRun(started.id)
    if(epoch===assistantEpoch&&sameRunScope(sid,session.value?.id,started.session_id)){applyAssistantState(result);if(prompt.value===started.draft.prompt)setText('',[])}
  } catch(cause){if(epoch===assistantEpoch&&sameRunScope(sid,session.value?.id,planning.value?.session_id)){
    // 创建成功但响应中断只读取原流程，不能重放创建或扣费请求。
    if(planning.value?.id)try{const state=await creationService.run(planning.value.id);if(epoch===assistantEpoch&&sid===session.value?.id)applyAssistantState(state)}catch{}
    // 业务拒绝不能伪装成断线，否则用户会一直重试同一个无效请求。
    const status=Number((cause as {statusCode?:number}).statusCode||0)
    error.value=status>=400&&status<500?(cause as Error).message:'响应连接中断，已保留原流程和输入；可刷新状态后继续，未重复提交生成。'
  }} finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
/** 用户明确切换技能才清空隐式上下文，历史消息与产物仍保留在原会话。 */
function selectUserSkill(id:string){
  if(id===skill.value||workInProgress.value)return
  explicitSkillBoundary.value=true;stopCountdown();confirmation.value=null
  const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool'])delete extra[key]
  references.value=[];entry.value=conversationEntry(entry.value,id);patchParameters({extra:{...extra,requirement_boundary:true}});setSkill(id)
}
async function routerRun(id: string,sid?:string|null) { await navigateTo({path:'/dashboard',query:{...route.query,...(sid?{session:sid}:{}),run:id}}) }
async function answerPlanning(answer: string) {
  if (!planning.value || planningBusy.value || !answer.trim()) return
  scrollHistoryBottom(true)
  const epoch=++assistantEpoch,run=planning.value,currentDraft=draft()
  // 旧问题卡属于自己的原始技能；不能因为工具栏暂留其他技能而触发后端草稿校验错误。
  const answerDraft=currentDraft.skill===run.draft.skill?currentDraft:run.draft
  userInitiatedRun=run.id
  planningBusy.value=true;pendingUserAnswer.value=answer;error.value='';proposalQuoteError.value=''
  // 后续轮次同样订阅正文；最小调用序号隔离上一轮尚未更新的 waiting 快照。
  planning.value={...run,status:'planning',stream_text:'',card:undefined,awaiting_calls:run.calls+1}
  try {
    const value=await creationService.answerRun(run.id,run.calls,answer,run.question_revision,answerDraft)
    if(epoch!==assistantEpoch)return
    applyAssistantState(value);if(prompt.value===answer)setText('',[])
    answerText.value=''
    if(planning.value.status==='ready') {
      // 编辑区快照只比较本次真实提交的输入；完整执行需求另由服务端 task_input 冻结。
      // 已消费的答案会从编辑区清除，不能拿合并后的执行长文与空草稿比较。
      assistantDraft=JSON.stringify({...answerDraft,prompt:answerDraft.prompt===answer?'':answerDraft.prompt})
    }
  } catch(cause){if(epoch===assistantEpoch){
    // POST 可能丢失响应而订阅已收到新快照，失败时读取原流程，不能退回旧问题。
    try{const value=await creationService.run(run.id);if(epoch===assistantEpoch)applyAssistantState(value)}catch{}
    if(epoch===assistantEpoch)error.value='回答响应中断，正在保留原流程状态；请刷新状态后继续，未重复发送。'
  }} finally{if(epoch===assistantEpoch){planningBusy.value=false;pendingUserAnswer.value=''}}
}
async function cancelPlanning(){
  // 导演草稿刚生成时状态读取可能尚未返回，仍须取消真实流程，而不只是隐藏卡片。
  if(countdown.value!==null){stopCountdown();return}
  if(stoppingAssistant.value)return
  const cancelEpoch=++assistantEpoch,cancelSession=session.value?.id
  stoppingAssistant.value=true
  try {
    const id=director.value?.mv_run_id || director.value?.director_run_id || planning.value?.id
    if(id){
      const value=await creationService.cancelRun(id)
      if(cancelEpoch!==assistantEpoch||cancelSession!==session.value?.id)return
      planning.value=value
      // 停止不覆盖用户新输入；只有空输入框才恢复本次已发送需求供后续编辑。
      if(!prompt.value.trim()){const text=value.draft.original_prompt??value.draft.prompt;setText(text,[{type:'text',text}])}
    }
    director.value=null;directorAccepted.value=false
    const extra={...parameters.value.extra};delete extra.creation_run_id;delete extra.mv_run_id;delete extra.director_run_id;patchParameters({extra})
    // 清除恢复入口，刷新不会再次打开已取消的脚本。
    const query={...route.query};delete query.run
    await navigateTo({path:'/dashboard',query})
  } catch(cause){if(cancelEpoch===assistantEpoch)error.value='停止请求未被服务端确认，请点击停止重试；任务状态尚未改变。'} finally{if(cancelEpoch===assistantEpoch){planningBusy.value=false;stoppingAssistant.value=false}}
}
async function confirmVideoSwitch() {
  const value=videoSwitch.value;if(!value)return
  await continueImage(value.batch,value.result,true)
  if(!error.value){setText(value.text,[{type:'text',text:value.text}]);videoSwitch.value=null}
}
const templates = computed<CreationTemplate[]>(() => {
  // 统一读取已落库上架模板，避免本地演示预设与旧商品模板混在一起。
  return (catalog.value?.templates || []).map(item => ({ ...item, cover: item.cover.startsWith('/creation-presets/') || item.cover.startsWith('http') ? item.cover : siteAsset(item.cover) }))
})
const recommendedSkills = computed(() => (catalog.value?.skills || []).filter(item => item.recommended_entries?.includes(entry.value) && item.entries.includes(entry.value) && item.is_active !== false && (entry.value!=='music'||['song','mv-visual'].includes(item.id))))
const selectedTemplate = computed(() => templates.value.find(item => item.id === parameters.value.selectedTemplateId) || null)
const cases = ref<PublicCreationCase[]>([]), selectedCase = ref<PublicCreationCase | null>(null)
const casesLoading=ref(false),casesError=ref('')
// 内容分类由服务端返回，旧案例兼容“其他创作”，不拿展示入口或媒体类型冒充分类。
const caseCategory=ref('all')
const caseCategories=computed(()=>[...new Map(cases.value.map(item=>[item.category||'other',{code:item.category||'other',label:item.category_label||'其他创作'}])).values()])
const filteredCases=computed(()=>cases.value.filter(item=>caseCategory.value==='all'||(item.category||'other')===caseCategory.value))
watch(()=>entry.value,()=>{caseCategory.value='all'})
let caseRevision=0
/** 按入口读取后台公开案例；旧入口响应不会覆盖当前分类。 */
async function loadCases(){const current=++caseRevision;casesLoading.value=true;casesError.value='';cases.value=[];selectedCase.value=null;try{const values=await creationCaseService.list(entry.value);if(current===caseRevision)cases.value=values}catch{if(current===caseRevision)casesError.value='案例加载失败，请重试。'}finally{if(current===caseRevision)casesLoading.value=false}}
watch(entry,loadCases,{immediate:true})
async function openCase(item:PublicCreationCase){try{selectedCase.value=await creationCaseService.detail(item.id,entry.value)}catch{casesError.value='案例已下架或暂不可用，请刷新列表。';await loadCases()}}
async function makeSame(){const item=selectedCase.value;if(!item)return;try{const fresh=await creationCaseService.detail(item.id,entry.value);if(!fresh.template){notice.value='关联模板已下架，暂不能制作同款。';selectedCase.value=fresh;return}selectedCase.value=null;await chooseTemplate(fresh.template)}catch{notice.value='案例或模板暂不可用，请重新选择。'}}
const caseGrid = ref<HTMLElement | null>(null)
/** 上划提示也可点击，定位案例列表；减少动态效果的用户使用即时滚动。 */
function browseCases() {
  caseGrid.value?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}
const caseHeading = computed(() => ({ free: '精选创作案例', drama: '公开短剧案例', commerce: '电商与广告案例', music: '音乐与 MV 灵感', image: '图片创作案例' })[entry.value])
const images = computed(() => activeResult.value?.images?.results || [])
const videos = computed(() => activeResult.value?.video?.results || [])
const songs = computed<Array<Record<string, any>>>(() => Array.isArray(activeResult.value?.music?.result.music) ? activeResult.value!.music!.result.music as Array<Record<string, any>> : [])
const chosenImage = computed(() => images.value[selectedResult.value] || images.value[0])
const chosenVideo = computed(() => videos.value[selectedResult.value] || videos.value[0])
const sourceTask = computed(() => activeResult.value?.music)
const resultTarget = computed(()=>focused.value?.task_type || target.value)
const mediaLinks = computed(() => songs.value.length?[]:processingResults(sourceTask.value?.result))
const creditLabel = computed(() => confirmation.value ? `${confirmation.value.credits} 点` : estimateLabel.value)
// 结果目录依赖音频及处理结果，必须在计算属性全部初始化后再建立订阅。
watch([canvasSelected,selectedResultKey],([version,key])=>{if(version&&key)viewedVersions.set(key,version)})
const statusLabels: Record<string, string> = { quoting: '预估费用', queued: '排队中', submitting: '提交中', in_progress: '生成中', completed: '已完成', needs_review: '待核对', failed: '生成失败' }
async function chooseTemplate(item: CreationTemplate) {
  const priorExamples=new Set(selectedTemplate.value?.example_refs?.map(ref=>ref.version_id) || [])
  const ownReferences=references.value.filter(ref=>!priorExamples.has(ref.version_id))
  setSkill(item.skill); patchParameters({ ...item.parameters, templateId: item.parameters?.templateId || '', selectedTemplateId: item.id })
  if (entry.value === 'drama') {
    const style = catalog.value?.styles.find(style => item.id.includes('fantasy') ? /玄幻/.test(style.display_name) : /都市/.test(style.display_name))
    if (style) patchParameters({ style: style.display_name, styleId: style.style_id })
  } else {
    // 后台旧模板没有字段语法时，按描述段落提供原位编辑，不修改原始描述或模板编号。
    const parts = templateSegments(item.prompt)
    if (item.source && !parts.some(part => part.field)) {
      const clauses = item.prompt.split(/([，。,；;\n])/)
      setText(item.prompt, clauses.filter(Boolean).map((text, index) => ({ type: 'text', text, ...(!/^[，。,；;\n]$/.test(text) ? { field: `描述${Math.floor(index / 2) + 1}` } : {}) })))
    } else setText(parts.map(part => part.text).join(''), parts)
  }
  // 只有已登记的真实平台版本参与生成；音乐封面不会混入音频引用。
  if (selectedSkill.value?.target !== 'music' && item.example_refs?.length) {
    try {
      const values: ComposerReference[]=[]
      for(const ref of item.example_refs){const asset=await libraryService.detail(ref.item_id);const version=asset.versions.find(row=>row.id===ref.version_id);if(version)values.push({...ref,name:asset.name,media_type:asset.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}
      references.value=[...ownReferences,...values.filter(ref=>!ownReferences.some(own=>own.version_id===ref.version_id))]
    } catch(cause){error.value=`示例素材不可用，请上传自己的素材：${(cause as Error).message}`}
  }
}
async function sendWithContext() {
  if(!requireLogin())return
  if(safetyDirectBusy.value)return
  if(annotationSubmitting.value||planningBusy.value||stoppingAssistant.value||planning.value?.status==='planning')return
  scrollHistoryBottom(true)
  // 批注预览不是已上传附件；显式发送时才持久化，失败保留编辑内容，不提交生成。
  if(annotationDraft.value){
    annotationSubmitting.value=true
    try{
      await canvasRef.value?.finishAnnotation()
      const value=annotationDraft.value,sid=session.value?.id
      if(!value||!sid)throw new Error('批注来源暂不可用，请重新选择作品。')
      const artifact=await creationService.saveArtifact(sid,value.file,value.source,value.operations,value.requestId)
      // 迟到保存只属于原会话，不能把批注写入用户刚切换的会话。
      if(session.value?.id!==sid)return
      let originalVersion=''
      if(value.source.kind==='artifact')originalVersion=session.value?.artifacts?.find(v=>v.id===value.source.id)?.version_id||''
      else if(value.source.kind==='reference')originalVersion=value.source.id
      else if(value.source.kind==='image'){const item=await libraryService.saveResult('product_image',value.source.id,value.source.result_id!,'other');originalVersion=item.versions[0]?.id||''}
      if(session.value?.id!==sid)return
      session.value!.artifacts=[...(session.value!.artifacts||[]).filter(v=>v.id!==artifact.id),artifact]
      const typed=prompt.value;setSkill('edit');references.value=[...references.value.filter(v=>v.version_id!==originalVersion),{item_id:artifact.item_id,version_id:artifact.version_id,purpose:'reference',name:'批注',media_type:'image',preview_url:libraryService.previewUrl(artifact.preview_url)}]
      // 批注续作绑定自己的固定版本，不沿用上一作品的规划执行标识。
      const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id'])delete extra[key]
      director.value=null;directorAccepted.value=false
      patchParameters({templateId:'',selectedTemplateId:'',workflow:'direct',extra:{...extra,workspace_tool:{action:'edit',source:{kind:'artifact',id:artifact.id}}}})
      setText(typed,[{type:'text',text:typed}]);canvasRef.value?.markSaved();canvasSelected.value=artifact.id
      // 首次发送批注必须重新报价，不能沿用原图报价直接提交收费任务。
      confirmation.value=null
    }catch(cause){error.value=(cause as Error).message;return}finally{annotationSubmitting.value=false}
  }
  // 底部输入始终视为需求修订，问题卡的答案才调用回答接口。
  // 发送阶段只协商意图；当前结果作为只读上下文，不把闲聊自动变成图片修改。
  if(entry.value!=='drama'){await planDemand();return}
  await prepare()
}
/** 方案就绪后只准备报价卡；恢复页面不触发自动授权或生成。 */
const proposalSubmitted=computed(()=>!!planning.value&&(!!planning.value.executed_request||messages.value.some(item=>!!item.task_id&&item.content.parameters.extra?.creation_run_id===planning.value?.id)))
// 仅待补充问题阶段可以返回修改；已完成方案或已提交媒体不回退旧答案。
const canReviseQuestion=computed(()=>planning.value?.status==='waiting'&&!!planning.value.answers.length&&!proposalSubmitted.value&&!planningBusy.value&&!busy.value&&!workInProgress.value)
/** 直接生成只保留一张确认卡；导演分镜仍沿用必要的脚本编辑流程。 */
const singleConfirmationProposal=computed(()=>!safetyDirectBusy.value&&canShowGenerationConfirmation(planning.value,proposalSubmitted.value))
// 真实技术参数改变后自动重新核价；同值更新不产生重复请求，来源和正文仍须重新协商。
const proposalParametersKey=computed(()=>JSON.stringify({...parameters.value,extra:undefined}))
watch([()=>planning.value?.id,()=>planning.value?.status,()=>planning.value?.card?.type,proposalParametersKey,planningBusy,loading,busy,sessionLoading,()=>cloudDraft.state.value,()=>cloudDraft.restoring.value,()=>cloudDraft.restored.value],()=>{
  const run=planning.value
  // 会话和云草稿均恢复完毕后再报价，防止晚到的草稿覆盖刚得到的确认卡。
  if(!run||!singleConfirmationProposal.value||!draftReady.value||!cloudDraft.restored.value||cloudDraft.restoring.value||cloudDraft.state.value==='loading'||sessionLoading.value||planningBusy.value||loading.value||proposalQuoteBusy.value||busy.value)return
  const key=`${run.id}:${run.question_revision??run.calls}:${proposalParametersKey.value}`
  if(quotedProposalKey===key)return
  quotedProposalKey=key
  void quoteAssistantPlan(userInitiatedRun===run.id)
// 云草稿的恢复监听在 post 阶段开始，此处随后检查，避免早一个队列发起报价。
},{flush:'post'})
/** 自动显示真实报价，手动只需点一次确认；原有免确认规则仅用于本页明确发起的新流程。 */
async function quoteAssistantPlan(allowAuto=false){
  if(proposalQuoteBusy.value)return
  const run=planning.value,epoch=assistantEpoch
  if(!run||run.status!=='ready')return
  proposalQuoteBusy.value=true;proposalQuoteError.value=''
  try{
    await acceptAssistantPlan()
    if(planning.value?.id!==run.id||planning.value.status!=='ready'||epoch!==assistantEpoch){confirmation.value=null;return}
    if(!confirmation.value){proposalQuoteError.value=error.value||'暂未取得有效报价，请重试。';return}
    if(allowAuto&&assistantAccepted.value)await maybeAutoExecute()
  }catch(cause){proposalQuoteError.value=cause instanceof Error?cause.message:'报价读取失败，请重试。'}
  finally{proposalQuoteBusy.value=false}
}
/** 取消的对象限定为本次待确认方案，不能误取消会话里其他运行中的媒体任务。 */
async function cancelProposal(){
  const run=planning.value;if(!run||busy.value||proposalQuoteBusy.value)return
  stopCountdown();++assistantEpoch;confirmation.value=null;assistantAccepted.value=false
  try{const cancelled=await creationService.cancelRun(run.id);if(planning.value?.id===run.id)planning.value=cancelled}
  catch{proposalQuoteError.value='取消未获服务端确认，请重试。'}
}
const proposalModelLabel=computed(()=>{if((confirmation.value?.target||planning.value?.card?.target||target.value)==='music')return 'Suno · 音乐引擎';const code=confirmation.value?.draft.parameters.model||planning.value?.card?.model||parameters.value.model;return models.value.find(item=>item.code===code)?.name||code||'待报价'})
const proposalSpec=computed(()=>{const value=confirmation.value?.draft.parameters||parameters.value;if((confirmation.value?.target||planning.value?.card?.target||target.value)==='music')return (value.extra.instrumental?'纯音乐':'歌曲')+' · '+(value.customLyrics?'自定义歌词':'根据描述创作');return `${value.aspectRatio} · ${value.resolution} · ${{low:'快速',medium:'标准',high:'精细'}[value.quality]}${confirmation.value?.target==='image'?` · ${value.count} 张`:''}`})
// 切换推荐技能与绑定来源沿用现有逻辑，仅为报价准备冻结草稿，不执行媒体生成。
async function acceptAssistantPlan(){
  // 允许修改模型及规格后重报价；正文或固定素材改变则必须重新协商，不能套用旧方案。
  if(assistantDraft){
    const prior=JSON.parse(assistantDraft),current=draft()
    if((current.prompt.trim() && prior.prompt!==current.prompt) || prior.skill!==current.skill || JSON.stringify(prior.references)!==JSON.stringify(current.references)){error.value='需求或来源已改变，请重新发送给助手核对方案。';return}
  }
  const card=planning.value?.card
  if(planning.value?.status!=='ready')return
  // 同媒体采用推荐技能只补配方，不重置用户已选的模型、快速质量及清晰度。
  const selectedParameters=JSON.parse(JSON.stringify(parameters.value)) as CreationParameterState,originalTarget=target.value
  const run=planning.value
  const proposalText=run.task_input?.prompt||run.generation_prompt||[run.draft.original_prompt??run.draft.prompt,...run.answers.map(item=>`${item.question}：${item.answer}`)].join('\n')
  if(card?.skill && card.skill!==skill.value){
    if(canvasRef.value&&!await canvasRef.value.confirmLeave())return
    const next=card.skill
    if(!catalog.value?.skills.some(item=>item.id===next)){
      entry.value=['song','instrumental','reference','remix'].includes(next)||next.startsWith('mv-')?'music':'free'
      catalog.value=await creationService.catalog(entry.value)
    }
    const text=prompt.value
    if(next==='animate'&&!references.value.some(item=>item.media_type==='image')&&activeResult.value?.images&&chosenImage.value)await continueImage(activeResult.value.images.id,chosenImage.value.id,true)
    setSkill(next);setText(text,[{type:'text',text}])
  }
  // 只有采用编辑／图转视频方案时才绑定来源，普通聊天不改变所选技能。
  if(['edit','animate'].includes(card?.skill||skill.value)&&!references.value.some(item=>item.media_type==='image')&&activeResult.value?.images&&chosenImage.value){
    const text=prompt.value,next=card?.skill||skill.value
    await continueImage(activeResult.value.images.id,chosenImage.value.id,next==='animate');setText(text,[{type:'text',text}]);setSkill(next)
  }
  if(target.value===originalTarget)patchParameters({model:selectedParameters.model,aspectRatio:selectedParameters.aspectRatio,resolution:selectedParameters.resolution,quality:selectedParameters.quality,count:selectedParameters.count})
  // 服务端已合并用户聊天中的明确参数修改，确认卡与执行必须消费同一快照。
  if(run.task_input && parameters.value.extra.creation_run_id!==run.id)patchParameters(run.task_input.parameters)
  if(card?.model && (!selectedParameters.model || target.value!==originalTarget) && parameters.value.extra.creation_run_id!==planning.value?.id)patchParameters({model:card.model})
  patchParameters({extra:{...parameters.value.extra,creation_run_id:planning.value!.id}})
  await prepare(true,{...draft(),skill:run.task_input?.skill||draft().skill,skill_version:run.task_input?.skill_version,prompt:proposalText,generation_prompt:proposalText,original_prompt:run.draft.original_prompt??run.draft.prompt,references:run.task_input?.references||draft().references})
  assistantAccepted.value=!!confirmation.value
  assistantDraft=JSON.stringify(draft())
}
function selectAssets(values: Array<{ item: LibraryItem; version: LibraryVersion; reference: LibraryReference }>) {
  for (const { item, version, reference } of values) addReference({ ...reference, name: item.name, media_type: item.media_type, preview_url: libraryService.previewUrl(version.preview_url) })
}
async function openAssets() {
  if(!requireLogin())return
  assetBrowserOpen.value=true
}
async function searchAssets() {
  try { audioItems.value = (await libraryService.list({ scope: assetScope.value, category: assetCategory.value, media_type: entry.value === 'music' ? 'audio' : assetMedia.value, query: audioQuery.value })).items }
  catch (cause) { error.value = (cause as Error).message }
}
function selectAudio(item: LibraryItem) {
  const version = item.versions[0]
  if (!version) return
  // 文档必须走片段预览，不能把整份文件冒充已有文本范围引用。
  if(item.media_type==='document'){assetBrowserOpen.value=false;pickerOpen.value=true;return}
  if(references.value.length>=12){error.value='本轮最多引用 12 项素材。';return}
  addReference({ item_id: item.id, version_id: version.id, purpose: item.media_type === 'video' ? 'reference_video' : 'reference', name: item.name, media_type: item.media_type, preview_url: libraryService.previewUrl(version.preview_url) }); audioPickerOpen.value = false
}
/** 光标选择器已固定文件版本，加入后由同一草稿监听使旧报价失效。 */
function mentionReference(item:ComposerReference){addReference(item)}
watch([assetScope, assetCategory, assetMedia], () => { if (audioPickerOpen.value) void searchAssets() })
async function favorite() {
  if (!chosenImage.value || !activeResult.value?.images) return
  try { await productImageService.setFavorite(activeResult.value.images.id, chosenImage.value.id, !chosenImage.value.isFavorite); await refreshResults() }
  catch (cause) { error.value = (cause as Error).message }
}
async function chooseVideo(index: number) {
  selectedResult.value = index
  if (!videos.value[index] || !activeResult.value?.video) return
  try { await productVideoService.selectResult(activeResult.value.video.id, videos.value[index]!.id) }
  catch (cause) { error.value = (cause as Error).message }
}
function useSong(index: number, mv: boolean) {
  if (!sourceTask.value) return
  references.value = []; setText('', [])
  setSkill(mv ? 'lyric-video' : 'remix')
  patchParameters({ sourceTask: `${sourceTask.value.id}:${index}`, musicOperation: mv ? 'generateMp4' : 'coverSong', musicMode: mv ? 'mv' : 'create' })
}
watch(() => focusedMessage.value, () => { selectedResult.value = 0 })
watch(() => route.query.session, value => { if (typeof value === 'string' && value !== session.value?.id) void restore(value) })
watch(() => route.query.entry, value => { if (!route.query.session && session.value && ['free', 'drama', 'commerce', 'music', 'image'].includes(String(value))) void chooseEntry(value as any) })
watch(()=>[route.query.run,catalog.value] as const,async ([id,directory])=>{
  // 先等目录载入，避免刷新时按默认生图能力覆盖已保存的视频模型或素材。
  if(!directory || typeof id!=='string' || planning.value?.id===id)return
  try{
    const run=await creationService.run(id);if(route.query.run!==id || (route.query.session && route.query.session!==run.session_id))return;planning.value=run
    if(run.status!=='cancelled'){
      setSkill(run.draft.skill)
      patchParameters({...run.draft.parameters,extra:{...run.draft.parameters.extra,...(run.preview?run.preview.mv_run_id?{mv_run_id:run.id}:{director_run_id:run.id}:{creation_run_id:run.id})}})
      // 待回答流程也恢复完整输入；普通规划的已回答信息不能在刷新后丢失。
      const original=run.draft.original_prompt ?? run.draft.prompt
      const text=!run.preview && run.status==='ready'?[original,...run.answers.map(item=>`${item.question}：${item.answer}`)].join('\n'):original
      setText(text,text===original?run.draft.segments:[{type:'text',text}])
      references.value=[]
      for(const ref of run.draft.references){const asset=await libraryService.detail(ref.item_id);const version=asset.versions.find(row=>row.id===ref.version_id);if(version)addReference({...ref,name:asset.name,media_type:asset.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}
      assistantDraft=JSON.stringify(draft())
      if(run.preview && run.status==='ready')director.value=run.preview
    }
  }catch(cause){error.value=(cause as Error).message}
},{immediate:true})
</script>

<template>
  <LivDialog :open="onboardingOpen" settings dark title="选择你的创作方向，快速开启创作" width="lg" @update:open="!$event && finishOnboarding()">
    <template #icon><img class="creation-onboarding-mascot" src="/creation-presets/liv-creative-seed.png" alt=""/></template>
    <div class="creation-onboarding-options">
      <UButton v-for="item in creationEntries" :key="item.id" class="creation-onboarding-card" :class="{'is-free':item.id==='free'}" :disabled="onboardingBusy" color="neutral" variant="ghost" @click="finishOnboarding(item.id)">
        <UIcon v-if="item.id==='free'" name="i-lucide-plus" aria-hidden="true"/>
        <span>{{item.label}}</span>
        <img v-if="onboardingCovers[item.id]" :src="onboardingCovers[item.id]" alt=""/>
      </UButton>
    </div>
    <p v-if="onboardingError" role="alert" class="liv-settings-note">{{onboardingError}}</p>
  </LivDialog>
  <section class="creation-studio" :class="{'is-safety-submitting':safetyDirectBusy}">
    <Teleport defer to="#creation-topbar-nav">
      <!-- 会话恢复或编辑时不显示新建入口切换，避免误切正在处理的上下文。 -->
      <nav v-if="!active && !sessionLoading && !sessionError" class="creation-entry-tabs" aria-label="创作用途"><button v-for="item in creationEntries" :key="item.id" :class="{ active: entry === item.id }" :aria-pressed="entry === item.id" :disabled="busy" @click="chooseEntry(item.id)">{{ item.label }}</button></nav>
    </Teleport>
    <p v-if="error" class="creation-error" role="alert">{{ error }}<button @click="error = ''" aria-label="关闭错误">×</button></p>
    <!-- 恢复会话期间按真实聊天区和画布布局占位，不用一行提示替代整片空白。 -->
    <DashboardSkeleton v-if="sessionLoading" variant="conversation" :layout="session?.id===pendingSession?(hasMedia?'media':'conversation'):'unknown'" :style="{'--creation-chat-width':`${chatWidth}px`}" aria-label="正在加载会话"/>
    <div v-if="sessionError" class="creation-error" role="alert">{{sessionError}}<button @click="restore(pendingSession)">重试加载会话</button></div>
    <header v-if="!active && !sessionLoading && !sessionError" class="creation-hero"><img class="creation-hero-mascot" src="/creation-presets/liv-creative-seed.png" alt="" aria-hidden="true"><h1>{{ entryInfo.title }}</h1><p>{{ entryInfo.description }}</p></header>
    <div v-if="!sessionLoading && !sessionError" ref="workspaceElement" :class="[active ? 'creation-workspace' : 'creation-home',{'is-resizing':resizing,'is-conversation-only':active&&!hasMedia,'is-chat-collapsed':active&&hasMedia&&chatCollapsed}]" :style="active ? {'--creation-chat-width':`${chatWidth}px`} : {}">
      <section :class="[active ? 'creation-chat-column' : 'creation-entry-column',{'mobile-pane-hidden':active&&mobilePane!=='chat'}]">
        <template v-if="active"><header class="creation-chat-heading"><UIcon name="i-lucide-messages-square" /><h2>{{ session?.title }}</h2><UTooltip v-if="hasMedia" text="收起对话"><UButton icon="i-lucide-panel-left-close" variant="ghost" square aria-label="收起对话" @click="chatCollapsed=true"/></UTooltip><UButton icon="i-lucide-settings-2" variant="ghost" aria-label="本会话确认设置" @click="rulesOpen=true"/><button aria-label="刷新任务" @click="refreshResults(true)"><UIcon name="i-lucide-refresh-cw" /></button></header>
          <div ref="historyElement" class="creation-chat-history liv-chat-v2" tabindex="0" @scroll.passive="trackHistory" @wheel.passive="historyWheel" @keydown="historyKey" @touchstart.passive="historyTouchStart" @touchmove.passive="historyTouchMove" @pointerdown="historyScrollbar">
            <div ref="historyContentElement" class="creation-chat-content">
            <template v-for="row in conversationRows" :key="row.key">
              <article v-if="row.run && !row.active" class="liv-conversation-turn"><div class="liv-user-message"><p>{{row.run.draft.original_prompt || row.run.draft.prompt}}</p></div><section class="liv-assistant-message"><header><img src="/creation-presets/liv-creative-seed.png" alt=""><strong>Liv 创作助手</strong><CreationRunTime :run="row.run"/></header><AssistantReply :text="row.run.card?.text || row.run.question?.text || row.run.stream_text || row.run.error || '已停止'"/><template v-for="(turn,index) in row.run.discussion" :key="`discussion:${index}`"><div class="liv-user-message"><p>{{turn.user}}</p></div><AssistantReply :text="turn.reply"/></template><div v-for="(answer,index) in row.run.answers" :key="index" class="liv-answer-summary"><span>{{answer.question}}</span><p>{{answer.answer}}</p></div></section></article>
<section v-if="row.active && planning" class="creation-assistant-card" aria-label="Liv 创作助手"><div class="liv-user-message"><p>{{planning.draft.original_prompt || planning.draft.prompt}}</p></div><header><img class="liv-assistant-avatar" src="/creation-presets/liv-creative-seed.png" alt=""><b>Liv 创作助手</b><CreationRunTime :run="planning"/></header><div v-if="pendingUserAnswer" class="liv-user-message"><p>{{pendingUserAnswer}}</p></div><p v-if="planning.status==='planning'" class="liv-thinking" role="status" aria-label="思考中"><UIcon name="i-lucide-loader-circle" class="animate-spin" />思考中<span class="liv-thinking-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p><AssistantReply v-if="planning.stream_text && ['planning','cancelled'].includes(planning.status)" :text="planning.stream_text"/><p v-if="planning.status==='waiting' && !knownFormatQuestion">{{planning.question?.text}}</p><div v-if="planning.status==='waiting' && knownFormatQuestion" class="liv-question-card"><strong>已沿用入口参数</strong><p>{{selectedParameterSummary}}</p><UButton :disabled="planningBusy" @click="answerPlanning(`沿用已选参数：${selectedParameterSummary}。请直接整理方案，不再重复询问画幅和用途。`)">继续整理方案</UButton></div><div v-if="planning.status==='waiting' && !knownFormatQuestion" class="liv-question-options"><template v-if="planning.question?.kind==='reference'"><UFileUpload accept="image/*" icon="i-lucide-plus" label="上传参考图" :disabled="planningBusy || busy" @update:model-value="uploadQuestionReference"/><UButton variant="soft" @click="openAssets">从资料库选择</UButton></template><UButton v-for="option in planning.question?.options?.filter(item=>!/^自由补充/.test(item))" :key="option" :variant="prompt===option || selectedAnswers.includes(option)?'solid':'soft'" :disabled="planningBusy" @click="chooseAnswer(option)">{{option}}</UButton><UButton v-if="!questionNeedsInput" variant="soft" :disabled="planningBusy" @click="questionInputExpanded=true;answerText=''">其他／自行输入</UButton><form v-if="questionNeedsInput || planning.question?.kind==='multiple'" class="liv-custom-answer" @submit.prevent="answerPlanning(answerText)"><UTextarea v-if="questionNeedsInput" v-model="answerText" aria-label="自由补充" placeholder="自由补充…" :rows="2" autoresize /><UButton type="submit" :disabled="planningBusy || !answerText.trim()">发送</UButton></form></div><template v-for="(turn,index) in planning.discussion" :key="`discussion:${index}`"><div class="liv-user-message"><p>{{turn.user}}</p></div><AssistantReply :text="turn.reply"/></template><div v-for="(answer,index) in (pendingUserAnswer ? planning.answers.slice(0,-1) : planning.answers)" :key="index" class="liv-answer-summary"><span>{{answer.question}}</span><p>{{answer.answer}}</p></div><AssistantReply v-if="planning.card" :text="planning.card.text"/><LivButton v-if="canReviseQuestion" variant="secondary" class="liv-question-back" @click="previousQuestion">修改上一答案</LivButton><CreationConfirmationCard v-if="singleConfirmationProposal" :skip-confirmation="confirmationRuleChecked" :rules-ready="rulesLoaded" :rules-busy="rulesBusy" :rules-error="rulesError" @rule="changeConfirmationRule" :model="proposalModelLabel" :spec="proposalSpec" :target="confirmation?.target || planning.card?.target || target" :credits="confirmation?.credits" :has-quote="!!confirmation && confirmation.draft.parameters.extra.creation_run_id===planning.id" :sufficient="!!confirmation?.sufficient" :quoting="proposalQuoteBusy || sessionLoading || loading || cloudDraft.state.value==='loading'" :busy="busy || rulesBusy" :error="proposalQuoteError || error" @confirm="submit" @cancel="cancelProposal" @retry="quoteAssistantPlan()" @settings="rulesOpen=true"/><template v-else-if="planning.status==='ready' && planning.card?.type==='proposal' && !proposalSubmitted"><UButton class="liv-proposal-adopt" color="primary" :disabled="busy" @click="acceptAssistantPlan">继续整理生成任务</UButton></template><p v-if="countdown!==null" role="status">{{countdown}} 秒后生成 · {{confirmation?.credits}} 点 <UButton variant="soft" @click="stopCountdown">停止</UButton></p><p v-if="planning.status==='failed'" role="alert">{{planning.error}}</p><p v-if="planning.status==='cancelled'">已停止，草稿保留。</p></section>
              <article v-for="item in row.media" :key="item.id" :class="{ active: item.id === focused?.id }" @click="chooseHistory(item.id)">
            <div v-if="!row.linked" class="liv-user-message" aria-label="用户消息">
              <div v-if="item.content.references.length" class="creation-message-assets liv-history-assets"><button v-for="reference in item.content.references" :key="reference.version_id" :aria-label="`预览 ${item.content.reference_names[reference.version_id] || '素材'}`" :title="session?.reference_previews?.[reference.version_id]?.available===false?'素材已失效':item.content.reference_names[reference.version_id] || '素材'" @click.stop="previewReference(reference.version_id)"><img v-if="session?.reference_previews?.[reference.version_id]?.available&&session.reference_previews[reference.version_id]?.media_type==='image'" :src="libraryService.previewUrl(session.reference_previews[reference.version_id]!.preview_url || '')" alt="参考图" loading="lazy"><template v-else><UIcon :name="session?.reference_previews?.[reference.version_id]?.media_type==='audio'?'i-lucide-audio-lines':'i-lucide-file-image'"/><span>{{session?.reference_previews?.[reference.version_id]?.available===false?'素材已失效':item.content.reference_names[reference.version_id] || '素材'}}</span></template></button></div>
              <p>{{ (item.content.original_prompt ?? item.content.prompt) || (item.content.entry === 'drama' ? '上传剧本，开始导演流程' : '制作歌词视频') }}</p>
            </div>
            <section class="liv-assistant-message"><header v-if="!row.linked"><img src="/creation-presets/liv-creative-seed.png" alt=""><strong>Liv 创作助手</strong></header><CreationTaskNotice v-if="showTaskNotice(taskData[item.id]?.status||'',allResults.some(result=>result.messageId===item.id))" :status="taskData[item.id]?.status||''" :detail="taskData[item.id]?.detail" :progress="taskActivity[item.id]?.progress" :has-task="!!item.task_id" :has-retry-notice="!!taskData[item.id]?.images?.errorMessage"/>
              <CreationSafetyRepair v-if="safetyFailure(item)" :media-kind="item.task_type==='video'?'video':'image'" :batch-id="item.task_id" :saved="taskData[item.id]?.images?.safetyRepair||taskData[item.id]?.video?.safetyRepair" :automatic="autoSafetyRepairMessageIds.includes(item.id)||latestSafetyMessageId===item.id" :disabled="busy || workInProgress" @adopt="(value,restore)=>adoptSafetyRepair(item,value,restore)"/>
              <CreationResultCard v-for="result in allResults.filter(value=>value.messageId===item.id)" :key="result.key" :item="result" :selected="selectedResultKey===result.key" :disabled="busy" @select="chooseSessionResult"/></section>
          </article>
            </template>
            <section v-if="videoSwitch" class="creation-director-preview"><p>切换到视频并引用这张图</p><UButton @click="videoSwitch=null">取消</UButton><UButton :disabled="busy" @click="confirmVideoSwitch">确认切换，重新报价</UButton></section>
            </div>
          </div>
        </template>
        <div ref="homeComposerSlot" class="creation-composer-slot" :style="homeDockVisible ? {minHeight:`${homeComposerHeight}px`} : undefined">
        <CreationComposer ref="composerRef" :loading="loading" :docked="homeDockVisible" :minimized="!homeComposerExpanded" :dock-style="homeDockStyle" @expand="expandHomeComposer" @collapse="homeComposerExpanded=false" :show-latest="active && !followLatest" @latest="latest" :annotation="annotationDraft" :working="workInProgress" :can-stop="canStopWork" :stop-reason="stopReason" @stop="cancelPlanning" show-planner :planning-busy="planningBusy" @plan="planDemand" :uploads="uploads" @dismiss-upload="dismissUpload" :template-example="selectedTemplate" :entry="entry" :skill="skill" :prompt="prompt" :segments="segments" :references="references" :parameters="parameters" :catalog="catalog" :templates="templates" :busy="busy || loading || annotationSubmitting" :credit-label="creditLabel" :conversational="entry!=='drama'&&!assistantAccepted" :script-file="scriptFile" :compact="active" :models="models" :ratios="ratios" :resolutions="resolutions" :qualities="qualities" :duration-range="durationRange" :music-sources="musicSources"
          @text="setText" @skill="selectUserSkill" @parameters="selectParameters" @upload="receiveFiles" @replace="replaceReference" @assets="openAssets" @reference="mentionReference" @remove="removeReference" @reorder="reorder" @template="chooseTemplate" @send="sendWithContext" @script="scriptFile = $event">
          <template #audio-source><div class="creation-audio-source"><UButton v-if="!references.some(item=>item.media_type==='audio')" icon="i-lucide-music-2" color="neutral" variant="soft" @click="mvPickerOpen=true">选择歌曲</UButton></div></template>
        </CreationComposer>
        </div>
        <div v-if="auth.session.loggedIn&&(cloudDraft.state.value==='error'||cloudDraft.conflict.value)" class="liv-draft-status" role="status">{{draftStatus}}<button v-if="cloudDraft.state.value==='error'" @click="cloudDraft.retry">重试</button><template v-if="cloudDraft.conflict.value"><button @click="cloudDraft.resolve(false)">保留本地</button><button @click="cloudDraft.resolve(true)">使用云端</button></template></div>
        <label v-if="target === 'music' && (['reference', 'remix'].includes(skill) || ((selectedSkill?.base_code||skill)==='free'&&references.length>0))" class="creation-rights"><UCheckbox :model-value="parameters.rightsConfirmed" label="我已获得参考音频的使用授权" @update:model-value="patchParameters({rightsConfirmed:!!$event})"/></label>
        <div v-if="!active" class="creation-support-tools"><button v-if="entry === 'commerce' || target === 'video'" @click="showVideoTools = true"><UIcon name="i-lucide-clapperboard" />视频同款与数字人口播</button></div>
        <div v-if="!active" class="creation-quick-templates"><button v-for="item in recommendedSkills" :key="item.id" :class="{active:skill===item.id}" @click="setSkill(item.id)"><img :src="item.cover" :alt="item.label"><span>{{ item.label }}</span></button></div>
      </section>
      <div v-if="active" v-show="hasMedia && !chatCollapsed" class="creation-workspace-resizer" role="separator" aria-label="调整聊天区宽度" aria-orientation="vertical" tabindex="0" :aria-valuenow="chatWidth" :aria-valuemin="320" :aria-valuemax="560" @pointerdown="startResize" @pointermove="moveResize" @pointerup="finishResize" @pointercancel="finishResize" @lostpointercapture="resizing=false" @keydown="resizeKey" @dblclick="setChatWidth(340);finishResize()" />
      <section v-if="active" v-show="hasMedia" class="creation-results-column creation-canvas-column" :class="{'mobile-pane-hidden':mobilePane!=='canvas'}">
        <UTooltip v-if="chatCollapsed" text="恢复对话"><UButton class="creation-restore-chat" icon="i-lucide-panel-left-open" variant="soft" aria-label="恢复对话" @click="chatCollapsed=false"/></UTooltip>
        <template v-if="audition"><UButton variant="ghost" @click="clearAudition">结束试听</UButton><MusicPlayer :url="audition.url" :title="audition.title"/></template>
        <CreationResultCanvas v-else ref="canvasRef" :results="allResults" :selected-result="selectedResultKey" :unread-results="unreadResults" :selection-disabled="busy" @result="chooseSessionResult" @annotation="updateAnnotation" :favorite="chosenImage?.isFavorite" @favorite="favorite" :versions="canvasVersions" :selected="canvasSelected" :status="activeResult?.status" :progress="taskActivity[focused?.id||'']?.progress" :progress-updated-at="taskActivity[focused?.id||'']?.progress_updated_at" :detail="['failed','needs_review','result_pending','result_error'].includes(activeResult?.status||'')?activeResult?.detail:taskActivity[focused?.id||'']?.label" :save-busy="saveBusy" :music-tools="musicToolOptions" @select="chooseCanvas" @save="saveCanvas" @ai="canvasAI" @music="makeMusicMv" @video="showVideoTools=true" @refresh="refreshResults(true)" />
      </section>
    </div>
    <div v-if="active && hasMedia" class="liv-mobile-workspace-tabs"><button :class="{active:mobilePane==='chat'}" @click="mobilePane='chat'">对话</button><button :class="{active:mobilePane==='canvas'}" @click="mobilePane='canvas'">作品</button></div>
    <section v-if="!active && !sessionLoading && !sessionError" class="creation-recommendations creation-cases" :style="{minHeight:`${homeCasesMinHeight}px`}"><header ref="caseHeader" class="creation-case-header"><h2>{{ caseHeading }}</h2><button v-if="cases.length" class="creation-browse-cases" aria-label="查看创作案例" @click="browseCases"><UIcon name="i-lucide-chevrons-up" /><span>上划查看更多</span></button></header><nav v-if="!casesLoading&&!casesError&&caseCategories.length" class="creation-filter" aria-label="案例内容分类"><UButton :color="caseCategory==='all'?'primary':'neutral'" :variant="caseCategory==='all'?'soft':'ghost'" :aria-pressed="caseCategory==='all'" @click="caseCategory='all'">全部</UButton><UButton v-for="category in caseCategories" :key="category.code" :color="caseCategory===category.code?'primary':'neutral'" :variant="caseCategory===category.code?'soft':'ghost'" :aria-pressed="caseCategory===category.code" @click="caseCategory=category.code">{{category.label}}</UButton></nav><DashboardSkeleton v-if="casesLoading" variant="cards" :rows="4" :heading="false" aria-label="正在加载创作案例"/><p v-else-if="casesError" role="alert" class="creation-muted">{{casesError}} <button @click="loadCases">重试案例</button></p><div v-else ref="caseGrid" class="creation-case-grid"><button v-for="item in filteredCases" :key="item.id" @click="openCase(item)"><div class="creation-case-cover"><img :src="item.cover" :alt="item.title" loading="lazy"><UIcon v-if="item.media_type!=='image'" name="i-lucide-circle-play" /></div><b :title="item.title">{{ item.title }}</b><span class="creation-muted">{{item.category_label||'其他创作'}}</span></button></div><p v-if="!casesLoading && !casesError && !filteredCases.length" class="creation-muted">暂无公开案例。</p></section>
    <section v-if="audition&&!active" class="creation-audition"><UButton variant="ghost" @click="clearAudition">结束试听</UButton><MusicPlayer :url="audition.url" :title="audition.title"/></section>
    <!-- 最近记录只在侧栏展示，首页下方专注用途案例。 -->
    <section v-if="director" class="creation-director-preview"><header><h2><UIcon name="i-lucide-clapperboard" />导演脚本草稿</h2><span>文字规划由平台承担；后续制作按报价计费</span></header><input v-model="director.title" aria-label="脚本标题"><p>{{ director.summary }}</p><textarea v-model="director.script" aria-label="导演脚本" /><p v-for="item in director.material_suggestions" :key="item" class="creation-muted">{{ item }}</p><button :disabled="busy" @click="cancelPlanning">取消本流程</button><button class="creation-primary" :disabled="busy" @click="directorAccepted = true; prepare()">确认脚本，预估解析费用</button></section>
    <p v-if="confirmation && !confirmation.sufficient" class="creation-error">积分不足，<NuxtLink to="/dashboard-billing">去充值</NuxtLink></p>
    <div v-if="confirmation?.target==='drama'" class="creation-director-preview"><button class="creation-primary" :disabled="busy || !confirmation.sufficient" @click="prepare()">开始制作 · {{ confirmation.credits }} 点</button></div>
    <LivDialog v-model:open="rulesOpen" settings sectioned dark title="二次确认设置" description="管理当前会话内图片、音频和视频生成的二次确认规则。" width="sm">
      <div class="creation-confirmation-settings liv-rule-sections">
        <p v-if="rulesError" role="alert">{{rulesError}} <UButton variant="ghost" @click="loadConfirmationRules">重试</UButton></p>
        <section><h3>不再提醒的项目</h3><div class="liv-rule-group">
          <label v-for="item in [{key:'image' as const,label:'图片'},{key:'audio' as const,label:'音频'},{key:'video' as const,label:'视频'}]" :key="item.key" class="liv-settings-row liv-rule-row"><span><strong>{{item.label}}生成</strong><small>开启后，普通{{item.label}}生成免二次确认</small></span><USwitch v-model="rulesDraft[item.key]" :disabled="!rulesLoaded||rulesBusy"/></label>
        </div></section>
        <section><h3>自动确认冷静期</h3><div class="liv-rule-group"><label class="liv-settings-row liv-rule-row"><span><strong>自动确认前等待 10 秒</strong><small>开启后等待 10 秒，期间可在输入区停止本次生成。</small></span><USwitch v-model="rulesDraft.cooldown" :disabled="!rulesLoaded||rulesBusy"/></label></div></section>
        <section class="liv-rule-threshold"><div><h3>高积分强制确认阈值</h3><p class="liv-settings-note">单次任务超过此值，或无法可靠报价时，仍会要求确认。</p></div><div><UInputNumber v-model="rulesDraft.threshold" aria-label="高积分强制确认阈值（积分）" :disabled="!rulesLoaded||rulesBusy" :min="0" :max="100000" :step="1"/></div></section>
      </div>
      <template #footer><LivButton settings variant="secondary" :disabled="rulesBusy" @click="rulesOpen=false">取消</LivButton><LivButton settings variant="primary" :disabled="!rulesLoaded" :loading="rulesBusy" @click="saveConfirmationRules">保存</LivButton></template>
    </LivDialog>
    <LibraryPicker v-model:open="pickerOpen" dark :kind="target === 'video' ? 'video' : 'image'" :model="parameters.model" :remaining="Math.max(0, Number(catalog?.profiles[target === 'video' ? 'product_video' : 'product_image']?.input_schema.max_reference_count || 0) - references.length)" @select="selectAssets" />
    <div v-if="assetBrowserOpen" class="creation-modal-backdrop" @click.self="assetBrowserOpen=false"><section class="creation-asset-panel" style="padding:0;width:min(680px,100%)"><AssetLibraryPanel compact selectable :kind="target" :model="parameters.model" :existing="references" :max-references="Math.max(0,12-references.length)" :allowed-media-types="(selectedSkill?.base_code || skill)==='free'&&target==='music'?['audio']:selectedSkill?.media_types" @close="assetBrowserOpen=false" @advanced="assetBrowserOpen=false;pickerOpen=true" @select="selectAudio($event);assetBrowserOpen=false"/></section></div>
    <div v-if="audioPickerOpen" class="creation-modal-backdrop" @click.self="audioPickerOpen = false"><section class="creation-asset-panel"><header><h2>资料库资产引用</h2><button aria-label="关闭" @click="audioPickerOpen = false"><UIcon name="i-lucide-x" /></button></header><div class="creation-filter"><button :class="{ active: assetScope === 'personal' }" @click="assetScope = 'personal'">个人资料</button><button :class="{ active: assetScope === 'public' }" @click="assetScope = 'public'">平台素材</button></div><div class="creation-asset-filters"><LivSelect v-model="assetCategory" aria-label="素材用途"><option value="">全部用途</option><option v-for="item in assetCategories" :key="item.code" :value="item.code">{{ item.name }}</option></LivSelect><LivSelect v-if="target !== 'music'" v-model="assetMedia" aria-label="素材类型"><option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option></LivSelect></div><input v-model="audioQuery" placeholder="搜索素材" @keyup.enter="searchAssets"><button @click="searchAssets">搜索</button><p v-if="!audioItems.length" class="creation-muted">暂时没有符合条件的素材，可以使用 ＋ 上传。</p><div class="creation-asset-grid"><button v-for="item in audioItems" :key="item.id" @click="selectAudio(item)"><img v-if="item.media_type === 'image' && item.versions[0]?.preview_url" :src="libraryService.previewUrl(item.versions[0].preview_url)" :alt="item.name"><UIcon v-else :name="item.media_type === 'audio' ? 'i-lucide-music' : 'i-lucide-file'" /><b>{{ item.name }}</b><small>{{ item.media_type }} · 固定版本 {{ item.versions[0]?.version_no }}</small></button></div></section></div>
    <div v-if="showMusicTools || showVideoTools" class="creation-modal-backdrop" @click.self="showMusicTools = false; showVideoTools = false"><section class="creation-existing-tools"><header><h2>{{ showMusicTools ? '音频工具' : '视频工具' }}</h2><button @click="showMusicTools = false; showVideoTools = false" aria-label="关闭"><UIcon name="i-lucide-x" /></button></header><MusicWorkspacePanel v-if="showMusicTools" compact :source-task-id="sourceTask?.id" :initial-operation="selectedMusicOperation" :source-audio-index="Number(canvasSelected.split(':')[1]||0)" @created="recordToolTask($event, 'music'); showMusicTools = false" /><ProductVideoWorkspacePanel v-else :initial-source="chosenVideo&&activeResult?.video?{taskId:activeResult.video.id,resultId:chosenVideo.id}:undefined" :current-credit-balance="account.currentBalance" :default-video-model="parameters.model" @created="recordToolTask($event, 'video'); showVideoTools = false" /></section></div>
  </section>
    <Teleport to="body"><div v-if="attachmentPreview" ref="attachmentDialog" class="liv-reference-preview" role="dialog" aria-modal="true" :aria-label="attachmentPreview.name" tabindex="-1" @click.self="attachmentPreview=null" @keydown.esc="attachmentPreview=null"><button aria-label="关闭素材预览" @click="attachmentPreview=null">×</button><figure><img v-if="attachmentPreview.media_type==='image'" :src="attachmentPreview.preview_url" :alt="attachmentPreview.name"><video v-else-if="attachmentPreview.media_type==='video'" :src="attachmentPreview.preview_url" controls playsinline/><audio v-else-if="attachmentPreview.media_type==='audio'" :src="attachmentPreview.preview_url" controls/><a v-else :href="attachmentPreview.preview_url" target="_blank">打开文件</a><figcaption>{{attachmentPreview.name}}</figcaption></figure></div></Teleport>
    <div v-if="selectedCase" class="creation-modal-backdrop" @click.self="selectedCase = null"><section class="creation-case-preview"><header><h2>{{ selectedCase.title }}</h2><button aria-label="关闭案例" @click="selectedCase = null"><UIcon name="i-lucide-x" /></button></header><video v-if="selectedCase.media_type==='video'" :src="selectedCase.media_url" controls playsinline preload="none" /><audio v-else-if="selectedCase.media_type==='audio'" :src="selectedCase.media_url" controls preload="none" /><img v-else :src="selectedCase.media_url" :alt="selectedCase.title"><p>{{ selectedCase.description }}</p><button v-if="selectedCase.template" class="creation-primary" @click="makeSame">制作同款</button></section></div>
  <LivDialog v-if="mvPickerOpen" :open="mvPickerOpen" @update:open="!busy&&(mvPickerOpen=$event)" settings dark title="选择 MV 歌曲">
    <div class="mv-source-picker"><URadioGroup v-model="mvSourceMode" orientation="horizontal" :items="[{label:'我的歌曲',value:'owned'},{label:'音频链接',value:'link'}]" :disabled="busy" aria-label="歌曲来源方式"/><section v-if="mvSourceMode==='owned'"><p>从本人已完成的歌曲中选择一首。</p><USelect v-model="mvSource" class="w-full" :items="musicSources.map(item=>({value:item.id,label:item.label}))" placeholder="选择已完成歌曲" aria-label="选择已完成歌曲" :disabled="busy"/></section><section v-else><p>填写一个 HTTPS 音频链接，或关闭弹窗后从加号上传文件。</p><UInput v-model="mvUrl" class="w-full" placeholder="https://…" aria-label="音频 HTTPS 链接" :disabled="busy"/></section></div>
    <template #footer><LivButton settings block variant="primary" :disabled="!canUseMvSource" :loading="busy" @click="confirmMvSource">{{mvSourceMode==='owned'?'使用这首歌曲':'导入音频'}}</LivButton></template>
  </LivDialog>
</template>

<style scoped>
/* 用户需求按内容收缩并靠右，图片作为同一条消息的顶部内容，不再暴露引用语法。 */
.liv-chat-v2 .liv-user-message{display:flex;flex-direction:column;align-items:flex-start;width:fit-content;max-width:92%;margin:0 0 0 auto;padding:12px 15px;border-radius:18px 26px 6px 18px;background:#4F46E5;color:#fff;overflow-wrap:anywhere;font-size:13px;line-height:1.8}
.liv-chat-v2 .liv-user-message>p{margin:0;white-space:pre-wrap;color:#fff}.liv-chat-v2 .liv-history-assets{margin:0 0 9px;gap:7px}.liv-chat-v2 .liv-history-assets button{background:transparent;border:0;padding:0;color:#fff;max-width:160px}.liv-chat-v2 .liv-history-assets img{width:auto;height:auto;max-width:150px;max-height:150px;border-radius:9px;object-fit:contain}.liv-chat-v2 .liv-assistant-message,.liv-chat-v2 .liv-assistant-message header,.liv-chat-v2 .liv-assistant-message p{color:#fff}
/* 会话输入按内容增长；成功保存保持静默，只在失败或冲突时占用一行。 */
.creation-chat-column :deep(.creation-composer.is-compact){padding:8px 12px 10px!important}.creation-chat-column :deep(.creation-editor-wrap){margin-top:0!important}.creation-chat-column :deep(.creation-editor){min-height:60px!important;max-height:180px!important;font-size:14px!important;line-height:1.65!important;padding-right:25px}.creation-chat-column :deep(.creation-placeholder){font-size:12px!important;line-height:1.65!important;max-height:42px;overflow:hidden;padding-right:24px}.creation-chat-column :deep(.creation-placeholder>span:last-child:not(.placeholder-char)){display:none}.creation-chat-column :deep(.creation-toolbar){padding-top:22px!important}.creation-chat-column :deep(.creation-cost){top:1px!important}.creation-studio>.creation-error,.creation-studio>.creation-notice{position:fixed;top:66px;left:50%;transform:translateX(-50%);z-index:230;width:max-content;max-width:calc(100vw - 36px);margin:0;padding:6px 10px;border-radius:8px;font-size:11px;line-height:1.5;gap:10px;box-shadow:0 5px 20px #0003}.creation-chat-column>.creation-director-preview{margin:6px 10px;padding:8px 10px;border-radius:9px;width:auto;max-width:none;flex-shrink:0}.creation-chat-column>.creation-director-preview p{margin:0;font-size:11px;line-height:1.5}.creation-chat-column :deep(.creation-plan-icon){position:absolute;right:0;top:1px;z-index:2;display:grid;place-items:center;width:24px;height:24px;color:#8e94a2;border-radius:6px}.creation-chat-column :deep(.creation-plan-icon:hover){color:#A5B4FC;background:#4F46E515}.creation-chat-column :deep(.creation-plan-icon:disabled){opacity:.3}.creation-chat-column :deep(.creation-plan-icon svg){width:14px;height:14px}
.creation-canvas-column{padding:0!important;border:0!important;background:transparent!important;min-width:0;overflow:hidden!important}.liv-chat-v2 article{background:none!important;border:0!important;border-radius:0!important;padding:16px 4px!important;cursor:pointer}.liv-chat-v2 article>p:not(.creation-chat-role){background:#202c3c;border:1px solid #4F46E525;border-radius:15px 15px 4px 15px;padding:14px;font-size:13px;line-height:1.85;margin:6px 0 10px}.liv-chat-v2 article.active>p:not(.creation-chat-role){border-color:#4F46E566}.liv-history-assets{display:flex;gap:8px;flex-wrap:wrap}.liv-history-assets button{display:flex;flex-direction:column;gap:5px;max-width:110px;background:#1c1e24;border:1px solid #34363e;border-radius:10px;padding:5px;cursor:pointer;color:#A5B4FC}.liv-history-assets img{width:82px;height:65px;object-fit:contain;border-radius:6px}.liv-history-assets span{font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.liv-history-assets :deep(svg){width:28px;height:28px;margin:10px}.liv-assistant-message{margin-top:22px;font-size:12px;color:#b2b5c0;line-height:1.85}.liv-assistant-message header{display:flex;align-items:center;gap:8px;margin-bottom:9px;color:#e9eaf0}.liv-assistant-message header img{width:28px;height:28px;object-fit:contain}.liv-assistant-message p{padding-left:36px}.liv-derived-card{display:flex;align-items:center;gap:10px;border:1px solid #33363d;background:#1d2026;border-radius:12px;padding:10px;width:100%;margin:10px 0;text-align:left}.liv-derived-card img{width:65px;height:54px;object-fit:contain;border-radius:6px}.liv-derived-card strong{font-size:12px;display:block}.liv-derived-card small{font-size:10px;color:#9297a3;display:block;margin-top:5px}.liv-draft-status{font-size:10px;color:#747a86;padding:0 14px 7px;display:flex;justify-content:flex-end;gap:8px;align-items:center}.liv-draft-status button{color:#A5B4FC}.liv-reference-preview{position:fixed;inset:0;z-index:550;background:#050608dd;backdrop-filter:blur(6px);display:grid;place-items:center;padding:40px}.liv-reference-preview>button{position:absolute;right:24px;top:20px;color:white;font-size:28px}.liv-reference-preview img,.liv-reference-preview video{display:block;width:auto;height:auto;max-width:90vw;max-height:80dvh;object-fit:contain}.liv-reference-preview figcaption{color:#b8bdc7;font-size:12px;text-align:center;margin-top:14px}.liv-mobile-workspace-tabs{display:none}@media(max-width:1023.98px){.creation-workspace .mobile-pane-hidden{display:none!important}.creation-workspace{display:flex!important;flex-direction:column;height:calc(100dvh - 140px)!important}.creation-chat-column,.creation-canvas-column{flex:1;min-height:0;width:100%}.creation-workspace-resizer{display:none!important}.liv-mobile-workspace-tabs{display:flex;justify-content:center;gap:8px;padding:6px}.liv-mobile-workspace-tabs button{border-radius:18px;padding:6px 25px;font-size:12px;background:#24262d}.liv-mobile-workspace-tabs button.active{background:#4F46E5;color:white}}
.creation-onboarding-mask{position:fixed;inset:0;z-index:450;display:grid;place-items:center;background:#0009;backdrop-filter:blur(5px);padding:20px}.creation-onboarding-mask section{width:min(780px,100%);background:#151518;border:1px solid #333338;border-radius:24px;padding:32px;color:#eee}.creation-onboarding-mask header{display:flex;justify-content:space-between;align-items:center;gap:16px}.creation-onboarding-mask h2{font-size:20px;font-weight:650}.creation-onboarding-mask p{color:#999;font-size:13px;margin:12px 0 24px}.creation-onboarding-mask section>div{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.creation-onboarding-mask button{background:#212125;border:1px solid #36363b;border-radius:14px;padding:20px;display:flex;align-items:center;gap:12px;color:inherit;cursor:pointer}.creation-onboarding-mask button:hover{border-color:var(--liv-accent,#4F46E5)}.creation-onboarding-mask header button{background:none;border:0;padding:4px;font-size:24px}.creation-onboarding-mask strong{font-size:14px}.creation-onboarding-mask :deep(svg){width:24px;height:24px;color:var(--liv-accent,#4F46E5)}@media(max-width:600px){.creation-onboarding-mask section>div{grid-template-columns:1fr 1fr}}

/* 消息区是唯一可增长区域；历史问题不会成为输入框外的固定表单。 */
.creation-studio .creation-chat-column{position:relative;min-height:0;overflow:hidden}
.creation-studio .creation-chat-history{flex:1;min-height:0;max-height:none;overflow-y:auto;overscroll-behavior:contain;padding:var(--liv-chat-inset)}
.creation-chat-content{display:flow-root;min-width:0;flex:none}
/* 建议确认正在核价／提交时，不闪现另一个“继续整理”按钮；失败后恢复正常操作。 */
.is-safety-submitting .liv-proposal-adopt{display:none!important}
.creation-studio .creation-chat-history article{border:0!important;background:transparent!important;padding:0!important;margin:0 0 var(--liv-chat-gap)!important;cursor:default}
.creation-studio .creation-chat-history p{font-size:var(--liv-chat-font)!important;line-height:var(--liv-chat-line)!important;overflow-wrap:anywhere}
.creation-studio .creation-chat-history .liv-user-message{width:fit-content;max-width:90%;margin:0 0 24px auto;padding:12px 16px;border-radius:20px 20px 4px 20px;background:var(--liv-ui-primary);color:var(--color-text-inverse)}
.creation-studio .creation-chat-history .liv-user-message p{margin:0}
.creation-studio .creation-chat-history .liv-assistant-message{padding:0;margin:0 0 24px}
.creation-studio .creation-chat-history .liv-assistant-message header{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:14px;font-weight:600}
.creation-studio .creation-chat-history .liv-assistant-message header img,.liv-assistant-avatar{width:24px;height:24px;object-fit:contain}
.creation-studio .creation-chat-history .creation-assistant-card{flex:none;max-width:none;width:100%;margin:0 0 24px;padding:0;border:0;background:transparent}
.creation-studio .creation-chat-history .creation-assistant-card>header{display:flex;justify-content:flex-start;align-items:center;gap:8px;margin-bottom:12px;font-size:14px}
.creation-studio .creation-chat-history .creation-assistant-card>.liv-question-card{display:grid;gap:8px;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--color-panel)}
.creation-studio .creation-chat-history .creation-assistant-card>div button{justify-content:flex-start;white-space:normal;text-align:left;min-height:40px}
.liv-reply-text{white-space:pre-wrap}.liv-answer-summary{border-left:2px solid var(--color-border-soft);padding-left:12px;margin:12px 0;font-size:12px;color:var(--liv-settings-muted)}
.creation-studio .creation-chat-column :deep(.creation-composer.is-compact){flex:none;padding:16px!important;border-radius:24px 24px 0 0!important;background:var(--liv-workspace-surface)!important}
.creation-studio .creation-chat-column :deep(.creation-editor){min-height:var(--liv-chat-editor-min)!important;max-height:var(--liv-chat-editor-max)!important;font-size:var(--liv-chat-font)!important;line-height:var(--liv-chat-line)!important}
.creation-studio .creation-chat-column :deep(.creation-placeholder){font-size:14px!important;line-height:1.7!important;max-height:none!important}
.creation-studio .creation-chat-column :deep(.creation-placeholder>span:last-child:not(.placeholder-char)){display:block!important;font-size:12px}
.creation-studio .creation-chat-column :deep(.creation-toolbar){padding-top:12px!important}
.creation-studio .creation-chat-column :deep(.creation-send){width:36px;height:36px}
@media(min-width:1024px){.creation-studio .creation-workspace{min-height:0;height:calc(100dvh - 100px)}}
@media(max-width:1023.98px){.creation-studio .creation-chat-column{height:calc(100dvh - 150px);min-height:350px}}

/* 聊天元素不再继承导演表单的布局和颜色。 */
.creation-studio .creation-chat-column{background:var(--liv-workspace-surface)}
.creation-studio .creation-chat-history .liv-user-message{display:block;flex:none;height:auto;min-height:0;align-self:flex-end;color:var(--liv-chat-assistant-text)}
/* 追问中的用户消息可能嵌在助手容器内，清除助手正文缩进，短气泡按文字自然收紧。 */
.creation-studio .creation-chat-history .liv-user-message p{padding:0;text-indent:0;text-align:left;color:inherit;line-height:1.7;white-space:pre-wrap}
.creation-assistant-card{color:var(--liv-chat-assistant-text)}
.creation-assistant-card>header img{flex:none}
.creation-assistant-card>p,.creation-assistant-card :deep(.liv-assistant-reply){color:var(--liv-chat-assistant-text)}
.creation-studio .creation-chat-history .creation-assistant-card>.liv-question-card{gap:12px}
.creation-studio .creation-chat-history .liv-question-card>button{border-radius:999px;padding:10px 16px;min-height:40px;background:var(--color-panel);border:1px solid var(--color-border-soft);color:var(--liv-chat-assistant-text)}
.liv-custom-answer{display:grid;gap:8px}.liv-custom-answer>button{justify-self:end;border-radius:999px}
/* 选择题不套灰色卡片，灰色仅用于可点击选项；长文本自然换行且维持正文规格。 */
.liv-question-options{display:grid;gap:12px;min-width:0}
.creation-assistant-card>.liv-question-options{margin-top:12px}
.liv-question-options>button{display:flex;justify-content:center;width:100%;min-height:40px;padding:12px 16px;border:0;border-radius:12px;background:var(--liv-number-surface);color:var(--liv-chat-assistant-text);font-size:14px;line-height:1.7;white-space:normal;text-align:center}
/* 悬停和键盘焦点同样可辨识，禁用时不响应视觉反馈。 */
.liv-question-options>button:not(:disabled):hover{background:var(--color-surface-hover)}
.liv-question-options>button:not(:disabled):focus-visible{outline:2px solid var(--liv-ui-primary);outline-offset:2px}
.liv-question-back{margin:12px 0;background:var(--liv-number-surface)!important;border:1px solid var(--color-border-soft);border-radius:999px;min-height:36px;color:var(--liv-chat-assistant-text)!important}
.liv-thinking{display:flex;align-items:center;gap:8px;font-size:12px}.liv-thinking>span{flex:none}
/* 三个点错峰呼吸，减少动态效果时保持静态省略号。 */
.liv-thinking .liv-thinking-dots{display:inline-flex;gap:2px;margin-left:-8px}.liv-thinking-dots>span{animation:liv-thinking-dot 1.2s ease-in-out infinite}.liv-thinking-dots>span:nth-child(2){animation-delay:.16s}.liv-thinking-dots>span:nth-child(3){animation-delay:.32s}
@keyframes liv-thinking-dot{0%,70%,100%{opacity:.25}35%{opacity:1}}
@media(prefers-reduced-motion:reduce){.liv-thinking-dots>span{animation:none}}
.creation-assistant-card>.liv-proposal-adopt{display:flex;justify-content:center;width:100%;background:var(--liv-ui-primary);color:var(--liv-chat-assistant-text);border-radius:999px;min-height:36px;margin-top:16px}
</style>

<style scoped>
.creation-audio-source{font-size:14px;color:var(--liv-settings-muted);padding:8px 0}.mv-source-picker{display:grid;gap:16px;font-size:var(--liv-settings-body);line-height:1.7}.mv-source-picker p{margin:0;color:var(--liv-settings-muted)}.mv-source-picker section{display:grid;gap:12px}.mv-source-picker section+section{padding-top:16px;border-top:1px solid var(--color-border-soft)}
</style>

<style scoped>
.creation-confirmation-settings{display:grid;gap:20px}.creation-confirmation-settings>label{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:14px}.creation-confirmation-settings>p{font-size:12px;color:var(--liv-settings-muted)}
</style>
