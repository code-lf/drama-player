<script setup lang="ts">
// 积分不足仅打开全站充值弹窗，不丢失当前报价与草稿。
const billingDialog=useBillingDialog()
import {groupConversation,continuousAnswers} from '../conversationRows'
import type {StoryboardSourceSelection} from '../drama/standaloneStoryboard'
import CreationProcessEvents from './CreationProcessEvents.vue'
import CreationQuestionPages from './CreationQuestionPages.vue'
import CreationStyleQuestion from './CreationStyleQuestion.vue'
import CreationAnsweredQuestionCard from './CreationAnsweredQuestionCard.vue'
import CreationWorkspaceNotice from './CreationWorkspaceNotice.vue'
import {hasAcceptedAnswerSince,repeatsSubmittedQuestion} from '../answeredQuestions'
import {runProcessEvents} from '../processEvents'
import {userBubbleText} from '../userBubbleText'
import {videoQuoteSummary} from '../videoQuoteSummary'
import {canvasParentImage} from '../canvasToolLineage'
import {resolveCanvasMusicTool} from '../musicCanvasTools'
import {clampChatWindow,clampMiniChat,minimizeChatWindow,type ChatWindowRect} from '../floatingChatLayout'
import {remainingReferences, mergeRoundReferences, submittedTextSegments,referenceSnapshot} from '../submittedReferences'
import CreationRunAttachments from './CreationRunAttachments.vue'
import CreationStageCard from './CreationStageCard.vue'
import {continuationStyleConflict} from '../styleConflict'
import CreationPreviewMedia from './CreationPreviewMedia.vue'
import CreationCaseViewer from './CreationCaseViewer.vue'
import CreationSkillShowcase from './CreationSkillShowcase.vue'
import CreationSkillDetail from './CreationSkillDetail.vue'
import CreationQuickSkill from './CreationQuickSkill.vue'
import {skillExampleParts} from '../skillPresentation'
import {pushPromptUndo,matchesPromptSnapshot,restorePromptSnapshot,type PromptUndoEntry} from '../skillPromptHistory'
import {skillTrialReferences,trialImageCount} from '../skillTrial'
import {homeComposerShouldDock,homeHeaderIsStuck} from '../homeDock'
import { defineWorkspaceComponent } from '~/features/dashboard/asyncWorkspace'
// 首页只下载输入与展示组件，画布、剪辑和专项工具在实际显示时再加载。
const SkillCenterPanel=defineWorkspaceComponent(()=>import('./SkillCenterPanel.vue'))
import {replicaParameters,quickRecommendedSkills} from '../homeShowcase'
// 歌词时间轴只在音乐引用入口展示时加载，普通画布和首页不提前解析媒体编辑代码。
const MvLyricAlignment=defineWorkspaceComponent(()=>import('./MvLyricAlignment.vue'))
import {questionNeedsText,isQuestionUploadOption,questionNeedsReference,multipleQuestionAnswer} from '../questionInteraction'
import {nextHistoryFollow} from '../chatScroll'
import CreationTaskNotice from './CreationTaskNotice.vue'
import {showTaskNotice} from '../taskPresentation'
// 安全修复仅在真实任务出现对应失败时加载，不放入所有会话的首屏依赖。
const CreationSafetyRepair=defineWorkspaceComponent(()=>import('./CreationSafetyRepair.vue'))
import {safetySubmissionMatches} from '../safetySubmission'
import type {ImageSafetyRepair} from '~/entities/product-image/types'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
// 音乐试听只在用户打开试听区域时加载，普通会话不提前下载播放器及波形依赖。
const MusicPlayer=defineWorkspaceComponent(()=>import('~/features/music/components/MusicPlayer.vue'))
import CreationComposer from './CreationComposer.vue'
import CreationConversationPanel from './CreationConversationPanel.vue'
import CreationNodeControls from './CreationNodeControls.vue'
import {nodeParameterError} from '../nodeParameterValidation'
import CreationConfirmationCard from './CreationConfirmationCard.vue'
import CreationResultCard from './CreationResultCard.vue'
import CreationRunTime from './CreationRunTime.vue'
import CreationThinkingIndicator from './CreationThinkingIndicator.vue'
import {sessionResults,processingResults,batchCompositionResults,batchImageResults,playableMusicSong,readyResult,type SessionResult} from '../resultCatalog'
import {advanceCompositionReads} from '../compositionState'
import {canAcceptRun,sameRunScope,appendResultKeys,unreadResultKeys,assistantInteraction,conversationEntry,awaitingCreationDecision} from '../workflowState'
import {canShowGenerationConfirmation} from '../confirmationRules'
import {runParameterSnapshot} from '../runParameterSnapshot'
import AssistantReply from './AssistantReply.vue'
import CanvasDramaActionCard from '../drama/components/CanvasDramaActionCard.vue'
import CanvasDramaProgress from '../drama/components/CanvasDramaProgress.vue'
import {dramaProgressRows} from '../drama/dramaProgress'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import type {CanvasVersion,AnnotationDraft} from './CreationResultCanvas.vue'
const CreationResultCanvas=defineWorkspaceComponent(()=>import('./CreationResultCanvas.vue'))
import {useWorkspaceDraft} from '../useWorkspaceDraft'
import {persistentDraft} from '../draftPersistence'
import type {SystemSkill,CreationMessage,WorkspaceSource,CreationDraft,WorkspacePreview} from '../types'
// 资料选择器只在首次使用时加载；两个入口仍复用相同组件，已打开过后保留关闭动画及内部状态。
const LibraryPicker=defineWorkspaceComponent(()=>import('~/features/library/components/LibraryPicker.vue'))
const AssetLibraryPanel=defineWorkspaceComponent(()=>import('~/features/library/components/AssetLibraryPanel.vue'))
const MusicWorkspacePanel=defineWorkspaceComponent(()=>import('~/features/music/components/MusicWorkspacePanel.vue'))
const ProductVideoWorkspacePanel=defineWorkspaceComponent(()=>import('~/features/product-video/components/ProductVideoWorkspacePanel.vue'))
import { useCreationWorkspace } from '../useCreationWorkspace'
import { templateSegments } from '../templateSyntax'
import { creationCaseService, type PublicCreationCase } from '~/shared/api/services/creationCaseService'
import { creationEntries, visibleCreationEntries, defaultParameters } from '../catalog'
import { selectedSkillWorkflow } from '../skillSelection'
import type { CreationTemplate, ComposerReference, CreationParameterState, ComposerSegment } from '../types'
import type { LibraryItem, LibraryReference, LibraryVersion } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import { productImageService } from '~/shared/api/services/productImageService'
import { productVideoService } from '~/shared/api/services/productVideoService'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { creationService, type CreationRun, type VideoPlan, type ImageCreativePlan } from '~/shared/api/services/creationService'
import {canvasScriptProductionOptions,type CanvasScriptState} from '../drama/scriptDocument'
import {useCanvasActivity} from '../drama/canvasActivity'
import CanvasConversationActivity from '../drama/components/CanvasConversationActivity.vue'
import CreationVideoPlanCard from './CreationVideoPlanCard.vue'
const CreationVideoWorkbench=defineWorkspaceComponent(()=>import('./CreationVideoWorkbench.vue'))
const CreationEditingWorkspace=defineWorkspaceComponent(()=>import('./CreationEditingWorkspace.vue'))
const CreationAgentCanvas=defineWorkspaceComponent(()=>import('./CreationAgentCanvas.vue'))
// 图片计划编辑器本身很薄，直接复用已加载的输入器；避免节点选中后只出现空的异步宿主。
import CreationImagePlanEditor from './CreationImagePlanEditor.vue'
import CreationImagePlanCard from './CreationImagePlanCard.vue'
import {hasUnsubmittedImagePlan,hasSubmittedImagePlan} from '../imagePlanState'
import {planReferencePreviews} from '../planReferences'
import {resultCanvasNodeId,creativeRetryParameters,hiddenProposalOutput,type CreativeNode,type CreativeNodeParameters} from '../agentCanvas'
import {videoCompositionService,type CompositionJob} from '~/shared/api/services/videoCompositionService'
import CreationFlowRecovery from './CreationFlowRecovery.vue'
// 成片合成面板及其素材选择器只在用户打开合成时加载，不阻塞普通画布进入。
const CreationDeliveryPanel=defineWorkspaceComponent(()=>import('./CreationDeliveryPanel.vue'))
import {hasUnsubmittedVideoPlan,hasSubmittedVideoPlan} from '../videoPlanState'

