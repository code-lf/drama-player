<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import CreationSkillCards from './CreationSkillCards.vue'
import SkillBuilderShell from './SkillBuilderShell.vue'
import CreationProcessEvents from './CreationProcessEvents.vue'
import {authoringProcessEvents} from '../processEvents'
import {skillAuthoringSummary,skillFlowSummary,isAuthoringNotice} from '../skillAuthoringSummary'
import AssistantReply from './AssistantReply.vue'
import {workspaceNavigationItems} from '../workspaceNavigation'
import SkillFlowEditor from './SkillFlowEditor.vue'
import SkillTextResources from './SkillTextResources.vue'
import SkillReferenceAssets from './SkillReferenceAssets.vue'
// 业务目录位于自动扫描目录外，显式引入弹窗，避免未知标签将关闭状态的表单直接铺到列表页。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import type {SkillFlow} from '../skillExecutionFlow'
import {stableSkillSnapshot,authoringChanges,applyAuthoringProposal,type AuthoringMessage,type AuthoringProposal} from '../skillAuthoringPreview'
import CreationSkillDetail from './CreationSkillDetail.vue'
import { skillCenterService, type SkillRecipe, type SkillAuthoringResult } from '~/shared/api/services/skillCenterService'
import type { SystemSkill, CreationCatalog } from '~/features/creation/types'
import { libraryService } from '~/shared/api/services/libraryService'
import type { LibraryItem, LibraryVersion, LibraryReference } from '~/entities/library/types'
import LibraryPicker from '~/features/library/components/LibraryPicker.vue'
/** 目录只负责浏览和编辑，试用交给外层共享创作壳，不重复创建草稿或发送链路。 */
const props=defineProps<{trialBusy?:boolean}>()
const emit=defineEmits<{try:[row:SystemSkill];tool:[]}>()
const pendingTrial=ref<SystemSkill|null>(null)
const rows = ref<SystemSkill[]>([])
const {auth,requireLogin}=useWorkbenchAuth()
import { creationService } from '~/shared/api/services/creationService'
import {skillDocumentTemplate} from '../skillDocument'
import {digitalHumanToolSkill} from '../toolSkills'
import {productVideoService} from '~/shared/api/services/productVideoService'
// 专用工具没有普通技能配方；只按真实配置开放试用，不伪装后台技能。
const digitalAvailable=ref(false),digitalChecking=ref(true)
onMounted(async()=>{try{digitalAvailable.value=(await productVideoService.getDigitalHumanAvailability()).available}catch{digitalAvailable.value=false}finally{digitalChecking.value=false}})
// 内置工具仅按分类与搜索展示，不提供没有服务端记录支持的收藏或复制按钮。
const showDigitalHumanSkill=computed(()=>!rows.value.some(row=>row.home_showcase?.category==='presenter')&&scope.value==='platform'&&(!category.value||category.value===digitalHumanToolSkill.category)&&`${digitalHumanToolSkill.label}${digitalHumanToolSkill.description}`.includes(search.value))
const enabled = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const scope = ref<'platform' | 'user' | 'favorite'>('platform')
const category = ref('recommended')
const search = ref('')
const detail = ref<SystemSkill | null>(null)
const recipe = ref<SkillRecipe | null>(null)
const editingKey = ref('')
const route=useRoute(),router=useRouter()
const draftId=ref(''),draftRevision=ref(0)
const closeBuilderOpen=ref(false)
const conversation=ref<AuthoringMessage[]>([]),proposal=ref<AuthoringProposal|null>(null)
const executionFlow=ref<SkillFlow|null>(null)
const authoringMode=ref<'document'|'steps'>('document')
const draftSaveState=ref<'idle'|'saving'|'saved'|'error'>('idle')
let autoSaveTimer:ReturnType<typeof setTimeout>|null=null,autoSavePaused=false
/** 自动保存仅提交已存在的草稿协议；失败停止重发，保留原请求号及本机修改。 */
function stopAutoSave(){if(autoSaveTimer)clearTimeout(autoSaveTimer);autoSaveTimer=null}
function scheduleAutoSave(){
  stopAutoSave()
  if(!recipe.value||busy.value||pendingFinish||autoSavePaused||editorSnapshot()===savedDraftText)return
  draftSaveState.value='idle'
  autoSaveTimer=setTimeout(()=>{autoSaveTimer=null;void persistDraft()},700)
}
/** 只在真实失败时提供重试；不是恢复一个常驻手工保存按钮。 */
async function retryAutoSave(){autoSavePaused=false;await persistDraft()}
onBeforeUnmount(stopAutoSave)
const authoringReferences=ref<LibraryReference[]>([])
const authoring=ref<SkillAuthoringResult|null>(null),acknowledgedAuthoring=ref('')
let authoringTimer:ReturnType<typeof setTimeout>|null=null
/** 页面恢复只读取原命令；离开或换号清理轮询，绝不自动重发。 */
function stopAuthoringRead(){if(authoringTimer)clearTimeout(authoringTimer);authoringTimer=null}
onBeforeUnmount(stopAuthoringRead)
function acceptAuthoring(value:SkillAuthoringResult){
  // GET 与 POST 可能乱序返回；同一请求已结束时，旧的处理中快照不能把状态倒退。
  if(authoring.value?.request_id===value.request_id&&authoring.value.status!=='processing'&&value.status==='processing')return
  authoring.value=value
  if(value.status==='processing'){error.value='';return}
  if(value.request_id===acknowledgedAuthoring.value)return
  if(value.status==='failed'){
    // 失败跟随当前对话显示，避免只放在已滚走的顶部、让用户误以为没有回复。
    conversation.value.push({role:'assistant',content:value.error||'本次整理失败，原稿保留。'})
    acknowledgedAuthoring.value=value.request_id;error.value='';return
  }
  if(!recipe.value||!value.result)return
  if(proposal.value)return
  if(value.source_revision!==draftRevision.value||(value.base_mode&&value.base_mode!==authoringMode.value)||stableSkillSnapshot(authoringReferences.value)!==stableSkillSnapshot(value.base_references||[])||stableSkillSnapshot(recipe.value.config)!==stableSkillSnapshot(value.base_config)||stableSkillSnapshot(executionFlow.value)!==stableSkillSnapshot(value.base_flow||null)){error.value='已读回原整理结果，但当前草稿已改变；未覆盖新稿。';return}
  // 无关请求或无需修改时没有候选，不能把原稿包装成“修改成功”要求用户再次确认。
  if(value.operation!=='convert'&&stableSkillSnapshot(value.result.config)===stableSkillSnapshot(value.base_config)){
    acknowledgedAuthoring.value=value.request_id
    conversation.value.push({role:'assistant',content:value.result.review||'本次未修改草稿。这里仅用于创建、优化、检查技能和转换步骤，不处理其他创作任务。'})
    error.value='';return
  }
  proposal.value={base:value.base_config,candidate:value.result.config,flow:value.result.execution_flow||null,base_flow:value.base_flow||null}
  // 左侧说明来自已校验候选的真实字段，不再只显示一句“已就绪”，不冒充已保存或已生成。
  const candidate=value.result.config
  const lines=value.operation==='convert'
    ? [skillFlowSummary(value.result.execution_flow)]
    : [skillAuthoringSummary(candidate)]
  conversation.value.push({role:'assistant',content:lines.filter(Boolean).join('\n\n')})
  error.value=''
}
async function readAuthoring(expectedRequestId?:string){
  stopAuthoringRead();const id=draftId.value,target=recipe.value,owner=auth.session.user?.id
  if(!id||!target)return
  try{
    const saved=await skillCenterService.readDraft(id)
    if(draftId.value!==id||recipe.value!==target||owner!==auth.session.user?.id)return
    // POST 可能尚未落库；等待同一请求的真实受理记录，不把上一轮结果误当本轮进度。
    if(expectedRequestId&&saved.authoring?.request_id!==expectedRequestId){authoringTimer=setTimeout(()=>void readAuthoring(expectedRequestId),2500);return}
    if(saved.authoring)acceptAuthoring(saved.authoring)
    if(saved.authoring?.status==='processing')authoringTimer=setTimeout(()=>void readAuthoring(expectedRequestId),2500)
  }catch(cause){if(recipe.value===target&&owner===auth.session.user?.id)report(cause)}
}
/** 仅用户显式结束已超时的文字等待；先停只读轮询，不重发供应商请求。 */
async function endAuthoringWait(){
  if(!authoring.value?.recovery_available||busy.value)return
  const target=recipe.value,owner=auth.session.user?.id,id=draftId.value
  const requestId=authoring.value.request_id
  busy.value=true;stopAuthoringRead()
  try{
    const result=await skillCenterService.endAuthoringWait(id,{expected_revision:draftRevision.value,request_id:requestId})
    if(recipe.value!==target||owner!==auth.session.user?.id||draftId.value!==id)return
    acceptAuthoring(result)
  }catch(cause){if(recipe.value===target&&owner===auth.session.user?.id){report(cause);void readAuthoring()}}
  finally{if(recipe.value===target&&owner===auth.session.user?.id)busy.value=false}
}
const completionOpen=ref(false),completionTrial=ref(false)
type CompletionInfo={label:string;description:string;category:string;scenarios:string;usage:string;output:string;example:string;coverReference:LibraryReference|null;coverPreviewUrl:string;coverChanged:boolean}
type SkillCoverPayload=SkillRecipe&{cover_reference?:LibraryReference|null;cover_preview_url?:string}
type CompletionCoverContext={target:SkillRecipe;draftId:string;owner:string|undefined;revision:number}
type CompletionCoverCandidate={item:LibraryItem;version:LibraryVersion;reference:LibraryReference;previewUrl:string;context:CompletionCoverContext}
const completionInfo=ref<CompletionInfo>({label:'',description:'',category:'',scenarios:'',usage:'',output:'',example:'',coverReference:null,coverPreviewUrl:'',coverChanged:false})
// 服务端读取时签发的短期预览独立保存，禁止写回技能配置或固定版本引用。
const draftCoverPreviewUrl=ref(''),completionCoverPickerOpen=ref(false),completionCoverBusy=ref(false),completionCoverError=ref('')
const completionCoverCandidate=ref<CompletionCoverCandidate|null>(null)
let completionCoverRevision=0,completionPickerContext:CompletionCoverContext|null=null
/** 取消或切换草稿时递增修订号，丢弃尚未返回的旧封面上传与选择结果。 */
function resetCompletionCoverState(){completionCoverRevision++;completionCoverPickerOpen.value=false;completionCoverBusy.value=false;completionCoverError.value='';completionCoverCandidate.value=null;completionPickerContext=null}
/** 草稿对象切换就使封面操作失效；同步清理避免新稿短暂显示旧稿封面。 */
watch(recipe,()=>{resetCompletionCoverState();draftCoverPreviewUrl.value=''},{flush:'sync'})
function completionCoverContext():CompletionCoverContext|null{
  const target=recipe.value
  if(!target||!completionOpen.value)return null
  return{target,draftId:draftId.value,owner:auth.session.user?.id,revision:completionCoverRevision}
}
/** 校验异步结果仍属于同一账号、同一草稿及当前完成表单。 */
function isCurrentCompletionCover(context:CompletionCoverContext){const sameDraft=draftId.value===context.draftId||(!context.draftId&&!!draftId.value);return context.revision===completionCoverRevision&&completionOpen.value&&recipe.value===context.target&&sameDraft&&auth.session.user?.id===context.owner}
/** 只允许个人资料库中的小于等于5MB JPG、PNG、WebP 固定图片版本。 */
function validateCompletionCover(item:LibraryItem,version:LibraryVersion){
  const mime=version.mime_type.toLowerCase()
  if(item.scope!=='personal')throw new Error('技能封面只能选择个人资料库中的图片。')
  if(item.media_type!=='image'||!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('技能封面仅支持JPG、PNG或WebP图片。')
  if(version.size_bytes>5*1024*1024)throw new Error('技能封面不能超过5MB。')
}
/** 把真实资料库固定版本转成专属封面字段，不加入生成参考素材数组。 */
function setCompletionCover(item:LibraryItem,version:LibraryVersion,previewUrl:string){
  validateCompletionCover(item,version)
  completionInfo.value.coverReference={item_id:item.id,version_id:version.id,purpose:'skill_cover'}
  completionInfo.value.coverPreviewUrl=previewUrl?libraryService.previewUrl(previewUrl):''
  completionInfo.value.coverChanged=true;completionCoverError.value=''
}
function openCompletionCoverPicker(){
  const context=completionCoverContext()
  if(!context||completionCoverBusy.value||!requireLogin())return
  completionPickerContext=context;completionCoverError.value='';completionCoverPickerOpen.value=true
}
/** 选择器允许浏览平台素材，但技能封面只接受个人范围；版本ID固定保存。 */
function selectCompletionCover(values:Array<{item:LibraryItem;version:LibraryVersion;reference:LibraryReference}>){
  const context=completionPickerContext;completionPickerContext=null
  if(!context||!isCurrentCompletionCover(context))return
  const selected=values[0]
  if(!selected)return
  try{setCompletionCover(selected.item,selected.version,selected.version.preview_url)}catch(cause){completionCoverError.value=cause instanceof Error?cause.message:'封面素材不可用。'}
}
/** 上传仅先存入个人资料库并形成候选；用户点选后才绑定到当前技能。 */
async function uploadCompletionCover(value:File|File[]|null|undefined){
  const file=Array.isArray(value)?value[0]:value,context=completionCoverContext()
  if(!file||!context||completionCoverBusy.value||!requireLogin())return
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){completionCoverError.value='请选择5MB以内的JPG、PNG或WebP图片。';return}
  completionCoverBusy.value=true;completionCoverError.value=''
  try{
    const item=await libraryService.upload(file,'other')
    if(!isCurrentCompletionCover(context))return
    const version=item.versions[0]
    if(!version)throw new Error('上传成功但没有可用的固定版本，请到资料库检查。')
    validateCompletionCover(item,version)
    completionCoverCandidate.value={item,version,reference:{item_id:item.id,version_id:version.id,purpose:'skill_cover'},previewUrl:version.preview_url,context}
  }catch(cause){if(isCurrentCompletionCover(context))completionCoverError.value=cause instanceof Error?cause.message:'封面上传失败，请重试。'}
  finally{if(context.revision===completionCoverRevision&&context.owner===auth.session.user?.id)completionCoverBusy.value=false}
}
function chooseUploadedCompletionCover(){
  const candidate=completionCoverCandidate.value
  if(!candidate||!isCurrentCompletionCover(candidate.context))return
  try{setCompletionCover(candidate.item,candidate.version,candidate.previewUrl);completionCoverCandidate.value=null}catch(cause){completionCoverError.value=cause instanceof Error?cause.message:'封面素材不可用。'}
}
/** 清除操作只暂存于完成表单；取消时不触碰技能原配置。 */
function removeCompletionCover(){completionInfo.value.coverReference=null;completionInfo.value.coverPreviewUrl='';completionInfo.value.coverChanged=true;completionCoverError.value='';completionCoverCandidate.value=null}
/** 取消只放弃本次表单候选；已上传文件仍留在个人资料库，不会绑定到技能。 */
function closeCompletion(){if(busy.value)return;completionOpen.value=false;resetCompletionCoverState()}
/** 完成前单独核对公开信息；取消不会改动正文或创建技能版本。 */
/** 空白占位文档不是可运行技能，完成或试用前必须补充实际创作指导。 */
function blankSkillDocument(){return /^# 未命名技能\s*$/.test(config.value.document||'')}
function openCompletion(trial=false){if(!recipe.value||busy.value)return;if(blankSkillDocument()){error.value='请先通过对话或编辑补充技能内容。';return}resetCompletionCoverState();const source=recipe.value as SkillCoverPayload,c=recipe.value.config,hasConfigReference=Object.prototype.hasOwnProperty.call(c,'cover_reference'),reference=hasConfigReference?c.cover_reference:source.cover_reference??null,preview=draftCoverPreviewUrl.value||source.cover_preview_url||c.cover_preview_url||c.cover||'';completionInfo.value={label:c.label,description:c.description,category:c.category,scenarios:c.public_guide?.scenarios||'',usage:c.public_guide?.usage||'',output:c.public_guide?.output||'',example:c.public_guide?.example||'',coverReference:reference,coverPreviewUrl:preview?libraryService.previewUrl(preview):'',coverChanged:false};completionTrial.value=trial;completionOpen.value=true}
async function confirmCompletion(){if(!recipe.value||!completionInfo.value.label.trim()||!completionInfo.value.description.trim()||completionCoverBusy.value)return;const {label,description,category,scenarios,usage,output,example}=completionInfo.value;Object.assign(recipe.value.config,{label,description,category,public_guide:{...recipe.value.config.public_guide,introduction:description,scenarios,usage,output,example}});if(completionInfo.value.coverChanged){recipe.value.config.cover_reference=completionInfo.value.coverReference;recipe.value.config.cover='';draftCoverPreviewUrl.value=completionInfo.value.coverPreviewUrl}await save()}
/** 试用冻结已保存修订，不经过完成表单，不偷偷创建个人技能；新编辑不能被迟到跳转吞掉。 */
async function trialDraft(){
  if(!recipe.value||busy.value||!requireLogin())return
  if(blankSkillDocument()){error.value='请先通过对话或编辑补充技能内容。';return}
  const target=recipe.value,owner=auth.session.user?.id
  await persistDraft()
  if(recipe.value!==target||owner!==auth.session.user?.id)return
  if(pendingDraft||savedDraftText!==editorSnapshot()){error.value='草稿尚未保存，暂不能试用。';return}
  const snapshot=editorSnapshot(),id=draftId.value
  busy.value=true
  try{
    const result=await skillCenterService.trialDraft(id,{expected_revision:draftRevision.value,request_id:crypto.randomUUID()})
    if(recipe.value!==target||owner!==auth.session.user?.id)return
    if(editorSnapshot()!==snapshot){error.value='原稿试用已准备，期间的新修改已保留；请再次试用最新稿。';return}
    await router.push({path:'/dashboard',query:{session:result.session.id}})
  }catch(cause){if(recipe.value===target&&owner===auth.session.user?.id)report(cause)}
  finally{if(recipe.value===target&&owner===auth.session.user?.id)busy.value=false}
}
/** 上传仅加入助手分析上下文，绝不混入技能永久执行素材；视频蒸馏本轮不开放。 */
async function uploadAuthoring(files:FileList){
  if(busy.value||!recipe.value)return
  const target=recipe.value,owner=auth.session.user?.id;busy.value=true
  try{for(const file of Array.from(files)){
    if(authoringReferences.value.length>=6)throw new Error('最多添加6项分析附件。')
    if(!/\.(png|jpe?g|webp|txt|md|pdf|docx)$/i.test(file.name))throw new Error('仅支持图片及 TXT、Markdown、PDF、Word 文档；视频蒸馏待支持。')
    const item=await libraryService.upload(file,'other');if(recipe.value!==target||owner!==auth.session.user?.id)return
    const version=item.versions[0];if(!version)throw new Error('上传未返回有效素材版本。')
    const reference:LibraryReference={item_id:item.id,version_id:version.id,purpose:'reference'}
    if(item.media_type==='document'){const doc=await libraryService.readDocument(reference);if(recipe.value!==target||owner!==auth.session.user?.id)return;if(doc.parse_status!=='ready'||!doc.total_chars||doc.total_chars>8000)throw new Error('文档需解析完成且不超过8000字，请在资料库选取片段。');reference.start=0;reference.end=doc.total_chars}
    else if(item.media_type!=='image')throw new Error('该附件类型暂不能用于技能创作。')
    authoringReferences.value.push(reference)
  }}catch(cause){report(cause)}finally{busy.value=false}
}
/** 草稿离开基线包含对话和候选，未应用的修改预览也需要保存。 */
function editorSnapshot(){return stableSkillSnapshot({authoring_mode:authoringMode.value,acknowledged_authoring:acknowledgedAuthoring.value,recipe:recipe.value,conversation:conversation.value,proposal:proposal.value,authoring_references:authoringReferences.value,execution_flow:executionFlow.value})}
const previewChanges=computed(()=>proposal.value?authoringChanges(proposal.value):[])
// 候选明确列出信息及指南资源的变化，不用正文修改冒充其它字段已保存。
const previewLabels:Record<string,string>={label:'名称',description:'简介',category:'分类',requirement:'输入要求',prompt_prefix:'生成前补充',prompt_suffix:'生成后约束',instructions:'执行说明',document:'SKILL.md',public_guide:'技能信息',text_resources:'文本指南资源'}
/** 只有明确应用才改正文；已有手工修改时整体拒绝，不覆盖局部字段。 */
function applyProposal(){if(!proposal.value||!recipe.value)return;try{if(authoring.value?.base_mode&&authoring.value.base_mode!==authoringMode.value)throw new Error('创作模式已切换，请先核对原候选，未覆盖当前稿。');if(proposal.value.flow&&stableSkillSnapshot(executionFlow.value)!==stableSkillSnapshot(proposal.value.base_flow||null))throw new Error('步骤已修改，未覆盖当前步骤。');const next=applyAuthoringProposal(recipe.value.config,proposal.value);recipe.value.config=next;if(proposal.value.flow){executionFlow.value=proposal.value.flow;authoringMode.value='steps';documentTab.value='步骤'}proposal.value=null;acknowledgedAuthoring.value=authoring.value?.request_id||'';error.value=''}catch(cause){report(cause)}}
function discardProposal(){proposal.value=null;acknowledgedAuthoring.value=authoring.value?.request_id||''}
let savedDraftText=''
/** 离开前保留未保存提示；取消不清除正文、稳定请求或服务端稿。 */
async function requestCloseBuilder(){if(recipe.value&&editorSnapshot()!==savedDraftText)await persistDraft();if(recipe.value&&editorSnapshot()!==savedDraftText){closeBuilderOpen.value=true;return}void closeBuilder()}
/** 导航前保存同一草稿；失败不离开、不丢稿，目标仅来自共享固定导航目录。 */
async function navigateBuilder(path:string){
  if(busy.value)return
  // 只允许共享工作区目录中的站内页面，避免事件参数变成任意跳转。
  if(!workspaceNavigationItems.some(item=>item.to===path))return
  const target=recipe.value,owner=auth.session.user?.id
  await persistDraft()
  if(recipe.value!==target||owner!==auth.session.user?.id)return
  if(pendingDraft||savedDraftText!==editorSnapshot()){error.value='草稿尚未保存，未离开编辑。请先核对保存状态。';return}
  await closeBuilder();await router.push(path)
}
async function closeBuilder(){
  resetCompletionCoverState();draftCoverPreviewUrl.value='';completionOpen.value=false
  ++assetReadRevision;assetItems.value=[]
  localImportCandidate.value=null
  stopAutoSave()
  const query={...route.query};delete query.skillDraft
  await router.replace({query})
  recipe.value=null;closeBuilderOpen.value=false;draftId.value='';draftRevision.value=0;pendingDraft=null;pendingFinish=null;savedDraftText='';conversation.value=[];proposal.value=null;executionFlow.value=null;authoringReferences.value=[];stopAuthoringRead();authoring.value=null;acknowledgedAuthoring.value='';authoringMode.value='document';draftSaveState.value='idle';autoSavePaused=false
}
let pendingDraft:Parameters<typeof skillCenterService.writeDraft>[1]|null=null
let pendingFinish:{id:string;body:Parameters<typeof skillCenterService.finishDraft>[1];snapshot:string}|null=null
/** 自动保存沿用原幂等写协议，原请求保留至明确成功；网络响应丢失时不能换号覆盖。 */
async function persistDraft(){
  if(!recipe.value||busy.value)return
  if(pendingFinish){error.value='原完成操作尚待核对，请点击完成读取原结果。';return}
  stopAutoSave()
  if(!pendingDraft&&editorSnapshot()===savedDraftText){draftSaveState.value='saved';return}
  const target=recipe.value,owner=auth.session.user?.id
  if(!draftId.value)draftId.value=crypto.randomUUID()
  const id=draftId.value
  pendingDraft ||= {authoring_mode:authoringMode.value,acknowledged_authoring:acknowledgedAuthoring.value,expected_revision:draftRevision.value,request_id:crypto.randomUUID(),recipe:JSON.parse(JSON.stringify(target)),editing_key:editingKey.value,authoring_references:JSON.parse(JSON.stringify(authoringReferences.value)),conversation:JSON.parse(JSON.stringify(conversation.value)),proposal:proposal.value?JSON.parse(JSON.stringify(proposal.value)):null,execution_flow:executionFlow.value?JSON.parse(JSON.stringify(executionFlow.value)):null}
  busy.value=true;draftSaveState.value='saving'
  try{
    const saved=await skillCenterService.writeDraft(id,pendingDraft)
    if(owner!==auth.session.user?.id||recipe.value!==target)return
    // 只在本机仍等于发出内容时接收服务端补齐的兼容缺省字段；响应期间的新输入优先保留。
    const sent=stableSkillSnapshot({authoring_mode:pendingDraft.authoring_mode||'document',acknowledged_authoring:pendingDraft.acknowledged_authoring||'',recipe:pendingDraft.recipe,conversation:pendingDraft.conversation||[],proposal:pendingDraft.proposal||null,authoring_references:pendingDraft.authoring_references||[],execution_flow:pendingDraft.execution_flow||null})
    if(editorSnapshot()===sent){Object.assign(target,saved.recipe);conversation.value=saved.conversation||[];proposal.value=saved.proposal||null;authoringReferences.value=saved.authoring_references||[];executionFlow.value=saved.execution_flow||null;acknowledgedAuthoring.value=saved.acknowledged_authoring||'';authoringMode.value=saved.authoring_mode||(saved.execution_flow?'steps':'document');const coverReceipt=saved as typeof saved&{cover_preview_url?:string};if('cover_preview_url'in coverReceipt)draftCoverPreviewUrl.value=coverReceipt.cover_preview_url?libraryService.previewUrl(coverReceipt.cover_preview_url):''}
    draftRevision.value=Math.max(draftRevision.value,saved.revision);pendingDraft=null
    // 重试旧请求期间仍可能有新编辑，以真正保存的服务端快照作为离开基线。
    savedDraftText=stableSkillSnapshot({authoring_mode:saved.authoring_mode||(saved.execution_flow?'steps':'document'),acknowledged_authoring:saved.acknowledged_authoring||'',recipe:saved.recipe,conversation:saved.conversation||[],proposal:saved.proposal||null,authoring_references:saved.authoring_references||[],execution_flow:saved.execution_flow||null})
    await router.replace({query:{...route.query,skillDraft:id}})
    draftSaveState.value=editorSnapshot()===savedDraftText?'saved':'idle';autoSavePaused=false
  }catch(cause){if(owner===auth.session.user?.id&&recipe.value===target){draftSaveState.value='error';autoSavePaused=true;report(cause)}}finally{if(owner===auth.session.user?.id&&recipe.value===target){busy.value=false;scheduleAutoSave()}}
}
/** 只在已登录且没有本机编辑时恢复路由指定稿，不自动发送或生成。 */
async function restoreSkillDraft(){
  const id=route.query.skillDraft,owner=auth.session.user?.id
  if(typeof id!=='string'||!owner||recipe.value)return
  try{
    const saved=await skillCenterService.readDraft(id)
    if(owner!==auth.session.user?.id||recipe.value||route.query.skillDraft!==id)return
    recipe.value=saved.recipe;editingKey.value=saved.editing_key;draftId.value=id;draftRevision.value=saved.revision;pendingDraft=null
    const coverReceipt=saved as typeof saved&{cover_preview_url?:string};draftCoverPreviewUrl.value=coverReceipt.cover_preview_url?libraryService.previewUrl(coverReceipt.cover_preview_url):''
    conversation.value=saved.conversation||[];proposal.value=saved.proposal||null;executionFlow.value=saved.execution_flow||null
    authoringReferences.value=saved.authoring_references||[];acknowledgedAuthoring.value=saved.acknowledged_authoring||''
    authoringMode.value=saved.authoring_mode||(saved.execution_flow?'steps':'document');documentTab.value=authoringMode.value==='steps'?'步骤':'文档'
    savedDraftText=editorSnapshot();draftSaveState.value='saved';autoSavePaused=false
    if(saved.authoring){acceptAuthoring(saved.authoring);if(saved.authoring.status==='processing')void readAuthoring()}
    if(saved.completion){pendingFinish={id,body:{expected_revision:saved.revision,request_id:crypto.randomUUID()},snapshot:editorSnapshot()};error.value='此草稿已完成，点击完成读取原结果，不会创建新版本。'}
  }catch(cause){report(cause)}
}
onMounted(restoreSkillDraft)
const importedText = ref('')
const importOpen = ref(false)
const localImportCandidate=ref<SkillRecipe|null>(null)
/** 导入前先保留原稿；解析不执行模型或媒体，错误文件也不能污染当前编辑身份。 */
async function previewLocalSkill(file:File){
  if(!recipe.value||busy.value)return
  if(file.size>128*1024){error.value='技能文件最多128KB。';return}
  const target=recipe.value,owner=auth.session.user?.id
  await persistDraft()
  if(recipe.value!==target||owner!==auth.session.user?.id)return
  if(pendingDraft||editorSnapshot()!==savedDraftText){error.value='原稿尚未保存，未开始导入。';return}
  busy.value=true
  try{const content=await file.text();const candidate=await skillCenterService.importPreview(content,target.base_code);if(recipe.value===target&&owner===auth.session.user?.id)localImportCandidate.value=candidate}
  catch(cause){if(recipe.value===target&&owner===auth.session.user?.id)report(cause)}
  finally{if(recipe.value===target&&owner===auth.session.user?.id)busy.value=false}
}
/** 用户确认后才建立新的草稿身份；原草稿已落库，导入不是覆盖原版本。 */
async function applyLocalSkill(){
  if(!localImportCandidate.value||busy.value)return
  const candidate=localImportCandidate.value,target=recipe.value,owner=auth.session.user?.id
  // 预览期间仍可能编辑原稿；只有该最新内容已保存且身份未变化，才切换到新草稿。
  await persistDraft()
  if(recipe.value!==target||auth.session.user?.id!==owner||localImportCandidate.value!==candidate)return
  if(pendingDraft||savedDraftText!==editorSnapshot()){error.value='原草稿尚未保存，请先核对后再导入。';return}
  busy.value=true
  try{
  await closeBuilder()
  // 异步路由切换期间账号可能变化，不把旧账号导入候选带入新账号。
  if(auth.session.user?.id!==owner)return
  recipe.value={...candidate,expected_version:0};editingKey.value='';documentTab.value='文档';authoringMode.value='document'
  localImportCandidate.value=null
  }finally{busy.value=false}
}
const documentTab = ref('文档')
/** 首次进入步骤由 AI 转换当前已保存文档；已有流程只切视图，不重复生成或覆盖手改步骤。 */
async function toggleAuthoringMode(){
  if(!recipe.value||busy.value)return
  if(proposal.value){error.value='请先核对对话中的修改候选，应用或放弃后再切换。';return}
  if(authoringMode.value==='document'&&!executionFlow.value?.steps.length){
    if(!config.value.document?.trim()||blankSkillDocument()){error.value='请先补充技能文档，再由 AI 转换步骤。';return}
    await assist('convert');return
  }
  authoringMode.value=authoringMode.value==='document'?'steps':'document'
  documentTab.value=authoringMode.value==='steps'?'步骤':'文档'
}
const stepModels=ref<Array<{code:string;target:string;name?:string}>>([])
const stepStyles=ref<CreationCatalog['styles']>([])
/** 按草稿身份和账号加载目录；即使基础能力相同，切稿后也要重新读取并丢弃迟到响应。 */
watch([recipe,()=>auth.session.user?.id],async ([target,owner])=>{stepModels.value=[];stepStyles.value=[];const code=target?.base_code;if(!code)return;try{const result=await skillCenterService.authoringCapabilities(code);if(recipe.value===target&&auth.session.user?.id===owner){stepModels.value=result.models;stepStyles.value=result.styles||[]}}catch(cause){if(recipe.value===target&&auth.session.user?.id===owner)report(cause)}})
const assistDescription = ref(''), assetItems = ref<LibraryItem[]>([])
const config = computed(() => recipe.value?.config || {})
const scoped = computed(() => rows.value.filter(row => scope.value === 'favorite' ? row.is_favorite : row.kind === scope.value))
// 分类从当前真实目录生成，不呈现无数据分类。
// 展示分类按用户确认的顺序，旧数据通过别名映射继续可检索。
const categories = ['自媒体','广告营销','游戏','短漫剧','周边设计']
/** 兼容既有目录分类；后台填写新分类时直接使用，不迁移或覆盖历史版本。 */
function displayCategory(row: SystemSkill){
  // 运营已填写的新分类优先；旧视频分类中的广告与展示不能误归到自媒体。
  if(categories.includes(row.category))return row.category
  if(['product','poster','showcase','ad'].includes(row.base_code || row.id))return '广告营销'
  return ({通用:'自媒体',视频:'自媒体',音乐:'自媒体',电商:'广告营销',短剧:'短漫剧',图片:'周边设计'} as Record<string,string>)[row.category] || row.category
}
const visible = computed(() => scoped.value.filter(row => (!category.value || (category.value==='recommended'?!!row.recommended_entries?.length:displayCategory(row) === category.value)) && `${row.label} ${row.description}`.toLowerCase().includes(search.value.toLowerCase())))
watch(scope, () => { if(scope.value!=='platform')category.value = '' })
function report(cause: unknown) { error.value = cause instanceof Error ? cause.message : '操作失败，请稍后重试。' }
let refreshRevision=0
/** 目录随账号隔离，旧账号或卸载后的迟到响应不能覆盖当前公开／私人列表。 */
async function refresh() {
  const revision=++refreshRevision,owner=auth.session.user?.id
  loading.value = true
  try { const data = auth.session.loggedIn ? await skillCenterService.list() : {...await creationService.publicCatalog('free'),user_skills_enabled:false};if(revision!==refreshRevision||owner!==auth.session.user?.id)return; rows.value = data.skills; enabled.value = data.user_skills_enabled; error.value = '' } catch (cause) { if(revision===refreshRevision&&owner===auth.session.user?.id)report(cause) } finally { if(revision===refreshRevision)loading.value = false }
}
onMounted(refresh)
onBeforeUnmount(()=>{++refreshRevision;pendingTrial.value=null;resetCompletionCoverState()})
watch(()=>auth.session.user?.id,()=>{
  resetCompletionCoverState();draftCoverPreviewUrl.value=''
  ++assetReadRevision;assetItems.value=[]
  localImportCandidate.value=null
  // 换号先清理原账号的计时器和写入身份，再恢复新账号草稿，避免两个watch互相覆盖。
  stopAutoSave();stopAuthoringRead();authoring.value=null;acknowledgedAuthoring.value='';draftId.value='';draftRevision.value=0
  pendingDraft=null;pendingFinish=null;savedDraftText='';autoSavePaused=false;draftSaveState.value='idle'
  busy.value=false;completionOpen.value=false;closeBuilderOpen.value=false;conversation.value=[];proposal.value=null;executionFlow.value=null;authoringReferences.value=[];authoringMode.value='document';documentTab.value='文档'
  rows.value=[];recipe.value=null;detail.value=null;pendingTrial.value=null;void refresh();void restoreSkillDraft()
})
async function favorite(row: SystemSkill) {
  if(!requireLogin())return
  if (busy.value) return
  busy.value = true
  try { await skillCenterService.favorite(row.id, !row.is_favorite); row.is_favorite = !row.is_favorite } catch (cause) { report(cause) } finally { busy.value = false }
}
function trySkill(row: SystemSkill) {
  if (row.is_active === false||props.trialBusy) return
  // 详情试用等组件关闭完成后再展开输入，避免焦点陷阱把焦点带回目录。
  if(detail.value){pendingTrial.value=row;detail.value=null;return}
  emit('try',row)
}
/** 组件关闭结束后才交接试用；普通 Esc 关闭不改输入框状态。 */
function finishDetail(){const row=pendingTrial.value;pendingTrial.value=null;if(row)emit('try',row)}
async function edit(row?: SystemSkill, copy = false) {
  if(!requireLogin())return
  error.value = ''
  try {
    const base = row || rows.value.find(item => item.kind === 'platform')
    if (!base) throw new Error('暂无可用基础技能，请联系管理员。')
    const data = await skillCenterService.export(base.id,true)
    resetCompletionCoverState();draftCoverPreviewUrl.value=''
    recipe.value = data.skill
    stopAutoSave();draftId.value='';draftRevision.value=0;pendingDraft=null;savedDraftText='';conversation.value=[];proposal.value=null;executionFlow.value=null;authoringReferences.value=[];stopAuthoringRead();authoring.value=null;acknowledgedAuthoring.value='';authoringMode.value='document';documentTab.value='文档';draftSaveState.value='idle';autoSavePaused=false
    editingKey.value = row?.kind === 'user' && !copy ? row.id : ''
    recipe.value.expected_version = editingKey.value ? base.version : 0
    const exported=data.skill as SkillCoverPayload
    // 导出配方只保留固定编号，临时预览来自本人目录读取结果，不写入可导出的配置。
    if(editingKey.value){if(Object.prototype.hasOwnProperty.call(exported,'cover_reference'))recipe.value.config.cover_reference=exported.cover_reference;const preview=base.cover_preview_url||exported.cover_preview_url;draftCoverPreviewUrl.value=preview?libraryService.previewUrl(preview):''}
    else{delete recipe.value.config.cover_reference;delete recipe.value.config.cover_preview_url;recipe.value.config.cover=''}
    if (!row) {
      // 空白新建不继承基础技能的创作正文或示例；平台能力与必需素材限制仍由服务端校验。
      Object.assign(recipe.value.config,{label:'未命名技能',description:'请填写技能简介',guidance_mode:'markdown',
        document:'# 未命名技能\n',requirement:'',prompt_prefix:'',prompt_suffix:'',instructions:'',
        examples:[],questions:[],workflow_steps:[],text_resources:[],public_guide:null})
      recipe.value.references=[]
    } else if (!editingKey.value) recipe.value.config.label = `我的${base.label}`
    detail.value = null
  } catch (cause) { report(cause) }
}
async function changeBase(event: Event) {
  if(pendingFinish){error.value='请先核对原完成结果，不能切换基础能力。';return}
  const row = rows.value.find(item => item.id === (event.target as HTMLSelectElement).value)
  if (row) await edit(row, true)
}
/** 完成只引用服务端已保存修订；未知结果保留原请求以恢复，不重复创建版本。 */
async function save() {
  if(!requireLogin()||!recipe.value||busy.value)return
  const target=recipe.value,owner=auth.session.user?.id
  if(!pendingFinish){
    if(proposal.value){error.value='请先应用或放弃修改预览，再完成技能。';return}
    await persistDraft()
    if(recipe.value!==target||owner!==auth.session.user?.id)return
    if(pendingDraft||savedDraftText!==editorSnapshot()){error.value='草稿尚未全部保存，请先核对再完成。';return}
    pendingFinish={id:draftId.value,body:{expected_revision:draftRevision.value,request_id:crypto.randomUUID()},snapshot:editorSnapshot()}
  }
  busy.value=true
  try{
    const request=pendingFinish
    const result=await skillCenterService.finishDraft(request.id,request.body)
    if(recipe.value!==target||owner!==auth.session.user?.id)return
    // 同一草稿试用复用稳定会话编号；响应丢失重试不建第二个画布，不提交媒体。
    const trialSession=completionTrial.value&&editorSnapshot()===request.snapshot?await creationService.create({id:request.id,entry:result.skill.entries[0]||'free',skill:result.skill.id,title:`试用 · ${result.skill.label}`}):null
    if(recipe.value!==target||owner!==auth.session.user?.id)return
    pendingFinish=null
    if(editorSnapshot()!==request.snapshot){
      // 完成期间发生的新编辑留在本机，后续只能针对已创建技能另存新版本。
      editingKey.value=result.skill.id;target.expected_version=result.skill.version
      draftId.value='';draftRevision.value=0;savedDraftText=''
      const query={...route.query};delete query.skillDraft;await router.replace({query})
      error.value='原稿已完成，期间的新修改已保留，请另存草稿后完成新版本。';return
    }
    completionOpen.value=false;await closeBuilder();scope.value='user';category.value='';search.value='';await refresh();if(trialSession){await router.push({path:'/dashboard',query:{session:trialSession.id}})}
  }catch(cause){report(cause)}finally{busy.value=false}
}
async function archive(row: SystemSkill) {
  if(!requireLogin())return
  // 归档只隐藏新试用入口，不删除不可变版本及历史任务。
  busy.value = true
  try { await skillCenterService.archive(row.id); detail.value = null; await refresh() } catch (cause) { report(cause) } finally { busy.value = false }
}
async function download(row: SystemSkill) {
  if(!requireLogin())return
  try {
    const data = await skillCenterService.export(row.id)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'liv-skill.json'; link.click(); URL.revokeObjectURL(url)
  } catch (cause) { report(cause) }
}
async function importRecipe() {
  if(!requireLogin())return
  try { recipe.value = await skillCenterService.importPreview(importedText.value); recipe.value.expected_version = 0; editingKey.value = ''; importOpen.value = false } catch (cause) { report(cause) }
}
/** 私有资源仅从本人素材库读取，选择时固定版本；不把文件地址当授权凭证。 */
let assetReadRevision=0
async function loadAssets(){
  const target=recipe.value,owner=auth.session.user?.id,revision=++assetReadRevision
  if(!target||!owner)return
  try{
    const base=rows.value.find(row=>row.id===target.base_code)
    const result=await libraryService.list({scope:'personal'})
    // 私有目录迟到时不能落入另一账号或另一技能，也不能覆盖更新的目录读取。
    if(recipe.value!==target||auth.session.user?.id!==owner||revision!==assetReadRevision)return
    assetItems.value=result.items.filter(item=>base?.media_types.includes(item.media_type))
  }catch(cause){if(recipe.value===target&&auth.session.user?.id===owner&&revision===assetReadRevision)report(cause)}
}
function toggleAsset(item: LibraryItem, version: LibraryVersion){if(!recipe.value)return;const index=recipe.value.references.findIndex(ref=>ref.version_id===version.id);if(index>=0)recipe.value.references.splice(index,1);else if(recipe.value.references.length<12)recipe.value.references.push({item_id:item.id,version_id:version.id,purpose:item.media_type==='video'?'reference_video':'reference'})}
/** 只应用到发起时的同一草稿；期间手工编辑或切换账号后保留新稿。 */
async function assist(operation:'edit'|'convert'='edit'){
  if(!recipe.value||busy.value)return
  if(authoring.value?.status==='processing'){void readAuthoring();return}
  if(proposal.value){error.value='请先应用或放弃当前修改预览。';return}
  if(conversation.value.length>36){error.value='本稿对话较长，请保存后新建草稿继续整理。';return}
  const requestText=operation==='convert'?'请转换成步骤式 SKILL 界面。读取当前文档与资源，生成步骤、执行要求、提示词模板及前序依赖；保留原文，未支持的能力明确标注。':assistDescription.value.trim()
  if(!requestText)return
  const actualOperation=operation==='convert'||/转.{0,8}步骤/.test(requestText)?'convert':'edit'
  const target=recipe.value,owner=auth.session.user?.id
  conversation.value.push({role:'user',content:requestText})
  // 先保存并取得可恢复地址；保存响应未核实时绝不调用模型。
  await persistDraft()
  if(recipe.value!==target||owner!==auth.session.user?.id)return
  if(pendingDraft||savedDraftText!==editorSnapshot()){error.value='草稿尚未全部保存，未发送整理请求。';return}
  const id=draftId.value,body={request_id:crypto.randomUUID(),expected_revision:draftRevision.value,description:requestText,operation:actualOperation as 'edit'|'convert'}
  // 用户消息已经持久化，发送即清空输入；原命令由收据恢复，不留旧文字诱发重复发送。
  // 保存失败在上方返回，仍保留尚未发出的文字；转换按钮不清空用户未发送的新稿。
  if(operation!=='convert')assistDescription.value=''
  busy.value=true
  try{
    const response=skillCenterService.draftAssist(id,body)
    // 模型等待期间只读服务端已持久化事件，让左侧实时显示读取、转换的真实状态。
    authoringTimer=setTimeout(()=>void readAuthoring(body.request_id),500)
    const result=await response
    if(recipe.value!==target||owner!==auth.session.user?.id||draftId.value!==id)return
    stopAuthoringRead()
    acceptAuthoring(result)
    if(result.status==='processing')void readAuthoring()
  }catch(cause){
    if(recipe.value===target&&owner===auth.session.user?.id){error.value='整理受理状态待核对，正在读取原结果；不会自动重发。';void readAuthoring()}
  }finally{busy.value=false}
}
async function importFile(event: Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;if(file.size>128*1024){error.value='技能文档最多 128KB。';return}importedText.value=await file.text();input.value=''}
/** 附件通过真实个人资料库上传，保存为固定版本；基础能力不支持的类型不自动引用。 */
async function uploadAttachment(event: Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(!file || !recipe.value || busy.value)return
  busy.value=true
  try{const item=await libraryService.upload(file,'other');const base=rows.value.find(row=>row.id===recipe.value?.base_code);if(!base?.media_types.includes(item.media_type))throw new Error('附件已保存至个人资料库，但当前基础能力不能引用此类型。');if(item.versions[0])toggleAsset(item,item.versions[0]);await loadAssets()}catch(cause){report(cause)}finally{busy.value=false;input.value=''}
}
const documentPreview = computed(() => recipe.value ? JSON.stringify({ format: 'liv-skill-v1', license: 'private', skill: recipe.value }, null, 2) : '')
// 监听完整业务快照；保存本身不调模型、不完成技能、不改变费用授权。
watch(editorSnapshot,scheduleAutoSave)
watch(busy,value=>{if(!value)scheduleAutoSave()})
</script>
<template>
  <section class="skill-center">
    <LivDialog v-if="localImportCandidate" :open="!!localImportCandidate" title="核对本地技能" settings dark @update:open="value=>{if(!value)localImportCandidate=null}">
      <p>确认后作为新技能草稿打开，原草稿保留。文档中的工具和模型建议不授予执行权限。</p>
      <p>{{localImportCandidate.config.label}} · 基础能力：{{localImportCandidate.base_code}}</p>
      <UTextarea :model-value="localImportCandidate.config.document||localImportCandidate.config.instructions||localImportCandidate.config.description" readonly :rows="12" class="w-full" aria-label="导入技能预览"/>
      <template #footer><LivButton settings variant="secondary" @click="localImportCandidate=null">取消</LivButton><LivButton settings variant="primary" @click="applyLocalSkill">作为新草稿打开</LivButton></template>
    </LivDialog>
    <!-- 完成表单与编辑对话分开，个人技能不伪造团队或公开发布能力。 -->
    <LivDialog v-if="completionOpen && recipe" :open="completionOpen" title="基础信息" settings dark @update:open="value=>{if(!value)closeCompletion()}">
      <form class="builder-completion" @submit.prevent="confirmCompletion">
        <section class="completion-cover-field" aria-label="技能封面">
          <div class="completion-cover-heading"><strong>技能封面</strong><small>仅使用本人个人资料库 JPG、PNG、WebP 图片，最大 5MB。封面只用于技能展示，不会作为生成参考素材。</small></div>
          <div class="completion-cover-preview">
            <img v-if="completionInfo.coverPreviewUrl" :src="completionInfo.coverPreviewUrl" alt="技能封面预览" class="completion-cover"/>
            <span v-else-if="completionInfo.coverReference" class="completion-cover-empty">已绑定个人资料库固定版本</span>
            <span v-else class="completion-cover-empty">尚未设置封面</span>
          </div>
          <div class="completion-cover-actions">
            <UFileUpload accept="image/png,image/jpeg,image/webp" icon="i-lucide-upload" label="上传图片" description="JPG、PNG、WebP · 最大5MB" :disabled="completionCoverBusy" @update:model-value="uploadCompletionCover"/>
            <UButton type="button" variant="soft" :disabled="completionCoverBusy" @click="openCompletionCoverPicker">从资料库选择</UButton>
            <UButton v-if="completionInfo.coverReference||completionInfo.coverPreviewUrl||config.cover" type="button" variant="ghost" :disabled="completionCoverBusy" @click="removeCompletionCover">移除封面</UButton>
          </div>
          <p v-if="completionCoverBusy" role="status">正在上传到个人资料库…</p>
          <div v-if="completionCoverCandidate" class="completion-cover-candidate">
            <span>已上传到个人资料库：{{completionCoverCandidate.item.name}}。确认选择后才会设为封面。</span>
            <div><UButton type="button" variant="primary" @click="chooseUploadedCompletionCover">选为技能封面</UButton><UButton type="button" variant="ghost" @click="completionCoverCandidate=null">暂不使用</UButton></div>
          </div>
          <p v-if="completionCoverError" role="alert" class="completion-cover-error">{{completionCoverError}}</p>
        </section>
        <label>Skill 名称 *<UInput v-model="completionInfo.label" :maxlength="80" required/></label>
        <label>描述 *<UTextarea v-model="completionInfo.description" :maxlength="1000" :rows="3" required/></label>
        <label>分类<UInput v-model="completionInfo.category" :maxlength="40" required/></label>
        <p>可见范围：仅自己可见。团队共享与公开发布暂未开放。</p>
        <label>最佳实践<UTextarea v-model="completionInfo.example" :maxlength="3000" :rows="3"/></label>
        <label>适用场景<UTextarea v-model="completionInfo.scenarios" :maxlength="2000" :rows="2"/></label>
        <label>如何使用<UTextarea v-model="completionInfo.usage" :maxlength="3000" :rows="2"/></label>
        <label>输出内容<UTextarea v-model="completionInfo.output" :maxlength="2000" :rows="2"/></label>
        <p v-if="completionTrial">确认后保存当前私有技能版本并进入创作页试用，不自动发送或生成媒体。</p>
        <p v-if="error" role="alert">{{error}}</p>
      </form>
      <template #footer><LivButton settings variant="secondary" :disabled="busy" @click="closeCompletion">返回编辑</LivButton><LivButton settings variant="primary" :loading="busy" :disabled="busy||completionCoverBusy||!completionInfo.label.trim()||!completionInfo.description.trim()||!completionInfo.category.trim()" @click="confirmCompletion">{{completionTrial?'保存并试用':'完成'}}</LivButton></template>
    </LivDialog>
    <LibraryPicker v-if="completionCoverPickerOpen" :open="completionCoverPickerOpen" kind="image" :remaining="1" media-type="image" dark @select="selectCompletionCover" @update:open="value=>{completionCoverPickerOpen=value;if(!value)completionPickerContext=null}"/>
    <LivDialog v-if="closeBuilderOpen" :open="closeBuilderOpen" title="离开技能编辑？" description="未保存的修改将不再保留；已保存的草稿和技能不受影响。" settings dark @update:open="closeBuilderOpen=$event"><template #footer><LivButton settings variant="secondary" @click="closeBuilderOpen=false">继续编辑</LivButton><LivButton settings variant="primary" @click="closeBuilder">放弃未保存修改</LivButton></template></LivDialog>
    <header><div><h1>技能</h1><p>选择平台能力，或创建自己的私有创作配方。</p></div><div class="actions"><button class="primary" :disabled="!enabled" @click="edit()">＋ 创建我的技能</button></div></header>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="filters"><nav class="category-nav" aria-label="技能分类"><button :class="{active:scope!=='platform'}" @click="scope='user'">我的技能</button><span class="nav-divider"/><button :class="{active:scope==='platform'&&category==='recommended'}" @click="scope='platform';category='recommended'">推荐</button><button :class="{active:scope==='platform'&&!category}" @click="scope='platform';category=''">全部</button><button v-for="name in categories" :key="name" :class="{active:scope==='platform'&&category===name}" @click="scope='platform';category=name">{{ name }}</button></nav><input v-model="search" type="search" placeholder="搜索技能" aria-label="搜索技能"></div>
    <div v-if="scope!=='platform'" class="categories"><button :class="{active:scope==='user'}" @click="scope='user'">我创建的</button><button :class="{active:scope==='favorite'}" @click="scope='favorite'">我收藏的</button></div>
    <div v-if="loading" class="grid" aria-label="正在加载技能"><div v-for="index in 6" :key="index" class="skeleton" /></div>
<CreationSkillCards v-else-if="visible.length||showDigitalHumanSkill" :skills="visible" :busy="trialBusy" @preview="detail=$event" @try="trySkill"><article v-if="showDigitalHumanSkill" class="skill-directory-tool"><img :src="digitalHumanToolSkill.cover" :alt="digitalHumanToolSkill.label"><div><strong>{{digitalHumanToolSkill.label}}</strong><p>{{digitalHumanToolSkill.description}}</p><UButton color="neutral" variant="solid" :disabled="!digitalAvailable||trialBusy" @click="emit('tool')">{{digitalChecking?'读取中':digitalAvailable?'试一试':'暂未配置'}}</UButton></div></article></CreationSkillCards>
    <div v-else class="empty">{{ scope==='user'?'还没有个人技能，点击创建或复制平台配方。':'暂无匹配技能。' }}</div>
    <CreationSkillDetail :skill="detail" :busy="trialBusy" @close="detail=null" @closed="finishDetail" @try="trySkill" @favorite="(id,enabled)=>{const row=rows.find(row=>row.id===id);if(row)row.is_favorite=enabled}"><template #manage><div class="actions"><UButton :disabled="!enabled" @click="edit(detail!,true)">复制为我的技能</UButton><template v-if="detail?.kind==='user'"><UButton @click="edit(detail)">编辑</UButton><UButton @click="download(detail)">导出</UButton><UButton :disabled="busy" @click="archive(detail)">归档</UButton></template></div></template></CreationSkillDetail>
<SkillBuilderShell v-if="recipe" :title="config.label" :steps-mode="authoringMode==='steps'&&documentTab==='步骤'" :busy="busy" :message="error" :prompt="assistDescription" @update:prompt="assistDescription=$event" :can-assist="!!assistDescription.trim()" @update:title="config.label=$event" @close="requestCloseBuilder" @navigate="navigateBuilder" @save="openCompletion()" @trial="trialDraft" @upload="uploadAuthoring" @import="previewLocalSkill" @assist="assist">
      <template #save-status><UButton v-if="draftSaveState==='error'" icon="i-lucide-refresh-cw" color="neutral" variant="ghost" aria-label="重试自动保存" :disabled="busy" @click="retryAutoSave">保存失败，重试</UButton></template>
      <!-- 候选操作跟随对话，不在文档上方展开重复字段清单；原稿保护沿用原方法。 -->
      <template #conversation><article v-for="(message,index) in conversation.filter(item=>!isAuthoringNotice(item))" :key="index" class="builder-chat" :class="message.role"><!-- 当前命令的真实阶段位于最终说明前，不集中堆在说明末尾。 --><CreationProcessEvents v-if="authoring&&message.role==='assistant'&&index===conversation.filter(item=>!isAuthoringNotice(item)).length-1" :events="authoringProcessEvents(authoring)"/><AssistantReply v-if="message.role==='assistant'" :text="message.content.startsWith('已整理「')&&authoring?.result&&message.content.includes('「'+authoring.result.config.label+'」')?skillAuthoringSummary(authoring.result.config):message.content"/><p v-else>{{message.content}}</p></article>
        <!-- 旧草稿只保存“候选就绪”短句，读取时从原候选补展示，不改写历史正文。 -->
        <article v-if="authoring?.status==='ready'&&authoring.operation!=='convert'&&authoring.result&&!conversation.some(item=>item.content.startsWith('已整理「'))" class="builder-chat assistant"><AssistantReply :text="skillAuthoringSummary(authoring.result.config)"/></article>
        <!-- 这里只投影服务端命令状态，不将模型描述的工具调用当成真实操作。 -->
        <div v-if="authoring&&authoringProcessEvents(authoring).length&&conversation.filter(item=>!isAuthoringNotice(item)).at(-1)?.role!=='assistant'" class="builder-command-events" aria-label="本次整理处理记录">
          <CreationProcessEvents :events="authoringProcessEvents(authoring)"/>
        </div>
        <div v-if="proposal" class="builder-candidate-actions"><UButton :disabled="busy||(!previewChanges.length&&!proposal.flow)" @click="applyProposal">应用修改</UButton><UButton color="neutral" variant="ghost" :disabled="busy" @click="discardProposal">放弃</UButton></div></template>
<UButton v-if="authoring?.status==='processing'" color="neutral" variant="soft" @click="readAuthoring()">读取原整理结果</UButton><UButton v-if="authoring?.status==='ready'&&!proposal&&acknowledgedAuthoring!==authoring.request_id" color="neutral" variant="ghost" @click="acknowledgedAuthoring=authoring.request_id">放弃原整理结果，保留当前稿</UButton>
      <section v-if="authoring?.status==='processing'&&authoring.recovery_available" class="builder-recovery"><p>整理等待已超过10分钟，可保留原稿并结束等待。此操作不取消供应商请求，也不会自动重发。</p><UButton color="neutral" variant="soft" :disabled="busy" @click="endAuthoringWait">结束等待并保留原稿</UButton></section>
      <template #attachments><div v-if="authoringReferences.length" class="builder-attachments"><UButton v-for="(reference,index) in authoringReferences" :key="reference.version_id" color="neutral" variant="soft" icon="i-lucide-paperclip" :disabled="busy" @click="authoringReferences.splice(index,1)">分析附件 {{index+1}} ×</UButton><small>文档按已上传全文读取；仅供助手分析，不随技能共享。</small></div></template>
      <div class="tabs"><button v-for="tab in [authoringMode==='steps'?'Skill 流程':'SKILL.md','资源附件','引用资产']" :key="tab" :class="{active:(documentTab==='文档'?'SKILL.md':documentTab==='步骤'?'Skill 流程':documentTab)===tab}" @click="documentTab=tab==='SKILL.md'?'文档':tab==='Skill 流程'?'步骤':tab; if(tab==='引用资产')loadAssets()">{{ tab }}</button><UButton class="builder-view-toggle" color="neutral" variant="ghost" :disabled="busy" @click="toggleAuthoringMode">{{authoringMode==='steps'?'切换为文档视图':'切换为步骤视图'}}</UButton></div><p v-if="documentTab==='步骤' && executionFlow?.source_document != null && executionFlow.source_document !== config.document" role="status" class="flow-document-notice">文档已变更，步骤可能需要更新；原文与步骤均已保留，可通过对话重新转换并先核对候选。</p><SkillFlowEditor :models="stepModels" :styles="stepStyles" v-if="documentTab==='步骤'" v-model="executionFlow"/><section v-else-if="documentTab==='文档'" class="builder-document-editor"><label><span class="sr-only">SKILL.md 专业文档</span><UTextarea v-model="config.document" aria-label="技能专业文档" :rows="16" :maxlength="20000" class="w-full flex-1 min-h-0" :ui="{base:'h-full resize-none'}"/></label><UButton v-if="!config.document" variant="soft" @click="config.document=skillDocumentTemplate(config.label)">填入文档模板</UButton></section><SkillTextResources v-else-if="documentTab==='资源附件'" :model-value="config.text_resources||[]" :busy="busy" @update:model-value="config.text_resources=$event"/><SkillReferenceAssets v-else :items="assetItems" :references="recipe.references" :busy="busy" @refresh="loadAssets" @toggle="toggleAsset" @remove="recipe.references=recipe.references.filter(ref=>ref.version_id!==$event)"/>
    </SkillBuilderShell>
    <div v-if="importOpen" class="overlay" @click.self="importOpen=false"><section class="dialog"><header><h2>导入 JSON / SKILL.md</h2><button @click="importOpen=false">×</button></header><p>请确认内容使用许可；只接受 liv-skill-v1 JSON 或 liv-skill-json 配方块。未知步骤与脚本不会执行。可先导出个人技能作为示例。</p><label>选择配方文件<input type="file" accept=".json,.md" @change="importFile" /></label><textarea v-model="importedText" class="import" placeholder="粘贴受控配方文档" /><p v-if="error" class="error">{{ error }}</p><button class="primary" @click="importRecipe">校验并预览</button></section></div>
  </section>
</template>
<style scoped>
.builder-candidate-actions{display:flex;align-items:center;gap:8px;margin-bottom:16px}
/* 处理记录是紧凑状态卡，不是执行流程图；沿用工作台表面、字体和图标尺寸。 */
.builder-command-events{display:grid;gap:8px;margin:0 0 16px}
.flow-document-notice{margin:12px 0;color:var(--liv-account-muted);font-size:13px;line-height:1.7}
/* 制造机隔离目录旧表单样式；字号和留白对齐对话工作台。 */
.builder-completion{display:grid;gap:20px}.builder-completion label{display:grid;gap:8px;font-size:14px}.completion-cover-field{display:grid;gap:10px;padding:14px;border:1px solid var(--liv-account-border);border-radius:16px;background:var(--liv-skill-card-selected)}.completion-cover-heading{display:grid;gap:4px}.completion-cover-heading small,.completion-cover-error{color:var(--liv-account-muted);font-size:12px;line-height:1.6}.completion-cover-preview{display:grid;place-items:center;min-height:112px;max-height:180px;overflow:hidden;border:1px dashed var(--liv-account-border);border-radius:12px;background:var(--liv-account-surface)}.completion-cover{height:160px;max-width:100%;object-fit:contain;border-radius:12px}.completion-cover-empty{padding:24px;color:var(--liv-account-muted);font-size:13px}.completion-cover-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.completion-cover-candidate{display:grid;gap:8px;padding:10px;border:1px solid var(--liv-account-border);border-radius:12px;font-size:13px}.completion-cover-candidate>div{display:flex;gap:8px}.completion-cover-error{color:var(--liv-account-danger,var(--liv-account-muted))}.builder-attachments{display:flex;gap:8px;padding:12px;flex-wrap:wrap}.builder-attachments small{width:100%;color:var(--liv-account-muted)}
.builder-save-state{font-size:12px;line-height:1.5;color:var(--liv-account-muted);white-space:nowrap}
.skill-center .skill-builder .tabs .builder-view-toggle{margin-left:auto;font-size:12px;font-weight:400}.builder-document-editor{min-height:0}
.skill-center .skill-builder :deep(button){font-family:inherit}
.skill-center .skill-builder .tabs{gap:24px;padding:0 0 12px;margin:0;border-bottom:1px solid var(--liv-account-border);flex:none}
.skill-center .skill-builder .tabs button{padding:8px 0;border:0;border-radius:0;background:transparent;color:var(--liv-account-muted);font-size:17px;font-weight:600;white-space:nowrap}
.skill-center .skill-builder .tabs button.active{background:transparent;color:var(--liv-account-text)}
/* 手机保留单一模式入口但允许页签自然分行，不用横向滚动条挤压步骤详情。 */
@media(max-width:767px){.skill-center .skill-builder .tabs{flex-wrap:wrap;column-gap:16px;row-gap:4px;min-width:0}.skill-center .skill-builder .tabs .builder-view-toggle{margin-left:0;flex-basis:100%;justify-content:flex-start}}
/* 与画布聊天共享字号和行距；去掉段落额外外距，避免短回复产生大块空白。 */
.skill-center .skill-builder .builder-chat{border:0;border-radius:0;padding:0;margin:0 0 16px;background:transparent;font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);color:var(--liv-account-text)}
.skill-center .skill-builder .builder-chat>p{margin:0!important;font-size:inherit;color:inherit;line-height:inherit}
.skill-center .skill-builder .builder-chat.user{margin-left:24px;padding:12px 16px;border-radius:20px 20px 4px 20px;background:var(--liv-accent);color:var(--liv-control-on-primary)}
.skill-center .skill-builder .builder-chat.user>b{display:none}
.skill-center .skill-builder .builder-chat.assistant>b{display:block;font-size:14px;font-weight:600;margin-bottom:12px}
.skill-center .skill-builder .builder-document-editor :deep(textarea){border:1px solid var(--liv-account-border);border-radius:16px;padding:20px;background:var(--liv-skill-card-selected);color:var(--liv-account-text);font-size:14px;line-height:1.8;font-family:inherit;box-shadow:none}
.skill-center .skill-builder .builder-document-editor>details{flex:none;margin-top:8px;color:var(--liv-account-muted);font-size:12px}
/* 正文使用编辑区剩余高度，避免固定16行输入下方留出大片空白。 */
.builder-document-editor{display:flex;flex-direction:column;flex:1;min-height:0}.builder-document-editor>label{display:flex;flex-direction:column;flex:1;min-height:240px}.builder-document-editor :deep(textarea){min-height:240px;height:100%}.builder-preview{max-height:40vh;overflow:auto;flex:none}
.builder-chat{padding:12px;margin-bottom:12px;border-radius:16px;background:var(--liv-skill-card-selected);white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}.builder-chat.user{border:1px solid var(--liv-account-border)}.builder-chat p{margin:6px 0!important}.builder-preview{padding:16px;margin-bottom:16px;border:1px solid var(--liv-account-border);border-radius:16px}.builder-preview pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font-size:13px}.builder-preview small{color:var(--liv-account-muted)}
.builder-information{display:grid;gap:12px}.builder-information label{display:grid;gap:6px}.builder-information input,.builder-information textarea,.builder-information select{width:100%}
/* 技能中心沿用深色工作台；列表与编辑区各自滚动，弹层不推动页面。 */
.skill-center{padding:28px;color:#eee;max-width:1500px;margin:auto}.skill-center header,.actions,.filters,.tabs,.categories{display:flex;align-items:center;gap:10px}.skill-center header,.filters{justify-content:space-between}.skill-center h1{font-size:28px}.skill-center h2{font-size:20px}.skill-center p{color:#a3a3ad;font-size:13px;line-height:1.7}.skill-center button{border:1px solid #38383f;background:#252529;color:#eee;border-radius:9px;padding:9px 14px;cursor:pointer}.skill-center button:disabled{opacity:.4;cursor:not-allowed}.skill-center .primary{background:var(--liv-accent);border-color:var(--liv-accent);color:white}.skill-center input,.skill-center textarea,.skill-center select{border:1px solid #38383f;background:#1c1c20;color:#eee;border-radius:8px;padding:10px;font:inherit}.filters{margin:26px 0 16px}.tabs .active,.categories .active{background:#41414a}.categories{flex-wrap:wrap;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.card{background:#131316;border:1px solid #303035;border-radius:18px;padding:14px;min-width:0}.card .cover{position:relative;display:block;width:100%;padding:0;aspect-ratio:16/9;overflow:hidden;border:0;background:#222228}.cover img{width:100%;height:100%;object-fit:cover}.cover span{position:absolute;left:8px;top:8px;border-radius:8px;background:#151519d9;padding:3px 8px;font-size:11px}.card .name{padding:12px 0 0;text-align:left;font-weight:700;border:0;background:transparent}.card p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:44px}.try{flex:1}.empty{padding:70px;text-align:center;color:#999}.skeleton{height:270px;background:#242428;border-radius:18px}.overlay{position:fixed;inset:0;z-index:300;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px}.dialog,.editor{background:#19191e;border:1px solid #3c3c43;border-radius:20px;padding:24px;max-height:90dvh;overflow:auto;width:min(720px,100%)}.editor{width:min(1200px,100%)}.editor-body{display:grid;grid-template-columns:1fr 1fr;gap:24px}.editor form{display:grid;gap:12px}.editor label{display:grid;gap:6px;font-size:13px}.editor aside{min-width:0}.editor pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;padding:14px;background:#101013;border-radius:10px;max-height:60vh;overflow:auto}.skill-center dt{margin-top:16px;color:#a1a1aa;font-size:12px}.skill-center dd{margin:6px 0;line-height:1.7}.pre{white-space:pre-wrap}.import{width:100%;height:260px}.error{color:#ff8c9f!important}@media(max-width:1250px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.grid{grid-template-columns:1fr}.skill-center{padding:18px}.filters,header{flex-wrap:wrap}.editor-body{grid-template-columns:1fr}}
</style>
<style scoped>
/* 目录分类统一加大加粗，覆盖历史多个字体层级；窄屏只让分类行横向滚动。 */
.skill-directory-tool{position:relative;break-inside:avoid;overflow:hidden;border-radius:16px;background:var(--liv-workspace-surface);margin-bottom:var(--liv-showcase-gap)}
.skill-directory-tool>img{display:block;width:100%;height:auto}.skill-directory-tool>div{position:absolute;inset:auto 0 0;padding:24px 12px 12px;color:var(--liv-control-on-primary);background:linear-gradient(transparent,rgba(0,0,0,.78))}
.skill-directory-tool strong{font-size:14px;line-height:20px}.skill-directory-tool p{margin:6px 0;font-size:12px;color:inherit}.skill-directory-tool button{height:32px;font-size:12px;border-radius:999px;background:var(--liv-control-on-primary);color:var(--liv-page-background)}
.skill-center .category-nav{gap:var(--liv-skill-directory-tab-gap);min-width:0}
.skill-center .category-nav button{font-size:var(--liv-skill-directory-tab-size)!important;font-weight:var(--liv-skill-directory-tab-weight)!important;line-height:28px;color:var(--liv-account-muted);padding:4px 0}
.skill-center .category-nav button.active{color:var(--liv-account-text);font-weight:800!important}
.skill-center .filters{align-items:center;flex-wrap:wrap}
.skill-center .filters input{margin-left:auto;width:160px;flex:none}
.skill-center>header{margin-bottom:28px}.skill-center>header .actions{flex-wrap:wrap}
@media(max-width:600px){.skill-center .category-nav{width:100%;gap:20px}.skill-center>header{gap:16px;flex-wrap:wrap}.skill-center .filters input{width:100%;margin-left:0}}
</style>
<style scoped>
/* 实测参考页：24px 标题、14px 名称、12px/32px 试用按钮；减少过重字重。 */
.skill-center h1{font-weight:630;line-height:30px}.skill-center .card .name{font-weight:500}.skill-center .card .actions button{font-size:12px}.skill-center .category-nav button{font-size:16px;font-weight:450}
</style>
<style scoped>
/* 列数跟随内容区宽度，不依赖整个应用窗口宽度，内嵌窄面板也保持合理卡片尺寸。 */
.skill-center{container-type:inline-size}.skill-center header p{display:none}.skill-center .card .actions .iconify{width:14px;height:14px}.skill-center .actions>.primary{height:34px;border-radius:20px;font-size:12px}.skill-center .category-nav{font-size:14px}@container(max-width:1000px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@container(max-width:720px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:430px){.grid{grid-template-columns:1fr}}
</style>
<style scoped>
/* 对齐紧凑资产卡片：正文 13px、说明 12px，按钮使用站点主题变量。 */
.skill-center{font-size:13px;max-width:1320px;padding:24px}.skill-center h1{font-size:24px;font-weight:700}.skill-center h2{font-size:18px}.skill-center button{font:inherit;padding:7px 12px}.skill-center .primary{background:var(--liv-accent);border-color:var(--liv-accent)}.skill-center p{font-size:12px}.filters{margin:28px 0 24px;gap:20px}.category-nav{display:flex;align-items:center;gap:18px;white-space:nowrap;overflow-x:auto}.category-nav button{border:0;padding:4px 0;background:transparent;color:#8e8e98;font-size:14px;font-weight:600}.category-nav button.active{color:#fff}.nav-divider{height:16px;width:1px;background:#38383e;flex-shrink:0}.card{padding:12px;border-radius:20px}.card .name{font-size:14px}.card p{line-height:1.5;min-height:36px;margin:7px 0 14px}.card .actions button{height:32px;padding:4px 11px;background:var(--liv-button-bg);border-color:#303034}.try{border-radius:20px!important}.skill-center .filters input{height:32px;font-size:12px;padding:6px 12px}.categories button{font-size:12px}.grid{gap:18px}@media(max-width:900px){.filters{flex-wrap:wrap}.category-nav{width:100%;gap:16px}}
</style>