import CreationReferenceQuestion from './CreationReferenceQuestion.vue'
/** 计划卡的响应只回到原运行，切换会话后旧保存/报价结果不得覆盖当前消息。 */
function updateVideoPlan(id:string,plan:VideoPlan){
  // 停止收据来自服务端取消成功；同步运行状态，刷新前后均隐藏未提交确认卡及节点。
  const stopped=plan.status==='stopped'?{status:'cancelled'}:{}
  const previous=planning.value?.id===id?planning.value.creative_plan:assistantHistory.value.find(run=>run.id===id)?.creative_plan
  if(planning.value?.id===id)planning.value={...planning.value,...stopped,creative_plan:plan,...(plan.flow_runtime?{flow_runtime:plan.flow_runtime}:{})}
  // 历史与当前运行使用同一快照，不能离开当前轮次就丢失刚读取的批次结果。
  assistantHistory.value=assistantHistory.value.map(run=>run.id===id?{...run,...stopped,creative_plan:plan,...(plan.flow_runtime?{flow_runtime:plan.flow_runtime}:{})}:run)
  // 批次首次受理后读取真实余额；轮询不反复刷新，更不能在前端直接按报价减余额。
  if(plan.batch&&!previous?.batch)void account.refreshProfile().catch(()=>{/* 余额读取失败不改写已受理任务。 */})
}
/** 图片修订只更新当前会话原运行，不继承视频报价/许可，不用迟到结果覆盖其他账号。 */
function updateImagePlan(id:string,plan:ImageCreativePlan){
  const run=graphRuns.value.find(value=>value.id===id)
  if(!run||run.session_id!==session.value?.id)return
  // Worker 在受理响应之后才扣点；首次受理及任务状态变化都读取账户，不能按报价本地扣减。
  // 不比较进度、预览地址等易变字段，避免每次只读轮询都请求余额。
  const balanceState=(value?:ImageCreativePlan)=>JSON.stringify(value?.batch?.items.map(item=>[item.item_id,item.task_id,item.status,item.delivery_status]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))??[])
  const refreshBalance=!!plan.batch&&balanceState(run.image_plan)!==balanceState(plan)
  // 与视频保持一致：只有服务端已确认的停止回执才使运行显示取消结论。
  const stopped=plan.status==='stopped'?{status:'cancelled'}:{}
  if(planning.value?.id===id)planning.value={...planning.value,...stopped,image_plan:plan,...(plan.flow_runtime?{flow_runtime:plan.flow_runtime}:{})}
  assistantHistory.value=assistantHistory.value.map(value=>value.id===id?{...value,...stopped,image_plan:plan,...(plan.flow_runtime?{flow_runtime:plan.flow_runtime}:{})}:value)
  if(refreshBalance)void account.refreshProfile().catch(()=>{/* 账户读取失败不改变任务，也不重提生成。 */})
}
/** 恢复结果只更新当前账号仍展示的同会话运行，不触发自动报价、倒计时或生成。 */
function updateRecoveredFlow(run:CreationRun){
  if(run.session_id!==session.value?.id)return
  if(planning.value?.id===run.id)planning.value=run
  assistantHistory.value=assistantHistory.value.map(item=>item.id===run.id?run:item)
}
/** 重试是独立草案，保留原批次历史；跨会话迟到结果不能切换当前运行。 */
async function openRetryVideoPlan(sourceId:string,run:CreationRun){
  const sid=session.value?.id,previous=planning.value,owner=auth.session.user?.id,scope=assistantEpoch
  if(run.session_id!==sid||planningBusy.value||busy.value||(!assistantHistory.value.some(item=>item.id===sourceId)&&previous?.id!==sourceId))return
  if(previous&&previous.id!==sourceId&&previous.id!==run.id){
    if(!await confirmHomeAction('即将打开历史批次的重试方案。当前方案的未保存编辑不会自动保存，已有任务和作品不受影响。是否继续？','打开重试方案'))return
  }
  // 对话框等待期间若换账号、会话或当前轮次，迟到导航必须丢弃。
  if(sid!==session.value?.id||owner!==auth.session.user?.id||scope!==assistantEpoch||planning.value?.id!==previous?.id)return
  if(previous&&previous.id!==run.id)assistantHistory.value=[...assistantHistory.value.filter(item=>item.id!==previous.id),previous]
  planning.value=run
  await routerRun(run.id,run.session_id)
}
import { request,buildProductImagePayload,buildProductVideoPayload } from '~/shared/api/adapters/httpAdapter'
import type {ProductImageGeneratePayload} from '~/entities/product-image/types'
import type {ProductVideoCreatePayload} from '~/entities/product-video/types'
import type { CreationEntryType } from '../types'
import {canApplyEntryPreference} from '../workbenchRules'
/** 技能页与首页共用同一个创作壳及编辑器实例，仅改变目录与停靠呈现。 */
const props=defineProps<{skillsPage?:boolean}>()
const {auth,requireLogin,loginOpen}=useWorkbenchAuth()
const {confirm:confirmHomeAction}=useActionDialog()
const onboardingOpen=ref(false),onboardingBusy=ref(false),preferenceError=ref(''),onboardingError=ref('')
/** 引导卡使用现有封面，广告采用用户提供的可颂图；仅展示，不自动作为生成素材。 */
const onboardingCovers:Partial<Record<CreationEntryType,string>>={drama:'/creation-presets/portrait-wide.png',commerce:'/creation-presets/perfume.png',marketing:'/creation-presets/onboarding-marketing-croissant.png',music:'/landing/case-youth.png',image:'/creation-presets/anime-wide.png'}
let preferenceRevision=0
/** 账号偏好只影响全新入口，不覆盖深链、会话和已输入的草稿。 */
function untouched(){return canApplyEntryPreference(route.path,route.query,prompt.value,references.value.length,!!scriptFile.value)}
/** 只读取当前账号的引导状态；失败明确提供重试，不推断用户已看过。 */
async function loadPreference(){
  const revision=++preferenceRevision,owner=auth.session.user?.id
  onboardingOpen.value=false;preferenceError.value='';onboardingError.value=''
  if(!auth.session.loggedIn)return
  try{
    // 显式预览只清除当前登录账号的引导已读，不修改默认用途或其他账号记录。
    if(route.query.onboarding==='preview'){
      await request('/account/creation-preferences',{method:'PUT',body:{onboarding_seen:false}})
      if(revision!==preferenceRevision || owner!==auth.session.user?.id)return
      const query={...route.query};delete query.onboarding
      await router.replace({path:route.path,query})
    }
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
  uploads, dismissUpload, sessionLoading, sessionError, pendingSession, patchParameters, setText, setSkill, chooseEntry, upload, addReference, removeReference, replaceReference, reorder, restore, focusMessage, refreshResults, draft, prepare, submit, continueImage, recordToolTask } = useCreationWorkspace({beforeSubmit:()=>cloudDraft.freezeForSubmit(),beforeScopeChange:()=>cloudDraft.flush(),beforeExecute:authorizeExecution,entryPath:()=>props.skillsPage?'/dashboard-skills':'/dashboard'})
const currentSessionTitle = useState<{id:string;title:string}|null>('creation-active-session-title',()=>null)
watch(() => session.value, value => { currentSessionTitle.value=value?{id:value.id,title:value.title}:null }, {immediate:true})
const workspaceElement=ref<HTMLElement|null>(null),chatWidth=ref(390),resizing=ref(false),composerRef=ref<InstanceType<typeof CreationComposer>|null>(null)
const homeComposerExpanded=ref(false),homeDockVisible=ref(false),homeDockStyle=ref<Record<string,string>>({})
const homeComposerSlot=ref<HTMLElement|null>(null),caseHeader=ref<HTMLElement|null>(null),homeComposerHeight=ref(260)
const homeCasesMinHeight=ref(0)
const showCaseBrowseHint=ref(true)
const homeCaseHeaderStuck=ref(false)
let homeScrollRoot:HTMLElement|null=null
/** 案例标题进入内容区上半屏后，提示已完成引导；向上返回时恢复，不记录成永久隐藏。 */
function caseBrowseHintVisible(headerTop:number,viewportTop:number,viewportHeight:number){
  return viewportHeight>0 && headerTop>viewportTop+viewportHeight/2
}
/** 大输入框离开内容区立即停靠；保留原位置高度，不等待分类标题，避免出现无输入入口的空档。 */
function trackHomeDock(){
  if(props.skillsPage&&!active.value){homeCaseHeaderStuck.value=false;homeDockVisible.value=true;showCaseBrowseHint.value=false;updateHomeDock();return}
  if(active.value || !homeScrollRoot || !caseHeader.value){homeCaseHeaderStuck.value=false;homeDockVisible.value=false;showCaseBrowseHint.value=false;return}
  // sticky 贴在滚动容器的内边距边界，不能忽略桌面和窄屏不同的顶部留白。
  const rootStyle=getComputedStyle(homeScrollRoot),paddingTop=Number.parseFloat(rootStyle.paddingTop)||0
  // sticky标题在滚动内边距处吸顶，向上补足同色背景，阻止图片从导航与分类之间穿出。
  workspaceElement.value?.style.setProperty('--liv-home-scroll-inset',`${paddingTop}px`)
  const top=homeScrollRoot.getBoundingClientRect().top+paddingTop
  // 读取实际sticky偏移，兼容已有8px导航间距与不同屏幕内边距，不提前盖住快捷入口。
  const headerStyle=getComputedStyle(caseHeader.value),resolvedOffset=Number.parseFloat(headerStyle.top)
  // 部分浏览器保留min()/calc()表达式，解析失败时按同一CSS令牌计算，不能误回退为0。
  const stickyGap=Number.parseFloat(headerStyle.getPropertyValue('--liv-home-sticky-gap'))||8
  const stickyOffset=Number.isFinite(resolvedOffset)?resolvedOffset:Math.min(0,stickyGap-paddingTop)
  homeCaseHeaderStuck.value=homeHeaderIsStuck(caseHeader.value.getBoundingClientRect().top,top+stickyOffset)
  showCaseBrowseHint.value=caseBrowseHintVisible(caseHeader.value.getBoundingClientRect().top,top,homeScrollRoot.clientHeight)
  // 短剧首页也更新案例提示，但不改变其原有独立上传和停靠规则。
  if(entry.value==='drama' || !homeComposerSlot.value){homeDockVisible.value=false;return}
  // 少量案例也能到达吸顶点，但不额外制造越过案例后的整屏空白。
  const caseMargin=Number.parseFloat(getComputedStyle(caseHeader.value.parentElement!).marginBottom)||0
  homeCasesMinHeight.value=Math.max(0,homeScrollRoot.clientHeight-paddingTop-(Number.parseFloat(rootStyle.paddingBottom)||0)-caseMargin)
  if(!homeDockVisible.value)homeComposerHeight.value=homeComposerSlot.value.getBoundingClientRect().height
  const visible=homeComposerShouldDock(homeComposerSlot.value.getBoundingClientRect().bottom,top)
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
function setChatWidth(value:number) {
  // 手机页签不使用桌面浮层宽度，不能因首次窄屏恢复把用户的440px偏好压成320px。
  const available=typeof window!=='undefined'&&window.innerWidth<1024?560:(workspaceElement.value?.clientWidth||960)-360
  chatWidth.value=Math.round(Math.max(320,Math.min(560,available,value)))
}
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
const draftOwner=computed(()=>auth.session.user?.id),draftReady=computed(()=>!!catalog.value&&!loading.value&&!sessionLoading.value&&!sessionError.value&&(!route.query.session||session.value?.id===route.query.session))
/** 云端只恢复固定版本编号；逐项复核访问权限，不能把保存过的地址当作授权。 */
async function applyCloudDraft(value:CreationDraft,isCurrent=()=>true){
  // 兼容已有云端／本地首页备份：忽略旧文字，不删除历史会话内容。
  value=persistentDraft(value,draftScope.value)
  const owner=draftOwner.value,scope=draftScope.value,restored:ComposerReference[]=[]
  // 已发送运行是入口规格的权威快照；旧版自动保存的空草稿默认值不能把“快速”改回“标准”。
  // 新版显式修改的字段单独标记并保留，因此刷新不会吞掉用户发送后的手动调整。
  let restoredParameters=value.parameters
  if(session.value && !messages.value.length){
    const rows=await creationService.runs(session.value.id)
    // 指定运行优先于会话最新轮次；从历史方案恢复不能被另一页面的新问题替换规格。
    const latest=typeof route.query.run==='string'?rows.find(row=>row.id===route.query.run):rows[rows.length-1]
    if(latest && (['waiting','planning','ready'].includes(latest.status)||latest.drama_action?.status==='awaiting_confirmation'||latest.continuation?.enabled||hasUnsubmittedVideoPlan(latest)||hasSubmittedVideoPlan(latest)||hasSubmittedImagePlan(latest)||hasUnsubmittedImagePlan(latest))){
      const edited=new Set(Array.isArray(value.parameters.extra?.user_parameter_keys)?value.parameters.extra.user_parameter_keys:[])
      restoredParameters={...value.parameters}
      const snapshot=runParameterSnapshot(latest)
      for(const key of ['model','aspectRatio','resolution','quality','count'] as const){
        if(!edited.has(key))(restoredParameters as unknown as Record<string,unknown>)[key]=snapshot[key]
      }
    }
  }
  for(const reference of value.references){try{const item=await libraryService.detail(reference.item_id),version=item.versions.find(v=>v.id===reference.version_id);if(version)restored.push({...reference,name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}catch{notice.value='部分草稿素材已失效，请重新选择。'}}
  if(!isCurrent()||owner!==draftOwner.value||scope!==draftScope.value)return
  entry.value=value.entry;setSkill(value.skill);patchParameters(restoredParameters);references.value=restored
  const valid=new Set(restored.map(v=>v.version_id))
  // 首页恢复偏好时不碰当前已输入文字，避免迟到读取清空用户刚写的新内容。
  if(!draftScope.value.startsWith('entry:'))setText(value.prompt,value.segments.filter(v=>v.type==='text'||valid.has(v.version_id)))
}
const cloudDraft=useWorkspaceDraft(draftOwner,draftScope,draftReady,()=>persistentDraft(draft(),draftScope.value),applyCloudDraft)
const dramaMode=ref<'standard'|'canvas'>('standard')
const dramaModeBusy=ref(false)
const dramaModeOptions=[{label:'标准模式',value:'standard'},{label:'画布模式',value:'canvas'}] as const
const allowChatScriptUpload=computed(()=>entry.value==='free'&&['','free','story'].includes(skill.value||''))
let canvasEntryRequest:{owner:string;key:string;file:File|null;id:string;saveId:string;runId:string;preview?:{script:string;title:string}}|undefined
/** 首页画布和聊天共用固定文稿发送；不会提交正式解析或媒体生成。 */
async function submitDramaCanvas(fromChat=false){
  if(dramaModeBusy.value||busy.value)return
  const owner=draftOwner.value
  if(!owner)return
  const value=draft(), input=fromChat?'file':String(value.parameters.extra.director_input_mode||'file')
  const file=input==='file'?scriptFile.value:null
  if(input==='file'&&!file){error.value='请先上传剧本文件。';return}
  if(input!=='file'&&!value.prompt.trim()){error.value=input==='idea'?'请先描述你的故事想法。':'请先粘贴剧本原文。';return}
  if(file&&(file.size>20*1024*1024||!/\.(txt|docx|pdf)$/i.test(file.name))){error.value='剧本仅支持 20 MB 内的 TXT、DOCX 或 PDF。';return}
  if(value.references.length||uploads.value.length){error.value='请先单独发送剧本，其他素材可在后续消息中添加。';return}
  const sid=fromChat?session.value?.id:undefined
  const key=JSON.stringify([sid,fromChat,value]), from=route.fullPath
  const isCurrent=()=>owner===draftOwner.value&&from===route.fullPath&&key===JSON.stringify([sid,fromChat,draft()])&&(!file||file===scriptFile.value)
  if(canvasEntryRequest?.owner!==owner||canvasEntryRequest.key!==key||canvasEntryRequest.file!==file){
    canvasEntryRequest={owner,key,file,id:sid||crypto.randomUUID(),saveId:crypto.randomUUID(),runId:crypto.randomUUID()}
  }
  const attempt=canvasEntryRequest
  dramaModeBusy.value=true;error.value=''
  try{
    // 聊天的生图比例不能当成短剧规格；首页明确选择的规格仍随文稿保存。
    const production=fromChat?undefined:canvasScriptProductionOptions(value.parameters,catalog.value?.styles||[])
    // 上传复用现有文件提取；想法明确发送后才起草剧本；粘贴原文不经模型改写。
    // 不沿用标准模式预览编号，避免改写另一条尚待确认的导演草稿。
    const previewInput={...value,parameters:{...value.parameters,extra:{...value.parameters.extra}}}
    delete previewInput.parameters.extra.director_run_id
    const preview=attempt.preview??(file?{...await creationService.readScriptFile(file),title:''}:input==='idea'?await creationService.director(previewInput,'general'):{script:value.prompt,title:''})
    attempt.preview=preview
    if(!isCurrent())return
    if(!preview.script.trim()||Array.from(preview.script).length>20000)throw new Error('剧本不能为空，且本轮最多读取 20000 字；请按集拆分，原文未截断。')
    const title=(file?.name.replace(/\.[^.]+$/,'')||(input==='idea'?preview.title:'')||preview.script.split(/\r?\n/).find(line=>line.trim())?.trim()||'我的剧本').slice(0,100)
    const requirements=fromChat?'':[input==='idea'?value.prompt:'',`画幅：${value.parameters.aspectRatio}`,value.parameters.style?`风格：${value.parameters.style}`:''].filter(Boolean).join('\n')
    const created=sid?{id:sid}:await creationService.create({id:attempt.id,entry:'free',skill:'free',title})
    if(!isCurrent())return
    // 固定提交标识；若保存回执丢失，重试同一文稿不会另建节点。
    // 新上传不隐式覆盖此画布已有的剧本；相同请求号重试可恢复原保存回执。
    const saved=await request<CanvasScriptState>(`/creation/sessions/${created.id}/script-document`,{method:'PUT',body:{expected_revision:0,request_id:attempt.saveId,document:{title,source_text:preview.script,requirements,production}}})
    if(!isCurrent())return
    if(!fromChat&&production?.style_id){
      // 首页明确选择短剧画布和风格后只导入固定文稿；不报价、不确认、不投递生成。
      // 服务端按会话幂等绑定项目，重试不会产生第二个项目。
      await request(`/creation/sessions/${created.id}/production-intake`,{method:'POST',body:{
        expected_document_revision:saved.revision,aspect_ratio:production.aspect_ratio,
        resolution:production.resolution,style_id:production.style_id,
      }})
      if(!isCurrent())return
    }
    const configuredStyle=!!(production?.style_id||value.parameters.styleId||value.parameters.style)
    const instruction=fromChat&&value.prompt.trim()?value.prompt:
      `我要根据已上传的完整剧本制作短剧。请先读取剧本，简要说明剧情和各场内容。${configuredStyle?'保留已选风格，不再询问。':'请推荐合适的视觉风格并让我选择。'}随后依据实际项目状态准备角色、场景和道具；正式剧本确认、收费解析和图片生成均须等待我的明确确认，不得自行提交。`
    const runDraft:CreationDraft={entry:'free',skill:fromChat?(value.skill||'free'):'free',
      prompt:instruction,original_prompt:instruction,segments:[{type:'text',text:instruction}],
      references:[],reference_names:{},
      parameters:fromChat?{...value.parameters,extra:{user_parameter_keys:value.parameters.extra.user_parameter_keys}}:
        {...defaultParameters(),style:value.parameters.style,styleId:value.parameters.styleId}}
    const started=await creationService.startScriptRun(runDraft,attempt.runId,created.id,saved.revision)
    if(!isCurrent())return
    if(scriptFile.value===file)scriptFile.value=null
    setText('',[])
    canvasEntryRequest=undefined
    if(session.value?.id===created.id){
      planning.value=started
      void reloadCanvasActivity()
    }
    await navigateTo({path:'/dashboard',query:{session:created.id,run:started.id,pane:'chat'}})
    // 真正发送才启动本轮；打开已有文稿和刷新只是只读恢复。
    try{
      if(started.status==='planning'){
        const result=await creationService.advanceRun(started.id)
        if(route.query.run===started.id)applyAssistantState(result)
      }
    }catch{if(route.query.run===started.id)error.value='剧本已保存，助手暂未完成回复，请核对当前状态后重试。'}
  }catch(cause){if(isCurrent()){
    error.value=sid&&Number((cause as {statusCode?:number}).statusCode)===409?'此画布可能已有剧本，请从剧本卡编辑原文，或新开画布发送另一份剧本。':cause instanceof Error?cause.message:'剧本暂未保存，请重试。'
  }}
  finally{dramaModeBusy.value=false}
}
/** 仅工具栏的真实用户操作标记为参数改动，目录初始化和草稿恢复不冒充手动选择。 */
function selectParameters(patch:Partial<CreationParameterState>){
  const prior=parameters.value.extra.user_parameter_keys
  const keys=[...new Set([...(Array.isArray(prior)?prior:[]),...Object.keys(patch).filter(key=>key!=='extra')])]
  patchParameters({...patch,extra:{...parameters.value.extra,...patch.extra,user_parameter_keys:keys}})
}
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
// 手机使用完整聊天/画布页签；桌面保留原浮窗坐标，不把手机布局写入桌面偏好。
const desktopWorkspace=ref(false)
const mobileWorkspace=computed(()=>active.value&&entry.value!=='drama'&&!desktopWorkspace.value)
/** 收起仅切换展示；窄屏同步作品页签，避免聊天隐藏后留在空白页。 */
function toggleChat(collapsed:boolean){
  // 手机没有最小化状态，只通过顶部页签切换，不产生不可恢复的小卡。
  if(mobileWorkspace.value){chatCollapsed.value=false;if(!collapsed)mobilePane.value='chat';return}
  const area=workspaceElement.value?.getBoundingClientRect()
  if(floatingChat.value&&area){
    if(collapsed&&!chatCollapsed.value)miniChatWindow.value=minimizeChatWindow(chatWindow.value,area)
    if(!collapsed&&chatCollapsed.value)chatWindow.value=clampChatWindow({...chatWindow.value,x:miniChatWindow.value.x,y:miniChatWindow.value.y+miniChatWindow.value.height-chatWindow.value.height},area)
  }
  chatCollapsed.value=collapsed;mobilePane.value=collapsed?'canvas':'chat'
}
// 合成工具独立于短剧和旧画布，切换账号/会话关闭，丢弃旧组件的迟到响应。
const compositionOpen=ref(false)
const editingWorkspaceOpen=ref(false)
watch(()=>session.value?.id,()=>{editingWorkspaceOpen.value=false})
// 工作台属于当前会话右栏，不在消息组件内部挂弹窗或播放器。
const videoWorkbench=ref<{runId:string;itemId:string}|null>(null)
// 画布普通单击只同步编辑上下文；完成卡和外部深链接才请求重新定位，避免抢走多选或自动缩放。
const videoWorkbenchNodeSelection=ref(false)
const videoWorkbenchRef=ref<InstanceType<typeof CreationVideoWorkbench>|null>(null)
const videoWorkbenchRun=computed(()=>{
  const id=videoWorkbench.value?.runId
  return planning.value?.id===id?planning.value:assistantHistory.value.find(run=>run.id===id)
})
const videoComposition=ref<CompositionJob|null>(null),videoCompositionBusy=ref(false),videoCompositionError=ref('')
let videoWorkbenchEpoch=0,videoCompositionTimer:ReturnType<typeof setTimeout>|undefined
/** 切换账号/会话时立即隔离旧媒体和迟到响应，恢复不会提交任何任务。 */
watch(()=>[draftOwner.value,session.value?.id],()=>{compositionOpen.value=false;videoWorkbench.value=null;videoComposition.value=null;videoCompositionBusy.value=false;videoCompositionError.value='';videoWorkbenchEpoch++;clearTimeout(videoCompositionTimer)})
onBeforeUnmount(()=>{videoWorkbenchEpoch++;clearTimeout(videoCompositionTimer)})
async function canLeaveVideoWorkbench(){
  if(videoWorkbenchRef.value?.isBusy())return false
  return !videoWorkbenchRef.value?.isDirty()||await confirmHomeAction('视频提示词还有未保存修改。是否放弃这些修改并切换？原视频不受影响。','切换视频工作台')
}
/** 点击对话封面只选中右侧视频，不播放、不生成，不清空对话草稿。 */
async function openVideoWorkbench(runId:string,itemId:string,requestFocus=true){
  const sid=session.value?.id,owner=draftOwner.value
  const run=planning.value?.id===runId?planning.value:assistantHistory.value.find(row=>row.id===runId)
  if(!run||run.session_id!==sid||!run.creative_plan?.items.some(item=>item.id===itemId))return
  // 同一批次的不同片段也有独立草稿，切换时必须确认未保存内容。
  const previous=videoWorkbench.value
  if(previous&&(previous.runId!==runId||previous.itemId!==itemId)&&!await canLeaveVideoWorkbench())return
  if(!videoWorkbench.value&&canvasRef.value&&!await canvasRef.value.confirmLeave())return
  if(session.value?.id!==sid||draftOwner.value!==owner||videoWorkbench.value!==previous)return
  if(videoWorkbench.value?.runId!==runId){videoComposition.value=null;videoCompositionBusy.value=false;videoCompositionError.value='';videoWorkbenchEpoch++;clearTimeout(videoCompositionTimer)}
  videoWorkbenchNodeSelection.value=!requestFocus
  videoWorkbench.value={runId,itemId};mobilePane.value='canvas'
  await navigateTo({path:route.path,query:{...route.query,videoRun:runId,videoItem:itemId}})
}
async function closeVideoWorkbench(){
  // 确认只属于当前工作台；弹窗期间若会话或选中片段改变，不能关闭后来打开的编辑器。
  const current=videoWorkbench.value,sid=session.value?.id,owner=draftOwner.value
  if(!await canLeaveVideoWorkbench())return false
  if(videoWorkbench.value!==current||session.value?.id!==sid||draftOwner.value!==owner)return false
  const query={...route.query};delete query.videoRun;delete query.videoItem
  // 先移除深链再清编辑上下文，避免导航期间的历史轮询按旧地址重新打开已退出的视频。
  await navigateTo({path:route.path,query})
  if(videoWorkbench.value!==current||session.value?.id!==sid||draftOwner.value!==owner)return false
  videoWorkbench.value=null;videoWorkbenchNodeSelection.value=false;videoComposition.value=null;videoWorkbenchEpoch++;clearTimeout(videoCompositionTimer)
  return true
}
/** 退出节点编辑只收起停靠输入区，不销毁画布或恢复第二套播放器。 */
async function closeGraphEditor(){if(await closeVideoWorkbench())await agentCanvasRef.value?.focus('')}
/** 改稿的新运行进入同一对话核价；窄屏回到对话，桌面保留右侧原片便于对照。 */
async function revisedVideoWorkbench(source:string,run:CreationRun){await openRetryVideoPlan(source,run);if(planning.value?.id===run.id){mobilePane.value='chat';await nextTick();scrollHistoryBottom(true)}}
/** 仅保存提示词时更新本会话记录，不跳转、不核价，更不提交媒体任务。 */
function savedVideoWorkbench(source:string,run:CreationRun){
  if(run.session_id!==session.value?.id||videoWorkbench.value?.runId!==source)return
  assistantHistory.value=[...assistantHistory.value.filter(value=>value.id!==run.id),run]
  if(planning.value?.id===run.id)planning.value=run
}
/** 明确点击整组合成后才POST；轮询仅读取同一业务任务，结果只在右侧播放。 */
async function composeVideoWorkbench(runId:string){
  if(videoCompositionBusy.value)return
  const run=planning.value?.id===runId?planning.value:assistantHistory.value.find(row=>row.id===runId)
  if(!run?.creative_plan||run.session_id!==session.value?.id)return
  await openVideoWorkbench(runId,run.creative_plan.items[0]?.id||'')
  if(videoWorkbench.value?.runId!==runId)return
  const epoch=videoWorkbenchEpoch
  videoCompositionBusy.value=true;videoCompositionError.value=''
  try{const job=await creationService.composeVideoBatch(runId,run.creative_plan.revision);if(epoch===videoWorkbenchEpoch){videoComposition.value=job;void pollVideoComposition(epoch)}}
  catch(cause){if(epoch===videoWorkbenchEpoch)videoCompositionError.value=(cause as Error).message||'合成未完成，请重试。'}
  finally{if(epoch===videoWorkbenchEpoch)videoCompositionBusy.value=false}
}
async function pollVideoComposition(epoch:number){
  clearTimeout(videoCompositionTimer)
  const job=videoComposition.value
  if(epoch!==videoWorkbenchEpoch||!job||!['queued','rendering'].includes(job.status))return
  try{const value=await videoCompositionService.read(job.id);if(epoch===videoWorkbenchEpoch)videoComposition.value=value}catch(cause){if(epoch===videoWorkbenchEpoch)videoCompositionError.value=(cause as Error).message}
  if(epoch===videoWorkbenchEpoch&&videoComposition.value&&['queued','rendering'].includes(videoComposition.value.status))videoCompositionTimer=setTimeout(()=>pollVideoComposition(epoch),4000)
}
// 深链恢复仅选择本账号已读取的运行，不自动创建方案、采购或合成。
watch(()=>[route.query.videoRun,route.query.videoItem,assistantHistory.value,planning.value,session.value?.id],()=>{
  const id=route.query.videoRun,item=route.query.videoItem
  if(typeof id!=='string'||typeof item!=='string')return
  const run=planning.value?.id===id?planning.value:assistantHistory.value.find(row=>row.id===id)
  if(run?.session_id===session.value?.id&&run?.creative_plan?.items.some(value=>value.id===item)&&!videoWorkbench.value){videoWorkbenchNodeSelection.value=false;videoWorkbench.value={runId:id,itemId:item};mobilePane.value='canvas'}
})
/** 合成只增加真实结果引用，不改变原聊天记录或启用旧画布。重复来源按任务及结果编号合并。 */
const compositionSources=computed(()=>[...new Map([
  ...allResults.value.filter(item=>item.kind==='video'&&item.source.kind==='video'&&item.source.result_id),
  ...batchCompositionResults([...assistantHistory.value,...(planning.value?[planning.value]:[])]),
].map(item=>[item.key,item])).values()])
/** 仅提供已成功投影的原歌曲槽位，处理结果/封面不能冒充可采用BGM。 */
const compositionMusicSources=computed(()=>allResults.value.filter(item=>item.kind==='audio'&&item.source.kind==='music'&&Number.isInteger(item.source.audio_index)))
// 工作台读取整个会话的可预览结果和固定参考版本，不受选中组过滤。
const editingAssets=computed(()=>{
  const assets=[...allResults.value,...compositionSources.value,...batchImageResults(graphRuns.value)]
  const byUrl=new Map<string,Pick<SessionResult,'key'|'title'|'kind'|'url'|'cover'>&{source?:SessionResult['source']}>(assets.filter(item=>item.url).map(item=>[item.url,item]))
  for(const [key,item] of Object.entries(graphPreviews.value)){
    // 直接关联已授权固定版本，不从文件名或临时URL反推素材身份。
    const reference=graphReferences.value.find(ref=>ref.version_id===key)
    if(item.available&&reference&&item.preview_url&&(item.media_type==='image'||item.media_type==='video'||item.media_type==='audio')&&!byUrl.has(item.preview_url))byUrl.set(item.preview_url,{key:`reference:${key}`,title:item.name,kind:item.media_type,url:item.preview_url,source:{kind:'reference',id:reference.version_id,item_id:reference.item_id}})
  }
  return [...byUrl.values()]
})
// 普通会话从参考素材及方案阶段就显示画布，不再等到媒体完成；短剧仍走原流程。
const hasMedia=computed(()=>entry.value!=='drama'||!!videoWorkbenchRun.value||allResults.value.length>0||messages.value.some(item=>item.task_id&&!['failed','cancelled'].includes(taskData[item.id]?.status||'')))
// 仅桌面采用可拖动浮窗；手机聊天独占内容区，短剧继续保留原布局。
const floatingChat=computed(()=>active.value&&hasMedia.value&&entry.value!=='drama'&&desktopWorkspace.value)
const chatWindow=ref<ChatWindowRect>({x:16,y:16,width:390,height:720})
const miniChatWindow=ref<ChatWindowRect>({x:16,y:16,width:280,height:88})
const miniChatStyle=computed(()=>floatingChat.value?{left:`${miniChatWindow.value.x}px`,top:`${miniChatWindow.value.y}px`,width:`${miniChatWindow.value.width}px`,height:`${miniChatWindow.value.height}px`,bottom:'auto'}:{})
/** 手机下半屏小卡保留拖动坐标，由画布预留真实遮挡；桌面沿用横向避让。 */
const canvasBottomInset=computed(()=>{
  const height=workspaceElement.value?.clientHeight||0
  return floatingChat.value&&chatCollapsed.value&&!desktopWorkspace.value&&miniChatWindow.value.y>height/2
    ?Math.max(0,height-miniChatWindow.value.y+12):0
})
/** 桌面缩小对话卡是画布内的真实遮挡，提供其可拖动坐标用于派生节点避让。 */
const canvasObstructions=ref<Array<{x:number;y:number;width:number;height:number}>>([])
let miniDragMoved=false
/** 拖动后抑制同一次释放的click；轻点仍展开，不误触发导航或任务。 */
function restoreMiniChat(){if(miniDragMoved){miniDragMoved=false;return}toggleChat(false)}
/** 只按真实活动显示简短状态；已提交媒体不提供假停止能力。 */
// 未知任务仍需核对，不能因没有运行百分比就把缩小状态卡误报为“空闲中”。
const miniChatStatus=computed(()=>graphActivity.value.running?'正在工作…':workInProgress.value?'正在思考…':awaitingDecision.value?'等待确认…':graphActivity.value.unavailable?'任务待核对':'空闲中')
function miniChatAction(){if(canStopWork.value)void cancelPlanning();else if(!graphActivity.value.running)toggleChat(false)}
const chatGesture=ref<'drag'|'resize'|null>(null)
let chatPointer:{id:number;x:number;y:number;rect:ChatWindowRect;edge:string}|null=null
const chatWindowStyle=computed(()=>floatingChat.value?{'--creation-chat-x':`${chatWindow.value.x}px`,'--creation-chat-y':`${chatWindow.value.y}px`,'--creation-chat-height':`${chatWindow.value.height}px`,'--creation-chat-width':`${chatWindow.value.width}px`}:{'--creation-chat-width':`${chatWidth.value}px`})
/** 标题拖动排除交互控件；指针捕获保证鼠标离开标题后仍能完成移动。 */
function startChatGesture(event:PointerEvent,edge=''){
  if(!floatingChat.value||event.button!==0||(!edge&&(event.target as HTMLElement).closest('button,a,input,textarea')))return
  if(edge==='mini'&&(event.target as HTMLElement).closest('button'))return
  if(edge==='mini')miniDragMoved=false
  chatPointer={id:event.pointerId,x:event.clientX,y:event.clientY,rect:{...(edge==='mini'?miniChatWindow.value:chatWindow.value)},edge}
  chatGesture.value=edge&&edge!=='mini'?'resize':'drag'
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);event.preventDefault()
}
/** 四边/四角共用缩放逻辑，左上缩放时保持对边位置；不触碰编辑器实例与草稿。 */
function moveChatGesture(event:PointerEvent){
  if(!chatPointer||event.pointerId!==chatPointer.id)return
  const {rect,edge}=chatPointer,dx=event.clientX-chatPointer.x,dy=event.clientY-chatPointer.y
  if(edge==='mini'){
    const area=workspaceElement.value?.getBoundingClientRect();if(!area)return
    if(Math.hypot(dx,dy)>4)miniDragMoved=true
    miniChatWindow.value=clampMiniChat({...rect,x:rect.x+dx,y:rect.y+dy},area);return
  }
  let next={...rect}
  if(!edge){next.x+=dx;next.y+=dy}
  else{
    if(edge.includes('e'))next.width+=dx
    if(edge.includes('s'))next.height+=dy
    if(edge.includes('w'))next.width-=dx
    if(edge.includes('n'))next.height-=dy
    const area=workspaceElement.value?.getBoundingClientRect();if(!area)return
    next=clampChatWindow(next,area)
    if(edge.includes('w'))next.x=rect.x+rect.width-next.width
    if(edge.includes('n'))next.y=rect.y+rect.height-next.height
  }
  const area=workspaceElement.value?.getBoundingClientRect();if(area)chatWindow.value=clampChatWindow(next,area)
  void nextTick(measureFloatingChat)
}
function finishChatGesture(){chatPointer=null;chatGesture.value=null}
const chatPanelElement=ref<HTMLElement|null>(null),canvasLeftInset=ref(0)
// 进入手机或打开另一会话时默认聊天；切页签不卸载编辑器与任务实例。
// 从短剧入口提交文稿时，窄屏优先打开画布而不是空白聊天。
watch([mobileWorkspace,()=>session.value?.id],()=>{if(mobileWorkspace.value){chatCollapsed.value=false;mobilePane.value=route.query.pane==='canvas'?'canvas':'chat';finishChatGesture()}},{flush:'post'})
let floatingChatObserver:ResizeObserver|undefined
/** 以浮层真实边界告知画布遮挡，拖宽、收起与窗口变化不再把新节点放到聊天背后。 */
function measureFloatingChat(){
  // 同一响应式断点既控制几何避让，也控制窄屏隐藏画布的播放；不销毁原节点。
  // 普通创作仅在真正手机宽度切换页签；短剧沿用原来的桌面边界。
  desktopWorkspace.value=window.innerWidth>=(entry.value==='drama'?1024:768)
  const root=workspaceElement.value,panel=chatPanelElement.value
  if(floatingChat.value&&root){const area=root.getBoundingClientRect(),rect=clampChatWindow(chatWindow.value,area);if(JSON.stringify(rect)!==JSON.stringify(chatWindow.value))chatWindow.value=rect;miniChatWindow.value=clampMiniChat(miniChatWindow.value,area)}
  canvasLeftInset.value=floatingChat.value&&!chatCollapsed.value&&desktopWorkspace.value&&root&&panel?Math.max(0,panel.getBoundingClientRect().right-root.getBoundingClientRect().left+16):0
}
watch([workspaceElement,chatPanelElement,floatingChat,chatCollapsed,chatWidth],()=>{void nextTick().then(()=>{
  floatingChatObserver?.disconnect();measureFloatingChat()
  if(typeof ResizeObserver!=='undefined'){floatingChatObserver=new ResizeObserver(measureFloatingChat);if(workspaceElement.value)floatingChatObserver.observe(workspaceElement.value);if(chatPanelElement.value)floatingChatObserver.observe(chatPanelElement.value)}
})},{flush:'post'})
onMounted(()=>window.addEventListener('resize',measureFloatingChat))
onBeforeUnmount(()=>{floatingChatObserver?.disconnect();window.removeEventListener('resize',measureFloatingChat)})
const agentCanvasRef=ref<InstanceType<typeof CreationAgentCanvas>|null>(null),graphToolsOpen=ref(false),graphToolNode=ref<CreativeNode|null>(null)
let canvasObstructionObserver:ResizeObserver|undefined
let stopCanvasObstructionWatch:(()=>void)|undefined,canvasObstructionDisposed=false
/** 用画布屏幕矩形为原点测量浮动控件，避免把工作区坐标误当成画布坐标。 */
function measureCanvasObstructions(){
  const root=workspaceElement.value,canvas=root?.querySelector<HTMLElement>('.creative-canvas')
  if(!root||!canvas){canvasObstructions.value=[];return}
  const canvasRect=canvas.getBoundingClientRect(),blocks:Array<{x:number;y:number;width:number;height:number}>=[]
  const readRect=(selector:string)=>{
    const element=root.querySelector<HTMLElement>(selector),rect=element?.getBoundingClientRect()
    return rect&&rect.width>0&&rect.height>0?{x:rect.left-canvasRect.left,y:rect.top-canvasRect.top,width:rect.width,height:rect.height}:undefined
  }
  // 状态小卡的位置可拖动，读取当前DOM矩形，而不是假设工作区与画布原点始终重合。
  if(floatingChat.value&&chatCollapsed.value){const mini=readRect('.creative-chat-minimized');if(mini)blocks.push(mini)}
  // 合成入口在窄屏会下移，必须按实际按钮边界避让；否则比例裁剪的新图可能被入口压住。
  if(compositionSources.value.length&&!graphToolsOpen.value){const compose=readRect('.creative-compose-entry');if(compose)blocks.push(compose)}
  canvasObstructions.value=blocks
}
// watch注册时会立刻读取computed初值。必须等整个setup完成后再订阅，不能提前触发后面声明的allResults。
onMounted(()=>{
  stopCanvasObstructionWatch=watch([workspaceElement,floatingChat,chatCollapsed,miniChatWindow,compositionSources,graphToolsOpen],()=>{void nextTick().then(()=>{
    // 卸载后忽略已排队的测量，避免旧会话重新挂回观察器。
    if(canvasObstructionDisposed)return
    canvasObstructionObserver?.disconnect();measureCanvasObstructions()
    if(typeof ResizeObserver!=='undefined'){
      canvasObstructionObserver=new ResizeObserver(measureCanvasObstructions)
      const root=workspaceElement.value
      for(const element of [root,root?.querySelector<HTMLElement>('.creative-canvas'),root?.querySelector<HTMLElement>('.creative-chat-minimized'),root?.querySelector<HTMLElement>('.creative-compose-entry')])if(element)canvasObstructionObserver.observe(element)
    }
  })},{flush:'post',immediate:true})
  window.addEventListener('resize',measureCanvasObstructions)
})
onBeforeUnmount(()=>{canvasObstructionDisposed=true;stopCanvasObstructionWatch?.();canvasObstructionObserver?.disconnect();window.removeEventListener('resize',measureCanvasObstructions)})
const imagePlanEditorRef=ref<InstanceType<typeof CreationImagePlanEditor>|null>(null),imagePlanEditorNodeId=ref('')
// 节点批注和主聊天附件分离；画布画笔不污染主输入，也不能借用另一个节点的批注。
const graphAnnotationDraft=ref<AnnotationDraft|null>(null)
function updateGraphAnnotation(value:AnnotationDraft|null){graphAnnotationDraft.value=value}
// 画布实际任务投影回填状态卡，不用文字助手是否工作推测后台媒体进度。
const graphActivity=ref({running:0,unavailable:0})
const graphPreparing=ref(false)
let graphToolsEpoch=0
// 工具只属于当前账号/会话，旧弹窗及等待中的打开请求不能跟到另一个项目。
watch(()=>[draftOwner.value,session.value?.id],()=>{graphToolsEpoch++;graphToolsOpen.value=false;graphToolNode.value=null;graphAnnotationDraft.value=null;graphActivity.value={running:0,unavailable:0}})
const graphAnnotationReturn=ref<{sessionId:string|undefined;owner:string}|null>(null)
const graphRuns=computed(()=>[...assistantHistory.value,...(planning.value?[planning.value]:[])])
const graphCompositions=ref<Array<{title:string;job:CompositionJob;nodeId?:string;resultUnavailable?:boolean}>>([])
/** 快捷成片复用原结果卡和真实画布节点，不从模型回复中提取URL或打开工作台。 */
function quickCompositionResults(run?:CreationRun|null):import('../resultCatalog').SessionResult[]{
  const value=graphCompositions.value.find(value=>value.job.id===run?.quick_composition?.job_id)
  if(!value||value.job.status!=='succeeded'||!value.job.output?.public_url||value.resultUnavailable)return []
  return [{key:`composition:${value.job.id}`,messageId:'',versionKey:value.job.id,kind:'video',
    title:value.title,summary:`${(value.job.output.duration_ms||0)/1000}秒 · 点击在画布播放与下载`,
    url:value.job.output.public_url,source:{kind:'composition',id:value.job.id},canvasNodeId:value.nodeId||`composition:${value.job.id}`}]
}
async function openQuickComposition(result:import('../resultCatalog').SessionResult){
  if(result.canvasNodeId&&await agentCanvasRef.value?.focus(result.canvasNodeId))mobilePane.value='canvas'
}
/** 失败只填入修正意图供用户发送，不自动重试错误快照、更不重购成功素材。 */
function correctQuickComposition(){
  const text='请只修正失败的合成计划，复用本会话已完成的视频和音乐；根据实际素材容量修正后展示合成确认，不生成或购买新媒体。'
  setText(prompt.value.trim()?`${prompt.value}\n${text}`:text)
}
// 文稿采用是显式的一次发送意图；切换账号、会话或技能后不自动带入下一轮。
const pendingStoryboardSource=ref<(StoryboardSourceSelection&{title:string})|null>(null)
watch(()=>[draftOwner.value,session.value?.id,skill.value],()=>{pendingStoryboardSource.value=null},{flush:'sync'})
/** 只填入真实已保存文稿身份，不复制正文、不自动请求模型或创建正式短剧项目。 */
async function chooseCanvasStoryboardSource(source:StoryboardSourceSelection,title:string,close:()=>void){
  if(workInProgress.value||entry.value!=='free'||!catalog.value?.skills.some(item=>item.id==='drama-storyboard'))return
  selectUserSkill('drama-storyboard')
  // 同技能换文稿也属于显式来源边界，不把上一故事的改稿上下文当成当前正文。
  explicitSkillBoundary.value=true
  pendingStoryboardSource.value={...source,title}
  if(!prompt.value.trim())setText(`请把所选文稿《${title}》（V${source.revision}）规划成分镜。`)
  close();toggleChat(false)
  await nextTick();await composerRef.value?.focusInput()
}
/** 阅读页只追加待发送的修改说明，保留对话原有文字和素材引用。 */
async function discussCanvasScript(description:string,title:string,revision:number){
  const text=`请就剧本《${title}》（V${revision}）提供以下修改建议，不直接保存剧本或发起制作：\n${description}`
  const previous=prompt.value,separator=previous?'\n\n':''
  const existing=segments.value.length?segments.value:previous?[{type:'text' as const,text:previous}]:[]
  setText(`${previous}${separator}${text}`,[...existing,{type:'text',text:separator+text}])
  toggleChat(false)
  await nextTick();await composerRef.value?.focusInput()
}
const graphCompositionFileReads=new Map<string,number>()
let graphCompositionEpoch=0,graphCompositionTimer:ReturnType<typeof setTimeout>|undefined,graphCompositionSchedule:ReturnType<typeof setTimeout>|undefined
/** 合成节点只读取当前会话成片目录；恢复不触发 materialize、合成或重试。 */
async function readGraphCompositions(reset=false){
  const sid=session.value?.id,owner=draftOwner.value,epoch=++graphCompositionEpoch
  // 显式刷新已经接手时取消尚未触发的合并任务，避免同一目录紧接着读取两次。
  clearTimeout(graphCompositionSchedule)
  clearTimeout(graphCompositionTimer)
  if(reset)graphCompositionFileReads.clear()
  if(!sid||!owner||entry.value==='drama'){graphCompositions.value=[];return}
  try{
    const manifest=await videoCompositionService.canvasOutputs(sid)
    const rows=await Promise.all(manifest.outputs.map(async output=>(await videoCompositionService.outputJobs(sid,output.id)).map(job=>({title:output.title,job,nodeId:output.canvas_node_id}))))
    if(epoch!==graphCompositionEpoch||sid!==session.value?.id||owner!==draftOwner.value)return
    const state=advanceCompositionReads(rows.flat(),graphCompositionFileReads)
    graphCompositions.value=state.rows
    // 对话提交的合成不打开工作台；原任务进入终态后只读刷新该轮回复，保留当前输入与作品。
    const finished=new Set(state.rows.filter(row=>['succeeded','failed'].includes(row.job.status)).map(row=>row.job.id))
    for(const run of graphRuns.value.filter(run=>run.quick_composition&&finished.has(run.quick_composition.job_id)&&!['succeeded','failed'].includes(run.quick_composition.status))){
      const updated=await creationService.run(run.id)
      if(epoch!==graphCompositionEpoch||sid!==session.value?.id||owner!==draftOwner.value)return
      if(planning.value?.id===updated.id)applyAssistantState(updated)
      assistantHistory.value=assistantHistory.value.map(value=>value.id===updated.id?updated:value)
    }
    if(state.poll)graphCompositionTimer=setTimeout(()=>{if(!document.hidden)void readGraphCompositions()},4000)
  }catch{/* 独立合成目录失败不破坏已读取的图片与视频节点，打开合成面板可显式重试。 */}
}
/** 合并同一事件波次触发的目录刷新；立即作废旧响应，避免旧会话的结果覆盖当前画布。 */
function scheduleGraphCompositionRead(){
  graphCompositionEpoch++
  clearTimeout(graphCompositionSchedule)
  clearTimeout(graphCompositionTimer)
  graphCompositionSchedule=setTimeout(()=>{if(typeof document!=='undefined'&&!document.hidden)void readGraphCompositions(true)},80)
}
watch(()=>[session.value?.id,draftOwner.value],()=>{graphCompositions.value=[];scheduleGraphCompositionRead()})
watch(compositionOpen,value=>{if(!value)scheduleGraphCompositionRead()})
// 新任务收据主动唤醒原目录读取；轮询仅跟进原任务，不重新提交合成。
watch(()=>graphRuns.value.map(run=>run.quick_composition?.job_id||'').filter(Boolean).join(','),scheduleGraphCompositionRead)
/** 隐藏标签页暂停请求，重新可见后补一次只读对账，不让轮询永久停在排队态。 */
function resumeGraphCompositions(){if(!document.hidden)scheduleGraphCompositionRead()}
onMounted(()=>document.addEventListener('visibilitychange',resumeGraphCompositions))
onBeforeUnmount(()=>{graphCompositionEpoch++;clearTimeout(graphCompositionTimer);clearTimeout(graphCompositionSchedule);document.removeEventListener('visibilitychange',resumeGraphCompositions)})
const graphPreviews=computed(()=>Object.fromEntries(Object.entries({...session.value?.reference_previews,...Object.assign({},...graphRuns.value.map(run=>run.reference_previews||{}))}).map(([key,value])=>[key,{...(value as WorkspacePreview),preview_url:(value as WorkspacePreview).preview_url?libraryService.previewUrl((value as WorkspacePreview).preview_url!):''}])))
const graphReferences=computed(()=>mergeRoundReferences(roundReferences.value,references.value))
/** 按画布来源只读重取文件元数据；失效链接不重生成、不重报价，也不重复扣费。 */
async function refreshGraphFile(node:CreativeNode){
  const source=node.data.source
  const sid=session.value?.id,owner=draftOwner.value
  if(!sid||!owner||!source)return
  const current=()=>sid===session.value?.id&&owner===draftOwner.value
  try{
    if(source.kind==='artifact'){
      const artifact=session.value?.artifacts?.find(value=>value.id===source.id)
      if(!artifact)throw new Error('编辑版本记录已失效，请从原作品重新打开。')
      const item=await libraryService.detail(artifact.item_id)
      if(!current())return
      const version=item.versions.find(value=>value.id===artifact.version_id)
      if(item.media_type!=='image'||!version?.preview_url)throw new Error('素材库未返回该编辑版本的可用图片地址。')
      // 仅替换内存中的同一版本预览元数据；裁剪文件、来源链和已完成作品保持不变。
      session.value.artifacts=[...(session.value.artifacts||[]).filter(value=>value.id!==artifact.id),{...artifact,preview_url:version.preview_url}]
    }else if(source.kind==='image'||source.kind==='video'){
      // 计划批次的子任务不一定对应聊天消息，先读取原运行的服务端权威快照。
      const run=graphRuns.value.find(value=>value.image_plan?.batch?.items.some(item=>item.task_id===source.id)||value.creative_plan?.batch?.items.some(item=>item.task_id===source.id))
      if(run){
        const fresh=await creationService.run(run.id)
        if(!current())return
        updateRecoveredFlow(fresh)
      }else{
        const message=messages.value.find(value=>value.task_id===source.id)
        if(!message)throw new Error('原任务记录暂不可用；没有创建新任务。')
        // 旧式单任务直接刷新原任务记录，不能借“重载文件”入口再次提交生成。
        if(source.kind==='image'){
          const images=await productImageService.getHistory(source.id)
          if(!current())return
          taskData[message.id]={status:normalizeStatus(images.status),progress:images.progress||0,detail:images.errorMessage||images.currentStep||'',images}
        }else{
          const video=await productVideoService.getTask(source.id)
          if(!current())return
          taskData[message.id]={status:normalizeStatus(video.status),progress:video.progress,detail:video.errorMessage||video.currentStep,video}
        }
      }
    }else if(source.kind==='music'){
      const message=messages.value.find(value=>value.task_id===source.id)
      if(!message)throw new Error('原音乐任务记录暂不可用；没有创建新任务。')
      const music=await musicService.task(source.id)
      if(!current())return
      taskData[message.id]={status:music.status,progress:music.progress,detail:music.error_message,music}
      musicTasks.value=[music,...musicTasks.value.filter(value=>value.id!==music.id)]
    }else if(source.kind==='composition'){
      // 合成结果按成片目录重新读取；目录恢复不会再次调用合成接口。
      await readGraphCompositions(true)
      if(!current())return
    }else if(source.kind==='reference'&&source.item_id){
      const item=await libraryService.detail(source.item_id)
      if(!current())return
      const version=item.versions.find(value=>value.id===source.id)
      if(!version?.preview_url)throw new Error('素材库未返回该参考版本的可用文件地址。')
      const preview={available:true,name:item.name,media_type:item.media_type,preview_url:version.preview_url}
      const url=libraryService.previewUrl(version.preview_url)
      references.value=references.value.map(value=>value.version_id===source.id?{...value,name:item.name,media_type:item.media_type,preview_url:url}:value)
      roundReferences.value=roundReferences.value.map(value=>value.version_id===source.id?{...value,name:item.name,media_type:item.media_type,preview_url:url}:value)
      if(session.value)session.value.reference_previews={...session.value.reference_previews,[source.id]:preview}
      assistantHistory.value=assistantHistory.value.map(value=>value.reference_previews?.[source.id]?{...value,reference_previews:{...value.reference_previews,[source.id]:preview}}:value)
      if(planning.value?.reference_previews?.[source.id])planning.value={...planning.value,reference_previews:{...planning.value.reference_previews,[source.id]:preview}}
    }else{
      throw new Error('此节点没有可重新读取的原始文件记录。')
    }
    if(!current())return
    notice.value='已重新读取原任务/素材记录；未重新生成。若仍无法播放，原文件当前可能不可用。'
  }catch(cause){
    if(current())error.value=(cause as Error).message||'重新读取原文件失败，未创建新任务。'
  }
}
const graphResults=computed(()=>{
  const values=[...allResults.value,...batchCompositionResults(graphRuns.value),...batchImageResults(graphRuns.value)]
  for(const artifact of session.value?.artifacts||[])values.push({key:`artifact:${artifact.id}`,messageId:'',versionKey:artifact.id,kind:'image',title:'图片编辑版本',summary:'',url:libraryService.previewUrl(artifact.preview_url),source:{kind:'artifact',id:artifact.id},parentSource:artifact.source})
  return [...new Map(values.map(value=>[value.key,value])).values()]
})
/** 续作只展示服务端核实的成功图片，不能从模型文字猜图或把同会话其他作品混入。 */
function continuationImages(run:CreationRun|null|undefined){
  if(!run)return []
  const refs=(run as CreationRun&{completed_image_sources?:Array<{task_id:string;result_id:string}>}).completed_image_sources||[]
  return graphResults.value.filter(item=>item.kind==='image'&&refs.some(ref=>ref.task_id===item.source.id&&ref.result_id===item.source.result_id))
}
/** 同轮已有批次成果卡时，不再把后续阶段复用的图片重复放进产物汇总。 */
function answerContinuationImages(run:CreationRun|null|undefined,rows:ReturnType<typeof groupConversation>){
  const shown=new Set(batchImageResults(rows.flatMap(row=>row.run?[row.run]:[])).map(item=>item.key))
  return continuationImages(run).filter(item=>!shown.has(item.key))
}
/** 成果卡只定位已有节点，不创建媒体任务或采购。 */
async function openContinuationImage(key:string){
  const result=graphResults.value.find(item=>item.key===key)
  if(result)await agentCanvasRef.value?.focus(result.canvasNodeId||resultCanvasNodeId(result,messages.value,graphResults.value))
}
// 仅明确的视频深链接覆盖画布保存的选择；旧单作品工作台的默认结果不能在刷新时抢走文本/草案。
const graphFocusId=computed(()=>videoWorkbench.value&&!videoWorkbenchNodeSelection.value?`plan:${videoWorkbench.value.runId}:${videoWorkbench.value.itemId}`:'')
const graphToolVersions=computed<CanvasVersion[]>(()=>{
  const node=graphToolNode.value,source=node?.data.source
  if(!node||!source||node.data.kind==='text')return []
  // 原工具的歌词、逐字对齐和对比来源继续保留，但只接收同一业务作品的元数据。
  const original=canvasVersions.value.find(value=>value.source.kind===source.kind&&value.source.id===source.id&&value.source.result_id===source.result_id&&value.source.audio_index===source.audio_index)
  return [{...original,key:node.id,title:node.data.title,kind:node.data.kind==='compose'?'video':node.data.kind,url:node.data.url||'',cover:node.data.cover||original?.cover,parentUrl:(source.kind==='artifact'?canvasParentImage(source,graphResults.value):undefined)||original?.parentUrl,source}]
})
/** 图片选中即展开原作品工具，不再要求多点一次；不触发保存、模型调用或采购。 */
async function selectGraphNode(node:CreativeNode){
  imagePlanEditorNodeId.value=node.data.planTarget==='image'?node.id:''
  // 可播放视频与成片和图片一样，选中即展开工具，不需要二次点击。
  if(['image','video','compose'].includes(node.data.kind)&&node.data.source&&node.data.url&&['reference','succeeded','completed'].includes(node.data.status)){
    if(!graphToolsOpen.value||graphToolNode.value?.id!==node.id)await openGraphTools(node)
    return
  }
  if(node.data.planTarget!=='image'&&node.data.runId&&node.data.itemId)await openVideoWorkbench(node.data.runId,node.data.itemId,false)
}
/** 对话方案卡只定位同会话的真实图片条目，不打开旧视频工作台或发起采购。 */
async function openImagePlan(runId:string,itemId:string){
  const run=graphRuns.value.find(value=>value.id===runId)
  if(run?.session_id!==session.value?.id||!run.image_plan?.items.some(value=>value.id===itemId))return
  if(await agentCanvasRef.value?.focus(`image-plan:${runId}:${itemId}`))mobilePane.value='canvas'
}
/** 保存选择/核价前先保存节点正文，防止对话的旧修订覆盖工作中的单张改稿。 */
async function beforeImagePlanCommand(){
  return !imagePlanEditorRef.value?.isBusy()&&!imagePlanEditorRef.value?.isDirty()&&!busy.value&&!planningBusy.value
}
/** 节点正在键入时隐藏该运行的旧价；其他运行的编辑不冒充本计划已经改变。 */
function imagePlanDraftDirty(runId:string){
  return imagePlanEditorNodeId.value.startsWith(`image-plan:${runId}:`)&&!!imagePlanEditorRef.value?.isDirty()
}
/** 输入区缩略图严格对应本张固定引用，不借用主聊天新附件。 */
function imagePlanReferences(runId:string,itemId:string):ComposerReference[]{
  const run=graphRuns.value.find(value=>value.id===runId)
  return planReferencePreviews(run?.image_plan?.items.find(value=>value.id===itemId)?.references||[],graphReferences.value,graphPreviews.value)
}
/** 视频也消费同一套预览投影；改稿/原片的固定引用保持各自运行和条目身份。 */
function videoPlanReferences(runId:string,itemId:string):ComposerReference[]{
  const run=graphRuns.value.find(value=>value.id===runId)
  return planReferencePreviews(run?.creative_plan?.items.find(value=>value.id===itemId)?.references||[],graphReferences.value,graphPreviews.value)
}
/** 节点优先继承本人原运行的规格；新草案才使用当前同类型模型，不混用上一媒体类型。 */
function graphNodeInitial(node:CreativeNode){
  const original=creativeRetryParameters(node,graphRuns.value,messages.value,graphResults.value)
  if(original)return original
  // 只有新草案/参考素材可采用当前选择；缺少原记录的旧任务不能冒充聊天当前模型。
  return (node.data.manual||node.data.reference)&&node.data.kind===target.value?parameters.value:{}
}
/** 离开当前视频改稿前复用原未保存确认，不让画布切换绕过编辑保护。 */
async function beforeSelectGraphNode(node?:CreativeNode){
  if(imagePlanEditorRef.value&&node?.id!==imagePlanEditorNodeId.value){
    if(imagePlanEditorRef.value.isBusy())return false
    const current=imagePlanEditorNodeId.value,sid=session.value?.id,owner=draftOwner.value
    if(imagePlanEditorRef.value.isDirty()&&!await confirmHomeAction('图片提示词还有未保存修改，是否放弃并切换？已保存方案不受影响。','切换图片方案'))return false
    if(current!==imagePlanEditorNodeId.value||sid!==session.value?.id||owner!==draftOwner.value)return false
  }
  // 画布内工具不再由模态遮罩阻止切换，必须在原节点离开前明确处理未保存笔迹。
  if(graphToolsOpen.value&&node?.id!==graphToolNode.value?.id){
    const epoch=graphToolsEpoch,id=graphToolNode.value?.id,sid=session.value?.id,owner=draftOwner.value
    if(canvasRef.value&&!await canvasRef.value.confirmLeave())return false
    if(epoch!==graphToolsEpoch||id!==graphToolNode.value?.id||sid!==session.value?.id||owner!==draftOwner.value)return false
    graphToolsEpoch++;graphToolsOpen.value=false
  }
  if(!videoWorkbench.value||(node?.data.runId===videoWorkbench.value.runId&&node?.data.itemId===videoWorkbench.value.itemId))return true
  return closeVideoWorkbench()
}
async function updateGraphToolsOpen(open:boolean){
  const epoch=graphToolsEpoch,id=graphToolNode.value?.id
  if(!open&&canvasRef.value&&!await canvasRef.value.confirmLeave())return
  if(epoch!==graphToolsEpoch||id!==graphToolNode.value?.id)return
  if(!open)graphToolsEpoch++
  graphToolsOpen.value=open
}
/** 节点批注属于本节点子任务：先固定真实像素版本，再迁移当前输入；不跳回主聊天或复用旧报价。 */
async function useInlineGraphAnnotation(value:AnnotationDraft,node:CreativeNode,text:string,submit=false){
  if(annotationSubmitting.value)return
  const sameSource=(a:WorkspaceSource|undefined,b:WorkspaceSource|undefined)=>!!a&&!!b&&a.kind===b.kind&&a.id===b.id&&a.result_id===b.result_id&&a.audio_index===b.audio_index
  if(!graphToolsOpen.value||graphToolNode.value?.id!==node.id||!sameSource(value.source,graphToolNode.value.data.source)){
    error.value='批注来源已变化，请返回对应节点核对后再发送。';return
  }
  const sid=session.value?.id,owner=draftOwner.value,parameters=node.data.parameters?{...node.data.parameters}:undefined
  annotationSubmitting.value=true
  try{
    const artifact=await saveCanvas(value)
    if(!artifact||sid!==session.value?.id||owner!==draftOwner.value)return
    const id=`result:artifact:${artifact.id}:`
    if(submit)await agentCanvasRef.value?.submitEditedNode(id,text,parameters)
    else await agentCanvasRef.value?.prepareEditedNode(id,text,parameters)
  }catch(cause){error.value=(cause as Error).message||'批注版本未能用于当前节点，修改仍保留。'}
  finally{annotationSubmitting.value=false}
}
/** 节点发送先完成尚未结束的笔画；保存失败不继续策划，普通节点沿用原发送命令。 */
async function submitGraphEditor(node:CreativeNode,text:string,submit:()=>unknown){
  if(annotationSubmitting.value)return
  if(graphToolsOpen.value&&graphToolNode.value?.id===node.id&&(graphAnnotationDraft.value||canvasRef.value?.isDirty())){
    // 文字输入或笔画缩略图尚未发布时也必须先完成，不能因预览防抖窗口而发送未批注原图。
    const sid=session.value?.id,owner=draftOwner.value,editor=canvasRef.value,source=graphToolNode.value
    try{
      await editor?.finishAnnotation()
      if(sid!==session.value?.id||owner!==draftOwner.value||source!==graphToolNode.value||editor!==canvasRef.value)return
      const value=graphAnnotationDraft.value
      if(!value){error.value='批注预览尚未准备好，修改仍保留，请稍后重新发送。';return}
      await useInlineGraphAnnotation(value,node,text,true)
    }catch(cause){error.value=(cause as Error).message||'批注尚未完成，未提交生成。'}
    return
  }
  await submit()
}
/** 明确点击后先免费保存固定版本，再交回输入；不调用模型、不核价、不授权费用。 */
async function useGraphAnnotation(value:AnnotationDraft){
  if(annotationSubmitting.value)return
  annotationSubmitting.value=true
  try{
  const sid=session.value?.id,owner=draftOwner.value
  const artifact=await saveCanvas(value)
  if(!artifact||sid!==session.value?.id||owner!==draftOwner.value)return
  let originalVersion=''
  if(value.source.kind==='artifact')originalVersion=session.value?.artifacts?.find(item=>item.id===value.source.id)?.version_id||''
  else if(value.source.kind==='reference')originalVersion=value.source.id
  else if(value.source.kind==='image'){
    const item=await libraryService.saveResult('product_image',value.source.id,value.source.result_id!,'other')
    originalVersion=item.versions[0]?.id||''
  }
  if(sid!==session.value?.id||owner!==draftOwner.value)return
  if(!graphToolsOpen.value)return
  if(canvasRef.value?.isDirty()){error.value='批注版本已保存，但又有新的编辑，请先保存或处理新改动。';return}
  const typed=prompt.value;setSkill('edit')
  references.value=[...references.value.filter(item=>item.version_id!==originalVersion),{item_id:artifact.item_id,version_id:artifact.version_id,purpose:'reference',name:'批注版本',media_type:'image',preview_url:libraryService.previewUrl(artifact.preview_url)}]
  const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id'])delete extra[key]
  director.value=null;directorAccepted.value=false
  patchParameters({templateId:'',selectedTemplateId:'',workflow:'direct',extra:{...extra,workspace_tool:{action:'edit',source:{kind:'artifact',id:artifact.id}}}})
  setText(typed,[{type:'text',text:typed}]);updateAnnotation(null);confirmation.value=null
  graphAnnotationReturn.value={sessionId:sid,owner}
  graphToolsOpen.value=false
  chatCollapsed.value=false;mobilePane.value='chat'
  notice.value='已保存批注并添加到创作素材，生成前仍需核价确认。'
  }catch(cause){error.value=(cause as Error).message||'批注版本已保存，添加素材失败，可从该节点工具继续创作。'}
  finally{annotationSubmitting.value=false}
}
/** 弹窗释放焦点后再回到主输入框，避免默认恢复到工具按钮抢走输入焦点。 */
function graphToolsCloseAutoFocus(event:Event){
  const target=graphAnnotationReturn.value;if(!target)return
  event.preventDefault();graphAnnotationReturn.value=null
  if(target.sessionId===session.value?.id&&target.owner===draftOwner.value)void nextTick().then(()=>composerRef.value?.focusInput())
}
/** 打开工具必须尊重来源切换的取消结果；引用/编辑版本也保留未保存保护。 */
async function openGraphTools(node:CreativeNode,initialTool?:'crop'){
  if(!node.data.source||!node.data.url||busy.value)return
  const sid=session.value?.id,owner=draftOwner.value,epoch=++graphToolsEpoch
  if(canvasRef.value&&!await canvasRef.value.confirmLeave())return
  if(node.data.resultKey&&allResults.value.some(value=>value.key===node.data.resultKey)){
    // 当前节点已由画布选中；只同步旧作品状态，不再次定位触发选中→工具→定位的递归。
    if(!await chooseSessionResult(node.data.resultKey,false))return
  }
  if(epoch!==graphToolsEpoch||sid!==session.value?.id||owner!==draftOwner.value||busy.value)return
  graphToolNode.value=node;graphToolsOpen.value=true
  if(initialTool==='crop'){
    // 等内嵌画布工具挂载后再开启裁剪；迟到的上下文动作不能切到另一会话或节点。
    await nextTick()
    if(epoch!==graphToolsEpoch||sid!==session.value?.id||owner!==draftOwner.value||graphToolNode.value?.id!==node.id||!graphToolsOpen.value)return
    await canvasRef.value?.openCrop()
  }
}
/** AI剪辑和片段截取共用原编辑器；只打开当前来源，不自动新增计划、导出或采购。 */
function openGraphVideoEditor(source?:WorkspaceSource){
  const current=graphToolNode.value?.data.source
  if(!graphToolsOpen.value||!source||!current||busy.value||graphPreparing.value)return
  if(current.kind!==source.kind||current.id!==source.id||current.result_id!==source.result_id||current.item_id!==source.item_id||current.audio_index!==source.audio_index){error.value='工具来源已变化，请重新打开对应节点。';return}
  editingWorkspaceOpen.value=true
}
/** 复用原画布轻量通知；连续点击同一开发中入口也重新计时，不改写任务或方案。 */
async function showGraphToolNotice(message:string){
  const sid=session.value?.id,owner=draftOwner.value
  notice.value='';await nextTick()
  if(sid===session.value?.id&&owner===draftOwner.value)notice.value=message
}
/** 普通画布工具使用节点子任务输入；旧工作台的聊天交接保留给非画布流程。 */
async function graphMediaTool(action:string,source:WorkspaceSource){
  const node=graphToolNode.value
  if(!graphToolsOpen.value||!node||busy.value||graphPreparing.value)return
  const current=node.data.source
  if(!current||current.kind!==source.kind||current.id!==source.id||current.result_id!==source.result_id||current.audio_index!==source.audio_index){error.value='工具来源已变化，请重新打开对应节点。';return}
  try{await agentCanvasRef.value?.prepareMediaTool(node.id,action)}catch(cause){error.value=(cause as Error).message||'工具草案未能建立，原作品保持不变。'}
}
const graphFavorite=computed(()=>{const source=graphToolNode.value?.data.source;if(source?.kind!=='image')return false;return Object.values(taskData).some(task=>task?.images?.id===source.id&&task.images.results.some((value:any)=>value.id===source.result_id&&value.isFavorite))})
/** 工具操作绑定当前节点业务身份，不借用另一条正在查看作品的收藏状态。 */
async function favoriteGraphNode(){const source=graphToolNode.value?.data.source;if(source?.kind!=='image'||!source.result_id)return;try{await productImageService.setFavorite(source.id,source.result_id,!graphFavorite.value);await refreshResults(true)}catch(cause){error.value=(cause as Error).message}}
/** 画布生成是明确的新需求；只把授权素材编号送入既有整理接口，不直接采购。 */
/** 原技能重整与自由派生分开；先准备权限/目录，确认后才创建新轮，不携带旧执行授权。 */
async function retryGraphPlanning(node:CreativeNode){
  if(busy.value||planningBusy.value||graphPreparing.value||stoppingAssistant.value||planning.value?.status==='planning'||!requireLogin())return
  if(node.data.phase!=='planning'||node.data.itemId||!node.data.runId||!['failed','cancelled'].includes(node.data.status)||uploads.value.length)return
  // 本轮沿用的素材与技能边界不包含在 draft() 内，重整准备和确认期间同样需要防止被覆盖。
  const retryDraftStamp=()=>JSON.stringify([draft(),roundReferences.value,explicitSkillBoundary.value])
  const sid=session.value?.id,owner=draftOwner.value,scope=assistantEpoch,stamp=retryDraftStamp()
  const current=()=>sid===session.value?.id&&owner===draftOwner.value&&scope===assistantEpoch
  const unchanged=()=>current()&&stamp===retryDraftStamp()
  const requestId=crypto.randomUUID()
  graphPreparing.value=true
  let started:CreationRun|undefined,adopted=false
  try{
    const source=await creationService.run(node.data.runId)
    if(!current())return
    if(source.session_id!==sid||!['failed','cancelled'].includes(source.status)||source.executed_request||source.creative_plan?.batch)throw new Error('原整理状态已改变，请刷新节点后核对。')
    // 私人试用及旧固定版本按本人原运行读取，不能用公开目录缺项误判为技能失效。
    const nextCatalog=await creationService.catalog(source.draft.entry,sid,source.id)
    if(!current())return
    if(source.mode!=='chat'&&!nextCatalog.skills.some(value=>value.id===source.draft.skill))throw new Error('原技能当前不可用，未替换当前输入。')
    const prepared:ComposerReference[]=[]
    for(const reference of source.draft.references){
      const item=await libraryService.detail(reference.item_id),version=item.versions.find(value=>value.id===reference.version_id)
      if(!current())return
      if(!version)throw new Error('原固定素材版本已不可用，请先核对资料库。')
      if(item.media_type==='document'&&(version.parse_status!=='ready'||reference.start==null||reference.end==null||reference.end<=reference.start))throw new Error('原文档片段暂不可读取，请先核对资料库。')
      prepared.push({...reference,name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)})
    }
    if(!unchanged())throw new Error('准备期间输入已变化，未覆盖当前草稿。')
    if((prompt.value.trim()||references.value.length||roundReferences.value.length)&&!await confirmHomeAction('将恢复原节点的技能、规格与素材继续整理，并替换当前未发送的输入。已有作品不受影响，生成仍需重新确认。是否继续？','按原技能重新整理'))return
    if(!unchanged()){if(current())error.value='确认期间输入已变化，未覆盖当前草稿。';return}
    // 创建响应未知时只GET原请求，不自动重发POST，也不回退到自由技能执行器。
    try{started=await creationService.retryPlanning(source.id,requestId,source.calls)}
    catch(cause){try{const recovered=await creationService.runByRequest(requestId);if(recovered.retry_of===source.id)started=recovered}catch{/* 没有受理记录时由用户显式重试。 */}if(!started)throw cause}
    if(!current())return
    if(started.session_id!==sid||started.retry_of!==source.id||started.version!==source.version)throw new Error('返回的整理来源或技能版本不一致，已停止继续。')
    if(!unchanged()){
      assistantHistory.value=[...assistantHistory.value.filter(value=>value.id!==started!.id),started]
      error.value='原技能整理节点已保留，但输入在请求期间变化，未覆盖新稿；可再次点击原节点的重新整理继续。'
      return
    }
    planningBusy.value=true;stopCountdown();confirmation.value=null;assistantAccepted.value=false;userInitiatedRun='';error.value=''
    const previous=planning.value
    if(previous&&previous.id!==started.id)assistantHistory.value=[...assistantHistory.value.filter(value=>value.id!==previous.id),previous]
    catalog.value=nextCatalog;entry.value=started.draft.entry;skill.value=started.draft.skill
    // 恢复完整原规格而非单次接口数量1；默认值只补老快照缺失字段，不调用setSkill覆盖。
    parameters.value={...defaultParameters(),...started.draft.parameters,extra:{...started.draft.parameters.extra}}
    references.value=[];roundReferences.value=prepared;explicitSkillBoundary.value=false
    setText('',[]);assistantDraft=JSON.stringify(draft());planning.value=started;adopted=true
    await routerRun(started.id,started.session_id)
    if(!current())return
    const result=started.status==='planning'?await creationService.advanceRun(started.id):started
    if(current()&&planning.value?.id===started.id)applyAssistantState(result)
  }catch(cause){if(current())error.value=(cause as Error).message||'重新整理未完成，原节点与草稿仍保留。'}
  finally{if(current()&&adopted)planningBusy.value=false;graphPreparing.value=false}
}
async function generateGraphNode(node:CreativeNode,inputs:CreativeNode[]){
  if(busy.value||planningBusy.value||graphPreparing.value)return
  // 草稿之外的本轮引用与边界也参与防覆盖，异步准备期间变化时不能替换新状态。
  const currentGraphDraft=()=>JSON.stringify([draft(),roundReferences.value,explicitSkillBoundary.value])
  const sid=session.value?.id,owner=draftOwner.value,stamp=currentGraphDraft()
  const prepared:ComposerReference[]=[]
  graphPreparing.value=true
  try{
    // 已保存草案可能遇到后台停用或目录尚未加载；不能继续用旧能力或默认图片模型提交。
    if(node.data.kind==='audio'&&!(catalog.value?.capabilities?.platform.music.enabled??catalog.value?.music_operations?.some(row=>row.operation==='generation'&&row.enabled)))throw new Error('音乐生成当前不可用，请稍后重试，草案已保留。')
    // 当前音乐草案先支持文字创作；参考音频需要独立授权和来源选择，不继承聊天旧引用。
    if(node.data.kind==='audio'&&inputs.some(input=>input.data.kind!=='text'||!!input.data.reference))throw new Error('音乐节点暂不支持直接引用媒体或文档，请使用文字描述。')
    for(const input of inputs){
      if(sid!==session.value?.id||owner!==draftOwner.value)return
      const source=input.data.source
      // 固定文档与普通文字节点分开：文档不依赖媒体URL，也不能被空文本分支静默丢弃。
      if(input.data.reference){
        const ref=input.data.reference,item=await libraryService.detail(ref.item_id),version=item.versions.find(value=>value.id===ref.version_id)
        if(!version)throw new Error('引用素材版本已失效')
        if(item.media_type==='document'&&(version.parse_status!=='ready'||ref.start==null||ref.end==null||ref.start<0||ref.end<=ref.start))throw new Error('参考文档需解析完成并选择有效原文片段，请在资料库重新选择。')
        prepared.push({...ref,name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)});continue
      }
      if(input.data.kind==='text'){
        // 旧布局可能已保存这条线；提交时仍核对源节点，不把未完成/失败流式文字当最终要求。
        if(input.data.phase==='planning'&&!['ready','replied','completed','succeeded'].includes(input.data.status))throw new Error('引用的文字尚未整理完成，请等待原节点完成后再提交。')
        if(!input.data.prompt.trim())throw new Error('引用的文本节点还没有内容，请先填写并保存。');continue
      }
      if(!input.data.url||!source)throw new Error('引用的素材尚未完成或已失效，请先完成来源节点。')
      if(source.kind==='image'||source.kind==='video'){
        const item=await libraryService.saveResult(source.kind==='image'?'product_image':'product_video',source.id,source.result_id!,'other'),version=item.versions[0]
        if(!version)throw new Error('作品尚未形成可引用版本');prepared.push({item_id:item.id,version_id:version.id,purpose:source.kind==='video'?'reference_video':'reference',name:item.name,media_type:source.kind,preview_url:libraryService.previewUrl(version.preview_url)})
      }else if(source.kind==='composition'){
        const item=await libraryService.saveResult('video_composition',source.id,'','other'),version=item.versions[0]
        if(!version||item.media_type!=='video')throw new Error('成片尚未形成可引用的视频版本')
        prepared.push({item_id:item.id,version_id:version.id,purpose:'reference_video',name:item.name,media_type:'video',preview_url:libraryService.previewUrl(version.preview_url)})
      }else if(source.kind==='artifact'){
        const artifact=session.value?.artifacts?.find(value=>value.id===source.id);if(!artifact)throw new Error('编辑版本已失效')
        const item=await libraryService.detail(artifact.item_id),version=item.versions.find(value=>value.id===artifact.version_id);if(!version)throw new Error('编辑版本已失效')
        prepared.push({item_id:item.id,version_id:version.id,purpose:'reference',name:item.name,media_type:'image',preview_url:libraryService.previewUrl(version.preview_url)})
      }else throw new Error('此来源尚未支持直接引用，请从资料库添加固定素材。')
    }
    if(sid!==session.value?.id||owner!==draftOwner.value)return
    if(stamp!==currentGraphDraft())throw new Error('准备素材期间创作草稿已变化，未替换当前输入，请重新提交。')
    if(node.data.parameters&&['image','video'].includes(node.data.kind)){
      const problem=nodeParameterError(node.data.parameters,node.data.kind==='video'?'video':'image',catalog.value,prepared)
      if(problem)throw new Error(problem+'，未提交生成。')
    }
    // 空正文也可能有待发送素材；替换前须确认，取消时保留原引用。
    if((prompt.value.trim()||references.value.length||roundReferences.value.length)&&!await confirmHomeAction('将用当前节点内容替换未发送的输入框草稿和素材，是否继续？','从画布整理需求'))return
    if(sid!==session.value?.id||owner!==draftOwner.value)return
    if(stamp!==currentGraphDraft())throw new Error('确认期间创作草稿已变化，未替换当前输入，请重新提交。')
    const text=[...inputs.filter(value=>value.data.kind==='text'&&!value.data.reference).map(value=>value.data.prompt),node.data.prompt].filter(Boolean).join('\n\n')
    // 此段只同步收敛参数；失败时恢复原稿，绝不恢复可能已经失效的费用确认。
    const previousGraphDraft={skill:skill.value,parameters:parameters.value,references:references.value,roundReferences:roundReferences.value,boundary:explicitSkillBoundary.value}
    try{
    // 手动节点不沿用上一轮多条数量、技能边界和费用授权，规格仍遵守当前真实模型能力。
    setSkill('free')
    // 同一固定版本可能同时从作品节点和资料库节点连入；同用途同片段只提交一次。
    references.value=[...new Map(prepared.map(item=>[JSON.stringify([item.version_id,item.purpose,item.start,item.end]),item])).values()];roundReferences.value=[];explicitSkillBoundary.value=true
    const music=node.data.kind==='audio',musicOptions=node.data.parameters
    patchParameters(music?{model:'',style:musicOptions?.style||'',styleId:'',count:1,output:'music',workflow:'direct',musicMode:'create',musicOperation:'',sourceTask:'',sourceUrl:'',customLyrics:false,rightsConfirmed:false,extra:{instrumental:!!musicOptions?.instrumental,vocal_gender:musicOptions?.vocalGender||'',requirement_boundary:true,canvas_node_id:node.id,canvas_node_kind:'audio'}}:{...node.data.parameters,count:1,output:node.data.kind==='video'?'video':node.data.kind==='image'?'image':'auto',workflow:'direct',extra:{...parameters.value.extra,requirement_boundary:true,canvas_node_id:node.id,canvas_node_kind:node.data.kind}})
    // 平台目录可能变更：不能把失效的音乐能力降级为图片或沿用其他人声选项。
    if(music&&(parameters.value.output!=='music'||!!parameters.value.extra.instrumental!==!!musicOptions?.instrumental||String(parameters.value.extra.vocal_gender||'')!==(musicOptions?.vocalGender||'')||parameters.value.style!==(musicOptions?.style||'')))throw new Error('音乐设置与当前平台能力不一致，请重新核对，未提交生成。')
    // 原共享输入器会收敛规格；若平台锁定值造成变化，必须阻止提交而非静默换模型/改时长。
    if(node.data.parameters&&!music){
      const expected=node.data.parameters
      const keys:Array<keyof CreativeNodeParameters>=['model','aspectRatio','resolution','style','styleId',...(node.data.kind==='video'?['durationSec' as const]:['quality' as const])]
      // 清晰度显示大小写归一不算改规格；其他字段仍严格比较，真正换模型/降档/改时长继续拒绝。
      if(keys.some(key=>key==='resolution'?String(expected[key]||'').toLowerCase()!==String(parameters.value[key]||'').toLowerCase():expected[key]!==parameters.value[key]))throw new Error('节点规格与平台当前配置冲突，未提交生成，请重新核对。')
    }
    }catch(cause){
      skill.value=previousGraphDraft.skill;parameters.value=previousGraphDraft.parameters;references.value=previousGraphDraft.references;roundReferences.value=previousGraphDraft.roundReferences;explicitSkillBoundary.value=previousGraphDraft.boundary
      // 原报价可能已被能力收敛影响，要求重新核价，避免回滚时重新授权。
      confirmation.value=null
      throw cause
    }
    // 文本交给只回复链路；图片/视频仍需完整策划、真实核价和显式确认。
    setText(text,[{type:'text',text}]);await planDemand({mode:node.data.kind==='text'?'chat':'skill'})
  }catch(cause){if(sid===session.value?.id&&owner===draftOwner.value)error.value=(cause as Error).message||'画布需求未能提交，草案仍保留。'}
  finally{graphPreparing.value=false}
}
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
async function chooseSessionResult(key:string,focusCanvas=true){
  const item=allResults.value.find(value=>value.key===key),sid=session.value?.id,owner=draftOwner.value
  if(!item||busy.value)return false
  /** 完成卡每次显式点击都定位，包括旧工作台仍选中同一作品但画布已切到文本的情况。 */
  async function focusResult(){
    // 用户点击完成卡仍显式定位；节点工具内部同步时不能重新进入选择回调。
    if(!focusCanvas||!agentCanvasRef.value||entry.value==='drama')return true
    const accepted=await agentCanvasRef.value.focus(resultCanvasNodeId(item!,messages.value,graphResults.value))
    return accepted!==false&&session.value?.id===sid&&draftOwner.value===owner
  }
  if(key===selectedResultKey.value&&!videoWorkbench.value)return focusResult()
  if(videoWorkbench.value&&!await closeVideoWorkbench())return false
  if(canvasRef.value&&!await canvasRef.value.confirmLeave())return false
  if(session.value?.id!==sid||draftOwner.value!==owner)return false
  await focusMessage(item.messageId)
  if(session.value?.id!==sid||draftOwner.value!==owner)return false
  resultGroup.value=key
  const remembered=viewedVersions.get(key)
  chooseCanvas(remembered&&canvasVersions.value.some(value=>value.key===remembered)?remembered:item.versionKey)
  unreadResults.value=unreadResults.value.filter(value=>value!==key)
  return focusResult()
}
const canvasVersions=computed<CanvasVersion[]>(()=>{
  const versions:CanvasVersion[]=[]
  const task=activeResult.value
  // 与完成卡共用任务/条目状态校验：失败条目的残留URL不能从版本菜单重新暴露。
  if(readyResult(task?.images))for(const [index,image] of (task?.images?.results||[]).entries())if(readyResult(image)&&image?.imageUrl)versions.push({key:image.id,title:`图片 · 版本 ${index+1}`,kind:'image',url:image.imageUrl,source:{kind:'image',id:task!.images!.id,result_id:image.id}})
  if(readyResult(task?.video))for(const [index,video] of (task?.video?.results||[]).entries())if(readyResult(video)&&video?.videoUrl)versions.push({key:video.id,title:`视频 · 版本 ${index+1}`,kind:'video',url:video.videoUrl,cover:video.coverUrl,source:{kind:'video',id:task!.video!.id,result_id:video.id}})
  // 不先filter再编号：成功的第二首必须仍引用audio_index=1，且失败任务不能暴露残留版本。
  if(['completed','succeeded','success'].includes(sourceTask.value?.status||''))for(const [index,song] of songs.value.entries())if(playableMusicSong(song))versions.push({key:`song:${index}`,title:String(song.title||`音乐 · 版本 ${index+1}`),kind:'audio',url:String(song.audio_url||song.url||song.audio||''),cover:String(song.image_url||song.cover_url||''),lyrics:String(song.lyrics||''),alignment:song.aligned_lyrics,source:{kind:'music',id:sourceTask.value!.id,audio_index:index}})
  // 分轨、剪辑和歌词视频等目录结果未必包含 music 数组，仍保留真实可播放文件。
  if(!songs.value.length&&sourceTask.value&&['completed','succeeded','success'].includes(sourceTask.value.status))for(const [index,link] of mediaLinks.value.entries())versions.push({key:link.id,title:`处理结果 · ${index+1}`,kind:link.video?'video':'audio',url:link.url,source:{kind:'music',id:sourceTask.value.id,result_id:link.id}})
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
const musicToolOptions=computed(()=>{
  const task=sourceTask.value
  const completed=!!task&&['completed','succeeded','success'].includes(String(task.status||'').toLowerCase())
  if(!task?.provider_task_id||!completed||!songs.value.some(playableMusicSong))return[]
  return(catalog.value?.music_operations||[]).filter(v=>v.enabled&&!!v.fields.task_id&&!['sample','addStem','addVocals','addInstrumental'].includes(v.operation)).map(v=>({code:v.operation,name:v.label}))
})
const selectedMusicOperation=ref('')
const musicToolSource=ref<{taskId:string;audioIndex:number}|null>(null)
/** 只从当前成功原曲打开目录允许的改造操作，并冻结被点击节点的曲目序号。 */
function openCanvasMusicTool(operation:string,source:WorkspaceSource){
  const request=resolveCanvasMusicTool(operation,source,sourceTask.value,songs.value,musicToolOptions.value)
  if(!request){notice.value='当前音乐曲目或可用操作已变化，请重新选择成品后重试。';return}
  selectedMusicOperation.value=request.operation
  musicToolSource.value={taskId:request.sourceTaskId,audioIndex:request.sourceAudioIndex}
  showMusicTools.value=true
}
/** 关闭音频工具只清理临时来源，不提交草稿、生成任务或费用确认。 */
function closeCanvasMusicTools(){showMusicTools.value=false;musicToolSource.value=null;selectedMusicOperation.value=''}
/** 按工具按钮的真实作品身份固定MV来源，不借用聊天选择，不提交生成或继承费用许可。 */
async function makeMusicMv(code:string,source:WorkspaceSource){
  if(code!=='make-mv'||busy.value||source?.kind!=='music'||!source.id||!Number.isInteger(source.audio_index)||(source.audio_index??-1)<0)return
  const sid=session.value?.id,owner=draftOwner.value,selection=`${source.id}:${source.audio_index}`
  if(prompt.value.trim()&&!await confirmHomeAction('将用这首歌的MV需求替换未发送的文字草稿，是否继续？','从音乐创作MV'))return
  if(sid!==session.value?.id||owner!==draftOwner.value||busy.value)return
  mvSourceMode.value='owned';mvSource.value=selection
  if(!await selectMvSong()||sid!==session.value?.id||owner!==draftOwner.value)return
  entry.value='music';setSkill('mv-visual');confirmation.value=null
  setText('请为这首歌设计视觉 MV。',[{type:'text',text:'请为这首歌设计视觉 MV。'}])
  chatCollapsed.value=false;mobilePane.value='chat'
  // 弹窗关闭后复用同一焦点交接，避免默认回焦到画布工具而丢失输入焦点。
  if(graphToolsOpen.value){graphAnnotationReturn.value={sessionId:sid,owner};graphToolsOpen.value=false}
  else await nextTick().then(()=>composerRef.value?.focusInput())
  notice.value='已添加当前曲目作为MV素材，生成前仍需核价确认。'
}
async function chooseHistory(id:string){
  // 失败提示是只读通知，不能点它覆盖右侧正在查看的作品。
  if(['failed','needs_review','result_error'].includes(taskData[id]?.status||''))return
  if(canvasRef.value&&!await canvasRef.value.confirmLeave())return
  canvasSelected.value='';await focusMessage(id)
}
function chooseCanvas(key:string){canvasSelected.value=key;const index=images.value.findIndex(v=>v.id===key),videoIndex=videos.value.findIndex(v=>v.id===key);if(index>=0)selectedResult.value=index;else if(videoIndex>=0){selectedResult.value=videoIndex;void chooseVideo(videoIndex)}}
/** 读取裁剪后图片的实际比例，只用于画布避让，不把计划比例冒充为文件尺寸。 */
async function imageBlobAspectRatio(file:Blob){
  if(!file.type.startsWith('image/'))return undefined
  let bitmap:ImageBitmap|undefined
  try{
    if(typeof createImageBitmap==='function'){
      bitmap=await createImageBitmap(file)
      const ratio=bitmap.width/bitmap.height
      return Number.isFinite(ratio)&&ratio>0?ratio:undefined
    }
    const url=URL.createObjectURL(file)
    try{return await new Promise<number|undefined>(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:undefined);image.onerror=()=>resolve(undefined);image.src=url})}
    finally{URL.revokeObjectURL(url)}
  }catch{return undefined}
  finally{bitmap?.close()}
}
async function saveCanvas(value:{file:Blob;source:WorkspaceSource;operations:Record<string,unknown>[];requestId:string}){
  if(!session.value||saveBusy.value)return;const sid=session.value.id,owner=draftOwner.value,canvasAtSave=canvasRef.value,toolAtSaveId=graphToolsOpen.value?graphToolNode.value?.id:undefined;saveBusy.value=true
  // 保存可以在后台完成，但切换作品后不能清空新编辑器，也不能由迟到的解码结果抢回节点。
  const editorStillCurrent=()=>canvasRef.value===canvasAtSave&&(!toolAtSaveId||graphToolsOpen.value&&graphToolNode.value?.id===toolAtSaveId)
  try{
    const artifact=await creationService.saveArtifact(sid,value.file,value.source,value.operations,value.requestId)
    if(session.value?.id!==sid||draftOwner.value!==owner)return
    const existingArtifact=session.value.artifacts?.some(value=>value.id===artifact.id)
    const keepSourceInView=!existingArtifact&&graphToolsOpen.value&&!!graphToolNode.value
    const sourceNodeId=graphToolNode.value?.id
    let artifactAspectRatio:number|undefined
    session.value.artifacts=[...(session.value.artifacts||[]).filter(v=>v.id!==artifact.id),artifact]
    const accepted=editorStillCurrent()&&!!canvasAtSave?.markSaved(value.source,value.operations)
    if(accepted){
      if(!existingArtifact&&agentCanvasRef.value){
        artifactAspectRatio=await imageBlobAspectRatio(value.file)
        if(session.value?.id!==sid||draftOwner.value!==owner||!editorStillCurrent())return
        const result=graphResults.value.find(item=>item.source.kind==='artifact'&&item.source.id===artifact.id)
        if(result&&!keepSourceInView){
          const id=resultCanvasNodeId(result,messages.value,graphResults.value)
          const placed=await agentCanvasRef.value.placeDerivedFromSource(id,value.source,artifactAspectRatio)
          // 来源节点可能刚切换或已移出当前画布；内嵌作品工具仍按它固定的节点身份兜底定位。
          if(!placed&&graphToolsOpen.value&&graphToolNode.value)await agentCanvasRef.value.placeDerived(id,graphToolNode.value.id,artifactAspectRatio)
        }
      }
      if(!editorStillCurrent())return
      canvasSelected.value=artifact.id
      if(graphToolsOpen.value&&graphToolNode.value){
        const result=graphResults.value.find(item=>item.source.kind==='artifact'&&item.source.id===artifact.id)
        if(result){
          const id=resultCanvasNodeId(result,messages.value,graphResults.value)
          graphToolNode.value={...graphToolNode.value,id,data:{kind:'image',title:result.title,prompt:result.summary,status:'succeeded',url:result.url,source:result.source,resultKey:result.key}}
          await nextTick()
          if(session.value?.id!==sid||draftOwner.value!==owner||!graphToolsOpen.value||graphToolNode.value?.id!==id)return
          if(!existingArtifact&&agentCanvasRef.value){
            // 新裁剪图需要继续与原图并排取景；只聚焦派生图会把来源挤出可视区。
            const placed=await agentCanvasRef.value.placeDerivedFromSource(id,value.source,artifactAspectRatio)
            if(!placed&&sourceNodeId)await agentCanvasRef.value.placeDerived(id,sourceNodeId,artifactAspectRatio)
          }else await agentCanvasRef.value?.focus(id)
        }
      }
    }
    notice.value=accepted?'已保存派生版本，原作品保持不变，未扣积分。':'已保存派生版本，当前新增的修改仍保留，未扣积分。'
    // 保存期间若用户已换作品或继续编辑，不允许“用于创作”交接到迟到的旧快照。
    return accepted?artifact:undefined
  }catch(cause){error.value=(cause as Error).message}finally{saveBusy.value=false}
}
/** 选择 AI 工具只绑定明确来源并填写草稿，不自动报价、提交或扣点。 */
async function canvasAI(action:string,source:WorkspaceSource){
  if(busy.value||graphPreparing.value)return
  error.value='';notice.value=''
  const text=prompt.value,sid=session.value?.id,owner=draftOwner.value,stamp=JSON.stringify(draft())
  graphPreparing.value=true
  try{
    if(source.kind==='image'){if(!await continueImage(source.id,source.result_id!,action==='image_to_video'))return}
    else if(source.kind==='artifact'){
      const artifact=session.value?.artifacts?.find(v=>v.id===source.id);if(!artifact)throw new Error('派生版本不可用')
      const item=await libraryService.detail(artifact.item_id),version=item.versions.find(v=>v.id===artifact.version_id)
      if(sid!==session.value?.id||owner!==draftOwner.value)return
      if(stamp!==JSON.stringify(draft()))throw new Error('准备编辑版本期间草稿已变化，未替换当前输入，请重新选择工具。')
      if(!version)throw new Error('派生版本不可用')
      parameters.value={...parameters.value,templateId:'',selectedTemplateId:'',workflow:'direct',output:action==='image_to_video'?'video':'image'};director.value=null;directorAccepted.value=false;setSkill(action==='image_to_video'?'animate':'edit');references.value=[{item_id:item.id,version_id:version.id,purpose:'reference',name:item.name,media_type:'image',preview_url:libraryService.previewUrl(version.preview_url)}]
    }
    else if(source.kind==='video'||source.kind==='composition'){
      const item=await libraryService.saveResult(source.kind==='composition'?'video_composition':'product_video',source.id,source.kind==='composition'?'':source.result_id!,'other'),version=item.versions[0]
      if(sid!==session.value?.id||owner!==draftOwner.value)return
      if(stamp!==JSON.stringify(draft()))throw new Error('准备视频期间草稿已变化，未替换当前输入，请重新选择工具。')
      if(!version)throw new Error('视频尚未形成可引用版本')
      setSkill('showcase');references.value=[{item_id:item.id,version_id:version.id,purpose:'reference_video',name:item.name,media_type:'video',preview_url:libraryService.previewUrl(version.preview_url)}]
    }
    if(sid!==session.value?.id||owner!==draftOwner.value)return
    if(error.value)return
    // 工具是明确的新来源；不默默带入上一轮尚留在聊天上下文中的其他素材。
    roundReferences.value=[];explicitSkillBoundary.value=true
    const instructions:Record<string,string>={background:'请调整这张图片的背景：',style:'请调整这张图片的风格：',edit:'请修改这张图片：',image_to_video:'让这张图片动起来：',video_reference:'参考这段视频继续创作：'}
    const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id'])delete extra[key]
    patchParameters({extra:{...extra,workspace_tool:{action,source}}});planning.value=null
    const instruction=instructions[action]||'',next=!text.trim()||Object.values(instructions).includes(text.trim())?instruction:`${instruction}\n${text}`
    setText(next,[{type:'text',text:next}]);mobilePane.value='chat';await composerRef.value?.focusInput()
    // 已明确改用作品工具时移除旧规划深链，刷新不能重新打开过期规划或报错。
    if(route.query.run){const query={...route.query};delete query.run;await navigateTo({path:route.path,query})}
  }catch(cause){if(sid===session.value?.id&&owner===draftOwner.value)error.value=(cause as Error).message}
  finally{graphPreparing.value=false}
}
function previewReference(version:string){const value=session.value?.reference_previews?.[version];if(value?.available)attachmentPreview.value={...value,preview_url:libraryService.previewUrl(value.preview_url||'')};else notice.value='该历史素材已失效或无权访问，原任务快照保持不变。'}
const { $siteAsset: siteAsset } = useNuxtApp()
const pickerOpen = ref(false), audioPickerOpen = ref(false), audioItems = ref<LibraryItem[]>([]), audioQuery = ref('')
const pickerMounted=ref(false),stagePickerMounted=ref(false)
watch(pickerOpen,open=>{if(open)pickerMounted.value=true},{flush:'sync'})
const assetBrowserOpen=ref(false)
// 画布入口使用非遮罩侧栏；输入框入口继续使用原有居中选择器。
const assetBrowserFromCanvas=ref(false)
// 切换账号或会话时销毁画布侧栏，避免旧会话的素材选择落到新会话。
watch(()=>[draftOwner.value,session.value?.id],()=>{if(assetBrowserFromCanvas.value)assetBrowserOpen.value=false},{flush:'sync'})
const assetScope = ref('personal'), assetCategory = ref(''), assetMedia = ref(''), assetCategories = ref<Array<{ code: string; name: string }>>([])
const showMusicTools = ref(false), selectedResult = ref(0), notice = ref('')
// 切换账号或会话立即销毁音频面板，避免旧来源与迟到操作回流到新的对话。
watch(()=>[draftOwner.value,session.value?.id],()=>closeCanvasMusicTools(),{flush:'sync'})
const showDigitalHumanSkill=ref(false)
/** 技能中心只打开口播工具，不自动报价、生成或改写当前创作草稿。 */
watch(()=>route.query.tool,value=>{if(value==='digital-human')showDigitalHumanSkill.value=true},{immediate:true})
// 画布通知统一居中；可恢复错误持续保留，普通操作反馈八秒后撤下，不重复发送右上角 Toast。
let noticeTimer:ReturnType<typeof setTimeout>|undefined
watch(notice,text=>{clearTimeout(noticeTimer);if(text&&text!==preferenceError.value)noticeTimer=setTimeout(()=>{notice.value=''},8000)})
onBeforeUnmount(()=>clearTimeout(noticeTimer))
// 加载仅显示原中央双点，不再叠加顶部加载胶囊；错误在加载结束后提示。
// 用户主动点击的轻量反馈不能被旧模式读取错误永久遮住；反馈结束后仍保留原错误及重试。
const draftProblemText=computed(()=>cloudDraft.conflict.value?'草稿与其他页面有冲突，请选择保留的版本。':cloudDraft.state.value==='error'?cloudDraft.failure.value||'草稿保存失败，请重试；未提交生成。':'')
const canvasNoticeText=computed(()=>sessionLoading.value?'':sessionError.value||draftProblemText.value||error.value||notice.value||preferenceError.value)
/** 只重试原读取或草稿保存，不重复提交创作或恢复费用授权。 */
async function retryCanvasNotice(){
  if(sessionError.value)await restore(pendingSession.value)
  else if(cloudDraft.state.value==='error'){await cloudDraft.retry();if(cloudDraft.state.value!=='error')error.value=''}
  else if(preferenceError.value)await loadPreference()
}
/** 冲突由用户明确选择；处理完成后不自动执行，需要用户再次核对确认。 */
async function resolveDraftConflict(useRemote:boolean){await cloudDraft.resolve(useRemote);if(!cloudDraft.conflict.value&&cloudDraft.state.value!=='error')error.value=''}
const entryInfo = computed(() => creationEntries.find(item => item.id === entry.value)!)
const pendingUserAnswer=ref('')
// 整组问卷提交先等真实答案落盘；不把长题干作为另一条乐观用户气泡重复显示。
const pendingQuestionForm=ref(false)
// 仅当服务端答案数超过提交前快照时，隐藏临时答案气泡并展示服务端保存的问题/答案卡。
const pendingAnswerBaseCount=ref<number|null>(null)
const pendingAnswerAccepted=computed(()=>hasAcceptedAnswerSince(planning.value?.answers?.length||0,pendingAnswerBaseCount.value))
const stageCard=ref<InstanceType<typeof CreationStageCard>|null>(null),styleConflictBusy=ref(false)
let pendingStageText:{fingerprint:string;requestId:string}|undefined
/** 当前阶段内合并补充，不新建运行；失败重试复用请求号，迟到响应不跨会话回填。 */
async function sendStageText(){
  const run=planning.value,stage=run?.collection_stage,text=prompt.value.trim(),owner=auth.session.user?.id,epoch=assistantEpoch
  if(!run||!stage||!text||planningBusy.value||busy.value||stageCard.value?.isBusy())return
  const snapshot=stageCard.value?.snapshot()||{answers:stage.answers,cursor:stage.cursor}
  const fingerprint=JSON.stringify([owner,run.id,stage.revision,text,snapshot])
  if(pendingStageText?.fingerprint!==fingerprint)pendingStageText={fingerprint,requestId:crypto.randomUUID()}
  planningBusy.value=true;error.value=''
  try{
    const saved=await creationService.stageText(run.id,{...snapshot,text,expected_revision:stage.revision,request_id:pendingStageText.requestId})
    if(epoch!==assistantEpoch||owner!==auth.session.user?.id||planning.value?.id!==run.id)return
    planning.value={...planning.value,collection_stage:saved};pendingStageText=undefined
    if(prompt.value.trim()===text)setText('',[])
  }catch(cause){if(epoch===assistantEpoch&&owner===auth.session.user?.id)error.value=(cause as Error).message}
  finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
// 阶段选图使用既有资料库选择器，但固定图片类型，不与底部草稿的选图回调混用。
const stagePickerOpen=ref(false)
watch(stagePickerOpen,open=>{if(open)stagePickerMounted.value=true},{flush:'sync'})
let finishStagePicker:((items:ComposerReference[])=>void)|undefined
function selectStageImages():Promise<ComposerReference[]>{
  if(!requireLogin())return Promise.resolve([])
  finishStagePicker?.([])
  const owner=auth.session.user?.id,id=planning.value?.id
  stagePickerOpen.value=true
  return new Promise(resolve=>{finishStagePicker=items=>resolve(owner===auth.session.user?.id&&id===planning.value?.id?items:[])})
}
function acceptStageImages(values:Array<{item:LibraryItem;version:LibraryVersion;reference:LibraryReference}>){
  const complete=finishStagePicker;finishStagePicker=undefined
  complete?.(values.filter(value=>value.item.media_type==='image').map(({item,version,reference})=>({...reference,name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)})))
  stagePickerOpen.value=false
}
watch(stagePickerOpen,open=>{if(!open){finishStagePicker?.([]);finishStagePicker=undefined}})
watch(()=>[auth.session.user?.id,planning.value?.id],()=>{stagePickerOpen.value=false;finishStagePicker?.([]);finishStagePicker=undefined})
onBeforeUnmount(()=>{finishStagePicker?.([]);finishStagePicker=undefined})
/** 上传只产生真实资料库版本；返回给阶段卡并保存，不在底部草稿重复挂引用。 */
async function uploadStageImage(file:File,progress?:(percent:number|null)=>void):Promise<ComposerReference|null>{
  const run=planning.value,owner=auth.session.user?.id,epoch=assistantEpoch
  if(!run||planningBusy.value||busy.value)return null
  // 使用原上传鉴权与真实XHR进度；阶段素材不混入底部输入的上传队列，也不触发生成。
  const item=await libraryService.upload(file,'other',progress)
  if(owner!==auth.session.user?.id||epoch!==assistantEpoch||planning.value?.id!==run.id)return null
  const version=item.versions[0]
  if(item.media_type!=='image'||!version)throw new Error('未取得可用的图片版本，请重新选择。')
  return {item_id:item.id,version_id:version.id,purpose:'reference',media_type:'image',name:item.name,preview_url:libraryService.previewUrl(version.preview_url)}
}
/** 刷新后按原固定版本恢复问题图预览；不使用最新版本，也不把地址持久化到浏览器。 */
async function restoreQuestionImage(reference:ComposerReference):Promise<ComposerReference|null>{
  const item=await libraryService.detail(reference.item_id)
  const version=item.versions.find(value=>value.id===reference.version_id)
  if(!version||item.media_type!=='image')return null
  return {...reference,name:item.name,media_type:'image',preview_url:libraryService.previewUrl(version.preview_url)}
}
/** 阶段固定引用也恢复缩略图，不把未保存的本地地址当作有效素材。 */
const collectionReferences=computed(()=>{
  const run=planning.value,existing=mergeRoundReferences(roundReferences.value,references.value)
  const stage=run?.collection_stage
  if(!stage)return existing
  const values=stage.definition.fields.filter(field=>field.kind==='reference').flatMap(field=>(stage.answers[field.id]||[]) as CreationDraft['references'])
  for(const ref of values){
    if(existing.some(item=>item.version_id===ref.version_id))continue
    const preview=run?.reference_previews?.[ref.version_id]
    existing.push({...ref,name:preview?.name||'参考素材',media_type:preview?.media_type||'image',preview_url:preview?.available?libraryService.previewUrl(preview.preview_url||''):''})
  }
  return existing
})
/** 整组提交已成功但分析请求断线时，由用户显式继续，不在刷新时自动重放。 */
async function continueCollectedStage(){
  const run=planning.value,owner=auth.session.user?.id,epoch=assistantEpoch
  if(!run||planningBusy.value||run.calls||run.collection_stage?.status!=='submitted')return
  planningBusy.value=true;error.value=''
  try{const result=await creationService.advanceRun(run.id);if(epoch===assistantEpoch&&owner===auth.session.user?.id&&planning.value?.id===run.id)applyAssistantState(result)}
  catch(cause){if(epoch===assistantEpoch&&owner===auth.session.user?.id)error.value=(cause as Error).message}
  finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
/** 阶段保存只写会话，整组提交才进入原分析链；迟到响应不得覆盖换号或换会话后的页面。 */
async function reloadCollectionStage(){
  const run=planning.value,owner=auth.session.user?.id,epoch=assistantEpoch
  if(!run||planningBusy.value||busy.value)return null
  planningBusy.value=true;error.value=''
  try{
    // 读取完整运行以同步素材预览；不恢复报价、执行许可或启动分析。
    const latest=await creationService.run(run.id)
    if(epoch!==assistantEpoch||owner!==auth.session.user?.id||planning.value?.id!==run.id)return null
    if(latest.status==='cancelled'||latest.collection_stage?.status!=='collecting')throw new Error('此阶段已在其他页面结束，本页填写仍保留；请先复制需要的内容再刷新会话。')
    planning.value=latest
    return latest.collection_stage
  }catch(cause){if(epoch===assistantEpoch&&owner===auth.session.user?.id)error.value=(cause as Error).message;return null}
  finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
async function saveCollectionStage(answers:Record<string,unknown>,submitStage:boolean,requestId:string,cursor?:number,note?:string):Promise<boolean>{
  const run=planning.value,stage=run?.collection_stage,owner=auth.session.user?.id
  if(!run||!stage||planningBusy.value||busy.value||uploads.value.length)return false
  const epoch=assistantEpoch
  planningBusy.value=true;error.value=''
  try{
    const saved=note&&!submitStage?await creationService.stageText(run.id,{answers,expected_revision:stage.revision,request_id:requestId,cursor,text:note}):await creationService.saveStage(run.id,{answers,expected_revision:stage.revision,request_id:requestId,cursor},submitStage)
    if(epoch!==assistantEpoch||owner!==auth.session.user?.id||planning.value?.id!==run.id)return false
    planning.value={...planning.value,collection_stage:saved}
    if(submitStage){
      // 先读提交快照再开始文字分析，不能把表单提交当作媒体授权。
      const snapshot=await creationService.run(run.id)
      if(epoch!==assistantEpoch||owner!==auth.session.user?.id||planning.value?.id!==run.id)return false
      planning.value=snapshot
      const result=await creationService.advanceRun(run.id)
      if(epoch!==assistantEpoch||owner!==auth.session.user?.id||planning.value?.id!==run.id)return false
      applyAssistantState(result)
    }
    return true
  }catch(cause){if(epoch===assistantEpoch&&owner===auth.session.user?.id)error.value=(cause as Error).message;return false}
  finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
/** 参考图只在本题上传和确认，不写入底部草稿，也不把选图动作自动当作已回答。 */
const referenceQuestionRef=ref<InstanceType<typeof CreationReferenceQuestion>|null>(null)
function chooseQuestionFile(){referenceQuestionRef.value?.chooseFile()}
async function confirmQuestionReference(items:ComposerReference[]){
  if(!items.length)return
  await answerPlanning('已上传参考图片，请读取本轮实际图片后继续整理原需求。',undefined,items)
}
/** 兼容旧题上传遗留的底部引用：只隐藏已随本题提交的固定版本，真实素材与历史不删除。 */
const composerReferences=computed(()=>{
  const run=planning.value
  // 非对话创建的历史重试草案可能缺少答案，不能因此使整个创作页渲染失败。
  const consumed=new Set(run?.answers?.some(answer=>questionNeedsReference(answer.snapshot))?run.draft.references.map(item=>item.version_id):[])
  return references.value.filter(item=>!consumed.has(item.version_id))
})
const selectedAnswers=ref<string[]>([])
// 不从问题正文猜测输入意图；旧记录有选项默认只展示选项。
const questionInputExpanded=ref(false)
/** 单题复用分页问卷外观，仍将原选项交给原回答入口，不增加执行或授权语义。 */
const standaloneQuestionFields=computed(()=>{
  const question=planning.value?.question
  if(!question||question.fields?.length||question.kind==='style'||questionNeedsReference(question))return []
  return [{id:'single-question',text:question.text,kind:question.kind==='multiple'?'multiple' as const:question.options?.length?'single' as const:'text' as const,options:question.options||[],requires_input:questionNeedsText(question),required:true}]
})
const questionNeedsInput=computed(()=>questionInputExpanded.value||questionNeedsText(planning.value?.question))
// 多选只在明确点击确定后提交；单选仍沿原直接回答入口。
const questionSubmission=computed(()=>planning.value?.question?.kind==='multiple'?multipleQuestionAnswer(selectedAnswers.value,answerText.value):answerText.value.trim())
/** 旧流程已落库的用途/画幅问题只显示原规格摘要，不再要求用户重复选择。 */
const knownFormatQuestion=computed(()=>{
  const options=planning.value?.question?.options || []
  return !!parameters.value.aspectRatio && options.length>=2 && options.every(option=>/\d+\s*[:：]\s*\d+/.test(option))
})
// 摘要和确认卡沿用同一质量等级文案，不改变已有参数或报价快照。
const selectedParameterSummary=computed(()=>`${models.value.find(item=>item.code===parameters.value.model)?.name || parameters.value.model || '待选模型'} · ${parameters.value.aspectRatio} · ${parameters.value.resolution} · ${{low:'低',medium:'中',high:'高'}[parameters.value.quality]}`)
/** 问题卡内明确选项使用回答接口；底部自由输入仍作为需求修订，两个入口不混用。 */
function chooseAnswer(option:string){
  if(planningBusy.value||stoppingAssistant.value)return
  if(planning.value?.question?.options?.includes(option)&&isQuestionUploadOption(option)){chooseQuestionFile();return}
  // 只有服务器提供且用户明确点击的切换项才改变技能，保留已有需求和有效素材。
  const nextSkill=catalog.value?.skills.find(item=>option==='切换到「'+item.label+'」')
  if(nextSkill&&planning.value?.question?.options?.includes(option)){
    void switchQuestionSkill(nextSkill.id)
    return
  }
  if(planning.value?.question?.kind==='multiple'){
    selectedAnswers.value=selectedAnswers.value.includes(option)?selectedAnswers.value.filter(item=>item!==option):[...selectedAnswers.value,option]
  }else void answerPlanning(option)
}
/** 卡片已完成多选汇总时直接提交；单选保留上传和技能切换的原业务分支。 */
function submitStandaloneAnswer(value:string){
  if(planning.value?.question?.kind==='multiple')void answerPlanning(value)
  else chooseAnswer(value)
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
watch(()=>`${planning.value?.id}:${planning.value?.calls}:${planning.value?.question_revision}`,()=>{selectedAnswers.value=[];questionInputExpanded.value=false})

const historyElement=ref<HTMLElement|null>(null),followLatest=ref(true)
const historyContentElement=ref<HTMLElement|null>(null)
let historyDetailsBrowsing=false
let historyResizeObserver:ResizeObserver|undefined,historyScrollFrame=0
/** 挂载及异步排版完成后再定位；不在骨架阶段对不存在的消息容器滚动。 */
function scrollHistoryBottom(force=false){
  if(force){historyDetailsBrowsing=false;followLatest.value=true}
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
const {items:canvasActivity,error:canvasActivityError,reload:reloadCanvasActivity}=useCanvasActivity(()=>session.value?.id)
const canvasExtractionId=ref('')
watch(()=>session.value?.id,()=>{canvasExtractionId.value=''},{flush:'sync'})
// 画布已经核对过当前文稿和提取回执；历史列表只是读取这些既有记录。
function refreshCanvasActivity(extractionId:string){
  canvasExtractionId.value=extractionId
  void reloadCanvasActivity()
}
/** 手机端先显示画布，避免在隐藏容器上计算取景。 */
async function locateCanvasActivity(id:string){
  mobilePane.value='canvas'
  await nextTick()
  await agentCanvasRef.value?.locateExtraction(id.slice('extraction:'.length))
}
const conversationRows=computed(()=>groupConversation(messages.value,assistantHistory.value,planning.value,session.value?.id,canvasActivity.value))
// 自动接续属于同一需求，保持真实阶段顺序，不重复开启助手回答。
const conversationAnswers=computed(()=>continuousAnswers(conversationRows.value))
const dramaReceipts=ref<Record<string,string>>({})
const currentDramaRuns=computed(()=>[...conversationAnswers.value].reverse().find(answer=>answer.rows.some(row=>!row.activity))?.rows.flatMap(row=>row.run?[row.run]:[])||[])
const currentDramaIds=computed(()=>new Set(currentDramaRuns.value.map(run=>run.id)))
const dramaSteps=computed(()=>dramaProgressRows(currentDramaRuns.value,dramaReceipts.value))
watch(()=>session.value?.id,()=>{dramaReceipts.value={}},{flush:'sync'})
/** 只接纳当前连续需求中的同一修订，防止迟到请求改写新需求的进度。 */
function rememberDramaReceipt(runId:string,revision:string,status:string){
  if(currentDramaRuns.value.some(run=>run.id===runId&&run.drama_action?.revision===revision))
    dramaReceipts.value[runId+':'+revision]=status
}
/** 内容增长引发的滚动事件不代表用户上翻；只有真实向上输入才暂停跟随。 */
function browseHistoryDetails(){historyDetailsBrowsing=true;followLatest.value=false}
function trackHistory(){const el=historyElement.value;if(el)followLatest.value=nextHistoryFollow(followLatest.value,el.scrollHeight-el.scrollTop-el.clientHeight,false,historyDetailsBrowsing)}
function historyWheel(event:WheelEvent){historyDetailsBrowsing=false;if(event.deltaY<0)followLatest.value=false}
function historyKey(event:KeyboardEvent){
  const target=event.target as HTMLElement
  if(target.closest('input,textarea,[contenteditable=true]'))return
  if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))historyDetailsBrowsing=false
  if(['ArrowUp','PageUp','Home'].includes(event.key)||(event.key===' '&&event.shiftKey))followLatest.value=false
}
let historyTouchY=0
function historyTouchStart(event:TouchEvent){historyDetailsBrowsing=false;historyTouchY=event.touches[0]?.clientY||0}
function historyTouchMove(event:TouchEvent){const y=event.touches[0]?.clientY||0;if(y>historyTouchY)followLatest.value=false;historyTouchY=y}
function historyScrollbar(event:PointerEvent){if(event.target===historyElement.value){historyDetailsBrowsing=false;followLatest.value=false}}
function latest(){const el=historyElement.value;if(el){historyDetailsBrowsing=false;el.scrollTo({top:el.scrollHeight,behavior:'smooth'});followLatest.value=true}}
watch(()=>[conversationRows.value.length,allResults.value.length,planning.value?.status,planning.value?.stream_text,planning.value?.stream_seq,planning.value?.card?.text],async()=>{await nextTick();scrollHistoryBottom()},{flush:'post'})
/** 切换会话时清除本页瞬时状态；历史记录留在原会话，旧异步响应由 epoch 隔离。 */
watch(()=>session.value?.id,(id,previous)=>{
  if(id===previous||planning.value?.session_id===id)return
  historyDetailsBrowsing=false
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
    if(!route.query.run&&!planning.value&&latest&&(latest.drama_action?.status==='awaiting_confirmation'||latest.continuation?.enabled||hasSubmittedVideoPlan(latest)||hasSubmittedImagePlan(latest)||hasUnsubmittedImagePlan(latest)||(!latest.executed_request&&(['waiting','planning','ready'].includes(latest.status)||hasUnsubmittedVideoPlan(latest))))){
      planning.value=latest;assistantDraft=JSON.stringify(latest.draft)
    }
  }catch{/* 助手历史加载失败不阻断媒体作品。 */}
})
const rulesOpen=ref(false),rulesBusy=ref(false),rulesRevision=ref(0),rulesLoaded=ref(false),rulesError=ref('')
// 页面只发现后端已创建的下一轮，绝不通过轮询请求规划、报价或生成。
let continuationRefreshBusy=false
let continuationRefresh:ReturnType<typeof setInterval>|undefined
onMounted(()=>{continuationRefresh=setInterval(async()=>{
  const id=session.value?.id,current=planning.value
  if(!id||!current||continuationRefreshBusy||planningBusy.value||busy.value||document.hidden)return
  if(!current.continuation?.enabled||['paused','superseded','failed','limit'].includes(current.continuation.status))return
  continuationRefreshBusy=true
  try{
    const updated=await creationService.run(current.id)
    if(session.value?.id!==id||planning.value?.id!==current.id)return
    // 只读取接续编号，不每五秒重签整段历史素材URL，避免图片重载闪烁。
    // 同一轮既存在于历史列表又作为活动轮：必须同步真实终态后再切下一阶段，
    // 否则历史副本永久保留planning，累计用时与画布任务列表会一直增长。
    applyAssistantState(updated)
    assistantHistory.value=assistantHistory.value.map(run=>run.id===updated.id?updated:run)
    const key=updated.continuation?.child_id
    if(key){
      const child=await creationService.run(key)
      if(session.value?.id!==id||planning.value?.id!==current.id)return
      if(child.auto_continuation?.parent_id===current.id){
        if(!assistantHistory.value.some(run=>run.id===child.id))assistantHistory.value.push(child)
        planning.value=child;assistantDraft=JSON.stringify(child.draft)
      }
    }
  }catch{/* 自动发现失败保留当前作品，下一周期重读，不重发任务。 */}
  finally{continuationRefreshBusy=false}
},5000)})
onBeforeUnmount(()=>clearInterval(continuationRefresh))
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
  // 自动接续轮首次发现时已进入历史列表；公开流式更新同步同身份副本，不复制新回答。
  assistantHistory.value=assistantHistory.value.map(run=>run.id===state.id?state:run)
}
// 监听原始值而非每次新建数组；正文快照更新不能反复重建 SSE 连接并触发限流。
watch([()=>planning.value?.id,()=>planning.value?.status],([id,status])=>{
  assistantStream?.abort()
  if(!id||status!=='planning')return
  // 确定性合成确认没有新模型调用；由POST返回原业务结果，不订阅不存在的下一次模型计数。
  if(planning.value?.awaiting_calls===planning.value?.calls)return
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
async function changeConfirmationRule(enabled:boolean,kind=confirmationRuleKind.value){
  const id=session.value?.id
  if(!id||!rulesLoaded.value||rulesBusy.value||busy.value)return
  stopCountdown();rulesBusy.value=true;rulesError.value=''
  const next={...rules.value,[kind]:enabled}
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
const awaitingDecision=computed(()=>awaitingCreationDecision(planning.value,messages.value.some(item=>!!item.task_id&&item.content.parameters.extra?.creation_run_id===planning.value?.id)))
// 只改变输入区进行态，不把等待用户误算成在途请求，否则会锁住问题卡与修改入口。
const canStopWork=computed(()=>assistantInteractionState.value.canStop||awaitingDecision.value&&!busy.value&&!stoppingAssistant.value||!!planning.value?.continuation?.enabled&&planning.value.continuation.status!=='paused')
const assistantAccepted=ref(false)
const proposalQuoteBusy=ref(false),proposalQuoteError=ref(''),proposalCancelBusy=ref(false)
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
  if(skill.value.startsWith('mv-')){
    if(files.length!==1||!audio){error.value='MV 请选择一个音频文件，本轮不支持图片视觉参考。';return}
    if(!audioUpload.value)await loadAudioConfig()
    if(!audioUpload.value){error.value='请重试读取音频上传限制。';return}
    if(audio.size>audioUpload.value.max_bytes||!audioUpload.value.extensions.includes(audio.name.split('.').at(-1)?.toLowerCase()||'')){error.value=audioUploadHint.value;return}
    const previous=[...references.value]
    await upload(files)
    const added=references.value.find(item=>!previous.some(old=>old.version_id===item.version_id))
    if(added){
      // 上传成功才切换歌曲，失败继续保留原来源；新歌曲不得继承旧歌词和片段。
      references.value=[added];roundReferences.value=[]
      patchParameters({rightsConfirmed:false,sourceTask:'',extra:{...parameters.value.extra,mv_song_version:'',mv_lyrics:'',mv_lyrics_source:'',mv_instrumental:false,mv_range_mode:'whole',mv_start_sec:0,mv_end_sec:undefined,mv_audio_duration_sec:undefined}})
    }
    return
  }
  await upload(files)
}
const mvSource = ref(''), mvUrl = ref('')
const mvPickerOpen=ref(false)
const mvSourceMode=ref<'owned'|'link'|'upload'>('owned')
const mvUploadFile=ref<File|null>(null)
const audioUpload=ref<{extensions:string[];max_bytes:number}|null>(null),audioConfigError=ref('')
let audioConfigEpoch=0
const audioUploadHint=computed(()=>audioUpload.value?`支持 ${audioUpload.value.extensions.map(e=>e.toUpperCase()).join('、')}，单文件不超过 ${Number((audioUpload.value.max_bytes/1048576).toFixed(2))}MiB`:'')
/** 提示只来自实际部署配置；读取失败不展示猜测值，上传前必须重试。 */
async function loadAudioConfig(){
  const token=++audioConfigEpoch,owner=auth.session.user?.id;audioConfigError.value='';audioUpload.value=null
  try{const value=(await libraryService.configuration()).audio_upload;if(!value||!value.extensions.length||value.max_bytes<=0)throw new Error('暂未取得音频上传限制');if(token===audioConfigEpoch&&owner===auth.session.user?.id)audioUpload.value=value}catch(cause){if(token===audioConfigEpoch&&owner===auth.session.user?.id)audioConfigError.value=(cause as Error).message}
}
watch(mvPickerOpen,value=>{if(value)void loadAudioConfig()})
watch(()=>skill.value,code=>{if(code.startsWith('mv-')&&!audioUpload.value)void loadAudioConfig()},{immediate:true})
// 暂存随已有账号隔离草稿保存，刷新不丢失 MV 创意及已选歌曲；不建立平行会话。
const savedMvDraft=computed(()=>(parameters.value.extra.mv_return_draft||null) as {content:CreationDraft;references:ComposerReference[]}|null)
/** 快捷入口只切换技能，不发送、不创建歌曲；返回时恢复原 MV 内容和固定歌曲。 */
function openMusicGeneration(){
  const content=JSON.parse(JSON.stringify(draft())) as CreationDraft;delete content.parameters.extra.mv_return_draft
  const saved={content,references:JSON.parse(JSON.stringify(mergeRoundReferences(roundReferences.value,references.value)))}
  mvPickerOpen.value=false;setSkill('song');setText('',[]);references.value=[];roundReferences.value=[]
  patchParameters({extra:{...parameters.value.extra,mv_return_draft:saved}})
}
function returnToMv(){const saved=savedMvDraft.value;if(!saved)return;setSkill(saved.content.skill);setText(saved.content.prompt,saved.content.segments);references.value=saved.references;patchParameters({...saved.content.parameters,extra:{...saved.content.parameters.extra,mv_return_draft:undefined}})}
const mvAlignmentDraft=computed(()=>({...draft(),references:references.value.some(r=>r.media_type==='audio')?references.value:roundReferences.value}))
function confirmMvLyrics(extra:Record<string,unknown>){patchParameters({extra:{...parameters.value.extra,...extra}});if(extra.mv_alignment_confirmation&&planning.value?.status==='ready')void quoteAssistantPlan(false)}
/** 来源互斥：切换时清空另一种输入，只允许一个明确的提交来源。 */
watch(mvSourceMode,mode=>{if(mode!=='link')mvUrl.value='';if(mode!=='owned')mvSource.value='';if(mode!=='upload')mvUploadFile.value=null})
const validMvLink=computed(()=>{try{const url=new URL(mvUrl.value.trim());return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password}catch{return false}})
const canUseMvSource=computed(()=>!busy.value&&(mvSourceMode.value==='owned'?!!mvSource.value:mvSourceMode.value==='link'?validMvLink.value:!!mvUploadFile.value))
/** 上传复用原有固定版本链路；失败保留弹窗和文件，成功后才收起。 */
async function confirmMvSource(){
  if(!canUseMvSource.value)return
  if(mvSourceMode.value==='owned')await selectMvSong()
  else if(mvSourceMode.value==='link')await importMvUrl()
  else if(mvUploadFile.value){
    const limits=audioUpload.value,file=mvUploadFile.value
    if(!limits){error.value='请先重试读取音频上传限制。';return}
    if(!limits.extensions.includes(file.name.split('.').at(-1)?.toLowerCase()||'')||file.size>limits.max_bytes){error.value=audioUploadHint.value;return}
    const previous=references.value[0]?.version_id
    // upload 自行设置 busy，不能提前置忙使其入口直接返回。
    await receiveFiles([mvUploadFile.value])
    if(references.value[0]?.version_id!==previous){mvPickerOpen.value=false;mvUploadFile.value=null}
  }
}
/** 已生成歌曲保存真实音频版本；歌词由制作准备接口读取，不再维护第二套独立歌词表单。 */
async function selectMvSong() {
  if(!mvSource.value || busy.value)return false
  const selection=mvSource.value,sid=session.value?.id,owner=draftOwner.value,stamp=JSON.stringify(draft())
  busy.value=true
  try {
    const [taskId,index]=selection.split(':')
    const item=await libraryService.saveResult('music',taskId!,index,'other')
    // 保存来源可能跨网络等待，切换账号/会话或修改草稿后不得回填迟到的旧歌曲。
    if(sid!==session.value?.id||owner!==draftOwner.value)return false
    if(selection!==mvSource.value||stamp!==JSON.stringify(draft())){error.value='草稿或歌曲选择已变化，未替换当前素材，请重新选择。';return false}
    const version=item.versions[0]
    if(!version)throw new Error('歌曲尚未形成可用的固定音频版本。')
    const songs=(musicTasks.value.find(task=>task.id===taskId)||(sourceTask.value?.id===taskId?sourceTask.value:undefined))?.result.music
    const song=Array.isArray(songs)?songs[Number(index)] as Record<string,unknown> | undefined:undefined
    const extra={...parameters.value.extra}
    for(const key of ['creation_run_id','mv_run_id','director_run_id'])delete extra[key]
    // 显式选择只固定本次制作来源，不再记录或伪造授权勾选；兼容旧草稿字段置为 false。
    patchParameters({sourceTask:selection,rightsConfirmed:false,extra:{...extra,mv_song_version:version.id,mv_lyrics:String(song?.lyrics||''),mv_lyrics_source:'song',mv_range_mode:'whole',mv_instrumental:false,mv_audio_duration_sec:version.media.duration_sec,mv_start_sec:0,mv_end_sec:undefined}})
    references.value=[{item_id:item.id,version_id:version.id,purpose:'reference',name:String(song?.title||item.name),media_type:'audio',preview_url:libraryService.previewUrl(version.preview_url),cover_url:String(song?.image_large_url||song?.image_url||'')}];roundReferences.value=[]
    patchParameters({extra:{...parameters.value.extra,mv_alignment_id:'',mv_alignment_confirmation:''}})
    mvPickerOpen.value=false
    return true
  }catch(cause){if(sid===session.value?.id&&owner===draftOwner.value)error.value=(cause as Error).message;return false}finally{busy.value=false}
}
async function importMvUrl(){
  if(busy.value || !validMvLink.value)return
  busy.value=true
  try{const item=await creationService.importAudio(mvUrl.value.trim());const version=item.versions[0]!;patchParameters({sourceTask:'',rightsConfirmed:false,extra:{...parameters.value.extra,mv_song_version:'',mv_lyrics:'',mv_lyrics_source:'',mv_instrumental:false,mv_range_mode:'whole',mv_start_sec:0,mv_end_sec:undefined,mv_audio_duration_sec:version.media.duration_sec}});references.value=[{item_id:item.id,version_id:version.id,purpose:'reference',name:item.name,media_type:'audio',preview_url:libraryService.previewUrl(version.preview_url)}];mvPickerOpen.value=false}catch(cause){error.value=(cause as Error).message}finally{busy.value=false}
}
/** 规划请求显式触发，刷新只读取状态，不重新调用文字模型或生成。 */
// 已接收参考与输入框分离；用户可明确移除，下一轮提交完整有效集合。
const roundReferences = ref<ComposerReference[]>([])
watch(()=>mvAlignmentDraft.value.references[0]?.version_id,(next,previous)=>{
  // 发送后移入本轮参考仍是同一版本；只有真正换歌或移除才撤销歌词确认。
  if(previous&&next!==previous)patchParameters({extra:{...parameters.value.extra,mv_alignment_id:'',mv_alignment_confirmation:''}})
})
watch(() => session.value?.id, id => {
  // 首次发送由服务端分配会话号，不是切换需求；不能因此清掉刚接收的参考。
  if(planning.value?.session_id!==id)roundReferences.value=[]
})
const roundRun=computed(()=>planning.value||assistantHistory.value.at(-1))
watch(() => [roundRun.value?.id,parameters.value.extra.round_reference_state,skill.value,explicitSkillBoundary.value], () => {
  const run=roundRun.value
  if(!run||explicitSkillBoundary.value||![run.draft.skill||'free',run.card?.skill].includes(skill.value||'free')){roundReferences.value=[];return}
  // 刷新后从服务端授权预览恢复本轮固定版本，不触发上传或生成。
  const saved=parameters.value.extra.round_reference_state as {run_id?:string;versions?:string[]}|undefined
  roundReferences.value=run.draft.references.filter(reference=>saved?.run_id!==run.id||!Array.isArray(saved.versions)||saved.versions.includes(reference.version_id)).map(reference=>{
    const preview=run.reference_previews?.[reference.version_id]
    return {...reference,name:preview?.name||run.draft.reference_names[reference.version_id]||'参考素材',media_type:preview?.media_type||'',preview_url:libraryService.previewUrl(preview?.preview_url||'')}
  })
})
/** 移除只改变下一轮输入并撤销旧报价，不删除资料库或历史消息。 */
function removeRoundReference(version:string){
  roundReferences.value=roundReferences.value.filter(item=>item.version_id!==version)
  confirmation.value=null;assistantAccepted.value=false
  patchParameters({extra:{...parameters.value.extra,round_reference_state:{run_id:roundRun.value?.id,versions:roundReferences.value.map(item=>item.version_id)}}})
}
async function continuePendingPlanning(){
  if(!planning.value||planningBusy.value||planning.value.calls)return
  planningBusy.value=true
  try{applyAssistantState(await creationService.advanceRun(planning.value.id))}
  catch(cause){error.value=(cause as Error).message}finally{planningBusy.value=false}
}
const previewSaveBusy=ref(false)
async function confirmDirector(){
  const preview=director.value,id=preview?.mv_run_id||preview?.director_run_id
  if(!preview||!id||busy.value||previewSaveBusy.value)return
  previewSaveBusy.value=true
  const script=preview.script,title=preview.title
  try{
    const saved=await creationService.savePreview(id,preview)
    if(director.value!==preview||preview.script!==script||preview.title!==title){error.value='脚本在保存期间改变，请再次确认。';return}
    preview.preview_revision=saved.preview_revision
    directorAccepted.value=true
    await prepare()
  }catch(cause){error.value=(cause as Error).message}finally{previewSaveBusy.value=false}
}
const refiningPrompt=ref(false)
/** 星芒仅优化当前草稿；用户中途改字、换账号/会话/素材时丢弃迟到结果，不导航。 */
async function refineComposerPrompt(){
  if(refiningPrompt.value||planningBusy.value||busy.value||!prompt.value.trim()||!requireLogin())return
  if(uploads.value.length){error.value='请先等待素材上传完成。';return}
  const original=JSON.stringify(draft()),owner=auth.session.user?.id,sid=session.value?.id
  refiningPrompt.value=true;error.value=''
  try{
    const result=await creationService.refinePrompt(JSON.parse(original))
    if(owner!==auth.session.user?.id||sid!==session.value?.id||original!==JSON.stringify(draft()))return
    setText(result.prompt,[{type:'text',text:result.prompt}])
    notice.value='提示词已优化，可修改后发送。'
  }catch(cause){if(owner===auth.session.user?.id&&sid===session.value?.id)error.value=(cause as Error).message||'优化未完成，原文已保留。'}
  finally{refiningPrompt.value=false}
}
async function planDemand(options?:{mode?:'chat'|'skill'}) {
  if(!requireLogin())return
  if(planning.value?.collection_stage?.status==='collecting'&&!explicitSkillBoundary.value){await sendStageText();return}
  if(styleConflictBusy.value)return
  if(safetyDirectBusy.value&&!pendingSafetySource)return
  if (planningBusy.value || stoppingAssistant.value || planning.value?.status==='planning' || !prompt.value.trim()) return
  if(uploads.value.length){error.value=`请先完成或移除上传：${uploads.value.map(item=>item.name).join('、')}`;return}
  // 续作仅在明确冲突时处理残留风格。手动风格先确认，取消不改草稿或历史作品。
  const prior=planning.value||assistantHistory.value.at(-1)
  if(continuationStyleConflict(parameters.value.style,prompt.value,prior?.generation_prompt||prior?.draft.prompt||'')){
    const style=parameters.value.style,owner=auth.session.user?.id,sid=session.value?.id,typed=prompt.value
    // 确认只属于弹窗打开时的完整草稿；等待中换技能、规格、素材或轮次，不可沿用旧确认继续发送。
    const confirmationContext=()=>JSON.stringify([assistantEpoch,planning.value?.id,skill.value,entry.value,parameters.value,references.value])
    const contextSnapshot=confirmationContext()
    const manual=(parameters.value.extra.user_parameter_keys as string[]||[]).some(key=>['style','styleId'].includes(key))
    if(manual){
      styleConflictBusy.value=true
      try{if(!await confirmHomeAction(`当前手动风格“${style}”与本轮画面要求冲突。确认将清除该标签并按本轮需求继续；取消保留当前草稿。`,'确认续作风格'))return}
      finally{styleConflictBusy.value=false}
    }
    if(owner!==auth.session.user?.id||sid!==session.value?.id||typed!==prompt.value||parameters.value.style!==style||contextSnapshot!==confirmationContext())return
    patchParameters({style:'',styleId:''})
  }
  scrollHistoryBottom(true)
  // 修复历史“图片入口＋自由创作”草稿，不能让合法自由对话被入口校验挡住。
  entry.value=conversationEntry(entry.value,skill.value)
  // 新需求撤销旧报价及许可，技能边界只来自用户主动选择，不包含助手推荐。
  stopCountdown();confirmation.value=null;error.value=''
  const sid=session.value?.id,previous=planning.value||assistantHistory.value.at(-1)
  const boundary=explicitSkillBoundary.value||parameters.value.extra.requirement_boundary===true
  const parent=!boundary&&previous&&previous.session_id===sid&&[previous.draft.skill||'free',previous.card?.skill].includes(skill.value||'free')?previous.id:null
  const sentReferences=[...references.value]
  const effectiveReferences=boundary?sentReferences:mergeRoundReferences(roundReferences.value,sentReferences)
  const requestDraft=JSON.parse(JSON.stringify(draft())) as CreationDraft
  const extra:Record<string,unknown>={...requestDraft.parameters.extra,references_explicit:true}
  requestDraft.references=effectiveReferences.map(({item_id,version_id,purpose,start,end})=>({item_id,version_id,purpose,start,end}))
  requestDraft.reference_names=Object.fromEntries(effectiveReferences.map(item=>[item.version_id,item.name]))
  for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool','requirement_boundary','safety_repair_source','safety_repair_edited'])delete extra[key]
  if(pendingSafetySource){extra.safety_repair_source=pendingSafetySource;extra.safety_repair_kind=pendingSafetyKind;extra.safety_repair_edited=pendingSafetyEdited;pendingSafetySource='';pendingSafetyEdited=false}
  requestDraft.parameters={...requestDraft.parameters,extra}
  assistantAccepted.value=false;assistantDraft=JSON.stringify(draft())
  const epoch=++assistantEpoch
  const requestId=crypto.randomUUID()
  // 在调用前固定本次选择；发送期间重新选择文稿不被旧响应清除。
  const sourceSelection=pendingStoryboardSource.value
  let acceptedId=''
  /** 接收与清理只作用于同一请求快照，连接恢复也走这一条路径。 */
  function acceptStarted(started:CreationRun){
    acceptedId=started.id
    if(planning.value&&planning.value.id!==started.id)assistantHistory.value=[...assistantHistory.value.filter(item=>item.id!==planning.value!.id),planning.value]
    planning.value=started;roundReferences.value=effectiveReferences
    if(pendingStoryboardSource.value===sourceSelection)pendingStoryboardSource.value=null
    references.value=remainingReferences(references.value,sentReferences)
    if(prompt.value===requestDraft.prompt)setText('',[])
    else setText(prompt.value,submittedTextSegments(segments.value,references.value))
    assistantDraft=JSON.stringify(draft());userInitiatedRun=started.id
  }
  planningBusy.value=true
  try {
    const started=await creationService.startRun(requestDraft,requestId,sid,undefined,parent,options?.mode,undefined,sentReferences.map(item=>item.version_id),sourceSelection?{node_id:sourceSelection.node_id,revision:sourceSelection.revision}:undefined)
    if(epoch!==assistantEpoch||!sameRunScope(sid,session.value?.id,started.session_id))return
    explicitSkillBoundary.value=false
    if(parameters.value.extra.requirement_boundary){const extra={...parameters.value.extra};delete extra.requirement_boundary;patchParameters({extra})}
    acceptStarted(started)
    await routerRun(started.id,started.session_id)
    // 新需求统一交给 Agent 分析完整输入并按缺失信息补问，不按商品入口预建固定问卷。
    // 已存在的 collection_stage 仍由原回答与恢复分支处理，不改写历史问答或生成授权。
    const result=await creationService.advanceRun(started.id)
    if(epoch===assistantEpoch&&sameRunScope(sid,session.value?.id,started.session_id)){applyAssistantState(result);if(prompt.value===started.draft.prompt)setText('',[])}
  } catch(cause){if(epoch===assistantEpoch&&sameRunScope(sid,session.value?.id,planning.value?.session_id)){
    // 创建成功但响应中断只读取原流程，不能重放创建或扣费请求。
    try{
      const state=acceptedId?await creationService.run(acceptedId):await creationService.runByRequest(requestId)
      if(epoch===assistantEpoch&&sameRunScope(sid,session.value?.id,state.session_id)){
        if(!acceptedId)acceptStarted(state)
        applyAssistantState(state);await routerRun(state.id,state.session_id)
      }
    }catch{/* 未接收时保留输入；不重放创建请求。 */}
    // 业务拒绝不能伪装成断线，否则用户会一直重试同一个无效请求。
    const status=Number((cause as {statusCode?:number}).statusCode||0)
    error.value=status>=400&&status<500?(cause as Error).message:'响应连接中断，已保留原流程和输入；可刷新状态后继续，未重复提交生成。'
  }} finally{if(epoch===assistantEpoch)planningBusy.value=false}
}
/** 用户明确切换技能才清空隐式上下文，历史消息与产物仍保留在原会话。 */
function selectUserSkill(id:string){
  if(workInProgress.value)return
  // 显式选择广告短片回到直接流程；恢复历史和应用模板不经过此分支。
  const workflow=selectedSkillWorkflow(catalog.value?.skills.find(item=>item.id===id))
  const workflowChanged=!!workflow&&workflow!==parameters.value.workflow
  if(id===skill.value&&!workflowChanged)return
  // 空技能和 free 是同一自由入口，模型分类归一不能清掉已选参考图。
  if((id||'free')===(skill.value||'free')&&!workflowChanged){setSkill(id);return}
  explicitSkillBoundary.value=true;stopCountdown();confirmation.value=null
  if(workflowChanged){director.value=null;directorAccepted.value=false}
  const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool','round_reference_state'])delete extra[key]
  roundReferences.value=[];references.value=[];entry.value=conversationEntry(entry.value,id);patchParameters({extra:{...extra,requirement_boundary:true}});setSkill(id)
  if(workflow)patchParameters({workflow})
}
async function routerRun(id: string,sid?:string|null) { await navigateTo({path:'/dashboard',query:{...route.query,...(sid?{session:sid}:{}),run:id}}) }
/** 个人风格与平台风格分别提交：仅固定素材版本，不把封面URL或名称当注册风格合同。 */
async function answerStyleReference(item:LibraryItem) {
  const version=item.versions[0]
  if(!version||item.media_type!=='image'||item.category!=='style')return
  const reference:ComposerReference={item_id:item.id,version_id:version.id,purpose:'reference',name:item.name,media_type:'image',preview_url:libraryService.previewUrl(version.preview_url)}
  await answerPlanning(`选择个人风格参考：${item.name}`,undefined,[reference],undefined,undefined,reference)
}
async function answerPlanning(answer: string,fieldAnswers?:Record<string,string>,questionReferences:ComposerReference[]=[],visualStyleId?:string,visualStyleVersion?:number,visualStyleReference?:ComposerReference) {
  if (!planning.value || planningBusy.value || !answer.trim()) return
  scrollHistoryBottom(true)
  const epoch=++assistantEpoch,run=planning.value,currentDraft=draft()
  // 旧问题卡属于自己的原始技能；不能因为工具栏暂留其他技能而触发后端草稿校验错误。
  const baseDraft=currentDraft.skill===run.draft.skill?currentDraft:run.draft
  // 问题素材只进入本次回答快照；不依赖工具栏当前技能，也不覆盖其他已固定的输入引用。
  const answerReferences=mergeRoundReferences(baseDraft.references as ComposerReference[],mergeRoundReferences(mergeRoundReferences(roundReferences.value,references.value),questionReferences))
  const answerDraft={...baseDraft,references:answerReferences.map(({item_id,version_id,purpose,start,end})=>({item_id,version_id,purpose,start,end})),reference_names:{...baseDraft.reference_names,...Object.fromEntries(answerReferences.filter(item=>item.name).map(item=>[item.version_id,item.name]))}}
  userInitiatedRun=run.id
  planningBusy.value=true;pendingUserAnswer.value=answer;pendingQuestionForm.value=!!run.question||fieldAnswers!==undefined||questionReferences.length>0;pendingAnswerBaseCount.value=run.answers?.length||0;error.value='';proposalQuoteError.value=''
  // 后续轮次同样订阅正文；最小调用序号隔离上一轮尚未更新的 waiting 快照。
  const directComposition=!!fieldAnswers&&run.question?.fields?.some(field=>/^compose_[a-f0-9]{32}$/.test(field.id)&&Object.prototype.hasOwnProperty.call(fieldAnswers,field.id))
  planning.value={...run,status:'planning',stream_text:'',response_phase:'queued',card:undefined,awaiting_calls:run.calls+(directComposition?0:1)}
  try {
    // 问卷确定携带字段答案；底部聊天仍只有文字，不把真实表单提交误判为插话后撤回答案。
    const value=await creationService.answerRun(run.id,run.calls,answer,run.question_revision,answerDraft,fieldAnswers,questionReferences.length>0&&!visualStyleReference,visualStyleId,visualStyleVersion,visualStyleReference?{item_id:visualStyleReference.item_id,version_id:visualStyleReference.version_id,purpose:visualStyleReference.purpose}:undefined)
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
  }} finally{if(epoch===assistantEpoch){planningBusy.value=false;pendingUserAnswer.value='';pendingQuestionForm.value=false;pendingAnswerBaseCount.value=null}}
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
      const value=await creationService.cancelRun(id,'composer_stop')
      if(cancelEpoch!==assistantEpoch||cancelSession!==session.value?.id)return
      planning.value=value
      // 停止不覆盖用户新输入；只有空输入框才恢复本次已发送需求供后续编辑。
      if(!prompt.value.trim()){const text=value.draft.original_prompt??value.draft.prompt;setText(text,[{type:'text',text}])}
    }
    director.value=null;directorAccepted.value=false
    const extra={...parameters.value.extra};delete extra.creation_run_id;delete extra.mv_run_id;delete extra.director_run_id
    // 停止只清理流程关联，不切换能力、不校验或改写用户的模型质量与其他收费参数。
    parameters.value={...parameters.value,extra}
    // 清除恢复入口，刷新不会再次打开已取消的脚本。
    const query={...route.query};delete query.run
    await navigateTo({path:'/dashboard',query})
  } catch(cause){if(cancelEpoch===assistantEpoch)error.value='停止请求未被服务端确认，请点击停止重试；任务状态尚未改变。'} finally{if(cancelEpoch===assistantEpoch){planningBusy.value=false;stoppingAssistant.value=false}}
}
async function confirmVideoSwitch() {
  const value=videoSwitch.value;if(!value)return
  if(!await continueImage(value.batch,value.result,true))return
  if(!error.value){setText(value.text,[{type:'text',text:value.text}]);videoSwitch.value=null}
}
const templates = computed<CreationTemplate[]>(() => {
  // 统一读取已落库上架模板，避免本地演示预设与旧商品模板混在一起。
  return (catalog.value?.templates || []).map(item => ({ ...item, cover: item.cover.startsWith('/creation-presets/') || item.cover.startsWith('http') ? item.cover : siteAsset(item.cover) }))
})
// MV 三种导演配方沿用各自提示指导，共用制作链，不按名称隐藏真实技能。
const recommendedSkills = computed(() => quickRecommendedSkills(catalog.value?.skills || [],entry.value).map(item=>item.id==='song'?{...item,label:'音乐生成'}:item))
const selectedSkillPreview=ref<SystemSkill|null>(null)
const skillPromptHistory=ref<PromptUndoEntry[]>([])
/** 示例素材在点击试用时才进入草稿，可移除、可撤销，不写入个人素材库或自动执行。 */
function applySkillPrompt(row:SystemSkill){
  const parts=skillExampleParts(row),text=parts.map(part=>part.text).join('')
  if(!text.trim())return
  const beforeCount=parameters.value.count
  // 图片示例的明确张数同步到真实预算；视频中的“张”不改变视频任务数量。
  const count=row.target==='image'?trialImageCount(text,parameters.value.count,false):parameters.value.count
  const before={prompt:prompt.value,segments:segments.value}
  const beforeExampleIds=(parameters.value.extra.skill_example_version_ids||[]) as string[]
  const samples=skillTrialReferences(row,references.value,beforeExampleIds)
  const beforeStyle={style:parameters.value.style,styleId:parameters.value.styleId}
  const explicitStyle=(parameters.value.extra.user_parameter_keys as string[]||[]).some(key=>['style','styleId'].includes(key))
  // 示例已有明确风格时清除继承的默认卡通标签；用户显式风格由试用前的确认处理。
  const clearStyle=/视觉风格|画面风格|商业摄影/.test(text)&&!explicitStyle
  const afterStyle=clearStyle?{style:'',styleId:''}:beforeStyle
  const after={prompt:text,segments:parts}
  const history=pushPromptUndo(skillPromptHistory.value,before,after)
  // 文字相同时仍记录素材替换，不能使“撤销”漏掉刚插入的示例图。
  const changed=JSON.stringify(references.value.map(ref=>ref.version_id))!==JSON.stringify(samples.references.map(ref=>ref.version_id))||clearStyle&&!!beforeStyle.style||count!==beforeCount
  const next=history===skillPromptHistory.value&&changed?[...history,{before,after}].slice(-100):history
  if(next!==skillPromptHistory.value&&next.length)next[next.length-1]!.trial={beforeReferences:references.value.map(ref=>({...ref})),afterVersions:samples.references.map(ref=>ref.version_id),beforeExampleIds,afterExampleIds:samples.exampleIds,beforeStyle,afterStyle,beforeCount,afterCount:count}
  skillPromptHistory.value=next
  references.value=samples.references
  patchParameters({...afterStyle,count,extra:{...parameters.value.extra,skill_example_version_ids:samples.exampleIds}})
  setText(text,parts)
}
/** 素材失效先阻止替换；手动风格冲突明确询问，不静默覆盖用户选择。 */
async function validateSkillTrial(row:SystemSkill){
  skillTrialReferences(row,references.value,(parameters.value.extra.skill_example_version_ids||[]) as string[])
  // 必须在切换技能或清除手动风格前预检；超限或手动冲突保留完整原草稿。
  if(row.target==='image')trialImageCount(skillExampleParts(row).map(part=>part.text).join(''),parameters.value.count,(parameters.value.extra.user_parameter_keys as string[]||[]).includes('count'))
  const explicit=(parameters.value.extra.user_parameter_keys as string[]||[]).some(key=>['style','styleId'].includes(key))
  if(explicit&&parameters.value.style&&/视觉风格|画面风格|商业摄影/.test(skillExampleParts(row).map(part=>part.text).join(''))){
    if(!await confirmHomeAction(`示例含有画面风格要求，你已手动选择“${parameters.value.style}”。是否清除该风格并使用示例？`,'确认示例风格'))return false
    const keys=(parameters.value.extra.user_parameter_keys as string[]||[]).filter(key=>!['style','styleId'].includes(key))
    patchParameters({extra:{...parameters.value.extra,user_parameter_keys:keys}})
  }
  return true
}
const canUndoSkillPrompt=computed(()=>skillPromptHistory.value.length>0&&!workInProgress.value&&!loading.value&&!directoryTrialBusy.value&&!cloudDraft.restoring.value)
// 手动修改后的Ctrl+Z先交给浏览器；只有精确回到刚填入的快照才撤销技能替换。
const skillPromptUndoReady=computed(()=>canUndoSkillPrompt.value&&matchesPromptSnapshot({prompt:prompt.value,segments:segments.value},skillPromptHistory.value.at(-1)!.after))
async function undoSkillPrompt(){
  if(!canUndoSkillPrompt.value)return
  const value=skillPromptHistory.value.at(-1)!
  skillPromptHistory.value=skillPromptHistory.value.slice(0,-1)
  if(value.trial){
    const state=value.trial
    // 草稿素材未被用户另外修改才完整恢复；否则只移除本次新增示例，不复活用户已删图片。
    if(JSON.stringify(references.value.map(ref=>ref.version_id))===JSON.stringify(state.afterVersions))references.value=state.beforeReferences
    else references.value=references.value.filter(ref=>!state.afterExampleIds.includes(ref.version_id)||state.beforeReferences.some(old=>old.version_id===ref.version_id))
    const style=parameters.value.style===state.afterStyle.style&&parameters.value.styleId===state.afterStyle.styleId?state.beforeStyle:{}
    // 用户试用后手动改过数量则保留，不用旧快照覆盖新的规格选择。
    const quantity=state.beforeCount!==undefined&&parameters.value.count===state.afterCount?{count:state.beforeCount}:{}
    patchParameters({...style,...quantity,extra:{...parameters.value.extra,skill_example_version_ids:state.beforeExampleIds.filter(id=>references.value.some(ref=>ref.version_id===id))}})
  }
  const restored=restorePromptSnapshot(value.before,references.value.map(row=>row.version_id))
  setText(restored.prompt,restored.segments)
  await composerRef.value?.focusInput()
}
// 页面历史不跨账号、入口、会话或实际执行过程，避免把旧需求带进新的创作上下文。
watch([entry,()=>auth.session.user?.id,()=>session.value?.id],()=>{skillPromptHistory.value=[]},{flush:'sync'})
watch(workInProgress,value=>{if(value)skillPromptHistory.value=[]})
const pendingSkillFocus=ref(false),pendingSkillScroll=ref<number|null>(null),previewDockScroll=ref<number|null>(null)
/** 预览前记录停靠位置，组件库移动焦点或锁滚动后仍能回到原卡片位置。 */
function openSkillPreview(row:SystemSkill){previewDockScroll.value=homeDockVisible.value?(homeScrollRoot?.scrollTop??null):null;selectedSkillPreview.value=row}
/** 等组件关闭及焦点恢复完成后再展开；停靠试用保持原浏览位置，不靠延时猜测。 */
async function finishHomeSkillSelection(){if(active.value)return;const expand=pendingSkillFocus.value,scroll=pendingSkillScroll.value??previewDockScroll.value;pendingSkillFocus.value=false;pendingSkillScroll.value=null;previewDockScroll.value=null;if(scroll!==null&&homeScrollRoot){homeScrollRoot.scrollTop=scroll;trackHomeDock()}if(expand){await expandHomeComposer();if(scroll===null)homeComposerSlot.value?.scrollIntoView({behavior:'smooth',block:'center'})}}
// 分享链接只打开公开预览，不自动选用、填入文字或执行任务。
let openedSkillLink=''
watch([()=>route.query.skillPreview,()=>catalog.value?.skills],()=>{const id=route.query.skillPreview;if(typeof id!=='string'){openedSkillLink='';return}if(id===openedSkillLink)return;const row=catalog.value?.skills.find(row=>row.id===id&&row.kind!=='user'&&row.is_active!==false);if(row){openedSkillLink=id;selectedSkillPreview.value=row}},{immediate:true})
watch([entry,()=>auth.session.user?.id],()=>{selectedSkillPreview.value=null;previewDockScroll.value=null;pendingSkillFocus.value=false;pendingSkillScroll.value=null})
const selectedTemplate = computed(() => templates.value.find(item => item.id === parameters.value.selectedTemplateId) || null)
const cases = ref<PublicCreationCase[]>([]), selectedCase = ref<PublicCreationCase | null>(null)
const casesLoading=ref(false),casesError=ref('')
let caseRevision=0
const replicaBusy=ref(false),replicaError=ref(''),pendingReplica=ref<{id:string;entry:CreationEntryType}|null>(null)
/** 按入口读取后台公开案例；旧入口响应不会覆盖当前分类。 */
async function loadCases(){const current=++caseRevision;casesLoading.value=true;casesError.value='';cases.value=[];selectedCase.value=null;pendingReplica.value=null;if(['commerce','marketing'].includes(entry.value)){casesLoading.value=false;return}try{const values=await creationCaseService.list(entry.value);if(current===caseRevision)cases.value=values}catch{if(current===caseRevision)casesError.value='案例加载失败，请重试。'}finally{if(current===caseRevision)casesLoading.value=false}}
watch(entry,loadCases,{immediate:true})
async function openCase(item:Pick<PublicCreationCase,'id'>){const current=++caseRevision,scope=entry.value;replicaError.value='';try{const value=await creationCaseService.detail(item.id,scope);if(current===caseRevision&&scope===entry.value)selectedCase.value=value}catch{if(current===caseRevision)casesError.value='案例已下架或暂不可用，请刷新列表。'}}
/** 登录只恢复案例选择，必须再点复刻才会替换草稿，不自动执行创作。 */
watch(()=>auth.session.loggedIn,logged=>{const pending=pendingReplica.value;pendingReplica.value=null;if(logged&&pending&&pending.entry===entry.value)void openCase(pending)})
watch(loginOpen,open=>{if(!open&&!auth.session.loggedIn)pendingReplica.value=null})
/** 首页使用保留原文撤销快照与素材；新技能只撤销不再有效的执行上下文。 */
const directoryTrialBusy=ref(false)
let directoryTrialRevision=0
/** 技能目录在本页试用：先验证技能，跨入口先存旧草稿并确认，再填公开示例，不复制执行许可。 */
async function useDirectorySkill(row:SystemSkill){
  if(directoryTrialBusy.value||workInProgress.value||loading.value||cloudDraft.restoring.value)return
  const current=++directoryTrialRevision,owner=auth.session.user?.id
  const scope=row.entries.includes(entry.value)?entry.value:row.entries[0]||'free'
  const valid=()=>current===directoryTrialRevision&&owner===auth.session.user?.id&&props.skillsPage&&!active.value
  directoryTrialBusy.value=true
  try{
    const fresh=await(auth.session.loggedIn?creationService.catalog(scope):creationService.publicCatalog(scope))
    if(!valid())return
    const spec=fresh.skills.find(item=>item.id===row.id&&item.is_active!==false&&item.entries.includes(scope))
    if(!spec){notice.value='该技能已停用或不可用，请刷新列表。';return}
    if(scope!==entry.value){
      const before=JSON.stringify(draft())
      if((prompt.value.trim()||references.value.length||scriptFile.value)&&!await confirmHomeAction('此技能需要切换创作入口。当前草稿会保留在原入口，是否继续？','切换技能入口'))return
      if(!valid()||before!==JSON.stringify(draft()))return
      await chooseEntry(scope)
      if(!valid())return
      // 新入口必须恢复其已有草稿，再选能力；迟到云端恢复不能覆盖刚选择的技能。
      if(auth.session.loggedIn){await cloudDraft.retry();if(cloudDraft.state.value==='error'){notice.value='新入口草稿读取失败，请先重试恢复。';return}}
    }
    if(!valid()||!await validateSkillTrial(spec)||!valid())return
    if(catalog.value)catalog.value={...catalog.value,skills:[...catalog.value.skills.filter(item=>item.id!==spec.id),spec]}
    const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool','execution_permission'])delete extra[key]
    director.value=null;directorAccepted.value=false;confirmation.value=null
    patchParameters({extra,selectedTemplateId:'',templateId:''});setSkill(spec.id)
    const workflow=selectedSkillWorkflow(spec);if(workflow)patchParameters({workflow})
    applySkillPrompt(spec)
    homeDockVisible.value=true;await expandHomeComposer()
  }catch(cause){if(valid())notice.value=cause instanceof Error?cause.message:'技能试用准备失败，草稿保留，请重试。'}
  finally{if(current===directoryTrialRevision)directoryTrialBusy.value=false}
}
watch(()=>auth.session.user?.id,()=>{++directoryTrialRevision;directoryTrialBusy.value=false})
onBeforeUnmount(()=>{++directoryTrialRevision})

async function useHomeSkill(id:string){
  if(workInProgress.value||loading.value||cloudDraft.restoring.value||directoryTrialBusy.value)return
  const wasDocked=homeDockVisible.value||previewDockScroll.value!==null
  const scope=entry.value,owner=auth.session.user?.id,current=++caseRevision
  const preview=selectedSkillPreview.value
  const trialRevision=++directoryTrialRevision
  // 点击立即展开和反馈；网络读取期间锁定编辑，不提前套用未校验技能或改写草稿。
  directoryTrialBusy.value=true
  if(preview)selectedSkillPreview.value=null
  homeDockVisible.value=true;homeComposerExpanded.value=true
  try{
    const fresh=await creationService.publicCatalog(scope),spec=fresh.skills.find(row=>row.id===id&&row.is_active!==false&&row.entries.includes(scope))
    if(current!==caseRevision||entry.value!==scope||auth.session.user?.id!==owner||active.value)return
    if(!spec){notice.value='该技能已下架，请刷新后选择。';return}
    // 详情与全局确认不能同时锁定焦点；先关闭详情，取消时恢复原预览，草稿仍保持不变。
    if(preview)await nextTick()
    const accepted=await validateSkillTrial(spec)
    if(current!==caseRevision||entry.value!==scope||auth.session.user?.id!==owner)return
    if(!accepted){if(preview)selectedSkillPreview.value=preview;return}
    if(catalog.value)catalog.value={...catalog.value,skills:catalog.value.skills.map(row=>row.id===id?spec:row)}
    const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool','execution_permission'])delete extra[key]
    if(id!==skill.value){director.value=null;directorAccepted.value=false}
    patchParameters({extra,selectedTemplateId:'',templateId:''});setSkill(id)
    const workflow=selectedSkillWorkflow(spec);if(workflow)patchParameters({workflow})
    applySkillPrompt(spec)
    const hadPreview=!!selectedSkillPreview.value;pendingSkillFocus.value=true;pendingSkillScroll.value=wasDocked?(previewDockScroll.value??homeScrollRoot?.scrollTop??null):null;selectedSkillPreview.value=null;if(!hadPreview)await finishHomeSkillSelection()
  }catch(cause){if(current===caseRevision&&entry.value===scope&&auth.session.user?.id===owner)notice.value=cause instanceof Error?cause.message:'技能状态读取失败，请重试。'}
  finally{if(trialRevision===directoryTrialRevision)directoryTrialBusy.value=false}
}
/** 先读取全部固定公共素材，再确认替换；任何失败均保持原草稿。 */
async function makeSame(){
  const item=selectedCase.value;if(!item||replicaBusy.value)return
  if(!auth.session.loggedIn){pendingReplica.value={id:item.id,entry:entry.value};requireLogin();return}
  const scope=entry.value,owner=auth.session.user?.id,current=++caseRevision
  const valid=()=>current===caseRevision&&entry.value===scope&&auth.session.user?.id===owner&&selectedCase.value?.id===item.id&&!active.value
  replicaBusy.value=true;replicaError.value=''
  try{
    const fresh=await creationCaseService.detail(item.id,scope)
    if(!valid())return
    selectedCase.value=fresh
    if(!fresh.template){replicaError.value='关联模板或技能已下架，暂不能复刻。';return}
    const template=fresh.template,prepared:ComposerReference[]=[]
    for(const ref of template.example_refs||[]){const asset=await libraryService.detail(ref.item_id);const version=asset.versions.find(row=>row.id===ref.version_id);if(asset.scope!=='public'||asset.status!=='published'||!version)throw Error('公共素材已失效');prepared.push({...ref,name:asset.name,media_type:asset.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}
    if(!valid())return
    const before=JSON.stringify(draft())
    if((prompt.value.trim()||references.value.length||scriptFile.value)&&!await confirmHomeAction('复刻将替换当前输入的需求和参考素材，已生成的作品不受影响。是否继续？','替换当前草稿'))return
    if(!valid()||before!==JSON.stringify(draft()))return
    // 展示媒体不进入引用；清除任务及费用上下文，规格仍由原模型能力校验。
    patchParameters({extra:{},selectedTemplateId:'',templateId:'',sourceTask:'',sourceUrl:'',rightsConfirmed:false});references.value=[];scriptFile.value=null;director.value=null;directorAccepted.value=false;confirmation.value=null
    await chooseTemplate({...template,parameters:replicaParameters(template.parameters) as Partial<CreationParameterState>,example_refs:[]})
    if(scope==='drama'){setText(template.prompt,templateSegments(template.prompt));patchParameters({extra:{director_input_mode:'idea'}})}
    references.value=prepared;selectedCase.value=null;notice.value='已套用配方，请核对需求与素材后再生成。'
    homeComposerSlot.value?.scrollIntoView({behavior:'smooth',block:'center'})
  }catch{if(valid())replicaError.value='案例配方或公共素材暂不可用，原草稿已保留，请重试。'}finally{replicaBusy.value=false}
}
const caseGrid = ref<HTMLElement | null>(null)
onBeforeUnmount(()=>{++caseRevision;pendingReplica.value=null})
/** 上划提示也可点击，定位案例列表；减少动态效果的用户使用即时滚动。 */
function browseCases() {
  caseGrid.value?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}
const caseHeading = computed(() => ({ free: '创作灵感', drama: '精选短剧', commerce: '', marketing: '', music: '音乐与 MV 灵感', image: '图片创作灵感' })[entry.value])
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
  if(!active.value&&entry.value==='drama'&&dramaMode.value==='canvas'){await submitDramaCanvas();return}
  if(allowChatScriptUpload.value&&scriptFile.value){
    if(workInProgress.value||awaitingDecision.value)return
    await submitDramaCanvas(true);return
  }
  if(uploads.value.length){error.value=`请先完成或移除上传：${uploads.value.map(item=>item.name).join('、')}`;return}
  if(safetyDirectBusy.value)return
  if(annotationSubmitting.value||planningBusy.value||stoppingAssistant.value||planning.value?.status==='planning')return
  if(planning.value?.collection_stage?.status==='collecting'&&!explicitSkillBoundary.value){await sendStageText();return}
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
  const run=planning.value;if(!run||busy.value||proposalQuoteBusy.value||proposalCancelBusy.value)return
  // 取消请求与确认互斥；仅收到同一会话的服务端取消状态后撤下报价，不伪造停止成功。
  const epoch=++assistantEpoch,sid=session.value?.id
  stopCountdown();proposalCancelBusy.value=true;proposalQuoteError.value=''
  try{
    const cancelled=await creationService.cancelRun(run.id,'proposal_cancel')
    if(epoch!==assistantEpoch||planning.value?.id!==run.id||session.value?.id!==sid)return
    if(cancelled.status!=='cancelled'||cancelled.executed_request)throw new Error('任务已提交，不能停止已执行的生成。')
    planning.value=cancelled;confirmation.value=null;assistantAccepted.value=false;quotedProposalKey='';error.value=''
  }catch(cause){if(epoch===assistantEpoch&&planning.value?.id===run.id){proposalQuoteError.value='停止未获服务端确认，请重试；已提交的生成任务不能通过此处取消。';error.value=proposalQuoteError.value}}
  finally{proposalCancelBusy.value=false}
}
const proposalModelLabel=computed(()=>{if((confirmation.value?.target||planning.value?.card?.target||target.value)==='music')return 'Suno · 音乐引擎';const code=confirmation.value?.draft.parameters.model||planning.value?.card?.model||parameters.value.model;return models.value.find(item=>item.code===code)?.name||code||'待报价'})
// 视频计量摘要来自服务端报价，不使用客户端猜测的参考素材时长。
const proposalSpec=computed(()=>{
  const value=confirmation.value?.draft.parameters||parameters.value
  const media=confirmation.value?.target||planning.value?.card?.target||target.value
  if(media==='music')return (value.extra.instrumental?'纯音乐':'歌曲')+' · '+(value.customLyrics?'自定义歌词':'根据描述创作')
  if(media==='video')return [value.aspectRatio,value.resolution,videoQuoteSummary(confirmation.value?.quote)].filter(Boolean).join(' · ')
  return `${value.aspectRatio} · ${value.resolution} · ${{low:'低',medium:'中',high:'高'}[value.quality]} · ${value.count} 张`
})
// 切换推荐技能与绑定来源沿用现有逻辑，仅为报价准备冻结草稿，不执行媒体生成。
async function acceptAssistantPlan(){
  const effective=mergeRoundReferences(roundReferences.value,references.value)
  const planned=planning.value?.draft.references||[]
  if(referenceSnapshot(effective)!==referenceSnapshot(planned)){error.value='本轮参考素材已改变，请重新发送需求核对方案。';return}
  // 允许修改模型及规格后重报价；正文或固定素材改变则必须重新协商，不能套用旧方案。
  if(assistantDraft){
    const prior=JSON.parse(assistantDraft),current=draft()
    // 素材已在上方用本轮有效集合核对；不能再拿已发送集合与清空后的编辑器重复比较。
    if((current.prompt.trim() && prior.prompt!==current.prompt) || prior.skill!==current.skill){error.value='需求或来源已改变，请重新发送给助手核对方案。';return}
  }
  const card=planning.value?.card
  if(planning.value?.status!=='ready')return
  // 同媒体采用推荐技能只补配方，不重置用户已选的模型、质量及清晰度。
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
    if(next==='animate'&&!references.value.some(item=>item.media_type==='image')&&activeResult.value?.images&&chosenImage.value&&!await continueImage(activeResult.value.images.id,chosenImage.value.id,true))return
    setSkill(next);setText(text,[{type:'text',text}])
  }
  // 只有采用编辑／图转视频方案时才绑定来源，普通聊天不改变所选技能。
  if(['edit','animate'].includes(card?.skill||skill.value)&&!references.value.some(item=>item.media_type==='image')&&activeResult.value?.images&&chosenImage.value){
    const text=prompt.value,next=card?.skill||skill.value
    if(!await continueImage(activeResult.value.images.id,chosenImage.value.id,next==='animate'))return
    setText(text,[{type:'text',text}]);setSkill(next)
  }
  if(target.value===originalTarget)patchParameters({model:selectedParameters.model,aspectRatio:selectedParameters.aspectRatio,resolution:selectedParameters.resolution,quality:selectedParameters.quality,count:selectedParameters.count})
  // 服务端已合并用户聊天中的明确参数修改，确认卡与执行必须消费同一快照。
  if(run.task_input && parameters.value.extra.creation_run_id!==run.id){
    // 人工试听确认晚于助手方案时，保留同一歌曲的确认版本；服务端仍复核固定音频和原文。
    const current=parameters.value.extra,mvExtra=skill.value.startsWith('mv-')?Object.fromEntries(['mv_alignment_id','mv_alignment_confirmation','mv_lyrics','mv_lyrics_source'].filter(key=>current[key]!==undefined).map(key=>[key,current[key]])):{}
    patchParameters({...run.task_input.parameters,extra:{...run.task_input.parameters.extra,...mvExtra}})
  }
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
  assetBrowserFromCanvas.value=false
  assetBrowserOpen.value=true
}
/** 画布资料库复用现有固定版本引用逻辑，不隐式提交任务或修改已生成素材。 */
async function openCanvasAssets() {
  if(!requireLogin())return
  if(assetBrowserOpen.value&&assetBrowserFromCanvas.value){assetBrowserOpen.value=false;return}
  assetBrowserFromCanvas.value=true
  assetBrowserOpen.value=true
}
const canvasAssetPlacementBusy=ref(false)
/** 仅画布侧栏提供独立放置，普通选择仍沿用输入框素材引用。 */
async function placeCanvasAsset(item:LibraryItem){
  if(canvasAssetPlacementBusy.value||!agentCanvasRef.value)return
  canvasAssetPlacementBusy.value=true
  try{if(await agentCanvasRef.value.placeLibraryAsset(item))assetBrowserOpen.value=false}
  finally{canvasAssetPlacementBusy.value=false}
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
watch(() => route.query.entry, value => { if (!route.query.session && session.value && ['free', 'drama', 'commerce', 'marketing', 'music', 'image'].includes(String(value))) void chooseEntry(value as any) })
watch(()=>[route.query.run,catalog.value] as const,async ([id,directory])=>{
  // 先等目录载入，避免刷新时按默认生图能力覆盖已保存的视频模型或素材。
  if(!directory || typeof id!=='string' || planning.value?.id===id)return
  try{
    const run=await creationService.run(id);if(route.query.run!==id || (route.query.session && route.query.session!==run.session_id))return;planning.value=run
    if(run.status!=='cancelled'){
      setSkill(run.draft.skill)
      const referenceState=parameters.value.extra.round_reference_state as {run_id?:string}|undefined
      // 入口草稿早于模型整理，可能仍为默认规格；深链恢复必须与确认卡消费同一执行快照。
      const snapshot=runParameterSnapshot(run)
      patchParameters({...snapshot,extra:{...snapshot.extra,...(referenceState?.run_id===run.id?{round_reference_state:referenceState}:{}),...(run.preview?run.preview.mv_run_id?{mv_run_id:run.id}:{director_run_id:run.id}:{creation_run_id:run.id})}})
      // 待回答流程也恢复完整输入；普通规划的已回答信息不能在刷新后丢失。
      const original=run.draft.original_prompt ?? run.draft.prompt
      const text=run.preview?original:''
      setText(text,text===original?run.draft.segments:[{type:'text',text}])
      references.value=[]
      for(const ref of (run.preview?run.draft.references:[])){const asset=await libraryService.detail(ref.item_id);const version=asset.versions.find(row=>row.id===ref.version_id);if(version)addReference({...ref,name:asset.name,media_type:asset.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}
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
      <UButton v-for="item in visibleCreationEntries" :key="item.id" class="creation-onboarding-card" :class="{'is-free':item.id==='free'}" :aria-label="item.label" :disabled="onboardingBusy" color="neutral" variant="ghost" @click="finishOnboarding(item.id)">
        <UIcon v-if="item.id==='free'" name="i-lucide-plus" aria-hidden="true"/>
        <span>{{item.label}}</span>
        <img v-if="onboardingCovers[item.id]" :src="onboardingCovers[item.id]" alt=""/>
      </UButton>
    </div>
    <p v-if="onboardingError" role="alert" class="liv-settings-note">{{onboardingError}}</p>
  </LivDialog>
  <section class="creation-studio" :class="{'is-safety-submitting':safetyDirectBusy,'is-skills-page':skillsPage&&!active}">
    <!-- 仅由问题卡明确上传动作触发；复用原上传校验，取消选择不发送答案。 -->

    <Teleport v-if="!skillsPage" defer to="#creation-topbar-nav">
      <!-- 会话恢复或编辑时不显示新建入口切换，避免误切正在处理的上下文。 -->
      <nav v-if="!active && !sessionLoading && !sessionError" class="creation-entry-tabs" aria-label="创作用途"><button v-for="item in visibleCreationEntries" :key="item.id" :class="{ active: entry === item.id }" :aria-pressed="entry === item.id" :disabled="busy||dramaModeBusy" @click="entry!==item.id&&chooseEntry(item.id)">{{ item.label }}</button></nav>
    </Teleport>
    <!-- 普通画布沿用中性双点加载，不再闪现旧双栏；短剧保留原占位。 -->
    <DashboardSkeleton v-if="sessionLoading" variant="conversation" :simple="entry!=='drama'" :layout="session?.id===pendingSession?(hasMedia?'media':'conversation'):'unknown'" :style="{'--creation-chat-width':`${chatWidth}px`}" aria-label="正在加载会话"/>
    <CreationWorkspaceNotice :text="canvasNoticeText" :error="!!error||!!draftProblemText||!!sessionError" :busy="sessionLoading||cloudDraft.state.value==='saving'" :retry="!!sessionError||cloudDraft.state.value==='error'||!!preferenceError" :dismissible="!!error&&!draftProblemText&&!sessionError" @retry="retryCanvasNotice" @dismiss="error=''">
      <template #actions><template v-if="cloudDraft.conflict.value"><button type="button" @click="resolveDraftConflict(false)">保留本地</button><button type="button" @click="resolveDraftConflict(true)">使用云端</button></template></template>
    </CreationWorkspaceNotice>
    <header v-if="!skillsPage && !active && !sessionLoading && !sessionError" class="creation-hero"><img class="creation-hero-mascot" src="/creation-presets/liv-creative-seed.png" alt="" aria-hidden="true"><h1>{{ entryInfo.title }}</h1><p>{{ entryInfo.description }}</p></header>
    <div v-if="!sessionLoading && !sessionError" ref="workspaceElement" :class="[active ? 'creation-workspace' : 'creation-home',{'is-resizing':resizing||!!chatGesture,'is-conversation-only':active&&!hasMedia,'is-chat-collapsed':active&&hasMedia&&chatCollapsed,'is-floating-chat':floatingChat,'is-mobile-workspace':mobileWorkspace}]" :style="active ? chatWindowStyle : {}">
      <!-- 手机页签置顶，聊天不可最小化；两个面板使用v-show保留草稿与画布状态。 -->
      <Teleport v-if="mobileWorkspace" defer to="#creation-topbar-nav"><nav class="creation-mobile-view-tabs" :data-pane="mobilePane" aria-label="切换手机工作区">
        <UButton icon="i-lucide-message-square" color="neutral" :variant="mobilePane==='chat'?'soft':'ghost'" :aria-pressed="mobilePane==='chat'" @click="toggleChat(false)">聊天</UButton>
        <UButton icon="i-lucide-grid-2x2" color="neutral" :variant="mobilePane==='canvas'?'soft':'ghost'" :aria-pressed="mobilePane==='canvas'" @click="mobilePane='canvas'">画布</UButton>
        <UButton icon="i-lucide-settings" color="neutral" variant="ghost" square aria-label="会话设置" @click="rulesOpen=true"/>
      </nav></Teleport>
      <Transition name="creation-chat-morph"><section v-show="!floatingChat||!chatCollapsed" ref="chatPanelElement" :class="[active ? 'creation-chat-column' : 'creation-entry-column',{'mobile-pane-hidden':active&&!floatingChat&&mobilePane!=='chat'}]">
        <!-- 浮窗边缘仅负责尺寸；正文和原输入器始终复用同一实例。 -->
        <template v-if="floatingChat"><div v-for="edge in ['n','s','e','w','ne','nw','se','sw']" :key="edge" :class="['creation-chat-resize-handle',`edge-${edge}`]" aria-hidden="true" @pointerdown="startChatGesture($event,edge)" @pointermove="moveChatGesture" @pointerup="finishChatGesture" @pointercancel="finishChatGesture" @lostpointercapture="finishChatGesture"/></template>
        <SkillCenterPanel v-if="skillsPage&&!active" :trial-busy="directoryTrialBusy||loading||cloudDraft.restoring.value" @try="useDirectorySkill" @tool="showDigitalHumanSkill=true"/>
        <!-- 画布与剪辑共用完整对话面板；原消息、卡片、滚动跟随和浮窗手势保持原业务身份。 -->
        <CreationConversationPanel :active="active" :history-element="el=>historyElement=el" :content-element="el=>historyContentElement=el" @scroll="trackHistory" @wheel="historyWheel" @history-key="historyKey" @touchstart="historyTouchStart" @touchmove="historyTouchMove" @history-pointer="historyScrollbar" @heading-down="startChatGesture($event)" @heading-move="moveChatGesture" @heading-up="finishChatGesture" @heading-cancel="finishChatGesture" @heading-capture-lost="finishChatGesture">
        <template #heading>
          <!-- 普通画布只保留紧凑助手标识；项目标题已在工作区顶栏展示，短剧原标题不变。 -->
          <template v-if="floatingChat||mobileWorkspace"><span class="creation-chat-agent-label">Liv Agent</span><span class="creation-chat-heading-spacer" aria-hidden="true"/></template>
          <template v-else><UIcon name="i-lucide-messages-square"/><h2>{{ session?.title }}</h2></template>
          <UTooltip text="本会话二次确认设置"><UButton icon="i-lucide-settings-2" variant="ghost" square aria-label="本会话确认设置" @click="rulesOpen=true"/></UTooltip><UTooltip v-if="hasMedia&&!mobileWorkspace" text="最小化对话"><UButton icon="i-lucide-minimize-2" variant="ghost" square aria-label="收起对话" @click="toggleChat(true)"/></UTooltip></template>
        <template #default>
            <div v-for="answer in conversationAnswers" :key="answer.key" class="liv-continuous-answer">
            <template v-for="(row,phaseIndex) in answer.rows" :key="row.key">
<CanvasConversationActivity v-if="row.activity" :item="row.activity" :asset-available="row.activity.id==='extraction:'+canvasExtractionId" @view-script="agentCanvasRef?.viewScriptVersion($event)" @locate-assets="locateCanvasActivity"/>
<template v-else>
<article v-if="row.run && !row.active" class="liv-conversation-turn">
  <div v-if="!row.run.auto_continuation" class="liv-user-message"><CreationRunAttachments :run="row.run" @preview="attachmentPreview=$event"/><p>{{userBubbleText(row.run.draft.original_prompt || row.run.draft.prompt)}}</p></div>
  <section class="liv-assistant-message">
    <header v-if="phaseIndex===0"><img src="/creation-presets/liv-creative-seed.png" alt=""><strong>Liv 创作助手</strong><CreationRunTime :run="row.run" :runs="answer.rows.flatMap(item=>item.run?[item.run]:[])"/></header>
    <CreationProcessEvents :events="runProcessEvents(row.run)"><template #answer="{answer}"><CreationAnsweredQuestionCard :answer="answer" @browse="browseHistoryDetails"/></template></CreationProcessEvents>
    <CreationFlowRecovery :key="`${row.run.id}:${auth.session.user?.id}`" :run="row.run" :busy="planningBusy||busy" @updated="updateRecoveredFlow"/>
    <p v-if="row.run.status==='cancelled'" class="liv-proposal-stopped" role="status">已为你停止本次处理，请问是否还有其他需求。已提交的生成任务不会因此撤销。</p>
    <p v-else-if="row.run.continuation?.status==='paused'" class="liv-proposal-stopped" role="status">已停止后续自动规划，已提交的生成任务仍会继续，成果会保留。</p>
    <!-- 历史轮也遵守同一停止/替代规则，不再以只读卡恢复已失效方案。 -->
    <template v-else-if="hiddenProposalOutput(row.run)"/>
    <!-- 历史批次仍读取真实结果并保留局部重试/合成入口，但不能改写已提交快照。 -->
    <CreationImagePlanCard :result-target="'#answer-results-'+answer.key" v-else-if="row.run.image_plan" :key="row.run.id" :run-id="row.run.id" :plan="row.run.image_plan" :reference-previews="graphPreviews" :busy="planningBusy||busy" readonly history @updated="updateImagePlan" @open="openImagePlan(row.run.id,$event)" @retry="openRetryVideoPlan"/>
    <CreationVideoPlanCard :result-target="'#answer-results-'+answer.key" v-else-if="row.run.creative_plan && row.run.creative_plan.total_count>=1" :key="row.run.id" :run-id="row.run.id" :plan="row.run.creative_plan" :catalog="catalog" readonly history :busy="planningBusy||busy" @updated="updateVideoPlan" @compose="compositionOpen=true" @compose-all="composeVideoWorkbench" @workbench="openVideoWorkbench" @retry="openRetryVideoPlan"/>
    <!-- 校验失败的流式草稿未经批准，历史回放不能把它冒充方案或正式价格。 -->
    <p v-else-if="row.run.status==='failed'" role="alert">{{row.run.error || '本轮整理失败，未提交生成。'}}</p>
    <template v-else>
      <template v-for="(turn,index) in row.run.discussion" :key="`discussion:${index}`"><UCollapsible v-if="repeatsSubmittedQuestion(turn.user,row.run.answers)" class="liv-prior-answer-reply" @update:open="browseHistoryDetails"><template #default="{open}"><UButton color="neutral" variant="ghost" :trailing-icon="open?'i-lucide-chevron-up':'i-lucide-chevron-down'">{{open?'收起此前回复':'查看此前回复'}}</UButton></template><template #content><AssistantReply :text="turn.reply"/></template></UCollapsible><template v-else><div class="liv-user-message"><p>{{userBubbleText(turn.user)}}</p></div><AssistantReply :text="turn.reply"/></template></template>
      <AssistantReply :text="row.run.card?.text || row.run.question?.text || row.run.stream_text || row.run.error || '已停止'"/>
      <Teleport defer :to="'#answer-results-'+answer.key"><CreationResultCard v-for="result in answerContinuationImages(row.run,answer.rows)" :key="`continued:${result.key}`" :item="result" @select="openContinuationImage"/></Teleport>
    </template>
    <CanvasDramaActionCard v-if="row.run.drama_action&&(row.run.status!=='cancelled'||row.run.drama_action.result)" :key="row.run.id+':'+row.run.drama_action.revision" :run="row.run" :track-progress="currentDramaIds.has(row.run.id)" :disabled="planningBusy||busy" @updated="updateRecoveredFlow" @production-changed="agentCanvasRef?.refreshProduction()" @progress="(revision,status)=>rememberDramaReceipt(row.key,revision,status)"/>
  </section>
</article>
<section v-if="row.active && planning" class="creation-assistant-card" aria-label="Liv 创作助手"><div v-if="!planning.auto_continuation" class="liv-user-message"><CreationRunAttachments :run="planning" @preview="attachmentPreview=$event"/><p>{{userBubbleText(planning.draft.original_prompt || planning.draft.prompt)}}</p></div><header v-if="phaseIndex===0"><img class="liv-assistant-avatar" src="/creation-presets/liv-creative-seed.png" alt=""><b>Liv 创作助手</b><CreationRunTime :run="planning" :runs="answer.rows.flatMap(item=>item.run?[item.run]:[])"/></header>
  <CreationProcessEvents :events="runProcessEvents(planning)"><template #answer="{answer}"><CreationAnsweredQuestionCard :answer="answer" @browse="browseHistoryDetails"/></template></CreationProcessEvents>
  <CreationFlowRecovery :key="`${planning.id}:${auth.session.user?.id}`" :run="planning" :busy="planningBusy||busy" @updated="updateRecoveredFlow"/>
  <!-- 只有服务端已取消才显示停止反馈；历史草稿与已有媒体任务均保留。 -->
  <p v-if="planning.status==='cancelled'" class="liv-proposal-stopped" role="status">已为你停止本次处理，请问是否还有其他需求。已提交的生成任务不会因此撤销。</p>
  <p v-else-if="planning.continuation?.status==='paused'" class="liv-proposal-stopped" role="status">已停止后续自动规划，已提交的生成任务仍会继续，成果会保留。</p>
  <template v-else-if="hiddenProposalOutput(planning)"/>
  <!-- 此卡位于轮次循环中，使用函数引用固定当前实例，避免字符串 ref 被 Vue 收集为数组。 -->
  <CreationStageCard v-else-if="planning.collection_stage?.status==='collecting'" :ref="instance=>stageCard=instance as InstanceType<typeof CreationStageCard>|null" :key="planning.id" :state-key="`${auth.session.user?.id}:${planning.id}`" :stage="planning.collection_stage" :busy="planningBusy||busy||!!uploads.length" :references="collectionReferences" :save="saveCollectionStage" :reload="reloadCollectionStage" :upload="uploadStageImage" :select-images="selectStageImages" @preview="item=>attachmentPreview={available:true,name:item.name,media_type:'image',preview_url:item.preview_url}"/>
  <UButton v-else-if="planning.collection_stage?.status==='submitted' && planning.calls===0" :loading="planningBusy" :disabled="planningBusy" @click="continueCollectedStage">信息已收齐，继续分析</UButton>
  <CreationStyleQuestion v-else-if="planning.status==='waiting' && planning.question?.kind==='style'" :key="planning.id+':'+planning.question_revision" :styles="catalog?.styles||[]" :recommendations="planning.question.style_recommendations" :title="planning.question.text" :busy="planningBusy||busy" :reference-allowed="references.length<12" @describe="text=>answerPlanning(text)" @reference="answerStyleReference" @select="item=>answerPlanning(`选择视觉风格：${item.display_name}`,undefined,[],item.style_id,item.style_version)"/>
  <CreationImagePlanCard :result-target="'#answer-results-'+answer.key" v-else-if="planning.image_plan" :key="planning.id" :run-id="planning.id" :quick-quote="true" :plan="planning.image_plan" :reference-previews="graphPreviews" :busy="planningBusy||busy" :draft-dirty="imagePlanDraftDirty(planning.id)" :readonly="planning.status!=='replied'||!!planning.superseded_by||!!planning.executed_request" :before-command="beforeImagePlanCommand" @updated="updateImagePlan" @open="openImagePlan(planning!.id,$event)" @retry="openRetryVideoPlan"/>
  <CreationVideoPlanCard :result-target="'#answer-results-'+answer.key" v-else-if="planning.creative_plan && planning.creative_plan.total_count>=1" :key="planning.id" :run-id="planning.id" :quick-quote="true" :plan="planning.creative_plan" :catalog="catalog" :busy="planningBusy||busy" :readonly="planning.status!=='replied'||!!planning.superseded_by||!!planning.executed_request" :skip-confirmation="rulesLoaded&&rules.video" :rules-ready="rulesLoaded" :rules-busy="rulesBusy" :rules-error="rulesError" @rule="changeConfirmationRule($event,'video')" @settings="rulesOpen=true" @updated="updateVideoPlan" @compose="compositionOpen=true" @compose-all="composeVideoWorkbench" @workbench="openVideoWorkbench" @retry="openRetryVideoPlan"/>
  <template v-else><div v-if="pendingUserAnswer && !pendingQuestionForm && !pendingAnswerAccepted" class="liv-user-message"><p>{{userBubbleText(pendingUserAnswer)}}</p></div><CreationThinkingIndicator :run="planning"/><AssistantReply v-if="planning.stream_text && ['planning','cancelled'].includes(planning.status)" :text="planning.stream_text"/><CreationQuestionPages v-if="(planning.status==='waiting'||planningBusy&&pendingQuestionForm&&!pendingAnswerAccepted) && planning.question?.fields?.length" :fields="planning.question.fields" :question-key="`${auth.session.user?.id}:${planning.id}:${planning.question_revision}`" :busy="planningBusy" @submit="answerPlanning"/><CreationReferenceQuestion v-if="planning.status==='waiting' && questionNeedsReference(planning.question) && !planning.question?.fields?.length" ref="referenceQuestionRef" :question-key="`${auth.session.user?.id}:${planning.id}:${planning.question_revision??planning.calls}`" :text="planning.question?.text||'请上传本次创作要参考的图片。'" :busy="planningBusy||busy" :upload="uploadStageImage" :restore="restoreQuestionImage" @submit="confirmQuestionReference"/><CreationQuestionPages v-if="(planning.status==='waiting'||planningBusy&&pendingQuestionForm&&!pendingAnswerAccepted) && standaloneQuestionFields.length" :fields="standaloneQuestionFields" title="请确认本次创作要求" single-answer allow-custom :question-key="`${auth.session.user?.id}:${planning.id}:${planning.question_revision}:single`" :busy="planningBusy" @submit="submitStandaloneAnswer($event)"/><template v-for="(turn,index) in planning.discussion" :key="`discussion:${index}`"><UCollapsible v-if="repeatsSubmittedQuestion(turn.user,planning.answers)" class="liv-prior-answer-reply" @update:open="browseHistoryDetails"><template #default="{open}"><UButton color="neutral" variant="ghost" :trailing-icon="open?'i-lucide-chevron-up':'i-lucide-chevron-down'">{{open?'收起此前回复':'查看此前回复'}}</UButton></template><template #content><AssistantReply :text="turn.reply"/></template></UCollapsible><template v-else><div class="liv-user-message"><p>{{userBubbleText(turn.user)}}</p></div><AssistantReply :text="turn.reply"/></template></template><AssistantReply v-if="planning.card" :text="planning.card.text"/><CreationConfirmationCard v-if="singleConfirmationProposal" :skip-confirmation="confirmationRuleChecked" :rules-ready="rulesLoaded" :rules-busy="rulesBusy" :rules-error="rulesError" @rule="changeConfirmationRule" :model="proposalModelLabel" :spec="proposalSpec" :target="confirmation?.target || planning.card?.target || target" :credits="confirmation?.credits" :has-quote="!!confirmation && confirmation.draft.parameters.extra.creation_run_id===planning.id" :sufficient="!!confirmation?.sufficient" :quoting="proposalQuoteBusy || sessionLoading || loading || cloudDraft.state.value==='loading'" :busy="busy || rulesBusy" :cancelling="proposalCancelBusy" :error="proposalQuoteError" @confirm="submit" @cancel="cancelProposal" @retry="quoteAssistantPlan()" @settings="rulesOpen=true"/><template v-else-if="planning.status==='ready' && planning.card?.type==='proposal' && !proposalSubmitted"><UButton class="liv-proposal-adopt" color="primary" :disabled="busy" @click="acceptAssistantPlan">继续整理生成任务</UButton></template><p v-if="countdown!==null" role="status">{{countdown}} 秒后生成 · {{confirmation?.credits}} 点 <UButton variant="soft" @click="stopCountdown">停止</UButton></p><p v-if="planning.status==='failed'" role="alert">{{planning.error}}</p></template>
  <CanvasDramaActionCard v-if="planning.drama_action&&(planning.status!=='cancelled'||planning.drama_action.result)" :key="planning.id+':'+planning.drama_action.revision" :run="planning" :track-progress="currentDramaIds.has(planning.id)" :disabled="planningBusy||busy" @updated="updateRecoveredFlow" @production-changed="agentCanvasRef?.refreshProduction()" @progress="(revision,status)=>rememberDramaReceipt(row.key,revision,status)"/>
  <Teleport defer :to="'#answer-results-'+answer.key"><CreationResultCard v-for="result in answerContinuationImages(row.active?planning:undefined,answer.rows)" :key="`continued:${result.key}`" :item="result" @select="openContinuationImage"/></Teleport>
</section>
              <Teleport defer :to="'#answer-results-'+answer.key"><CreationResultCard v-for="result in quickCompositionResults(row.active?planning:row.run)" :key="result.key" :item="result" :disabled="busy" @select="openQuickComposition(result)"/></Teleport>
              <div v-if="(row.active?planning:row.run)?.quick_composition?.status==='failed'" class="liv-plan-actions"><UButton color="neutral" variant="soft" :disabled="planningBusy||busy" @click="correctQuickComposition">修正合成</UButton></div>
              <article v-for="item in row.media" :key="item.id" :class="{ active: item.id === focused?.id }" @click="chooseHistory(item.id)">
            <div v-if="!row.linked" class="liv-user-message" aria-label="用户消息">
              <CreationRunAttachments :draft="item.content" :previews="session?.reference_previews" @preview="attachmentPreview=$event"/>
              <p>{{ userBubbleText((item.content.original_prompt ?? item.content.prompt) || (item.content.entry === 'drama' ? '上传剧本，开始导演流程' : '制作歌词视频')) }}</p>
            </div>
            <section class="liv-assistant-message"><header v-if="!row.linked"><img src="/creation-presets/liv-creative-seed.png" alt=""><strong>Liv 创作助手</strong></header><CreationTaskNotice v-if="showTaskNotice(taskData[item.id]?.status||'',allResults.some(result=>result.messageId===item.id))" :status="taskData[item.id]?.status||''" :detail="taskData[item.id]?.detail" :progress="taskActivity[item.id]?.progress" :has-task="!!item.task_id" :has-retry-notice="!!taskData[item.id]?.images?.errorMessage"/>
              <CreationSafetyRepair v-if="safetyFailure(item)" :media-kind="item.task_type==='video'?'video':'image'" :batch-id="item.task_id" :saved="taskData[item.id]?.images?.safetyRepair||taskData[item.id]?.video?.safetyRepair" :automatic="autoSafetyRepairMessageIds.includes(item.id)||latestSafetyMessageId===item.id" :disabled="busy || workInProgress" @adopt="(value,restore)=>adoptSafetyRepair(item,value,restore)"/>
              <Teleport defer :to="'#answer-results-'+answer.key"><CreationResultCard v-for="result in allResults.filter(value=>value.messageId===item.id)" :key="result.key" :item="result" :selected="selectedResultKey===result.key" :disabled="busy" @select="chooseSessionResult"/></Teleport></section>
          </article>
            </template>
            </template>
            <!-- 同轮所有真实产物汇总到末尾；传送仅移动展示，不重建任务或媒体。 -->
            <div v-if="!answer.rows[0]?.activity" :id="'answer-results-'+answer.key" class="liv-answer-results" aria-label="本轮产物"/>
            </div>
            <UButton v-if="canvasActivityError" color="neutral" variant="ghost" @click="reloadCanvasActivity">{{canvasActivityError}} 重试</UButton>
            <section v-if="videoSwitch" class="creation-director-preview"><p>切换到视频并引用这张图</p><UButton @click="videoSwitch=null">取消</UButton><UButton :disabled="busy" @click="confirmVideoSwitch">确认切换，重新报价</UButton></section>
        </template>
        <template #composer>
        <CanvasDramaProgress v-if="active&&dramaSteps.length" :key="conversationAnswers.at(-1)?.key" :steps="dramaSteps"/>
        <div ref="homeComposerSlot" class="creation-composer-slot" :style="homeDockVisible ? {minHeight:`${homeComposerHeight}px`} : undefined">
        <!-- 隐藏独立的本轮参考栏，保留已发送素材及后续请求的引用上下文。 -->
        <UButton v-if="planning?.status==='planning' && planning.calls===0 && !planningBusy" color="neutral" variant="soft" @click="continuePendingPlanning">继续整理已接收需求</UButton>
        <CreationComposer ref="composerRef" :loading="loading" :docked="homeDockVisible" :minimized="!homeComposerExpanded" :dock-style="homeDockStyle" @expand="expandHomeComposer" @collapse="homeComposerExpanded=false" :show-latest="active && !followLatest" @latest="latest" :annotation="annotationDraft" :working="workInProgress||awaitingDecision" :can-stop="canStopWork" :stop-reason="stopReason" @stop="cancelPlanning" show-planner :planning-busy="planningBusy||refiningPrompt" @plan="refineComposerPrompt" :uploads="uploads" @dismiss-upload="dismissUpload" :template-example="selectedTemplate" :entry="entry" :skill="skill" :prompt="prompt" :segments="segments" :references="composerReferences" :parameters="parameters" :catalog="catalog" :templates="templates" :busy="busy || dramaModeBusy || refiningPrompt || loading || annotationSubmitting || directoryTrialBusy" :send-action-label="!active&&entry==='drama'&&dramaMode==='canvas'?'保存剧本并进入画布':undefined" :credit-label="creditLabel" :conversational="entry!=='drama'&&!assistantAccepted" :script-file="scriptFile" :compact="active" :models="models" :ratios="ratios" :resolutions="resolutions" :qualities="qualities" :duration-range="durationRange" :music-sources="musicSources"
          :allow-script-attachment="allowChatScriptUpload" :trial-pending="directoryTrialBusy" :can-undo-skill-prompt="canUndoSkillPrompt" :skill-prompt-undo-ready="skillPromptUndoReady" @undo-skill-prompt="undoSkillPrompt" @text="setText" @skill="selectUserSkill" @tool="$event==='digital-human'&&(showDigitalHumanSkill=true)" @parameters="selectParameters" @upload="receiveFiles" @replace="replaceReference" @assets="openAssets" @reference="mentionReference" @remove="removeReference" @reorder="reorder" @template="chooseTemplate" @send="sendWithContext" @script="scriptFile = $event">
          <template #workflow-mode>
            <UButton v-if="pendingStoryboardSource" color="neutral" variant="soft" icon="i-lucide-file-text" trailing-icon="i-lucide-x" :aria-label="`移除分镜文稿来源：${pendingStoryboardSource.title}，V${pendingStoryboardSource.revision}`" :disabled="workInProgress" @click="pendingStoryboardSource=null">{{pendingStoryboardSource.title}} · V{{pendingStoryboardSource.revision}}</UButton>
            <URadioGroup v-if="!skillsPage&&!active&&entry==='drama'" v-model="dramaMode" :items="[...dramaModeOptions]" :disabled="busy||dramaModeBusy" orientation="horizontal" size="sm" aria-label="短剧制作模式" class="creation-drama-mode"/>
          </template>
<template #audio-source><div class="creation-audio-source flex-wrap"><UButton icon="i-lucide-music-2" color="neutral" variant="soft" :disabled="busy" @click="mvPickerOpen=true">{{references.some(item=>item.media_type==='audio')?'更换歌曲':'选择歌曲'}}</UButton><span class="creation-music-shortcut">没有音乐？试试 <UButton variant="link" class="creation-music-link" @click="openMusicGeneration">音乐生成</UButton></span><MvLyricAlignment :draft="mvAlignmentDraft" :audio-url="references[0]?.preview_url||roundReferences[0]?.preview_url" @confirmed="confirmMvLyrics"/></div></template>
        </CreationComposer>
        </div>
        <label v-if="target === 'music' && (['reference', 'remix'].includes(skill) || ((selectedSkill?.base_code||skill)==='free'&&references.length>0))" class="creation-rights"><UCheckbox :model-value="parameters.rightsConfirmed" label="我已获得参考音频的使用授权" @update:model-value="patchParameters({rightsConfirmed:!!$event})"/></label>
        <UButton v-if="savedMvDraft && !skill.startsWith('mv-')" color="neutral" variant="soft" @click="returnToMv">返回 MV 制作，选择具体曲目</UButton>
        <div v-if="!skillsPage && !active && entry!=='drama'" class="creation-quick-templates"><CreationQuickSkill v-for="item in recommendedSkills" :key="item.id" :skill="item" :active="skill===item.id" @preview="openSkillPreview" @use="useHomeSkill"/></div>
        </template>
        </CreationConversationPanel>
      </section></Transition>
      <div v-if="active" v-show="hasMedia && !chatCollapsed" class="creation-workspace-resizer" role="separator" aria-label="调整聊天区宽度" aria-orientation="vertical" tabindex="0" :aria-valuenow="chatWidth" :aria-valuemin="320" :aria-valuemax="560" @pointerdown="startResize" @pointermove="moveResize" @pointerup="finishResize" @pointercancel="finishResize" @lostpointercapture="resizing=false" @keydown="resizeKey" @dblclick="setChatWidth(340);finishResize()" />
      <section v-if="active" v-show="hasMedia" class="creation-results-column creation-canvas-column" :class="{'mobile-pane-hidden':!floatingChat&&mobilePane!=='canvas'}">
        <!-- 仅提示移动端编辑体验，不阻止查看或操作，不伪造系统执行状态。 -->
        <p v-if="mobileWorkspace&&mobilePane==='canvas'" class="creation-mobile-canvas-tip" role="note">画布编辑建议在桌面端体验</p>
        <!-- 图片编辑时先收起无关成片入口，避免窄屏盖住工具；退出节点工具后原入口恢复。 -->
        <!-- 快捷成片通过对话和作品操作进入；不常驻显示高级片段工作台入口，底层能力保留。 -->
        <Transition name="creation-chat-mini"><div v-if="chatCollapsed" class="creative-chat-minimized" :style="miniChatStyle" aria-label="创作助手状态卡" @pointerdown="startChatGesture($event,'mini')" @pointermove="moveChatGesture" @pointerup="finishChatGesture" @pointercancel="finishChatGesture" @lostpointercapture="finishChatGesture" @click.self="restoreMiniChat"><div class="creative-chat-mini-heading"><span>Liv 创作助手</span><UButton icon="i-lucide-maximize-2" class="creative-chat-mini-expand" square color="neutral" variant="ghost" aria-label="恢复对话" @click.stop="toggleChat(false)"/></div><div class="creative-chat-mini-status"><span role="status" @click="restoreMiniChat">{{miniChatStatus}}</span><UButton class="creative-chat-mini-action" :icon="workInProgress||graphActivity.running?'i-lucide-square':'i-lucide-arrow-up'" square color="neutral" variant="soft" :disabled="(workInProgress||!!graphActivity.running)&&!canStopWork" :aria-label="canStopWork?'停止整理需求':graphActivity.running?'生成任务已提交，无法停止':workInProgress?'当前请求暂不能停止':'展开对话'" @click.stop="miniChatAction"/></div></div></Transition>
        <!-- 普通技能统一投影到画布；短剧的既有工作台和业务链路保持不变。 -->
        <ClientOnly v-if="entry!=='drama'&&session?.id&&draftOwner">
          <!-- 内联节点工具不遮挡其他音乐；编辑中的节点已由media-editor替换原播放器，不会产生双实例播放。 -->
          <CreationAgentCanvas :key="`${draftOwner}:${session.id}`" ref="agentCanvasRef" :session-id="session.id" :stage-nav-target="desktopWorkspace&&!skillsPage?'#creation-topbar-nav':undefined" :owner-id="draftOwner" :runs="graphRuns" :messages="messages" :results="graphResults" :references="graphReferences" :previews="graphPreviews" :tasks="taskData" :activity="taskActivity" :compositions="graphCompositions" :asset-panel-open="assetBrowserOpen&&assetBrowserFromCanvas" :audio-enabled="catalog?.capabilities?.platform.music.enabled??catalog?.music_operations.some(row=>row.operation==='generation'&&row.enabled)??false" :focus-id="graphFocusId" :tool-node-id="graphToolsOpen?graphToolNode?.id:undefined" :left-inset="canvasLeftInset" :bottom-inset="canvasBottomInset" :obstructions="canvasObstructions" :playback-enabled="!editingWorkspaceOpen&&!compositionOpen&&!rulesOpen&&(floatingChat||desktopWorkspace||mobilePane==='canvas')" :before-select="beforeSelectGraphNode" :busy="busy||planningBusy||graphPreparing" @select="selectGraphNode" @tools="openGraphTools" @generate="generateGraphNode" @retry="retryGraphPlanning" @refresh-file="refreshGraphFile" @compose="compositionOpen=true" @edit-workspace="editingWorkspaceOpen=true" @compositions-changed="readGraphCompositions" @upload="openAssets" @assets="openCanvasAssets" @close-assets="assetBrowserFromCanvas&&(assetBrowserOpen=false)" @upload-audio="file=>upload([file])" @activity="graphActivity=$event" @canvas-activity-changed="refreshCanvasActivity" @discuss-script="discussCanvasScript">
            <template #storyboard-source-action="{source,title,disabled,close}">
              <UButton v-if="entry==='free'&&catalog?.skills.some(item=>item.id==='drama-storyboard')" color="neutral" variant="soft" icon="i-lucide-panels-top-left" :disabled="disabled||workInProgress" @click="chooseCanvasStoryboardSource(source,title,close)">用此文稿规划分镜</UButton>
            </template>
            <!-- 原作品工具作为当前节点内部编辑子任务，无UModal遮罩；保留下方同一提示词输入框。 -->
            <template #media-editor="{node,toolTarget}">
              <CreationResultCanvas v-if="graphToolsOpen&&graphToolNode?.id===node.id" ref="canvasRef" inline-node :playback-enabled="!editingWorkspaceOpen&&!compositionOpen&&!rulesOpen&&!showMusicTools&&(floatingChat||desktopWorkspace||mobilePane==='canvas')" :toolbar-target="toolTarget" :versions="graphToolVersions" :selected="graphToolVersions[0]?.key||''" :save-busy="saveBusy" :favorite="graphFavorite" :can-favorite="graphToolNode?.data.source?.kind==='image'" :music-tools="musicToolOptions" :music-task-id="sourceTask?.id" @favorite="favoriteGraphNode" @music="makeMusicMv" @audio-tool="openCanvasMusicTool" @save="saveCanvas" @annotation="updateGraphAnnotation" @ai="graphMediaTool" @edit-video="openGraphVideoEditor" @notice="showGraphToolNotice"><template #video-actions><UButton icon="i-lucide-clapperboard" color="neutral" variant="ghost" @click="openGraphVideoEditor(graphToolVersions[0]?.source)">AI 剪辑</UButton></template><template #top-actions><UButton icon="i-lucide-x" square color="neutral" variant="ghost" aria-label="退出节点工具" @click="updateGraphToolsOpen(false)"/></template></CreationResultCanvas>
            </template>
            <!-- 完整共享输入组件；画布仅提供节点上下文和独立业务命令，不再拼装第二套底栏。 -->
            <template #node-editor="nodeEditor">
              <CreationNodeControls :key="nodeEditor.node.id" full-editor :kind="nodeEditor.node.data.kind==='text'?'text':nodeEditor.node.data.kind==='video'?'video':nodeEditor.node.data.kind==='audio'?'music':'image'" :value="nodeEditor.value" :initial="graphNodeInitial(nodeEditor.node)" :prompt="nodeEditor.prompt" :readonly="nodeEditor.readonly" :annotation="graphToolsOpen&&graphToolNode?.id===nodeEditor.node.id?graphAnnotationDraft:null" :references="nodeEditor.references" :open-reference="nodeEditor.openReference" :reference-types="nodeEditor.inputs.filter(value=>value.data.reference||value.data.source).map(value=>({media_type:value.data.reference?.media_type||value.data.kind}))" :catalog="catalog" :busy="nodeEditor.busy||annotationSubmitting" @text="nodeEditor.update($event)" @update="nodeEditor.parameters($event)" @send="submitGraphEditor(nodeEditor.node,nodeEditor.prompt,nodeEditor.submit)">
                <template #toolbar-actions><UButton v-if="!nodeEditor.readonly" icon="i-lucide-save" color="neutral" variant="ghost" square aria-label="保存节点提示词" :disabled="nodeEditor.busy" @click="nodeEditor.save()"/></template>
              </CreationNodeControls>
            </template>
            <template #prompt-input="nodeEditor"><CreationComposer :key="nodeEditor.node.id" canvas-editor :canvas-readonly="nodeEditor.readonly" :entry="entry" :skill="skill" :prompt="nodeEditor.prompt" :segments="[{type:'text',text:nodeEditor.prompt}]" :references="[]" :parameters="parameters" :catalog="catalog" :templates="[]" :busy="busy||planningBusy||graphPreparing||nodeEditor.readonly" credit-label="" :script-file="null" :models="models" :ratios="ratios" :resolutions="resolutions" :duration-range="durationRange" :music-sources="[]" @text="nodeEditor.update($event)" @send="nodeEditor.submit()"/></template>
            <template #plan-editor="{node}">
              <CreationImagePlanEditor v-if="node.data.planTarget==='image'&&graphRuns.some(run=>run.id===node.data.runId&&run.image_plan)" ref="imagePlanEditorRef" :key="node.id" :run="graphRuns.find(run=>run.id===node.data.runId)!" :item-id="node.data.itemId!" :catalog="catalog" :references="imagePlanReferences(node.data.runId!,node.data.itemId!)" :busy="busy||planningBusy||graphPreparing" @updated="updateImagePlan"/>
              <CreationVideoWorkbench v-else-if="videoWorkbenchRun?.creative_plan&&videoWorkbench&&videoWorkbench.runId===node.data.runId" ref="videoWorkbenchRef" :key="videoWorkbench.runId" canvas-mode :run-id="videoWorkbench.runId" :plan="videoWorkbenchRun.creative_plan" :initial-item-id="videoWorkbench.itemId" :saved-runs="assistantHistory" :save-busy="saveBusy" @saved="savedVideoWorkbench" @updated="updateVideoPlan" @revise="revisedVideoWorkbench" @close="closeGraphEditor">
                <template #editor="videoEditor"><CreationNodeControls full-editor kind="video" :skill="videoWorkbenchRun.skill" :value="videoEditor.value" :initial="videoEditor.initial" :prompt="videoEditor.prompt" :readonly="videoEditor.readonly" :references="videoPlanReferences(node.data.runId!,node.data.itemId!)" :reference-types="videoPlanReferences(node.data.runId!,node.data.itemId!)" :catalog="catalog" :busy="videoEditor.busy" @text="videoEditor.update($event)" @update="videoEditor.parameters($event)" @send="videoEditor.submit()"><template #toolbar-actions><UButton icon="i-lucide-save" color="neutral" variant="ghost" square aria-label="保存视频编辑稿" :disabled="!videoEditor.canSave||videoEditor.busy" @click="videoEditor.save()"/></template></CreationNodeControls></template>
              </CreationVideoWorkbench>
              <p v-else role="alert">当前节点的方案尚未读取完整，请重新选择节点或刷新会话。</p>
            </template>
          </CreationAgentCanvas>
          <!-- 客户端画布挂载前也使用普通会话加载态，避免恢复后再次闪出旧左右分栏。 -->
          <template #fallback><DashboardSkeleton variant="conversation" :simple="entry!=='drama'" layout="media"/></template>
        </ClientOnly>
        <CreationVideoWorkbench v-else-if="videoWorkbenchRun?.creative_plan && videoWorkbench" ref="videoWorkbenchRef" :key="videoWorkbench.runId" :run-id="videoWorkbench.runId" :plan="videoWorkbenchRun.creative_plan" :initial-item-id="videoWorkbench.itemId" :saved-runs="assistantHistory" :composition="videoComposition" :composing="videoCompositionBusy" :composition-error="videoCompositionError" :save-busy="saveBusy" @save="saveCanvas" @ai="canvasAI" @saved="savedVideoWorkbench" @updated="updateVideoPlan" @revise="revisedVideoWorkbench" @compose="composeVideoWorkbench(videoWorkbench.runId)" @close="closeVideoWorkbench"/>
        <template v-else-if="audition"><UButton variant="ghost" @click="clearAudition">结束试听</UButton><MusicPlayer :url="audition.url" :title="audition.title"/></template>
<CreationResultCanvas v-else ref="canvasRef" :results="allResults" :selected-result="selectedResultKey" :unread-results="unreadResults" :selection-disabled="busy" @result="chooseSessionResult" @annotation="updateAnnotation" :favorite="chosenImage?.isFavorite" @favorite="favorite" :versions="canvasVersions" :selected="canvasSelected" :status="activeResult?.status" :progress="taskActivity[focused?.id||'']?.progress" :progress-updated-at="taskActivity[focused?.id||'']?.progress_updated_at" :detail="['failed','needs_review','result_pending','result_error'].includes(activeResult?.status||'')?activeResult?.detail:taskActivity[focused?.id||'']?.label" :save-busy="saveBusy" :music-tools="musicToolOptions" :music-task-id="sourceTask?.id" @select="chooseCanvas" @save="saveCanvas" @ai="canvasAI" @music="makeMusicMv" @audio-tool="openCanvasMusicTool" @refresh="refreshResults(true)" />
      </section>
    </div>
    <!-- 页签必须同时恢复聊天可见性，不能只改mobilePane却保留收起状态造成空白。 -->
    <div v-if="active && hasMedia && !floatingChat && !mobileWorkspace" class="liv-mobile-workspace-tabs"><button :class="{active:mobilePane==='chat'}" @click="toggleChat(false)">对话</button><button :class="{active:mobilePane==='canvas'}" @click="mobilePane='canvas'">作品</button></div>
<section v-if="!skillsPage && !active && !sessionLoading && !sessionError" class="creation-recommendations creation-cases" :style="{minHeight:`${homeCasesMinHeight}px`}">
  <div v-if="['commerce','marketing'].includes(entry)" ref="caseGrid" class="creation-commerce-skills">
    <CreationSkillShowcase :entry="entry==='marketing'?'marketing':'commerce'" :key="entry" :skills="catalog?.skills||[]" :loading="loading||!catalog" @select="useHomeSkill" @preview="openSkillPreview" @tool="showDigitalHumanSkill=true">
      <template #heading="{tabs,category,selectCategory}"><header ref="caseHeader" class="creation-case-header" :class="{'is-stuck':homeCaseHeaderStuck}"><UTabs :model-value="category" @update:model-value="selectCategory" :items="tabs" :content="false" color="neutral" variant="link" class="creation-case-tabs" aria-label="技能内容分类" :ui="{list:'creation-case-tab-list',trigger:'creation-case-tab',indicator:'hidden'}"/></header></template>
    </CreationSkillShowcase>
  </div>
  <template v-else>
    <header ref="caseHeader" class="creation-case-header" :class="{'is-stuck':homeCaseHeaderStuck}"><h2>{{caseHeading}}</h2><button v-if="cases.length" v-show="showCaseBrowseHint" class="creation-browse-cases" aria-label="查看创作案例" @click="browseCases"><UIcon name="i-lucide-chevrons-up"/><span>上划查看更多</span></button></header>
    <DashboardSkeleton v-if="casesLoading" variant="cards" :rows="4" :heading="false" aria-label="正在加载创作案例"/>
    <p v-else-if="casesError" role="alert" class="creation-muted">{{casesError}} <button @click="loadCases">重试案例</button></p>
    <div v-else ref="caseGrid" class="creation-case-grid"><button v-for="item in cases" :key="item.id" @click="openCase(item)"><div class="creation-case-cover"><CreationPreviewMedia :cover="item.cover" :video="item.media_type==='video'?item.media_url:undefined" :alt="item.title"/><UIcon v-if="item.media_type!=='image'" name="i-lucide-circle-play" /></div><b :title="item.title">{{item.title}}</b></button></div>
    <p v-if="!casesLoading&&!casesError&&!cases.length" class="creation-muted">暂无公开案例。</p>
  </template>
</section>
    <section v-if="audition&&!active" class="creation-audition"><UButton variant="ghost" @click="clearAudition">结束试听</UButton><MusicPlayer :url="audition.url" :title="audition.title"/></section>
    <!-- 最近记录只在侧栏展示，首页下方专注用途案例。 -->
    <section v-if="director" class="creation-director-preview"><header><h2><UIcon name="i-lucide-clapperboard" />导演脚本草稿</h2><span>文字规划由平台承担；后续制作按报价计费</span></header><input v-model="director.title" aria-label="脚本标题"><p>{{ director.summary }}</p><textarea v-model="director.script" aria-label="导演脚本" /><p v-for="item in director.material_suggestions" :key="item" class="creation-muted">{{ item }}</p><button :disabled="busy" @click="cancelPlanning">取消本流程</button><button class="creation-primary" :disabled="busy || previewSaveBusy" @click="confirmDirector">确认脚本，预估解析费用</button></section>
    <p v-if="confirmation && !confirmation.sufficient" class="creation-error">积分不足，<UButton color="neutral" variant="link" @click="billingDialog.show('recharge')">去充值</UButton></p>
    <div v-if="confirmation?.target==='drama'" class="creation-director-preview"><button class="creation-primary" :disabled="busy || !confirmation.sufficient" @click="prepare()">开始制作 · {{ confirmation.credits }} 点</button></div>
    <CreationSkillDetail :skill="selectedSkillPreview" :busy="workInProgress||loading" @close="selectedSkillPreview=null" @closed="finishHomeSkillSelection" @try="useHomeSkill($event.id)" @favorite="(id,enabled)=>{const row=catalog?.skills.find(row=>row.id===id);if(row)row.is_favorite=enabled}"/>
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
    <LibraryPicker v-if="pickerMounted" v-model:open="pickerOpen" dark :kind="target === 'video' ? 'video' : 'image'" :model="parameters.model" :remaining="Math.max(0, Number(catalog?.profiles[target === 'video' ? 'product_video' : 'product_image']?.input_schema.max_reference_count || 0) - references.length)" @select="selectAssets" />
    <LibraryPicker v-if="stagePickerMounted" v-model:open="stagePickerOpen" dark homepage :kind="target==='video'?'video':'image'" media-type="image" :model="parameters.model" :remaining="Math.max(0,12-collectionReferences.length)" initial-category="product" @select="acceptStageImages" />
    <div v-if="assetBrowserOpen" :class="assetBrowserFromCanvas?'creation-canvas-assets':'creation-modal-backdrop'" @click.self="assetBrowserOpen=false"><section class="creation-asset-panel creation-shared-assets" :class="{'is-canvas-assets':assetBrowserFromCanvas}"><header v-if="assetBrowserFromCanvas" class="creation-canvas-assets-header"><strong>资料库</strong><UButton icon="i-lucide-x" color="neutral" variant="ghost" square aria-label="关闭资料库" @click="assetBrowserOpen=false"/></header><AssetLibraryPanel compact selectable :canvas-placement="assetBrowserFromCanvas" :placement-busy="canvasAssetPlacementBusy" :kind="target" :model="parameters.model" :existing="references" :max-references="Math.max(0,12-references.length)" :allowed-media-types="(selectedSkill?.base_code || skill)==='free'&&target==='music'?['audio']:selectedSkill?.media_types" @close="assetBrowserOpen=false" @advanced="assetBrowserOpen=false;pickerOpen=true" @place-canvas="placeCanvasAsset" @select="selectAudio($event);assetBrowserOpen=false"/></section></div>
    <div v-if="audioPickerOpen" class="creation-modal-backdrop" @click.self="audioPickerOpen = false"><section class="creation-asset-panel"><header><h2>资料库资产引用</h2><button aria-label="关闭" @click="audioPickerOpen = false"><UIcon name="i-lucide-x" /></button></header><div class="creation-filter"><button :class="{ active: assetScope === 'personal' }" @click="assetScope = 'personal'">个人资料</button><button :class="{ active: assetScope === 'public' }" @click="assetScope = 'public'">平台素材</button></div><div class="creation-asset-filters"><LivSelect v-model="assetCategory" aria-label="素材用途"><option value="">全部用途</option><option v-for="item in assetCategories" :key="item.code" :value="item.code">{{ item.name }}</option></LivSelect><LivSelect v-if="target !== 'music'" v-model="assetMedia" aria-label="素材类型"><option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option></LivSelect></div><input v-model="audioQuery" placeholder="搜索素材" @keyup.enter="searchAssets"><button @click="searchAssets">搜索</button><p v-if="!audioItems.length" class="creation-muted">暂时没有符合条件的素材，可以使用 ＋ 上传。</p><div class="creation-asset-grid"><button v-for="item in audioItems" :key="item.id" @click="selectAudio(item)"><img v-if="item.media_type === 'image' && item.versions[0]?.preview_url" :src="libraryService.previewUrl(item.versions[0].preview_url)" :alt="item.name"><UIcon v-else :name="item.media_type === 'audio' ? 'i-lucide-music' : 'i-lucide-file'" /><b>{{ item.name }}</b><small>{{ item.media_type }} · 固定版本 {{ item.versions[0]?.version_no }}</small></button></div></section></div>
    <!-- 口播作为内置工具技能使用专用接口，旧视频首页不再挂入创作工作台。 -->
    <LivDialog :open="showDigitalHumanSkill" title="数字人口播" width="xl" dark @update:open="showDigitalHumanSkill=$event"><ProductVideoWorkspacePanel v-if="showDigitalHumanSkill" digital-only :current-credit-balance="account.currentBalance" :default-video-model="parameters.model" @created="recordToolTask($event,'video');showDigitalHumanSkill=false"/></LivDialog>
    <!-- 音频工具复用统一弹窗的焦点锁定、Esc关闭与正文滚动，不再用手写遮罩覆盖画布。 -->
    <LivDialog :open="showMusicTools" title="音频工具" width="xl" dark close-label="关闭音频工具" @update:open="open=>{if(!open)closeCanvasMusicTools()}">
      <MusicWorkspacePanel v-if="showMusicTools" compact :source-task-id="musicToolSource?.taskId" :initial-operation="selectedMusicOperation" :source-audio-index="musicToolSource?.audioIndex" @created="task=>{closeCanvasMusicTools();void recordToolTask(task,'music')}"/>
    </LivDialog>
  </section>
    <Teleport to="body"><div v-if="attachmentPreview" ref="attachmentDialog" class="liv-reference-preview" role="dialog" aria-modal="true" :aria-label="attachmentPreview.name" tabindex="-1" @click.self="attachmentPreview=null" @keydown.esc="attachmentPreview=null"><button aria-label="关闭素材预览" @click="attachmentPreview=null">×</button><figure><img v-if="attachmentPreview.media_type==='image'" :src="attachmentPreview.preview_url" :alt="attachmentPreview.name"><video v-else-if="attachmentPreview.media_type==='video'" :src="attachmentPreview.preview_url" controls playsinline/><audio v-else-if="attachmentPreview.media_type==='audio'" :src="attachmentPreview.preview_url" controls/><a v-else :href="attachmentPreview.preview_url" target="_blank">打开文件</a><figcaption>{{attachmentPreview.name}}</figcaption></figure></div></Teleport>
    <CreationCaseViewer :item="selectedCase" :items="cases" :busy="replicaBusy" :error="replicaError" @close="selectedCase=null" @replica="makeSame" @select="openCase"/>
  <!-- 短片是紧凑片段计划，不使用旧画布宽度；横片也按容器约束完整显示。 -->
  <CreationEditingWorkspace v-if="editingWorkspaceOpen&&session" :session-id="session.id" :assets="editingAssets" :entry-composition-id="graphToolsOpen&&graphToolNode?.data.source?.kind==='composition'?graphToolNode.data.source.id:undefined" :initial-asset-key="graphToolsOpen?editingAssets.find(item=>item.url===graphToolNode?.data.url)?.key:undefined" :sources="compositionSources" :music-sources="compositionMusicSources" @close="editingWorkspaceOpen=false;readGraphCompositions(true)" @open-run="id=>{editingWorkspaceOpen=false;routerRun(id,session?.id)}"/>
  <LivDialog :open="compositionOpen" title="短片合成" width="md" dark @update:open="compositionOpen=$event"><CreationDeliveryPanel v-if="compositionOpen&&session" :key="`${draftOwner}:${session.id}`" :session-id="session.id" :sources="compositionSources" :music-sources="compositionMusicSources" @open-run="id=>{compositionOpen=false;routerRun(id,session?.id)}"/></LivDialog>
  <LivDialog v-if="mvPickerOpen" :open="mvPickerOpen" @update:open="!busy&&(mvPickerOpen=$event)" settings dark title="选择 MV 歌曲">
    <div class="mv-source-picker">
      <URadioGroup v-model="mvSourceMode" orientation="horizontal" :items="[{label:'我的歌曲',value:'owned'},{label:'上传音频',value:'upload'},{label:'音频链接',value:'link'}]" :disabled="busy" aria-label="歌曲来源方式"/>
      <section v-if="mvSourceMode==='owned'"><p>从本人已完成的歌曲中选择一首。</p><USelect v-model="mvSource" class="w-full" :items="musicSources.map(item=>({value:item.id,label:item.label}))" placeholder="选择已完成歌曲" aria-label="选择已完成歌曲" :disabled="busy"/></section>
      <section v-else-if="mvSourceMode==='upload'"><UFileUpload v-model="mvUploadFile" :accept="audioUpload?.extensions.map(e=>'.'+e).join(',')||''" label="选择音频文件" icon="i-lucide-upload" :disabled="busy||!audioUpload"/></section>
      <section v-else><p>填写一个 HTTPS 音频链接。</p><UInput v-model="mvUrl" class="w-full" placeholder="https://…" aria-label="音频 HTTPS 链接" :disabled="busy"/></section>
      <p v-if="mvSourceMode==='upload'&&audioUploadHint" class="liv-settings-note">{{audioUploadHint}}</p>
      <UButton v-if="audioConfigError" variant="ghost" @click="loadAudioConfig">读取失败，重试上传限制</UButton>
      <span class="creation-music-shortcut">没有音乐？试试 <UButton variant="link" class="creation-music-link" @click="openMusicGeneration">音乐生成</UButton></span>
      <p v-if="error" role="alert">{{error}}</p>
    </div>
    <template #footer><LivButton settings block variant="primary" :disabled="!canUseMvSource" :loading="busy" @click="confirmMvSource">{{mvSourceMode==='owned'?'使用歌曲':mvSourceMode==='upload'?'上传并使用':'导入音频'}}</LivButton></template>
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
/* 快捷合成成果独立于助手正文渲染，须自行预留轮次间距，避免下一条用户气泡贴住卡片。 */
.creation-chat-content>.liv-result-card{margin-bottom:var(--liv-chat-gap)}
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
.liv-reply-text{white-space:pre-wrap}
/* 旧误归类回复只折叠展示；真实数据及最终完整正文不删除、不合并。 */
.liv-prior-answer-reply{margin:12px 0}.liv-prior-answer-reply :deep(button){color:var(--color-text-muted);font-size:var(--liv-chat-font)}
.creation-studio .creation-chat-column :deep(.creation-composer.is-compact){flex:none;padding:16px!important;border-radius:24px 24px 0 0!important;background:var(--liv-workspace-surface)!important}
.creation-studio .creation-chat-column :deep(.creation-editor){min-height:var(--liv-chat-editor-min)!important;max-height:var(--liv-chat-editor-max)!important;font-size:var(--liv-chat-font)!important;line-height:var(--liv-chat-line)!important}
.creation-studio .creation-chat-column :deep(.creation-placeholder){font-family:var(--liv-chat-family)!important;font-weight:var(--liv-chat-weight)!important;font-size:var(--liv-chat-font)!important;line-height:var(--liv-chat-line)!important;color:var(--liv-chat-placeholder)!important;max-height:none!important}
.creation-studio .creation-chat-column :deep(.creation-placeholder>span:last-child:not(.placeholder-char)){display:block!important;font-size:12px}
.creation-studio .creation-chat-column :deep(.creation-toolbar){padding-top:12px!important}
.creation-studio .creation-chat-column :deep(.creation-send){width:36px;height:36px}
@media(min-width:1024px){.creation-studio .creation-workspace{min-height:0;height:calc(100dvh - 100px)}}
@media(max-width:1023.98px){.creation-studio .creation-chat-column{height:calc(100dvh - 150px);min-height:350px}}

/* 聊天元素不再继承导演表单的布局和颜色。 */
.creation-studio .creation-chat-column{background:var(--liv-workspace-surface)}
/* 对话输入区与悬浮对话使用同一背景，避免桌面和手机出现拼色。 */
.creation-studio .creation-chat-column .creation-composer.is-compact{background:var(--liv-workspace-surface)}
.creation-studio .creation-chat-history .liv-user-message{display:block;flex:none;height:auto;min-height:0;align-self:flex-end;color:var(--liv-chat-assistant-text)}
/* 追问中的用户消息可能嵌在助手容器内，清除助手正文缩进，短气泡按文字自然收紧。 */
.creation-studio .creation-chat-history .liv-user-message p{padding:0;text-indent:0;text-align:left;color:inherit;line-height:1.7;white-space:pre-wrap}
/* 清除历史段落和助手表单对气泡的叠加留白，纯文字与带图使用相同上下内边距。 */
.creation-studio .creation-chat-history .liv-user-message{padding:12px 16px!important;margin:0 0 var(--liv-chat-gap) auto!important}
.creation-studio .creation-chat-history .liv-user-message>p{margin:0!important;padding:0!important;min-height:0;line-height:var(--liv-chat-line)!important}
.creation-studio .creation-chat-history .liv-user-message>:deep(.creation-message-assets){margin:0 0 12px;gap:8px}
.creation-studio .creation-chat-history .liv-user-message :deep(.creation-message-assets button){padding:0;min-height:0;border:0;background:transparent}
.creation-studio .creation-chat-history .liv-user-message :deep(.creation-message-assets.is-multiple img){width:var(--liv-chat-reference-thumb);height:var(--liv-chat-reference-thumb);max-width:100%;max-height:100%}
/* 同一需求各后台阶段只保留组内间距，组间仍沿用聊天轮次令牌。 */
.liv-continuous-answer{margin-bottom:var(--liv-chat-gap,24px)}
.creation-studio .creation-chat-history .liv-continuous-answer .liv-assistant-message,.creation-studio .creation-chat-history .liv-continuous-answer .creation-assistant-card{margin-bottom:12px}
.creation-assistant-card{color:var(--liv-chat-assistant-text)}
.creation-assistant-card>header img{flex:none}
.creation-assistant-card>p,.creation-assistant-card :deep(.liv-assistant-reply){color:var(--liv-chat-assistant-text)}
.creation-studio .creation-chat-history .creation-assistant-card>.liv-question-card{gap:12px}
.creation-studio .creation-chat-history .liv-question-card>button{border-radius:999px;padding:10px 16px;min-height:40px;background:var(--color-panel);border:1px solid var(--color-border-soft);color:var(--liv-chat-assistant-text)}
.liv-custom-answer{display:grid;gap:8px}.liv-custom-answer>button{justify-self:end;border-radius:999px}
/* 选择题不套灰色卡片，灰色仅用于可点击选项；长文本自然换行且维持正文规格。 */
/* 合成入口与播放器共享剩余高度，不能让按钮再叠加到100%高播放器之外。 */
.creation-canvas-column{display:flex;flex-direction:column;gap:8px}
.creation-canvas-column>button{flex:none;align-self:flex-start}
.creation-canvas-column :deep(.liv-canvas){flex:1;min-height:0;height:auto}
.liv-question-options{display:grid;gap:12px;min-width:0}
.liv-question-multiple-option{padding:12px 16px;border:1px solid var(--color-border-soft);border-radius:12px;background:var(--liv-number-surface);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line)}
.liv-question-multiple-option :deep(label){font-size:inherit;line-height:inherit}
/* 确认是表单主操作，优先级高于助手正文的左对齐选项规则，深色主按钮始终白字。 */
.creation-studio .creation-chat-history .creation-assistant-card .liv-custom-answer>button.liv-multiple-confirm{justify-self:stretch;justify-content:center;width:100%;min-height:40px;border-radius:999px;background:var(--liv-ui-primary);color:var(--liv-control-on-primary)}
.creation-assistant-card>.liv-question-options{margin-top:12px}
/* 长选项按对话阅读方向左对齐；保持整卡可点，不把多行文字居中成难扫读的段落。 */
.liv-question-options>button{display:flex;justify-content:flex-start;width:100%;min-height:40px;padding:12px 16px;border:1px solid var(--color-border-soft);border-radius:12px;background:var(--liv-number-surface);color:var(--liv-chat-assistant-text);font-size:14px;line-height:1.7;white-space:normal;text-align:left}
/* 悬停和键盘焦点同样可辨识，禁用时不响应视觉反馈。 */
.liv-question-options>button:not(:disabled):hover{background:var(--color-surface-hover)}
.liv-question-options>button:not(:disabled):focus-visible{outline:2px solid var(--liv-ui-primary);outline-offset:2px}
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
