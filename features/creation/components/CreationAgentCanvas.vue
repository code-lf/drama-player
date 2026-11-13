<script setup lang="ts">
import {computed,markRaw,nextTick,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import CreationMediaPreview from './CreationMediaPreview.vue'
import CreationWorkspaceNotice from './CreationWorkspaceNotice.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {VueFlow,useVueFlow,type Connection} from '@vue-flow/core'
import {MiniMap} from '@vue-flow/minimap'
import {collapsedGroupMembers,groupBounds,groupMembers,moveGroup,arrangeGroup,syncAutomaticGroups,syncAssetDefinitionGroup,canvasGroupLabel,dropGroupMembers,productionBoundaryLinks,placeFixedDramaBlocks,PRODUCTION_GROUP_SIZE,type GroupMemberBox,type GroupDropFrame} from '../canvasGroups'
import {canvasCompletionNotices} from '../canvasTaskNotices'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import {projectCreativeGraph,isFixedDramaNode,emptyCreativeLayout,canConnectCreative,creativeConnectionIssue,creativeInputs,sameCreativeLayout,creativeActivity,creativeRetryParameters,resultNodeId,type CreativeLayout,type CreativeNode,type CreativeNodeKind,type CreativeNodeParameters,type CanvasAssetPreview} from '../agentCanvas'
import type {CreationMessage,ComposerReference,WorkspacePreview,WorkspaceSource} from '../types'
import type {CreationRun} from '~/shared/api/services/creationService'
import type {SessionResult} from '../resultCatalog'
import type {CompositionJob} from '~/shared/api/services/videoCompositionService'
import {request} from '~/shared/api/adapters/httpAdapter'
import {libraryService} from '~/shared/api/services/libraryService'
import CreativeCanvasNode from './CreativeCanvasNode.vue'
import CreationImageLightbox from './CreationImageLightbox.vue'
import CreativeCanvasEdge from './CreativeCanvasEdge.vue'
import CreativeCompositionEditor from './CreativeCompositionEditor.vue'
import CanvasScriptDialog from '../drama/components/CanvasScriptDialog.vue'
import CanvasScriptReader from '../drama/components/CanvasScriptReader.vue'
import CanvasStandaloneShotEditor from '../drama/components/CanvasStandaloneShotEditor.vue'
import type {StandaloneStoryboard} from '../drama/standaloneStoryboard'
import CanvasProductionIntake from '../drama/components/CanvasProductionIntake.vue'
import CanvasAssetExtractionControls from '../drama/components/CanvasAssetExtractionControls.vue'
import {useCanvasAssetExtraction} from '../drama/useCanvasAssetExtraction'
import type {AssetCategory,CanvasScriptDocument,CanvasScriptState} from '../drama/scriptDocument'
import type {DramaAssetWorkspace} from '~/shared/api/types'
import type {ProductionEpisodeCard,ProductionShotCard} from '../agentCanvas'
import CanvasProductionBindingDialog from '../drama/components/CanvasProductionBindingDialog.vue'
import {useActionDialog} from '~/composables/useActionDialog'
import {creativeVisibleArea,creativeCameraHasVisibleNode,creativeFocusCamera,creativeFreePosition,creativeNearbyPosition,creativeVisibleNearbyPosition,creativePromptPosition,creativeCanvasPoint,creativeEstimatedNodeBounds,CREATIVE_MIN_ZOOM,type CreativeBounds} from '../canvasViewport'

// Vue 会把未传入的布尔属性解释为 false；只有宿主明确禁用时才暂停画布播放。
const props=withDefaults(defineProps<{sessionId:string;ownerId:string;runs:CreationRun[];messages:CreationMessage[];results:SessionResult[];references:ComposerReference[];previews:Record<string,WorkspacePreview>;tasks:Record<string,any>;activity?:Record<string,{progress?:number|null}>;compositions?:Array<{title:string;job:CompositionJob;nodeId?:string;resultUnavailable?:boolean}>;stageNavTarget?:string;focusId?:string;toolNodeId?:string;busy?:boolean;audioEnabled?:boolean;assetPanelOpen?:boolean;leftInset?:number;bottomInset?:number;obstructions?:CreativeBounds[];playbackEnabled?:boolean;beforeSelect?:(node?:CreativeNode)=>Promise<boolean>}>(),{playbackEnabled:true})
const emit=defineEmits<{select:[node:CreativeNode];tools:[node:CreativeNode,action?:'crop'];generate:[node:CreativeNode,inputs:CreativeNode[]];retry:[node:CreativeNode];refreshFile:[node:CreativeNode];compose:[];editWorkspace:[];compositionsChanged:[];upload:[];assets:[];closeAssets:[];uploadAudio:[file:File];activity:[value:{running:number;unavailable:number}];canvasActivityChanged:[extractionId:string];discussScript:[description:string,title:string,revision:number]}>()
const compositionEditor=ref<InstanceType<typeof CreativeCompositionEditor>|null>(null)
const {confirm}=useActionDialog()
// 每个会话拥有独立图实例；保留原 Vue Flow 依赖，不接入第三方执行器。
const graphId=`creative-${props.sessionId}`,flow=useVueFlow(graphId)
const canvasElement=ref<HTMLElement|null>(null),dockElement=ref<HTMLElement|null>(null),taskListElement=ref<HTMLElement|null>(null),viewToolsElement=ref<HTMLElement|null>(null)
// 工具宿主位于Vue Flow变换层之外；每会话独立目标，防止工具串到其他画布。
const nodeToolTargetId=`creative-node-tools-${props.sessionId}`,toolDockElement=ref<HTMLElement|null>(null),toolDockHeight=ref(0),toolDockWidth=ref(0)
let toolDockObserver:ResizeObserver|undefined
const layout=ref<CreativeLayout>(emptyCreativeLayout()),selectedId=ref(''),nodes=ref<CreativeNode[]>([]),ready=ref(false),saving=ref(false),error=ref(''),revision=ref(0)
const minimap=ref(false),hand=ref(false),expanded=ref(false),taskOpen=ref(false),draftPrompt=ref(''),draftTitle=ref(''),saved=ref(false)
const spacePan=ref(false),canvasHovered=ref(false),canvasListOpen=ref(false),canvasListQuery=ref(''),canvasListKind=ref('all')
// 成片也是视频，筛选时保留已有成片节点，不改变底层节点类型。
const filteredCanvasNodes=computed(()=>nodes.value.filter(node=>(canvasListKind.value==='all'||node.data.kind===canvasListKind.value||(canvasListKind.value==='video'&&node.data.kind==='compose'))&&node.data.title.toLocaleLowerCase().includes(canvasListQuery.value.trim().toLocaleLowerCase())))
// 目录只展示真实节点状态；未知状态保持待核对，不把内部英文枚举直接展示给用户。
function canvasListStatus(node:CreativeNode){if(node.data.scriptDocument)return '剧本已保存';return ({ready:'待确认',replied:'已回复',draft:'草案',waiting:'等待补充',planning:'正在整理',queued:'排队中',pending:'排队中',submitting:'正在提交',running:'生成中',rendering:'合成中',in_progress:'生成中',processing:'生成中',result_pending:'正在读取结果',result_error:'结果待核对',succeeded:'已完成',completed:'已完成',failed:'处理失败',needs_review:'待核对',status_unavailable:'状态待同步',reference:'参考素材',unavailable:'素材不可用',cancelled:'已停止'} as Record<string,string>)[node.data.status]||'待核对'}
// 空格只临时切换画布平移，不抢输入框、按钮或输入法；失焦时释放以防工具卡住。
function canvasSpaceDown(event:KeyboardEvent){if(!canvasHovered.value||scriptReaderOpen.value||event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;const target=event.target as HTMLElement|null;if(target?.closest('input,textarea,button,select,[contenteditable=true],[role=textbox]'))return;spacePan.value=true;event.preventDefault()}
function canvasSpaceUp(event:KeyboardEvent){if(event.code==='Space')spacePan.value=false}
function clearSpacePan(){spacePan.value=false}
onMounted(()=>{if(typeof window==='undefined')return;window.addEventListener('keydown',canvasSpaceDown);window.addEventListener('keyup',canvasSpaceUp);window.addEventListener('blur',clearSpacePan)})
onBeforeUnmount(()=>{if(typeof window==='undefined')return;window.removeEventListener('keydown',canvasSpaceDown);window.removeEventListener('keyup',canvasSpaceUp);window.removeEventListener('blur',clearSpacePan)})
// 普通选择不改变镜头；只有显式定位后才允许尺寸观察器继续补足取景。
const magnifiedNodeId=ref(''),previewNode=ref<CreativeNode|null>(null)
const multipleIds=ref<string[]>([]),selectedGroupId=ref('')
/** 画布剪贴板只保存可编辑草案信息和来源节点ID，不复制任务、结果地址或执行许可。 */
interface CreativeNodeClipboard {sourceId:string;kind:CreativeNodeKind;title:string;prompt:string}
const copiedNode=ref<CreativeNodeClipboard|null>(null),clipboardStatus=ref('')
// 操作校验与网络保存错误分开；自动保存成功不能提前清掉用户尚未读完的连线提示。
const actionError=ref('')
let clipboardStatusTimer:ReturnType<typeof setTimeout>|undefined
/** 分组仅引用可见节点，已隐藏/暂未恢复的成员仍保留原编号，不能据此伪造业务节点。 */
function memberBoxes(ids:string[]):GroupMemberBox[]{return ids.flatMap(id=>{
  const node=nodes.value.find(n=>n.id===id);if(!node)return []
  const size=nodeBounds(node)
  return [{id,x:node.position.x,y:node.position.y,width:size.width,height:size.height}]
})}
// 节点独立拖动期间固定组框；整组移动仍沿成员实际位置同步更新。
const nodeDropFrames=ref<GroupDropFrame[]|null>(null)
// 分类筛选只是本次视图，不能把未选分类从分组成员或生产关系中删除。
const assetGroupFilters=ref<Record<string,AssetCategory>>({})
// 生产组内部是固定排版卡片，不参加普通节点拖动。
const isStandaloneGroup=(id:string)=>id.startsWith('group:auto-storyboard-')
const isProductionGroup=(id:string)=>id.startsWith('group:auto-assets-')||id.startsWith('group:auto-shots-')||isStandaloneGroup(id)
let draggedNodeIds:string[]=[]
const groupFrames=computed(()=>(layout.value.groups||[]).flatMap(group=>{
  const members=memberBoxes(group.members),frozen=nodeDropFrames.value?.find(frame=>frame.id===group.id)
  let bounds=frozen||groupBounds(members)
  // 折叠保留完整成员坐标供整组移动；缩小的仅是可见容器。
  const assets=group.id.startsWith('group:auto-assets-')?nodes.value.filter(node=>group.members.includes(node.id)&&node.data.productionAsset):[]
  const assetTabs=assets.length?(['role','scene','prop'] as const).map(key=>({key,label:{role:'角色',scene:'场景',prop:'道具'}[key],count:assets.filter(node=>node.data.productionAsset?.category===key).length})):[]
  const category=assetGroupFilters.value[group.id]||assetTabs.find(tab=>tab.count)?.key
  const shots=group.id.startsWith('group:auto-shots-')||isStandaloneGroup(group.id)?nodes.value.filter(node=>group.members.includes(node.id)&&(node.data.productionShot||node.data.standaloneShot)):[]
  const cards=shots.length?shots:assets.filter(node=>node.data.productionAsset?.category===category)
  // 固定世界尺寸：四列至少各 260px，纵向预留四张 236px 卡片和三道行距。
  if(bounds&&(assets.length||shots.length))bounds={...bounds,...PRODUCTION_GROUP_SIZE}
  return bounds?[{...group,...bounds,...(group.collapsed?{width:320,height:96}:{}),label:assets.length?'资产':canvasGroupLabel(group,nodes.value),visibleCount:isProductionGroup(group.id)?cards.length:members.length,assetTabs,category,cards}]:[]
}))
function frameStyle(frame:{x:number;y:number;width:number;height:number}){const v=flow.viewport.value;return {left:`${frame.x*v.zoom+v.x}px`,top:`${frame.y*v.zoom+v.y}px`,width:`${frame.width*v.zoom}px`,height:`${frame.height*v.zoom}px`}}
const selectionToolbarStyle=computed(()=>{
  const bounds=groupBounds(memberBoxes(multipleIds.value));if(!bounds)return undefined
  const v=flow.viewport.value
  return {left:`${Math.max(16,Math.min(bounds.x*v.zoom+v.x,canvasSize.value.width-300))}px`,top:`${Math.max(12,bounds.y*v.zoom+v.y-48)}px`}
})
const removeOpen=ref(false),unsavedInputs=new Map<string,{prompt:string;title:string}>()
const submittingDraft=ref(false)
const creatingNode=ref(false)
// 名称是辅助编辑，不再让名称表单占据提示词输入框的第一行。
const renaming=ref(false)
const conflict=ref(false)
let conflictLocal:CreativeLayout|null=null,conflictRevision=0
// 冲突中的未保存文字与云端预览隔离；刷新/离页仍保留，明确选本机后才恢复到输入器。
let conflictInputs:Record<string,{prompt:string;title:string}>|null=null
const history:CreativeLayout[]=[],future:CreativeLayout[]=[]
const undoCount=ref(0),redoCount=ref(0)
let timer:ReturnType<typeof setTimeout>|undefined,epoch=0,selectionEpoch=0,dirty=0,alive=true,initialCameraReady=false
let dockObserver:ResizeObserver|undefined,dockHeight=0
let canvasObserver:ResizeObserver|undefined
const canvasSize=ref({width:0,height:0})
/** 节点未挂载或图片尚未加载时，从画布主题令牌读取真实卡片宽度与媒体高度上限。 */
function estimateNodeBounds(kind:CreativeNodeKind,aspectRatio?:string|number){
  const readMetric=(name:string,fallback:number)=>{
    if(!canvasElement.value||typeof getComputedStyle==='undefined')return fallback
    const value=Number.parseFloat(getComputedStyle(canvasElement.value).getPropertyValue(name))
    return Number.isFinite(value)&&value>0?value:fallback
  }
  return creativeEstimatedNodeBounds(kind,readMetric('--liv-graph-node-width',280),aspectRatio,readMetric('--liv-graph-media-height',420))
}
/** 未测量节点按类型/画幅估算安全边界；已测量节点始终采用Vue Flow的实际尺寸。 */
function nodeBounds(node:CreativeNode){
  const measured=flow.findNode(node.id)?.dimensions
  // 文稿首次挂载尚未实测时，定位也要给大卡片和操作区预留空间。
  const fallback=node.data.scriptDocument?{width:528,height:860}:estimateNodeBounds(node.data.kind,node.data.aspectRatio||layout.value.node_parameters?.[node.id]?.aspectRatio)
  // Vue Flow 首次测量可能还沿用普通文本节点尺寸；固定剧本至少保留设计尺寸及底部操作区。
  if(node.data.scriptDocument)return {width:Math.max(measured?.width||0,fallback.width),height:Math.max(measured?.height||0,fallback.height)}
  return {width:measured?.width||fallback.width,height:measured?.height||fallback.height}
}
/** 按稳定节点ID读取Vue Flow卡片DOM，避免预览器尺寸误当成画布节点尺寸。 */
function renderedNodeElement(node:CreativeNode){
  const canvas=canvasElement.value
  // DOM 测量是可选增强；节点未挂载或测试宿主尚无查询接口时继续使用布局几何估算。
  if(!canvas||typeof canvas.querySelectorAll!=='function')return undefined
  return [...canvas.querySelectorAll<HTMLElement>('.vue-flow__node')].find(value=>value.getAttribute('data-id')===node.id)
}
/** 派生定位读取画布DOM实测尺寸，编辑态扩宽后也以最终卡片边界避让。 */
function renderedNodeBounds(node:CreativeNode){
  const element=renderedNodeElement(node)
  const measured=element?.offsetWidth&&element?.offsetHeight?{width:element.offsetWidth,height:element.offsetHeight}:undefined
  return measured||nodeBounds(node)
}
const canvasAssets=ref<CanvasAssetPreview[]>([])
const scriptState=ref<CanvasScriptState>(),scriptOpen=ref(false),scriptReaderOpen=ref(false),scriptBusy=ref(false),scriptError=ref('')
const readerRevision=ref<number>()
const productionWorkspace=ref<DramaAssetWorkspace|null>(null),productionReadError=ref('')
const productionShots=ref<ProductionShotCard[]>([])
const productionEpisodes=ref<ProductionEpisodeCard[]>([])
const productionDocumentIsSource=ref(false)
const productionProjectId=ref('')
const productionBindingOpen=ref(false)
const productionReading=ref(false)
let productionReadSerial=0
let productionReadStartedAt=0
/** 只读共享资产；旧会话的迟到响应不能覆盖当前画布。 */
async function loadProductionWorkspace(){
  const serial=++productionReadSerial,sessionId=props.sessionId,ownerId=props.ownerId
  const isCurrent=()=>alive&&serial===productionReadSerial&&sessionId===props.sessionId&&ownerId===props.ownerId
  productionReadStartedAt=Date.now();productionReading.value=true
  try{
    const value=await request<{project_id?:string;workspace:DramaAssetWorkspace|null;storyboards?:ProductionShotCard[];episode_renders?:ProductionEpisodeCard[];canvas_document_is_source?:boolean}>(`/creation/sessions/${sessionId}/production-workspace`)
    if(isCurrent()){productionProjectId.value=value.project_id||value.workspace?.project_id||'';productionShots.value=value.storyboards||[];productionEpisodes.value=value.episode_renders||[];productionDocumentIsSource.value=value.canvas_document_is_source===true;productionWorkspace.value=value.workspace||null;productionReadError.value=''}
  }catch{
    if(isCurrent()){productionWorkspace.value=null;productionShots.value=[];productionEpisodes.value=[];productionDocumentIsSource.value=false;productionReadError.value='共享生产资料暂不可读，请核对项目绑定后重试。'}
  }finally{if(isCurrent())productionReading.value=false}
}
/** 返回画布时同步标准工作台的变更；不常驻轮询，不触发任务。 */
function refreshProductionOnReturn(){
  if(document.visibilityState==='visible'&&productionProjectId.value&&!productionReading.value&&Date.now()-productionReadStartedAt>=5000)void loadProductionWorkspace()
}
// 仅浏览器订阅窗口事件，避免非 DOM 环境挂载时中断首次读取。
onMounted(()=>{if(typeof window==='undefined'||typeof document==='undefined')return;document.addEventListener('visibilitychange',refreshProductionOnReturn);window.addEventListener('focus',refreshProductionOnReturn)})
onBeforeUnmount(()=>{if(typeof window==='undefined'||typeof document==='undefined')return;document.removeEventListener('visibilitychange',refreshProductionOnReturn);window.removeEventListener('focus',refreshProductionOnReturn)})
// 仅投影真实回执状态；没有图片时不展示已完成占位。
const shotPreviewLabels:Record<string,string>={queued:'等待预演',running:'预演中',required:'待首帧预演',failed:'预演失败',outdated:'需重新核对预演'}
const shotVideoLabels:Record<string,string>={queued:'镜头视频排队中',running:'镜头视频处理中',failed:'镜头视频处理失败',success:'镜头选版不可用'}
const assetExtraction=useCanvasAssetExtraction({sessionId:()=>props.sessionId,document:()=>scriptState.value,active:()=>alive,request})
// 复用文稿读取和提取轮询的真实状态，通知对话同步；无文稿时不额外读取历史。
watch(()=>[scriptState.value?.revision,assetExtraction.extraction.value?.id,assetExtraction.extraction.value?.status,!!productionWorkspace.value] as const,([version,id,status,formal])=>{
  if(version)emit('canvasActivityChanged',!formal&&status==='succeeded'?id||'':'')
},{flush:'post'})
// 读取不创建文稿，不阻塞普通节点加载；账号/会话变化后丢弃迟到结果。
async function loadScriptDocument(current=epoch){
  try{const value=await request<CanvasScriptState>(`/creation/sessions/${props.sessionId}/script-document`)
    if(alive&&current===epoch&&value.session_id===props.sessionId){scriptState.value=value;scriptError.value=''}
  }catch{if(alive&&current===epoch)scriptError.value='剧本文稿暂时无法读取，请重试；其他画布操作不受影响。'}
}
/** 保存成功才投影节点；失败保留弹窗原文，重试同一内容复用请求编号。 */
let scriptRequest:{key:string;id:string}|undefined
async function saveScriptDocument(document:Omit<CanvasScriptDocument,'id'>){
  if(scriptBusy.value||!ready.value||conflict.value)return
  if(!scriptState.value){scriptError.value='请先重新读取剧本文稿，再保存。';return}
  const current=epoch,sessionId=props.sessionId,key=JSON.stringify([sessionId,scriptState.value.revision,document])
  if(scriptRequest?.key!==key)scriptRequest={key,id:crypto.randomUUID()}
  scriptBusy.value=true;scriptError.value=''
  try{const value=await request<CanvasScriptState>(`/creation/sessions/${sessionId}/script-document`,{method:'PUT',body:{expected_revision:scriptState.value.revision,request_id:scriptRequest.id,document}})
    if(!alive||current!==epoch)return
    if(value.session_id!==sessionId||!value.document?.id||value.document.title!==document.title||value.document.source_text!==document.source_text||value.document.requirements!==document.requirements)throw new Error('保存结果尚未核对成功，本地原文已保留，请重试。')
    scriptState.value=value;scriptOpen.value=false;scriptRequest=undefined
    if(productionProjectId.value||productionReadError.value){productionWorkspace.value=null;void loadProductionWorkspace()}
    // 用户曾移除的是展示而非文稿；明确再次保存时恢复同一节点，不新建副本。
    if(layout.value.hidden.includes(`script:${value.document.id}`)){layout.value.hidden=layout.value.hidden.filter(id=>id!==`script:${value.document!.id}`);changed()}
    await nextTick();if(value.document&&!scriptReaderOpen.value)await focusSelectedNode(`script:${value.document.id}`)
  }catch(cause){if(alive&&current===epoch)scriptError.value=(cause as Error).message||'剧本保存失败，本地内容仍保留。'}
  finally{if(alive&&current===epoch)scriptBusy.value=false}
}
async function openScriptDocument(version?:number){
  if(!ready.value||conflict.value||scriptBusy.value)return
  const current=epoch
  if(!await confirmCompositionLeave()||(props.beforeSelect&&!await props.beforeSelect(undefined)))return
  if(!alive||current!==epoch)return
  // 打开前核对最新版本；打开后的保存错误不能自动覆盖本地文本。
  await loadScriptDocument(current)
  if(!alive||current!==epoch)return
  if(scriptState.value?.document){readerRevision.value=version;scriptReaderOpen.value=true}
  else if(version===undefined)scriptOpen.value=true
}
/** 只将修改意图带到当前会话，不自动发送或修改已保存文稿。 */
function discussScript(description:string){
  const state=scriptState.value
  if(!state?.document)return
  scriptReaderOpen.value=false;emit('discussScript',description,state.document.title,state.revision)
}
// 单镜保存回执比聊天轮询更及时，但更高修订的服务端记录始终优先。
const storyboardReceipts=ref<Record<string,StandaloneStoryboard>>({})
const graph=computed(()=>projectCreativeGraph({...props,runs:props.runs.map(run=>{
  const receipt=storyboardReceipts.value[run.id]
  const card=run.card as (NonNullable<CreationRun['card']>&{storyboard?:StandaloneStoryboard})|undefined
  return receipt&&card?.storyboard&&receipt.revision>card.storyboard.revision?{...run,card:{...card,storyboard:receipt}}:run
}),canvasAssets:canvasAssets.value,scriptDocument:scriptState.value,productionWorkspace:productionWorkspace.value,productionDocumentIsSource:productionDocumentIsSource.value,productionShots:productionShots.value,productionEpisodes:productionEpisodes.value,assetExtraction:productionReadError.value?null:assetExtraction.extraction.value},layout.value))
/** 隐藏态是显示投影，不写回业务节点或参与任务恢复。 */
function hiddenViewMembers(){
  const hidden=collapsedGroupMembers(layout.value)
  for(const group of layout.value.groups||[]){
    if(isProductionGroup(group.id))for(const id of group.members)hidden.add(id)
  }
  return hidden
}
/** 生产卡片不注册为独立 Vue Flow 节点；交互回填只更新普通节点。 */
const productionMemberIds=computed(()=>new Set((layout.value.groups||[]).filter(group=>isProductionGroup(group.id)).flatMap(group=>group.members)))
const flowNodes=computed({
  get:()=>productionMemberIds.value.size?nodes.value.filter(node=>!productionMemberIds.value.has(node.id)):nodes.value,
  set:(visible:CreativeNode[])=>{
    const fixed=nodes.value.filter(node=>productionMemberIds.value.has(node.id))
    if(!fixed.length){nodes.value=visible;return}
    const next=[...visible.filter(node=>!productionMemberIds.value.has(node.id)),...fixed]
    if(next.length!==nodes.value.length||next.some((node,index)=>node!==nodes.value[index]))nodes.value=next
  }
})
const edges=computed(()=>graph.value.edges)
// 生产成员不注册到 Vue Flow；不能只标为隐藏，否则刷新时仍会校验不存在的端点。
const viewEdges=computed(()=>{
  const hidden=hiddenViewMembers(),fixed=productionMemberIds.value
  return edges.value.filter(edge=>!fixed.has(edge.source)&&!fixed.has(edge.target))
    .map(edge=>({...edge,hidden:hidden.has(edge.source)||hidden.has(edge.target)}))
})
/** 保留图形库节点身份以支持框选/拖动；仅更新改变的显示标记，不写业务合同。 */
watch(()=>[JSON.stringify(layout.value.groups),nodes.value],()=>{
  const hidden=hiddenViewMembers()
  for(const node of nodes.value)if(Boolean(node.hidden)!==hidden.has(node.id))node.hidden=hidden.has(node.id)
},{flush:'sync'})
/** 来源关系原样保留；资产组、分镜组与成片之间只绘制一条外部线。 */
const productionLinks=computed(()=>{
  const groups=groupFrames.value.filter(group=>isProductionGroup(group.id)),v=flow.viewport.value
  const bounds=new Map<string,CreativeBounds>(groups.map(group=>[group.id,group]))
  for(const node of nodes.value)if(!node.hidden)bounds.set(node.id,{...nodeBounds(node),...node.position})
  return productionBoundaryLinks(edges.value,groups).flatMap(({id,source,target})=>{
    const from=bounds.get(source),to=bounds.get(target)
    if(!from||!to)return []
    const right=to.x+to.width/2>=from.x+from.width/2
    const x1=(from.x+(right?from.width:0))*v.zoom+v.x,y1=(from.y+from.height/2)*v.zoom+v.y
    const x2=(to.x+(right?0:to.width))*v.zoom+v.x,y2=(to.y+to.height/2)*v.zoom+v.y
    const bend=Math.max(24,Math.abs(x2-x1)/2)*(right?1:-1)
    return [{id,path:`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`}]
  })
})
/** 新生产结果和历史重叠共用一次避让；以组框为单位，不改变素材、分镜身份或连线。 */
function repairFixedDramaLayout(){
  const groups=(layout.value.groups||[]).filter(group=>isProductionGroup(group.id))
  const grouped=new Set(groups.flatMap(group=>group.members))
  const sources=productionBoundaryLinks(edges.value,groups)
  const blocks:Array<GroupDropFrame&{members:GroupMemberBox[];sources:string[];rank:number}>=[]
  const obstacles:GroupDropFrame[]=[]
  for(const node of nodes.value){
    if(grouped.has(node.id))continue
    const member={id:node.id,...nodeBounds(node),...(layout.value.positions[node.id]||node.position)}
    if(isFixedDramaNode(node))blocks.push({...member,members:[member],sources:sources.filter(edge=>edge.target===node.id).map(edge=>edge.source),rank:node.data.scriptDocument?0:node.data.productionEpisode?4:1})
    else obstacles.push(member)
  }
  for(const group of layout.value.groups||[]){
    const members=memberBoxes(group.members),bounds=groupBounds(members)
    if(!bounds)continue
    if(!isProductionGroup(group.id)){obstacles.push({id:group.id,...bounds});continue}
    blocks.push({id:group.id,...bounds,...PRODUCTION_GROUP_SIZE,members,sources:sources.filter(edge=>edge.target===group.id).map(edge=>edge.source),rank:group.id.startsWith('group:auto-assets-')?2:3})
  }
  blocks.sort((a,b)=>a.rank-b.rank||a.y-b.y||a.x-b.x||a.id.localeCompare(b.id))
  const moved=placeFixedDramaBlocks(blocks,obstacles)
  if(!Object.keys(moved).length)return false
  Object.assign(layout.value.positions,moved)
  return true
}

/** 按稳定业务身份归组，真实冲突时才写位置；普通编辑与拖动不触发自动重排。 */
watch(()=>[ready.value,conflict.value,nodes.value.map(n=>`${n.id}:${n.data.source?.id||''}`).join('|')],()=>{
  if(ready.value&&!conflict.value){
    const ordinary=syncAutomaticGroups(layout.value,nodes.value,edges.value),assets=syncAssetDefinitionGroup(layout.value,nodes.value)
    const repaired=repairFixedDramaLayout()
    if(ordinary||assets||repaired)changed()
  }
},{flush:'post'})
// 完成记录只投影既有结果；刷新不补发任务，显示真实批次而非重复完成卡。
const completedNotices=computed(()=>canvasCompletionNotices(nodes.value))
const selected=computed(()=>nodes.value.find(node=>node.id===selectedId.value))
/** 后期剪辑仅接收已有真实视频版本；混选图片、草案或未完成任务时不偷偷丢掉其中条目。 */
function compositionSourceIds(ids:string[]){
  const seen=new Set<string>(),result:string[]=[]
  for(const id of ids){
    const node=nodes.value.find(value=>value.id===id),source=node?.data.source
    if(!node||node.data.kind!=='video'||source?.kind!=='video'||!source.result_id||!node.data.url||!['completed','succeeded'].includes(node.data.status))return []
    const key=JSON.stringify([source.id,source.result_id])
    if(!seen.has(key)){seen.add(key);result.push(id)}
  }
  return result
}
const selectionCompositionSources=computed(()=>compositionSourceIds(multipleIds.value))
/** 只建立连到原片的剪辑草案；沿用原编辑器，仍需显式保存计划、预览及合成，不采购视频。 */
async function composeNodes(ids:string[]){
  if(props.busy||submittingDraft.value||creatingNode.value||conflict.value||!ready.value)return
  const sources=compositionSourceIds([...ids]);if(!sources.length)return
  return createNode('compose',sources[0],undefined,{title:'视频剪辑 / 合成',prompt:'',sourceIds:sources})
}
/** 只有来源仍在画布且可合法连接时才允许粘贴；未知/隐藏来源不降级成无来源采购草案。 */
const canPasteCopiedNode=computed(()=>{
  const copied=copiedNode.value,source=copied&&nodes.value.find(node=>node.id===copied.sourceId)
  return !!copied&&!!source&&ready.value&&!conflict.value&&!props.busy&&!creatingNode.value&&!submittingDraft.value&&canDerive(copied.kind,source.id)
})
/** 原媒体和已完成套图只编辑续作意图；未完成计划仍走业务编辑器，视频批次保留独立改稿链。 */
const sourceEditing=computed(()=>!!selected.value?.data.readonly&&(!selected.value.data.itemId||selected.value.data.planTarget==='image')&&!!selected.value.data.url&&!!selected.value.data.source&&['image','video'].includes(selected.value.data.kind)&&['reference','succeeded','completed'].includes(selected.value.data.status)&&canDerive(selected.value.data.kind,selected.value.id))
const canEdit=computed(()=>!!selected.value&&(sourceEditing.value||!selected.value.data.itemId&&!selected.value.data.readonly))
/** 续作从原条目快照恢复白名单规格，不能回退到聊天当前模型或携带旧报价授权。 */
const editorParameters=computed(()=>selected.value?creativeRetryParameters(selected.value,props.runs,props.messages,props.results):undefined)
const inputChanged=computed(()=>canEdit.value&&!!selected.value&&(draftPrompt.value!==selected.value.data.prompt||draftTitle.value!==selected.value.data.title))
/** 只读Agent正文随真实流式/完成快照更新；可编辑草案的本机输入和批次专用表单不能被轮询覆盖。 */
watch(selected,node=>{
  if(node?.data.readonly&&!node.data.itemId&&!canEdit.value){draftPrompt.value=node.data.prompt;draftTitle.value=node.data.title}
})
const inputs=computed(()=>creativeInputs(nodes.value,edges.value,selectedId.value))
/** 引用缩略图定位到真实来源节点；只切换选中与取景，不提交或生成媒体。 */
async function openEditorReference(reference:ComposerReference){
  const node=editorInputs.value.find(value=>value.id===reference.version_id||value.data.reference?.version_id===reference.version_id)
  if(node)await focusSelectedNode(node.id)
}
// 编辑原媒体时把该媒体本身作为固定引用展示、校验，发送不会丢失商品参考图。
const editorInputs=computed(()=>sourceEditing.value&&selected.value&&selected.value.data.source?.kind!=='composition'?[selected.value]:inputs.value)
/** 统一输入框仅展示真实节点引用；这些显示字段不替代提交时的服务端素材校验。 */
const editorReferences=computed<ComposerReference[]>(()=>editorInputs.value.map(node=>node.data.reference||{item_id:node.data.source?.id||node.id,version_id:node.id,name:node.data.title,media_type:node.data.kind==='text'?'document':node.data.kind==='compose'?'video':node.data.kind,preview_url:node.data.url||''}))
/** 规划线不偷偷切换文件；来源草案产出后由用户明确选定真实版本，再将该条线固定到结果节点。 */
const completedInputChoices=computed(()=>{
  if(!canEdit.value||!selected.value?.data.manual)return []
  const choices:Array<{source:CreativeNode;result:CreativeNode}>=[]
  for(const source of inputs.value){
    if(!source.data.manual||source.data.url||!['image','video','audio'].includes(source.data.kind))continue
    const seen=new Set<string>()
    for(const edge of edges.value.filter(value=>value.source===source.id&&value.data?.lineage)){
      const result=nodes.value.find(value=>value.id===edge.target)
      if(!result||result.data.kind!==source.data.kind||!['succeeded','completed'].includes(result.data.status)||!result.data.url||!result.data.source)continue
      const key=JSON.stringify(result.data.source);if(seen.has(key))continue;seen.add(key)
      if(canConnectCreative(nodes.value,edges.value,result.id,selectedId.value))choices.push({source,result})
    }
  }
  return choices
})
const completedInputMenu=computed(()=>completedInputChoices.value.map(({source,result},index)=>({label:`${source.data.title} · 已完成结果 ${index+1}`,onSelect:()=>useCompletedInput(source.id,result.id)})))
const promptPosition=computed(()=>{
  if(!selected.value||expanded.value)return undefined
  const measured=flow.findNode(selected.value.id)
  const size=measured?.dimensions
  const position=creativePromptPosition({...viewportArea(),...(canvasSize.value.width?canvasSize.value:{})},{...selected.value.position,width:size?.width||280,height:size?.height||360},flow.viewport.value)
  return {left:`${position.left}px`,top:`${position.top}px`,width:`${position.width}px`,right:'auto',bottom:'auto'}
})
/** 工具贴在当前节点上方，横向与输入框一致防遮挡，不随画布缩放按钮。 */
const toolPosition=computed(()=>{
  if(!selected.value||props.toolNodeId!==selected.value.id)return undefined
  const size=flow.findNode(selected.value.id)?.dimensions
  const position=creativePromptPosition({...viewportArea(),...canvasSize.value},{...selected.value.position,width:size?.width||280,height:0},flow.viewport.value)
  // 完整视频工具允许使用聊天之外的可见宽度，短工具仍按内容收紧；不能被输入器680px上限裁掉半排入口。
  const maxWidth=['video','compose'].includes(selected.value.data.kind)?Math.max(1,canvasSize.value.width-Math.max(16,props.leftInset||0)-16):position.width
  const width=Math.min(toolDockWidth.value||maxWidth,maxWidth)
  const center=(selected.value.position.x+(size?.width||280)/2)*flow.viewport.value.zoom+flow.viewport.value.x
  const left=Math.max(Math.max(16,props.leftInset||0),Math.min(center-width/2,canvasSize.value.width-width-16))
  return {left:`${left}px`,top:`${Math.max(8,selected.value.position.y*flow.viewport.value.zoom+flow.viewport.value.y-toolDockHeight.value-12)}px`,width:'max-content',maxWidth:`${maxWidth}px`}
})
const running=computed(()=>nodes.value.filter(node=>['planning','queued','pending','submitting','running','rendering','in_progress','processing','result_pending','status_unavailable','result_error'].includes(node.data.status)))
/** 任务卡只展示真实节点阶段；未知状态单列说明，不通过等待时间推算进度。 */
function taskCaption(node:CreativeNode){
  if(['status_unavailable','result_error'].includes(node.data.status))return '状态待核对'
  if(node.data.status==='result_pending')return '正在读取结果'
  if(node.data.phase==='planning')return '正在整理方案'
  if(['queued','pending'].includes(node.data.status))return '等待执行'
  return typeof node.data.progress==='number'?`正在生成 · ${node.data.progress}%`:'正在生成'
}
/** 规格来自所选节点对应的运行快照，而不是聊天输入框当前可能已更换的模型。 */
const selectedSpecification=computed(()=>{
  const node=selected.value,run=props.runs.find(value=>value.id===node?.data.runId)
  const item=(node?.data.planTarget==='image'?run?.image_plan:run?.creative_plan)?.items.find(value=>value.id===node?.data.itemId)
  const parameters=item?.parameters||run?.task_input?.parameters||run?.draft.parameters
  if(!parameters)return ''
  return [parameters.model,parameters.aspectRatio,parameters.durationSec?`${parameters.durationSec}秒`:'',parameters.resolution].filter(Boolean).join(' · ')
})
watch(selectedId,()=>{renaming.value=false})
/** 共用输入器只回写所选节点草稿，不在键入时改写聊天需求或发起生成。 */
function updateNodePrompt(value:string){if(canEdit.value&&!conflict.value)draftPrompt.value=value}
/** 规格选择独立保存至本节点，失败仍由原布局错误反馈；不会自动撤销其他运行的报价。 */
function updateNodeParameters(value:CreativeNodeParameters){
  if(!canEdit.value||conflict.value||!ready.value||props.busy||!selected.value)return
  if(JSON.stringify(selected.value.data.parameters)===JSON.stringify(value))return
  // 初次固定默认值不是一次用户编辑，不占撤销栈；后续手动更改才记录可撤销快照。
  if(selected.value.data.parameters)snapshot()
  layout.value.node_parameters||={};layout.value.node_parameters[selectedId.value]={...value};changed()
}
watch(()=>creativeActivity(nodes.value),value=>emit('activity',value),{immediate:true})
const nodeTypes={creative:markRaw(CreativeCanvasNode)},edgeTypes={creative:markRaw(CreativeCanvasEdge)}
// 大图总览保留一位小数，不能把0.1%显示成0%或用整数掩盖真实比例。
const zoom=computed(()=>Math.round(flow.viewport.value.zoom*100))
/** 空白处右键的新增菜单沿用同一创建命令，并将画布坐标传给新草案定位。 */
function createMenuItems(anchor?:{x:number;y:number}){
  const point=anchor?{...anchor}:undefined
  return [
    {label:'图片',icon:'i-lucide-image',onSelect:()=>createNode('image',undefined,point)},
    {label:'视频',icon:'i-lucide-film',onSelect:()=>createNode('video',undefined,point)},
    // 仅在平台真实开通音乐生成时提供入口，不伪造语音或音色能力。
    ...(props.audioEnabled?[{label:'音频',icon:'i-lucide-audio-lines',onSelect:()=>createNode('audio',undefined,point)}]:[]),
    {label:'文本',icon:'i-lucide-type',onSelect:()=>createNode('text',undefined,point)},
  ]
}
// 剪辑只打开现有工作台；任务与导出仍需用户在工作台明确操作。
const newItems=computed(()=>[...createMenuItems(),{label:'绑定短剧项目',icon:'i-lucide-link',disabled:!ready.value||conflict.value,onSelect:()=>{productionBindingOpen.value=true}},{label:scriptState.value?.document?'编辑剧本':'导入剧本',icon:'i-lucide-file-text',disabled:!ready.value||conflict.value||scriptBusy.value,onSelect:()=>openScriptDocument()},{label:'AI 剪辑',icon:'i-lucide-clapperboard',disabled:!ready.value||conflict.value||!!props.busy,onSelect:()=>emit('editWorkspace')},{label:'添加素材',icon:'i-lucide-upload',onSelect:()=>emit('upload')}])
const contextNodeId=ref('')
const contextPoint=ref<{x:number;y:number}|null>(null)
/** 右键拖动只平移镜头；超过阈值才阻止右键菜单，普通右键仍能新增节点。 */
let rightPan:{x:number;y:number;view:{x:number;y:number;zoom:number};moved:boolean}|undefined
let suppressContextMenu=false
function startRightPan(event:PointerEvent){
  if(event.button!==2||(event.target as HTMLElement).closest('button,input,textarea,[contenteditable=true],.nowheel'))return
  suppressContextMenu=false
  rightPan={x:event.clientX,y:event.clientY,view:{...flow.viewport.value},moved:false}
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.stopPropagation()
}
function moveRightPan(event:PointerEvent){
  if(!rightPan)return
  const dx=event.clientX-rightPan.x,dy=event.clientY-rightPan.y
  if(Math.hypot(dx,dy)>4)rightPan.moved=true
  if(rightPan.moved){suppressContextMenu=true;void flow.setViewport({...rightPan.view,x:rightPan.view.x+dx,y:rightPan.view.y+dy})}
}
function endRightPan(){if(rightPan?.moved)viewportEnd({event:{type:'pointerup'}});rightPan=undefined}
/** 右键固定本次菜单来源；打开菜单本身不切换或丢弃未保存编辑。 */
function prepareContextMenu(event:MouseEvent){
  if(suppressContextMenu){event.preventDefault();event.stopPropagation();suppressContextMenu=false;return}
  contextNodeId.value=(event.target as HTMLElement).closest('.vue-flow__node')?.getAttribute('data-id')||''
  const bounds=canvasElement.value?.getBoundingClientRect()
  // 坐标先转成画布世界坐标；缩放后点击空白新增仍落在鼠标附近，而不是默认挤到旧列。
  contextPoint.value=bounds?creativeCanvasPoint(event.clientX,event.clientY,bounds,flow.viewport.value):null
}
async function contextTools(action?:'crop'){const node=nodes.value.find(value=>value.id===contextNodeId.value);if(node&&await choose(node.id))emit('tools',node,action)}
async function contextRemove(){if(contextNodeId.value&&await choose(contextNodeId.value))removeOpen.value=true}
// 主/子菜单距视口保留12px；方向与项目锚点交给原组件，不传Nuxt封装未支持的偏移参数。
const contextMenuContent={collisionPadding:12}
const contextSubmenuContent={collisionPadding:12}
const contextItems=computed(()=>{
  const node=nodes.value.find(value=>value.id===contextNodeId.value)
  if(node)return [...nodeCreationItems(node.id),
    ...(compositionSourceIds([node.id]).length?[{label:'剪辑 / 合成',icon:'i-lucide-clapperboard',disabled:!ready.value||conflict.value||creatingNode.value||!!props.busy,onSelect:()=>composeNodes([node.id])}]:[]),
    ...(node.data.kind==='image'&&node.data.url&&node.data.source?[{label:'裁剪 / 改比例',icon:'i-lucide-crop',onSelect:()=>contextTools('crop')}]:[]),
    ...(node.data.url&&['image','video','audio','compose'].includes(node.data.kind)?[{label:'编辑与下载',icon:'i-lucide-sliders-horizontal',onSelect:()=>contextTools()}]:[]),
    {label:'复制节点',icon:'i-lucide-copy',kbds:['Ctrl','C'],onSelect:()=>copyNode(node.id)},
    {label:'创建副本',icon:'i-lucide-copy-plus',kbds:['Ctrl','D'],disabled:!ready.value||conflict.value||!!props.busy||creatingNode.value||!canDerive(node.data.kind,node.id),onSelect:()=>duplicateNode(node.id)},
    {label:'移出画布',icon:'i-lucide-trash-2',disabled:!ready.value||conflict.value,onSelect:contextRemove}]
  return [
    {label:'添加',icon:'i-lucide-plus',content:contextSubmenuContent,children:createMenuItems(contextPoint.value||undefined)},
    {label:'上传',icon:'i-lucide-upload',onSelect:()=>emit('upload')},
    // 创建/导入与画布编辑分组；不再用常驻说明文字把单行菜单撑高。
    {type:'separator' as const},
    {label:'粘贴',icon:'i-lucide-clipboard-paste',kbds:['Ctrl','V'],disabled:!canPasteCopiedNode.value,onSelect:()=>pasteNode(contextPoint.value||undefined)},
    {label:'撤销',icon:'i-lucide-undo-2',kbds:['Ctrl','Z'],disabled:!undoCount.value,onSelect:()=>undo()},
    {label:'一键整理',icon:'i-lucide-grip',content:contextSubmenuContent,disabled:!ready.value||conflict.value,children:[
      {label:'水平排列',onSelect:()=>arrange(nodes.value.map(node=>node.id),'horizontal')},
      {label:'垂直排列',onSelect:()=>arrange(nodes.value.map(node=>node.id),'vertical')}]},
  ]
})
// 右键菜单采用画布专用紧凑表面；限制宽度后可在节点旁展开，不再被长说明撑成遮住画布的大面板。
const contextMenuUi={content:'creative-context-menu',itemDescription:'creative-context-menu-description'}
/** 派生与手动拖线复用同一能力校验，不能从菜单绕过视频→图片等不支持的引用。 */
function canDerive(kind:CreativeNodeKind,parent?:string){
  const source=nodes.value.find(node=>node.id===parent)
  if(!source)return true
  // 失败重试不引用失败文件，而是下方创建逻辑重新选取原始合法素材。
  if(!source.data.url&&['failed','cancelled'].includes(source.data.status))return true
  const target:CreativeNode={id:'derive-target',type:'creative',position:{x:0,y:0},data:{kind,title:'',prompt:'',status:'draft',manual:true}}
  return canConnectCreative([...nodes.value,target],edges.value,source.id,target.id)
}
/** 右侧加号固定绑定所点击节点，不借用当前选中项；菜单打开后切换选择也不会串来源。 */
function nodeCreationItems(id:string){
  const source=nodes.value.find(node=>node.id===id)
  if(!source)return []
  const inheritedKind=['audio','compose'].includes(source.data.kind)?'video':source.data.kind
  const item=(label:string,kind:CreativeNodeKind,icon:string)=>({label,icon,disabled:!ready.value||conflict.value||creatingNode.value||!!props.busy||!canDerive(kind,id),

    onSelect:()=>createNode(kind,id)})
  return [item('派生',inheritedKind,'i-lucide-git-branch-plus'),item('文本','text','i-lucide-type'),item('图片','image','i-lucide-image'),item('视频','video','i-lucide-film')]
}
/** 拖线的可访问替代入口，与鼠标连线走同一校验和持久化，不直接改合成片段。 */
const compositionSourcesMenu=computed(()=>{
  const used=new Set(inputs.value.map(node=>JSON.stringify(node.data.source)))
  return nodes.value.filter(node=>{
    const key=JSON.stringify(node.data.source)
    if(!canConnectCreative(nodes.value,edges.value,node.id,selectedId.value)||used.has(key))return false
    used.add(key);return true
  }).map(node=>({label:node.data.title,onSelect:()=>connect({source:node.id,target:selectedId.value,sourceHandle:null,targetHandle:null})}))
})
/** 本地兜底按账号/会话隔离；服务端保存失败不谎报已保存，不缓存签名媒体地址。 */
const cacheKey=()=>`liv-creative-canvas-v1:${props.ownerId}:${props.sessionId}`
// Vue 响应式对象不能直接 structuredClone，持久化合同只含 JSON 安全字段。
const cloneLayout=():CreativeLayout=>JSON.parse(JSON.stringify(layout.value))
function stash(){
  // 输入中的文字只做本机恢复，不作为云端已保存稿，更不恢复报价或执行许可。
  const content=JSON.stringify({...(conflict.value&&conflictLocal?{revision:conflictRevision,layout:conflictLocal,dirty:true}:{revision:revision.value,layout:layout.value,dirty:!!dirty}),inputs:conflict.value&&conflictInputs?conflictInputs:Object.fromEntries(unsavedInputs)})
  // 标签页私有副本优先用于刷新；另一页保存不能覆盖本页尚未保存的正文。
  try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(cacheKey(),content)}catch{/* 隐私模式禁用存储时继续保留内存草稿。 */}
  // 保留原本关闭标签后的恢复兜底；新页无私有副本时才读取共享备份。
  try{localStorage.setItem(cacheKey(),content)}catch{/* 浏览器空间不足时仍保留当前页面草案。 */}
}
function snapshot(){history.push(cloneLayout());if(history.length>80)history.shift();future.length=0;undoCount.value=history.length;redoCount.value=0}
function changed(){dirty++;saved.value=false;stash();clearTimeout(timer);timer=setTimeout(persist,600)}
let assetReadSequence=0
/** 只读取服务端已保存的固定引用；迟到预览不能覆盖新会话或更新请求。 */
async function refreshCanvasAssets(current=epoch){
  const sequence=++assetReadSequence
  try{
    const value=await request<{items:CanvasAssetPreview[]}>(`/creation/sessions/${props.sessionId}/canvas/assets`)
    if(!alive||current!==epoch||sequence!==assetReadSequence)return false
    canvasAssets.value=value.items.map(item=>({...item,preview_url:item.preview_url?libraryService.previewUrl(item.preview_url):''}))
    if(actionError.value==='画布素材读取失败，请稍后重新读取画布。')actionError.value=''
    return true
  }catch{
    if(alive&&current===epoch&&sequence===assetReadSequence){canvasAssets.value=[];actionError.value='画布素材读取失败，请稍后重新读取画布。'}
    return false
  }
}
async function persist(){
  if(!ready.value||saving.value||conflict.value||!dirty||!alive)return
  saving.value=true;const current=epoch,stamp=dirty,content=cloneLayout()
  try{
    const value=await request<{revision:number}>(`/creation/sessions/${props.sessionId}/canvas`,{method:'PUT',body:{revision:revision.value,content}})
    if(!alive||current!==epoch)return
    revision.value=value.revision;error.value='';if(actionError.value==='画布尚未保存，请先处理保存错误。')actionError.value='';if(dirty===stamp){dirty=0;saved.value=true}stash()
    // 保存重试或撤销后，新引用此前没有授权预览；保存成功才重新读取，不回传签名地址。
    if((content.asset_references||[]).some(ref=>!canvasAssets.value.some(item=>item.item_id===ref.item_id&&item.version_id===ref.version_id)))void refreshCanvasAssets(current)
  }catch(cause){if(alive&&current===epoch){error.value=(cause as Error).message||'画布保存失败，修改保留在本机，请重试。';if((cause as {statusCode?:number}).statusCode===409){conflict.value=true;conflictLocal=cloneLayout();conflictRevision=revision.value;stash()}}}
  finally{if(alive&&current===epoch){saving.value=false;if(dirty&&dirty!==stamp){clearTimeout(timer);timer=setTimeout(persist,600)}}}
}
async function load(){
  // 手动重读前先备份当前输入；网络失败不能把正在编辑的正文换成旧缓存。
  if(ready.value)stash()
  const current=++epoch;ready.value=false;error.value='';canvasAssets.value=[];scriptState.value=undefined;scriptOpen.value=false;scriptReaderOpen.value=false;scriptBusy.value=false;scriptRequest=undefined
  void loadScriptDocument(current)
  productionWorkspace.value=null;productionShots.value=[];productionEpisodes.value=[];productionDocumentIsSource.value=false;productionReadError.value='';productionProjectId.value=''
  productionBindingOpen.value=false
  void loadProductionWorkspace()
  let backup:{revision:number;layout:CreativeLayout;dirty:boolean;inputs?:Record<string,{prompt:string;title:string}>}|null=null
  try{if(typeof sessionStorage!=='undefined')backup=JSON.parse(sessionStorage.getItem(cacheKey())||'null')}catch{/* 私有备份不可读时再检查原共享备份。 */}
  if(!backup)try{backup=JSON.parse(localStorage.getItem(cacheKey())||'null')}catch{/* 不恢复损坏备份。 */}
  // 离线分支也需要相同的文字备份；不能仅在请求成功后读取，否则关闭页面会覆盖成空输入。
  const backupInputs:Record<string,{prompt:string;title:string}>={}
  for(const [id,input] of Object.entries(backup?.inputs||{}))if(typeof input?.prompt==='string'&&input.prompt.length<=20000&&typeof input.title==='string'&&input.title.length<=160)backupInputs[id]=input
  try{
    const value=await request<{revision:number;content:CreativeLayout|null}>(`/creation/sessions/${props.sessionId}/canvas`)
    if(!alive||current!==epoch)return
    // 新的读取结果重新评估冲突，不继承上次失败留下的冲突标记或旧选择正文。
    selectedId.value='';conflict.value=false;conflictLocal=null;conflictInputs=null;dirty=0;saved.value=false
    revision.value=value.revision;layout.value=value.content||emptyCreativeLayout();initialCameraReady=false
    const acceptedBackup=!!backup?.layout&&!!value.content&&sameCreativeLayout(backup.layout,value.content)
    // 选择过但未改动的文字不算冲突；真正改过的输入即使布局dirty=false也不能被新修订抹掉。
    const priorNodes=backup?.layout?projectCreativeGraph(props,backup.layout).nodes:[]
    const pendingInputs=Object.entries(backupInputs).some(([id,input])=>{const node=priorNodes.find(node=>node.id===id);return !node||input.prompt!==node.data.prompt||input.title!==node.data.title})
    let resumeLayoutSave=false
    // 只有同一云端修订的输入备份可回填；其他页面已更新时不能用旧文字覆盖新稿。
    unsavedInputs.clear()
    if(backup&&(backup.revision===value.revision||acceptedBackup))for(const [id,input] of Object.entries(backupInputs))unsavedInputs.set(id,input)
    // 已被服务端接收的同一内容直接采用新修订；同修订未发送的布局安全补存，不重放任何生成。
    if(backup?.dirty&&acceptedBackup){dirty=0;saved.value=true}
    else if(backup?.dirty&&backup.revision===value.revision){layout.value=backup.layout;dirty=1;resumeLayoutSave=true}
    else if(backup?.layout&&backup.revision!==value.revision&&!acceptedBackup&&(backup.dirty||pendingInputs)){conflict.value=true;conflictLocal=backup.layout;conflictRevision=backup.revision;conflictInputs=backupInputs;error.value='其他页面保存了新画布，本机修改仍保留。请先核对，不会自动覆盖。'}
    if(layout.value.asset_references?.length){await refreshCanvasAssets(current);if(!alive||current!==epoch)return}
    await nextTick();await flow.setViewport(layout.value.viewport);if(!value.content&&!backup)await frameNodes();ready.value=true
    const selected=props.focusId||layout.value.selected_id;if(selected&&nodes.value.some(node=>node.id===selected)){await choose(selected,false);if(props.focusId){magnifiedNodeId.value=selected;await focusNode(selected)}}
    // 只修复完全看不到任何卡片的过期/错误镜头；只要有节点仍可见，就保留用户保存的平移和缩放。
    await nextTick()
    if(nodes.value.length){
      const area=viewportArea()
      // 视口尺寸尚未就绪时留给 nodesInitialized/ResizeObserver 重试，不锁住首帧镜头判断。
      if(area.width>0&&area.height>0){
        initialCameraReady=true
        if(!selectedId.value&&!creativeCameraHasVisibleNode(nodes.value.map(node=>({...nodeBounds(node),...node.position})),area,flow.viewport.value))await frameNodes()
      }
    }
    stash()
    if(resumeLayoutSave){clearTimeout(timer);timer=setTimeout(persist,0)}
  }catch(cause){if(alive&&current===epoch){if(backup?.layout){layout.value=backup.layout;revision.value=backup.revision;dirty=backup.dirty?1:0;unsavedInputs.clear();for(const [id,input] of Object.entries(backupInputs))unsavedInputs.set(id,input)}error.value=(cause as Error).message||'画布读取失败';ready.value=false}}
}
/** 冲突必须由用户明确选择；先重读最新修订，选择本机才可在该修订上另存。 */
async function resolveConflict(local:boolean){
  if(saving.value)return
  const current=epoch;const retained=conflictLocal||cloneLayout(),retainedInputs=conflictInputs||Object.fromEntries(unsavedInputs);saving.value=true
  try{
    const remote=await request<{revision:number;content:CreativeLayout|null}>(`/creation/sessions/${props.sessionId}/canvas`)
    if(!alive||current!==epoch)return
    // 明确选云端才放弃本机文字；切换输入前清掉旧选择，防止choose又把旧正文写回新版本。
    selectedId.value='';unsavedInputs.clear()
    if(local)for(const [id,input] of Object.entries(retainedInputs))unsavedInputs.set(id,input)
    revision.value=remote.revision;layout.value=local?retained:(remote.content||emptyCreativeLayout());dirty=0;conflict.value=false;conflictLocal=null;conflictInputs=null;error.value='';saved.value=!local
    // 选择云端后重新核权其固定版本；保留本机时等该版本实际保存后再读取，不能借用冲突前的旧预览。
    assetReadSequence++;canvasAssets.value=[]
    if(!local&&layout.value.asset_references?.length){await refreshCanvasAssets(current);if(!alive||current!==epoch)return}
    await nextTick()
    const id=layout.value.selected_id
    if(id&&nodes.value.some(node=>node.id===id))await choose(id,false,true)
    stash()
    if(local)changed()
  }catch(cause){if(alive&&current===epoch)error.value=(cause as Error).message}
  finally{if(alive&&current===epoch)saving.value=false}
}
// 任务进展更新只刷新节点数据，不重排位置、不抢选择，也不触发保存或生成。
watch(graph,value=>{
  const existing=new Set(nodes.value.map(node=>node.id))
  const previousNodes=nodes.value
  const previousSelection=previousNodes.find(node=>node.id===selectedId.value)
  const added=ready.value?value.nodes.filter(node=>!existing.has(node.id)&&!node.data.manual&&!layout.value.positions[node.id]):[]
  nodes.value=value.nodes.map(node=>({...node,selected:node.id===selectedId.value||multipleIds.value.includes(node.id)}))
  if(selectedId.value&&!value.nodes.some(node=>node.id===selectedId.value))selectedId.value=''
  // 只安排本次新到业务节点，不移动历史节点；轮询同一身份不会重复新增或反复抢镜头。
  if(added.length&&canvasElement.value?.clientWidth){
    const camera=flow.viewport.value,visible=creativeVisibleArea(viewportArea())
    const occupied=nodes.value.filter(node=>!added.some(value=>value.id===node.id)).map(node=>node.position)
    for(const node of added){
      if(isFixedDramaNode(node))continue // 固定节点由整块排版处理，不按普通小卡片放置。
      // 方案消失且真实任务受理时沿用该运行的方案位置，不把同一需求挪到另一列。
      const replacedPlan=node.id.startsWith('task:')&&node.data.runId?previousNodes.find(value=>value.id===`text:${node.data.runId}`):undefined
      if(replacedPlan||node.id.startsWith('task:')&&node.data.runId&&layout.value.positions[`text:${node.data.runId}`]){
        layout.value.positions[node.id]={...(replacedPlan?.position||layout.value.positions[`text:${node.data.runId}`])}
        if(replacedPlan&&previousSelection?.id===replacedPlan.id)void nextTick().then(()=>choose(node.id,false))
        occupied.push(layout.value.positions[node.id]);continue
      }
      const sources=value.edges.filter(edge=>edge.target===node.id).map(edge=>nodes.value.find(value=>value.id===edge.source)).filter((value):value is CreativeNode=>!!value)
      const sourceX=sources.length?Math.max(...sources.map(node=>node.position.x+400)):-Infinity
      const position=creativeFreePosition({x:Math.max(sourceX,(visible.left+24-camera.x)/camera.zoom),y:(visible.top-camera.y)/camera.zoom},occupied)
      layout.value.positions[node.id]=position;occupied.push(position)
    }
    changed()
    if(!inputChanged.value&&!compositionEditor.value?.isDirty())void nextTick().then(()=>frameNodes(added.map(node=>node.id)))
  }
}, {immediate:true})
watch(()=>[props.ownerId,props.sessionId],()=>{void load()},{immediate:true})
watch(()=>props.focusId,async id=>{if(id&&nodes.value.some(node=>node.id===id))await focusSelectedNode(id)})
watch([draftPrompt,draftTitle],()=>{
  if(ready.value&&canEdit.value&&selected.value){unsavedInputs.set(selected.value.id,{prompt:draftPrompt.value,title:draftTitle.value});stash()}
})
/** 真实遮挡几何由聊天小卡、任务列表与本级停靠区共同决定，不缩减画布本身的宽度。 */
function viewportArea(){
  const canvasRect=canvasElement.value?.getBoundingClientRect(),taskRect=taskListElement.value?.getBoundingClientRect()
  const taskObstruction=canvasRect&&taskRect&&taskRect.width>0&&taskRect.height>0?{x:taskRect.left-canvasRect.left,y:taskRect.top-canvasRect.top,width:taskRect.width,height:taskRect.height}:undefined
  // 底部缩放/撤销工具必须可点击；按实际高度和底边距预留，不用提升层级盖住输入器按钮。
  const viewTools=viewToolsElement.value,viewHeight=viewTools?.offsetHeight||0
  const viewBottom=viewTools&&typeof getComputedStyle!=='undefined'?Math.max(0,Number.parseFloat(getComputedStyle(viewTools).bottom)||0):0
  const viewReserve=viewHeight?viewHeight+viewBottom+12:0
  return {width:canvasElement.value?.clientWidth||0,height:canvasElement.value?.clientHeight||0,leftInset:props.leftInset||0,bottomInset:Math.max(props.bottomInset||0,viewReserve),toolHeight:props.toolNodeId?toolDockHeight.value:0,dockHeight:(dockElement.value?.offsetHeight||0)+(dockElement.value&&running.value.length?72:0),obstructions:[...(props.obstructions||[]),...(taskObstruction?[taskObstruction]:[])]}
}
/** 直接按真实卡片边界取景；派生文件晚于业务快照挂载时也不漏掉新结果。 */
async function frameBounds(boxes:Array<{x:number;y:number;width:number;height:number}>){
  await nextTick()
  if(!boxes.length||!canvasElement.value?.clientWidth||!canvasElement.value.clientHeight)return false
  const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y))
  const area=viewportArea(),bounds={x,y,width:Math.max(...boxes.map(box=>box.x+box.width))-x,height:Math.max(...boxes.map(box=>box.y+box.height))-y}
  const nextCamera=creativeFocusCamera(area,bounds,flow.viewport.value,false,.9,CREATIVE_MIN_ZOOM)
  await flow.setViewport(nextCamera)
  // 派生后的安全镜头也属于布局；刷新时恢复来源与新版本，不回到旧视角把结果留在画外。
  if(ready.value&&!conflict.value){layout.value.viewport={...nextCamera};changed()}
  return true
}
/** 新任务与手动总览都在可见区域内取景，不将作品居中到悬浮聊天下方。 */
async function frameNodes(ids=nodes.value.map(node=>node.id),boundsOverrides:Record<string,{width:number;height:number}>={}){
  await nextTick();const values=nodes.value.filter(node=>ids.includes(node.id))
  if(!values.length||!canvasElement.value?.clientWidth||!canvasElement.value.clientHeight)return
  // 布局改动刚写入时节点投影可能还没刷新；取景先读持久布局坐标，避免用旧坐标把新结果留在画外。
  // 节点媒体尚未触发测量时用真实画幅尺寸拟合，避免新裁剪图暂时按旧方形占位而被遮住。
  const production=groupFrames.value.filter(group=>isProductionGroup(group.id)&&group.members.some(id=>ids.includes(id)))
  const boxes=values.filter(node=>!production.some(group=>group.members.includes(node.id))).map(node=>{
    const position=layout.value.positions[node.id]||node.position
    const size=boundsOverrides[node.id]||nodeBounds(node)
    // 尺寸估算器也包含默认原点；必须让真实世界坐标最后覆盖默认 x/y。
    return {...size,...position}
  })
  await frameBounds([...boxes,...production])
}
/** 定位使用画布真实可见区域，扣除悬浮聊天与提示词区；不把整段历史缩成邮票。 */
async function focusNode(id:string,keepCamera=false,persistCamera=false){
  await nextTick()
  const node=nodes.value.find(value=>value.id===id),el=canvasElement.value
  if(!node||!el?.clientWidth){await flow.fitView({nodes:[id],padding:.3,maxZoom:1});return}
  const {width,height}=nodeBounds(node)
  const production=groupFrames.value.find(group=>isProductionGroup(group.id)&&group.members.includes(id))
  const camera=creativeFocusCamera(viewportArea(),production||{...node.position,width,height},flow.viewport.value,keepCamera)
  await flow.setViewport(camera)
  // 用户点击节点后若发生了安全区平移，持久化新的镜头；窗口/浮层临时避让仍不改历史镜头。
  const current=flow.viewport.value
  if(persistCamera&&ready.value&&!conflict.value&&(Math.abs(current.x-camera.x)>.5||Math.abs(current.y-camera.y)>.5||Math.abs(current.zoom-camera.zoom)>.001)){
    layout.value.viewport={...camera};changed()
  }
}
/** 总览后显式回到可编辑比例；双击、键盘和工具按钮走同一离开保护，不触发生成。 */
async function focusSelectedNode(id=selectedId.value){
  if(!id)return
  if(id!==selectedId.value)await choose(id)
  if(id===selectedId.value){magnifiedNodeId.value=id;await focusNode(id)}
}
/** 顶部索引只列真实节点；定位不选中卡片，不打开详情。 */
const locatedDramaStage=ref('')
const dramaStages=computed(()=>{
  const all=nodes.value
  if(!all.some(isFixedDramaNode))return []
  const sections=[{label:'总览',id:''}]
  for(const [label,node] of [
    ['剧本',all.find(n=>n.data.scriptDocument)],
    ['角色',all.find(n=>n.data.productionAsset?.category==='role')],
    ['场景',all.find(n=>n.data.productionAsset?.category==='scene')],
    ['道具',all.find(n=>n.data.productionAsset?.category==='prop')],
    ['分镜',all.find(n=>n.data.productionShot)],
    ['成片',all.find(n=>n.data.productionEpisode)],
  ] as const)if(node)sections.push({label,id:node.id})
  return sections
})
const activeDramaStage=computed(()=>{
  const node=nodes.value.find(n=>n.id===selectedId.value)
  if(!node)return dramaStages.value.some(item=>item.id===locatedDramaStage.value)?locatedDramaStage.value:''
  return dramaStages.value.find(item=>{
    const target=nodes.value.find(n=>n.id===item.id)
    return target&&(target.id===node.id||
      !!target.data.productionAsset&&target.data.productionAsset.category===node.data.productionAsset?.category||
      !!target.data.productionShot&&!!node.data.productionShot||
      !!target.data.productionEpisode&&!!node.data.productionEpisode)
  })?.id||''
})
async function jumpDramaStage(id:string){
  if(!await choose(''))return
  locatedDramaStage.value=id
  if(!id){await fitAll();return}
  const node=nodes.value.find(value=>value.id===id)
  const group=layout.value.groups?.find(value=>isProductionGroup(value.id)&&value.members.includes(id))
  if(group){
    if(node?.data.productionAsset)assetGroupFilters.value[group.id]=node.data.productionAsset.category
    if(group.collapsed&&!conflict.value){group.collapsed=false;changed()}
  }
  await frameNodes([id])
}
/** 历史回执只能定位自己的提取结果，不把旧修订指向当前资产。 */
async function locateExtraction(id:string){
  const group=groupFrames.value.find(value=>value.id===`group:auto-assets-${id}`)
  if(!group?.members[0]||!await choose(''))return false
  locatedDramaStage.value=group.members[0]
  await frameNodes(group.members)
  return true
}
/** 第一次双击只放大画布；同一节点再次双击才打开只读原图，绝不保存或生成。 */
async function doubleClickNode(id:string){
  const node=nodes.value.find(value=>value.id===id)
  if(!node)return
  if(magnifiedNodeId.value===id&&selectedId.value===id&&node.data.kind==='image'&&node.data.url&&node.data.source&&['reference','succeeded','completed'].includes(node.data.status)){
    previewNode.value=node;return
  }
  await focusSelectedNode(id)
}
// 浮层展开或拖宽只补足当前作品可见性；收起不重排节点，也不强制缩放整张图。
watch(()=>props.leftInset,(value,previous)=>{if(ready.value&&selectedId.value&&magnifiedNodeId.value===selectedId.value&&(value||0)>(previous||0))void focusNode(selectedId.value,true)})
/** 普通节点也响应窗口尺寸与缩小卡遮挡；仅补足取景，不改位置、正文或采购状态。 */
watch(()=>[canvasSize.value.width,canvasSize.value.height,props.bottomInset,(props.obstructions||[]).map(box=>`${box.x},${box.y},${box.width},${box.height}`).join('|'),running.value.length,completedNotices.value.length,taskOpen.value],async()=>{
  // 实际工作区尺寸改变时恢复可读取景，避免手机临时缩放被带回宽屏；节点世界坐标不变。
  if(!expanded.value&&ready.value&&selectedId.value&&magnifiedNodeId.value===selectedId.value)await focusNode(selectedId.value)
},{flush:'post'})
/** 节点工具会改变媒体尺寸；等图形库完成真实测量再补足取景，防止下方输入框被挤出视口。 */
watch(()=>{
  const id=props.toolNodeId,size=id?flow.findNode(id)?.dimensions:undefined
  return [id,size?.width,size?.height,canvasSize.value.width,canvasSize.value.height,toolDockHeight.value] as const
},async([id])=>{
  await nextTick()
  // 迟到的图片测量不能将镜头拉回已退出或切换的工具节点。
  // 工具/图片尺寸完成测量后重新适应当前节点，避免初次估算缩小后永久停在邮票比例。
  if(id&&ready.value&&props.toolNodeId===id&&selectedId.value===id&&magnifiedNodeId.value===id)await focusNode(id)
},{flush:'post'})
/** 首次尺寸测量完成后再定位，避免加载时宽高为0导致错误缩放。 */
function nodesInitialized(){
  if(initialCameraReady||!ready.value||!nodes.value.length)return
  // 图形库可能早于布局测量触发初始化；等实际视口有宽高后再判断保存镜头。
  const area=viewportArea();if(area.width<=0||area.height<=0)return
  initialCameraReady=true
  if(selectedId.value&&magnifiedNodeId.value===selectedId.value)void focusNode(selectedId.value)
  else if(!creativeCameraHasVisibleNode(nodes.value.map(node=>({...nodeBounds(node),...node.position})),area,flow.viewport.value))void frameNodes()
}
onBeforeUnmount(()=>{stash();alive=false;epoch++;clearTimeout(timer);clearTimeout(clipboardStatusTimer);dockObserver?.disconnect();canvasObserver?.disconnect();toolDockObserver?.disconnect()})
/** 工具换行及批注模式变化也参与取景，避免工具覆盖媒体；观察宿主，不监听整个文档。 */
watch(toolDockElement,element=>{
  toolDockObserver?.disconnect()
  if(!element||typeof ResizeObserver==='undefined')return
  toolDockObserver=new ResizeObserver(()=>{toolDockHeight.value=element.offsetHeight;toolDockWidth.value=element.offsetWidth})
  toolDockObserver.observe(element)
},{flush:'post'})
/** 容器变宽、聊天收起和窗口变化都重新计算锚点，不写业务状态。 */
watch(canvasElement,element=>{
  canvasObserver?.disconnect();if(!element)return
  const measure=()=>{canvasSize.value={width:element.clientWidth,height:element.clientHeight};if(ready.value&&!initialCameraReady)nodesInitialized()}
  measure();if(typeof ResizeObserver!=='undefined'){canvasObserver=new ResizeObserver(measure);canvasObserver.observe(element)}
})
// 编辑器异步读入片段后高度会变化；只在停靠区尺寸明显变化时重算，普通状态轮询不抢镜头。
watch(dockElement,element=>{
  dockObserver?.disconnect();dockHeight=0
  if(!element||typeof ResizeObserver==='undefined')return
  dockObserver=new ResizeObserver(()=>{
    const height=element.offsetHeight;if(Math.abs(height-dockHeight)<16)return;dockHeight=height
    // 总览下第一次选择不能立即移动小目标，留给双击/F/定位按钮显式恢复可读镜头。
    // 展开编辑是临时覆盖层，不应把背后的节点缩成邮票；恢复普通态才补足可见范围。
    if(!expanded.value&&ready.value&&selectedId.value&&magnifiedNodeId.value===selectedId.value)void focusNode(selectedId.value,true)
  })
  dockObserver.observe(element)
})
/** 草案切换保留本机输入；显式保存才修改云端节点，不写已执行快照。 */
async function choose(id:string,save=true,leaveApproved=false){
  const selection=++selectionEpoch
  const requested=nodes.value.find(value=>value.id===id)
  if(!leaveApproved&&id!==selectedId.value&&!await confirmCompositionLeave())return false
  if(!leaveApproved&&props.beforeSelect&&!await props.beforeSelect(requested)){nodes.value.forEach(value=>{(value as CreativeNode&{selected?:boolean}).selected=value.id===selectedId.value});return false}
  if(selection!==selectionEpoch||!alive)return false
  // 搜索定位折叠成员时显式展开所在组，不把焦点移向不可见节点。
  if(id)for(const group of layout.value.groups||[])if(group.collapsed&&group.members.includes(id)){group.collapsed=false;if(ready.value)changed()}
  if(requested?.data.productionAsset)for(const group of layout.value.groups||[])if(group.members.includes(id))assetGroupFilters.value[group.id]=requested.data.productionAsset.category
  multipleIds.value=[];selectedGroupId.value=''
  if(canEdit.value&&selected.value)unsavedInputs.set(selected.value.id,{prompt:draftPrompt.value,title:draftTitle.value})
  if(id!==selectedId.value)magnifiedNodeId.value=''
  selectedId.value=id;const node=nodes.value.find(value=>value.id===id)
  nodes.value.forEach(value=>{(value as CreativeNode&{selected?:boolean}).selected=value.id===id})
  if(save&&ready.value){layout.value.selected_id=id;changed()}
  if(node){const local=unsavedInputs.get(id);draftPrompt.value=local?.prompt??node.data.prompt;draftTitle.value=local?.title??node.data.title;emit('select',node)}
  return true
}
/** 合成编辑和其他节点共用真实离开保护；进行中的保存/提交不能被切换打断。 */
async function confirmCompositionLeave(){
  if(compositionEditor.value?.isBusy()){error.value='正在处理片段计划，请完成后再切换。';return false}
  return !compositionEditor.value?.isDirty()||await confirm('片段计划还有未保存修改，是否放弃并离开？原视频和已保存成片不受影响。','离开合成编辑')
}
/** 显式建立业务绑定前等待当前布局保存成功；失败或冲突时不能创建游离成片。 */
async function ensureSaved(){clearTimeout(timer);if(saving.value)return false;await persist();return ready.value&&!dirty&&!conflict.value&&!saving.value}
/** 单独上画布只保存资产和固定版本编号；读取预览时重新由服务端核权。 */
async function placeLibraryAsset(item:{id:string;media_type:string;versions:Array<{id:string}>}){
  const version=item.versions[0],current=epoch
  if(!version||!['image','video','audio'].includes(item.media_type)){actionError.value='此素材没有可用的图片、视频或音频版本。';return false}
  if(!ready.value||saving.value||conflict.value||props.busy){actionError.value='画布正在处理或存在保存冲突，请处理后再添加素材。';return false}
  if(!await confirmCompositionLeave()||(props.beforeSelect&&!await props.beforeSelect(undefined)))return false
  // 确认对话框等待期间可能切换账号或会话，旧操作不能落到新画布。
  if(!alive||current!==epoch)return false
  // 旧服务可能忽略新增字段并返回 200；先确认版本接口存在，避免写入后才发现无法恢复。
  try{
    const capability=await request<{items:CanvasAssetPreview[]}>(`/creation/sessions/${props.sessionId}/canvas/assets`)
    if(!alive||current!==epoch)return false
    if(!Array.isArray(capability.items))throw new Error('画布素材接口返回格式不正确。')
  }catch(cause){
    if(alive&&current===epoch)actionError.value=(cause as {statusCode?:number}).statusCode===404?'当前服务尚未支持画布素材，请更新服务后重试。':'画布素材服务暂不可用，请稍后重试。'
    return false
  }
  if(!await ensureSaved()){actionError.value='画布尚未保存，请先处理保存错误。';return false}
  if(!alive||current!==epoch)return false
  const id=`reference:${version.id}`,existing=layout.value.asset_references||[]
  if(!existing.some(row=>row.item_id===item.id&&row.version_id===version.id)&&existing.length>=200){actionError.value='画布素材已达到上限。';return false}
  snapshot()
  layout.value.asset_references=existing.some(row=>row.item_id===item.id&&row.version_id===version.id)?existing:[...existing,{item_id:item.id,version_id:version.id}]
  layout.value.hidden=layout.value.hidden.filter(value=>value!==id)
  changed()
  if(!await ensureSaved()||!alive||current!==epoch)return false
  try{
    // 旧服务可能忽略新字段，必须读回确认固定版本真的落库，不能把普通 200 当作添加成功。
    const stored=await request<{revision:number;content:CreativeLayout|null}>(`/creation/sessions/${props.sessionId}/canvas`)
    if(!alive||current!==epoch)return false
    if(stored.revision!==revision.value||!stored.content?.asset_references?.some(row=>row.item_id===item.id&&row.version_id===version.id)){
      dirty++;saved.value=false;stash();actionError.value='素材引用未能确认保存，本机修改已保留，请检查服务版本或画布冲突。';return false
    }
    if(!await refreshCanvasAssets(current)||!alive||current!==epoch)return false
    if(!canvasAssets.value.some(row=>row.item_id===item.id&&row.version_id===version.id&&row.available)){actionError.value='素材已保存到画布，但当前无法读取，请检查素材权限。';return false}
    await nextTick();await choose(id,true,true);await focusNode(id)
    return true
  }catch{if(alive&&current===epoch)actionError.value='素材已保存到画布，但预览读取失败，请稍后重试。';return false}
}
const nodeDragActive=ref(false)
/** 保存起始组框和本次移动集合，单节点与多选移动共用同一落点规则。 */
function dragStart(value:{node?:CreativeNode;nodes?:CreativeNode[]}){
  nodeDropFrames.value=groupFrames.value.filter(group=>!isProductionGroup(group.id)).map(({id,x,y,width,height})=>({id,x,y,width,height}))
  draggedNodeIds=(value.nodes?.length?value.nodes:value.node?[value.node]:[]).map(node=>node.id)
  nodeDragActive.value=true
}
function dragStop(){
  nodeDragActive.value=false
  if(conflict.value){nodeDropFrames.value=null;draggedNodeIds=[];return}
  snapshot()
  if(nodeDropFrames.value){
    const result=dropGroupMembers(layout.value,memberBoxes(draggedNodeIds),nodeDropFrames.value)
    if(result.rejected.length)actionError.value='目标分组已达到200个节点，本次保留原分组归属。'
  }
  nodeDropFrames.value=null;draggedNodeIds=[]
  for(const node of flow.getNodes.value)layout.value.positions[node.id]={...node.position}
  layout.value.viewport={...flow.viewport.value};changed()
}
/** 鼠标在窗口外松开或失焦后释放图形库拖动，不允许无按键移动继续拖着节点走。 */
function releaseCanvasDrag(event?:MouseEvent){
  if(event&&'buttons' in event&&event.buttons!==0)return
  endGroupDrag();endRightPan()
  if(!nodeDragActive.value)return
  nodeDragActive.value=false
  // d3使用mouseup结束拖动；补偿丢失事件而不是重建节点/取消已有坐标。
  window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,view:window,buttons:0,button:0}))
  for(const node of flow.getNodes.value)node.dragging=false
}
onMounted(()=>{if(typeof window==='undefined')return;window.addEventListener('mousemove',releaseCanvasDrag,true);window.addEventListener('mouseup',releaseCanvasDrag,true);window.addEventListener('blur',releaseCanvasDrag)})
onBeforeUnmount(()=>{if(typeof window==='undefined')return;window.removeEventListener('mousemove',releaseCanvasDrag,true);window.removeEventListener('mouseup',releaseCanvasDrag,true);window.removeEventListener('blur',releaseCanvasDrag)})
/** 框选结束先通过原离开保护，关闭单节点工具；只改变选择，不自动打组或提交业务。 */
async function collectSelection(){
  if(!ready.value||conflict.value)return
  const ids=(flow.getSelectedNodes?.value||nodes.value.filter(n=>(n as CreativeNode&{selected?:boolean}).selected)).map(n=>n.id)
  // 框选碰到组成员时把整组纳入，打组后合并旧容器，不复制节点。
  const selected=new Set(ids)
  for(const group of layout.value.groups||[])if(group.members.some(id=>selected.has(id)))group.members.forEach(id=>selected.add(id))
  await applyMultiSelection([...selected])
}
/** 修饰键选择以应用层当前选择为准，避免图形库默认按键或节点工具重绘先清空选择。 */
async function applyMultiSelection(ids:string[]){
  if(!ready.value||conflict.value)return
  if(ids.length<2)return
  if(!await choose(''))return
  multipleIds.value=ids.filter(id=>nodes.value.some(n=>n.id===id&&!isFixedDramaNode(n)))
  nodes.value.forEach(n=>{(n as CreativeNode&{selected?:boolean}).selected=multipleIds.value.includes(n.id)})
}
function nodeClicked(value:{node:CreativeNode;event:MouseEvent}){
  if(value.event?.shiftKey||value.event?.ctrlKey||value.event?.metaKey){
    const current=multipleIds.value.length?[...multipleIds.value]:selectedId.value?[selectedId.value]:[]
    const ids=current.includes(value.node.id)?current.filter(id=>id!==value.node.id):[...current,value.node.id]
    if(ids.length<2)void choose(ids[0]||'');else void applyMultiSelection(ids)
  }else void choose(value.node.id)
}
/** 内嵌作品与普通节点共用同一修饰键选择路径，不绕过离开保护或另建多选状态。 */
function nodeModifierClicked(id:string,event:MouseEvent){
  const node=nodes.value.find(value=>value.id===id)
  if(node)nodeClicked({node,event})
}
/** 组操作复用同一撤销/冲突/保存路径；取消组只移除容器，不删除任何成员或作品。 */
function createGroup(){
  if(!ready.value||conflict.value||multipleIds.value.length<2)return
  if(multipleIds.value.length>200||(layout.value.groups?.length||0)>=100){error.value='一期每组最多200个节点、每个画布最多100组，请缩小本次选择范围。';return}
  snapshot();const id=`group:${crypto.randomUUID()}`
  groupMembers(layout.value,multipleIds.value,id,`分组 ${(layout.value.groups?.length||0)+1}`)
  selectedGroupId.value=id;multipleIds.value=[];changed()
}
async function selectGroup(id:string){if(!await choose('')||!layout.value.groups?.some(g=>g.id===id))return false;selectedGroupId.value=id;return true}
/** 收起前走原编辑离开保护，避免隐藏尚未处理的提示词/合成编辑。 */
async function toggleGroup(id:string){
  if(!ready.value||conflict.value||!await selectGroup(id))return
  const group=layout.value.groups?.find(value=>value.id===id);if(!group)return
  snapshot();group.collapsed=!group.collapsed;changed()
}
/** 切换分类先处理当前节点编辑，不丢提示词，也不修改分组成员。 */
async function filterAssetGroup(id:string,key:string){
  if(!['role','scene','prop'].includes(key)||!await choose(''))return
  assetGroupFilters.value[id]=key as AssetCategory
}
function ungroup(id:string){if(!ready.value||conflict.value)return;snapshot();layout.value.groups=(layout.value.groups||[]).filter(g=>g.id!==id);selectedGroupId.value='';changed()}
function arrange(ids:string[],axis:'horizontal'|'vertical'){
  if(!ready.value||conflict.value)return
  const positions=arrangeGroup(memberBoxes(ids).filter(box=>!nodes.value.some(node=>node.id===box.id&&isFixedDramaNode(node))),axis);if(!Object.keys(positions).length)return
  snapshot();Object.assign(layout.value.positions,positions);changed()
}
// 移动以起始绝对位置和当前画布比例计算，组内相对位置不随轮询/缩放重复累加。
let groupDrag:{id:string;x:number;y:number;zoom:number;members:GroupMemberBox[];active:boolean;moved:boolean;lastMove?:PointerEvent}|undefined
async function startGroupDrag(event:PointerEvent,id:string){
  if(event.button!==0||!ready.value||conflict.value||isProductionGroup(id)&&!isStandaloneGroup(id))return
  const target=event.currentTarget as HTMLElement
  // 阻止兼容 mousedown 再启动画布手势，避免选中后马上被清空。
  event.preventDefault()
  const intent={id,x:event.clientX,y:event.clientY,zoom:flow.viewport.value.zoom,members:[] as GroupMemberBox[],active:false,moved:false}
  groupDrag=intent;target.setPointerCapture(event.pointerId)
  if(!await selectGroup(id)||groupDrag!==intent){if(groupDrag===intent)groupDrag=undefined;return}
  intent.members=memberBoxes(layout.value.groups?.find(g=>g.id===id)?.members||[]).filter(box=>isStandaloneGroup(id)||!nodes.value.some(node=>node.id===box.id&&isFixedDramaNode(node)));intent.active=true
  // 等待离开编辑确认时可能已经移动，获准后补上最后一次位移。
  if(groupDrag.lastMove)moveGroupDrag(groupDrag.lastMove)
}
function moveGroupDrag(event:PointerEvent){
  if((event.buttons&1)===0){endGroupDrag();return}
  const value=groupDrag;if(!value||conflict.value)return
  if(!value.active){value.lastMove=event;return}
  if(!value.moved&&Math.hypot(event.clientX-value.x,event.clientY-value.y)<3)return
  if(!value.moved){snapshot();value.moved=true}
  const positions=moveGroup(value.members,(event.clientX-value.x)/value.zoom,(event.clientY-value.y)/value.zoom)
  // 同步移动画布节点与持久化坐标，组框边界实时跟随成员，不等保存后再更新。
  Object.assign(layout.value.positions,positions)
  for(const node of nodes.value)if(positions[node.id])node.position=positions[node.id]!
}
function endGroupDrag(){if(groupDrag?.moved)changed();groupDrag=undefined}
/** 组内空白也能拖动；实际节点、连线和工具仍优先接收各自事件。 */
function startCanvasPointer(event:PointerEvent){
  if(event.button!==0){startRightPan(event);return}
  // 从组外空白框选，或按 Shift 从组内开始框选；普通左键拖组内空白移动整组。
  if(hand.value||spacePan.value||event.shiftKey||!ready.value||conflict.value||!(event.target instanceof Element)||!event.target.closest('.vue-flow__pane')||event.target.closest('.vue-flow__node,.vue-flow__edge,button,input,textarea'))return
  const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(),view=flow.viewport.value
  const x=(event.clientX-rect.left-view.x)/view.zoom,y=(event.clientY-rect.top-view.y)/view.zoom
  const group=[...groupFrames.value].reverse().find(g=>x>=g.x&&x<=g.x+g.width&&y>=g.y&&y<=g.y+g.height)
  if(!group)return
  event.stopPropagation()
  void startGroupDrag(event,group.id)
}
function viewportEnd(value?:{event?:{sourceEvent?:unknown;type?:string}}){if(!ready.value||!value?.event)return;magnifiedNodeId.value='';layout.value.viewport={...flow.viewport.value};changed()}
/** 缩放按钮属于明确用户操作，图形库的程序化事件可能不带原生event，需要主动保存视口。 */
async function userViewport(action:()=>Promise<unknown>){magnifiedNodeId.value='';await action();if(ready.value&&!conflict.value){layout.value.viewport={...flow.viewport.value};changed()}}
/** 加减吸附到十个百分点刻度；复位精确为 100%，缩放时保持鼠标或视口中心下的世界坐标。 */
function stepCanvasZoom(direction:-1|0|1,anchor?:{x:number;y:number}){
  const view=flow.viewport.value,current=view.zoom*100
  const step=direction>0?Math.floor((current+1e-6)/10)*10+10:Math.ceil((current-1e-6)/10)*10-10
  const next=direction===0?1:Math.max(CREATIVE_MIN_ZOOM,Math.min(2,step/100))
  const area=creativeVisibleArea(viewportArea())
  const point=anchor||{x:area.left+area.width/2,y:area.top+area.height/2}
  const ratio=next/view.zoom
  return userViewport(()=>flow.setViewport({zoom:next,x:point.x+(view.x-point.x)*ratio,y:point.y+(view.y-point.y)*ratio}))
}
/** 普通滚轮仍滚动画布或资产列表，仅 Ctrl/Command 滚轮接管缩放。 */
function canvasZoomWheel(event:WheelEvent){
  if((!event.ctrlKey&&!event.metaKey)||!event.deltaY)return
  event.preventDefault();event.stopPropagation()
  const rect=canvasElement.value?.getBoundingClientRect()
  void stepCanvasZoom(event.deltaY<0?1:-1,rect?{x:event.clientX-rect.left,y:event.clientY-rect.top}:undefined)
}
function fitAll(){return userViewport(()=>frameNodes())}
function connect(value:Connection){
  if(conflict.value)return
  const issue=creativeConnectionIssue(nodes.value,edges.value,value.source,value.target)
  if(issue){actionError.value=issue;return}
  actionError.value='';snapshot();layout.value.edges.push({id:`link:${crypto.randomUUID()}`,source:value.source,target:value.target});changed()
}
function removeEdge(id:string){snapshot();layout.value.edges=layout.value.edges.filter(edge=>edge.id!==id);changed()}
/** 只替换当前手动规划边，保留原草案/产物/自动追溯线；选择引用不调用模型、不恢复费用许可。 */
function useCompletedInput(sourceId:string,resultId:string){
  if(!ready.value||conflict.value||props.busy||submittingDraft.value||!canEdit.value||!selected.value?.data.manual)return
  const choice=completedInputChoices.value.find(value=>value.source.id===sourceId&&value.result.id===resultId)
  const planned=layout.value.edges.filter(edge=>edge.source===sourceId&&edge.target===selectedId.value)
  if(!choice||!planned.length){error.value='来源结果已变化，请重新选择已完成的真实版本。';return}
  const issue=creativeConnectionIssue(nodes.value,edges.value,resultId,selectedId.value)
  if(issue){error.value=issue;return}
  snapshot()
  layout.value.edges=layout.value.edges.map(edge=>planned.includes(edge)?{...edge,source:resultId}:edge)
  error.value='';changed()
}
/** 新节点作为来源的独立后续草案保存；按右键落点或来源卡片寻找最近空位，不改写已有作品。 */
async function createNode(kind:CreativeNodeKind,parent?:string,anchor?:{x:number;y:number},initial?:{title:string;prompt:string;sourceIds?:string[]}){
  if(!ready.value||conflict.value||creatingNode.value)return
  if(parent&&!canDerive(kind,parent)){error.value='此来源不支持直接引用到该类型。视频需要先用作品工具保存截帧，再从截帧派生图片。';return}
  const compositionSources=kind==='compose'&&initial?.sourceIds?[...initial.sourceIds]:null
  if(compositionSources&&JSON.stringify(compositionSourceIds(compositionSources))!==JSON.stringify(compositionSources))return
  if(layout.value.drafts.length>=200){error.value='当前画布已达到200个编辑草案，请先整理节点。';return}
  // 离开保护必须先于布局写入；取消不能留下游离草案、引用线或撤销记录。
  const intent={epoch,id:selectedId.value,prompt:draftPrompt.value,title:draftTitle.value,parameters:JSON.stringify(selected.value?.data.parameters)}
  creatingNode.value=true
  try{
  if(!await confirmCompositionLeave()||props.beforeSelect&&!await props.beforeSelect(undefined))return
  if(!alive||epoch!==intent.epoch||!ready.value||conflict.value)return
  if(selectedId.value!==intent.id||draftPrompt.value!==intent.prompt||draftTitle.value!==intent.title||JSON.stringify(selected.value?.data.parameters)!==intent.parameters){error.value='当前编辑内容已变化，本次未新建节点，请核对后重新操作。';return}
  if(parent&&(!nodes.value.some(node=>node.id===parent)||!canDerive(kind,parent))){error.value='派生来源已变化，请重新选择来源节点。';return}
  // 离开确认期间原片可能被移走或状态变化；快照前重新复核，失败不留下半个剪辑节点。
  if(compositionSources&&JSON.stringify(compositionSourceIds(compositionSources))!==JSON.stringify(compositionSources)){error.value='所选视频已变化，请重新选择后再剪辑。';return}
  if(layout.value.drafts.length>=200){error.value='当前画布已达到200个编辑草案，请先整理节点。';return}
  snapshot();const id=`draft:${crypto.randomUUID()}`,source=nodes.value.find(node=>node.id===parent)
  const ratio=source?.data.aspectRatio||source?.data.parameters?.aspectRatio||layout.value.node_parameters?.[source?.id||'']?.aspectRatio
  const targetBounds=estimateNodeBounds(kind,ratio),nodeWidth=targetBounds.width,nodeHeight=targetBounds.height
  const camera=flow.viewport.value,visible=creativeVisibleArea(viewportArea())
  const sourceWidth=source?nodeBounds(source).width:nodeWidth
  // 空白画布右键尽量在点击处生成；节点派生先保持来源邻接，再由共同取景处理遮挡。
  const preferred=anchor?{x:anchor.x+24,y:anchor.y+24,width:nodeWidth,height:nodeHeight}:source?{x:source.position.x+sourceWidth+96,y:source.position.y,width:nodeWidth,height:nodeHeight}:{x:(visible.left+visible.width/2-camera.x)/camera.zoom-nodeWidth/2,y:(visible.top+visible.height/2-camera.y)/camera.zoom-nodeHeight/2,width:nodeWidth,height:nodeHeight}
  const occupied=nodes.value.map(value=>{const size=nodeBounds(value);return{x:value.position.x,y:value.position.y,width:size.width,height:size.height}})
  // 图片/视频先按媒体高度上限预留整张卡片，避免空白草案挂载后伸进相邻内容。
  // 来源节点可能被聊天浮层挡住；先在来源附近避开碰撞，选中后再整体取景，不能只把子节点夹到视区边缘。
  const center=source?creativeNearbyPosition(preferred,occupied):creativeVisibleNearbyPosition(preferred,occupied,viewportArea(),camera)
  layout.value.positions[id]=center
  const title=({text:'文本',image:'图片',video:'视频',audio:'音频',compose:'合成'}[kind])+'草案'
  const retry=!!source&&!source.data.url&&['failed','cancelled'].includes(source.data.status)
  layout.value.drafts.push({id,kind,title:initial?.title||title,prompt:initial?.prompt??(retry?source!.data.prompt:'')})
  // 同媒体续作统一继承来源的白名单规格，包括套图和免费编辑版本；跨媒体不复制错误模型。
  // 在新节点挂载公共输入器之前固定，防止首选默认模型抢先写入布局。
  if(source?.data.kind===kind){
    const parameters=creativeRetryParameters(source,props.runs,props.messages,props.results)
    if(parameters){layout.value.node_parameters||={};layout.value.node_parameters[id]=parameters}
  }
  if(retry){
    // 失败文件不能被引用：保留原需求并重新连接原固定素材，仍需新的核价与确认。
    const target:CreativeNode={id,type:'creative',position:center,data:{kind,title,prompt:'',status:'draft',manual:true}}
    for(const input of creativeInputs(nodes.value,edges.value,source!.id)){
      // Agent 来源草案是追溯线，不是可采购媒体；仅沿用真实文件或文本内容。
      if(input.data.kind!=='text'&&(!input.data.source||!input.data.url))continue
      if(canConnectCreative([...nodes.value,target],edges.value,input.id,id))layout.value.edges.push({id:`link:${crypto.randomUUID()}`,source:input.id,target:id})
    }
  }else if(compositionSources){
    for(const sourceId of compositionSources)layout.value.edges.push({id:`link:${crypto.randomUUID()}`,source:sourceId,target:id})
  }else if(source)layout.value.edges.push({id:`link:${crypto.randomUUID()}`,source:source.id,target:id})
  changed();await nextTick();await choose(id,true,true);if(selectedId.value===id){
    // 组件右键派生后让来源与新草案共同进入安全视区；空白画布新建仍只定位新节点。
    // 这样新节点下方的统一输入器出现时，不会把原组件留在聊天浮层或输入器遮挡区外。
    if(source)await frameNodes([source.id,id])
    else await focusNode(id)
    return id
  }
  }finally{creatingNode.value=false}
}
/** 复制操作只暂存安全白名单；选择当前编辑节点时复制其尚未另存的本地草稿。 */
function copyNode(id:string){
  const node=nodes.value.find(value=>value.id===id);if(!node)return false
  copiedNode.value={sourceId:node.id,kind:node.data.kind,title:id===selectedId.value?draftTitle.value:node.data.title,prompt:id===selectedId.value?draftPrompt.value:node.data.prompt}
  clipboardStatus.value='节点已复制，可在画布空白处粘贴'
  clearTimeout(clipboardStatusTimer);clipboardStatusTimer=setTimeout(()=>{clipboardStatus.value='';clipboardStatusTimer=undefined},2400)
  return true
}
/** 粘贴只新建引用来源的空白草案，落点沿用画布右键坐标并交给原重叠避让算法。 */
async function pasteNode(anchor?:{x:number;y:number}){
  if(!canPasteCopiedNode.value||!copiedNode.value)return
  const copied={...copiedNode.value},source=nodes.value.find(node=>node.id===copied.sourceId)
  if(!source)return
  clipboardStatus.value=''
  return createNode(copied.kind,source.id,anchor,{title:`${copied.title} 副本`,prompt:copied.prompt})
}
/** Ctrl+D 与节点菜单共用复制白名单和草案创建路径，不复用原结果身份。 */
async function duplicateNode(id:string){
  if(!copyNode(id))return
  return pasteNode()
}
/** 作品AI工具仍在画布内建立子任务草案，不污染聊天输入，不自动整理或采购。 */
async function prepareMediaTool(sourceId:string,action:string){
  const instructions:Record<string,string>={background:'请调整所连接图片的背景：',style:'请调整所连接图片的风格：',edit:'请修改所连接的图片：',image_to_video:'请基于所连接图片制作视频：',video_reference:'请参考所连接的视频继续创作：'}
  if(!instructions[action]||props.busy||submittingDraft.value||creatingNode.value)return false
  const source=nodes.value.find(node=>node.id===sourceId)
  if(!source?.data.source||!source.data.url)return false
  const kind=action==='image_to_video'||action==='video_reference'?'video':'image'
  const id=await createNode(kind,sourceId)
  if(!id||!alive||selectedId.value!==id)return false
  // createNode已执行来源校验、规格继承与离开保护；这里只给本次新草案写入工具意图。
  draftPrompt.value=instructions[action]
  saveText();await focusNode(id);return true
}
/** 原技能重整由父级服务命令处理，不转成自由草案，也不把失败文件作为引用。 */
async function retryPlanning(id:string){
  const node=nodes.value.find(value=>value.id===id)
  if(!ready.value||conflict.value||props.busy||!node||node.data.phase!=='planning'||node.data.itemId||!node.data.runId||!['failed','cancelled'].includes(node.data.status))return
  if(!await confirmCompositionLeave()||props.beforeSelect&&!await props.beforeSelect(node))return
  if(!alive||props.busy||nodes.value.find(value=>value.id===id)!==node)return
  emit('retry',node)
}
/** 媒体重载只刷新画布文件读取，不整理需求、不创建任务，也不触发费用确认。 */
function refreshNodeFile(id:string){
  const node=nodes.value.find(value=>value.id===id)
  if(node)emit('refreshFile',node)
}
function saveText(){
  if(conflict.value)return
  if(!canEdit.value)return
  if(sourceEditing.value&&selected.value){
    if(layout.value.drafts.length>=200){error.value='当前画布已达到200个编辑草案，请先整理节点。';return}
    // 编辑意图另存为新草案，原图/原视频的提示词、任务和费用快照完全保留。
    const source=selected.value,id=`draft:${crypto.randomUUID()}`
    snapshot()
    layout.value.drafts.push({id,kind:source.data.kind,title:`${draftTitle.value} · 编辑稿`,prompt:draftPrompt.value})
    layout.value.positions[id]=creativeFreePosition({x:source.position.x+400,y:source.position.y},nodes.value.map(node=>node.position))
    layout.value.edges.push({id:`link:${crypto.randomUUID()}`,source:source.id,target:id})
    if(editorParameters.value){layout.value.node_parameters||={};layout.value.node_parameters[id]={...editorParameters.value}}
    changed();return id
  }
  const draft=layout.value.drafts.find(value=>value.id===selectedId.value)
  snapshot()
  if(draft){draft.prompt=draftPrompt.value;draft.title=draftTitle.value}
  else {layout.value.overrides||={};layout.value.overrides[selectedId.value]={prompt:draftPrompt.value,title:draftTitle.value}}
  changed()
}
/** 先保证草案及引用线已持久化，再交给Agent，避免刷新后业务运行指向不存在的草案。 */
async function generate(){
  if(!ready.value||conflict.value||props.busy||submittingDraft.value||!selected.value||!draftPrompt.value.trim())return
  submittingDraft.value=true
  try{
    const originalSource=sourceEditing.value?selectedId.value:''
    const created=saveText()
    if(created){await nextTick();await choose(created);if(selectedId.value===created){unsavedInputs.delete(originalSource);stash()}await focusNode(created)}
    if(!selected.value||sourceEditing.value)return
    const requested={...selected.value,data:{...selected.value.data,prompt:draftPrompt.value}},sources=[...inputs.value]
    if(!await ensureSaved()){if(!error.value)error.value='画布尚未保存成功，请完成保存或解决冲突后再提交。';return}
    if(!alive||selectedId.value!==requested.id||conflict.value||props.busy)return
    emit('generate',requested,sources)
  }finally{submittingDraft.value=false}
}
/** 保存原作品的编辑稿后切换到新草案，连续点击不会重复创建同一编辑意图。 */
async function saveNodePrompt(){
  if(submittingDraft.value)return
  submittingDraft.value=true
  try{
    const originalSource=sourceEditing.value?selectedId.value:''
    const id=saveText()
    if(id){await nextTick();await choose(id);if(selectedId.value===id){unsavedInputs.delete(originalSource);stash()}await focusNode(id)}
  }finally{submittingDraft.value=false}
}
/** 只移除画布展示/自建草案，不删除素材、任务、历史作品或计费记录；撤销可恢复。 */
async function removeNode(){
  const id=selectedId.value;if(!id)return
  if(!await confirmCompositionLeave())return
  if(props.beforeSelect&&!await props.beforeSelect(undefined))return
  if(id!==selectedId.value)return
  snapshot()
  if(selected.value?.data.manual){layout.value.drafts=layout.value.drafts.filter(value=>value.id!==id);layout.value.edges=layout.value.edges.filter(value=>value.source!==id&&value.target!==id);delete layout.value.positions[id]}
  else {
    const source=selected.value?.data.source
    // 仅移除独立放置的画布引用，聊天引用、素材库和真实生成任务均不删除。
    if(source?.kind==='reference'&&layout.value.asset_references?.some(row=>row.item_id===source.item_id&&row.version_id===source.id)){
      layout.value.asset_references=layout.value.asset_references.filter(row=>row.item_id!==source.item_id||row.version_id!==source.id)
      layout.value.edges=layout.value.edges.filter(edge=>edge.source!==id&&edge.target!==id)
      // 作废进行中的预览回包，防止移除或撤销期间旧地址回写。
      assetReadSequence++
      canvasAssets.value=canvasAssets.value.filter(row=>row.item_id!==source.item_id||row.version_id!==source.id)
    }
    layout.value.hidden=[...new Set([...layout.value.hidden,id])]
  }
  selectedId.value='';removeOpen.value=false;changed()
}
function undo(redo=false){const from=redo?future:history,to=redo?history:future,value=from.pop();if(!value)return;to.push(cloneLayout());layout.value=value;undoCount.value=history.length;redoCount.value=future.length;changed()}
function keyboard(event:KeyboardEvent){
  // 共用正文包含只读textbox，复制/翻阅其中的文字不能触发画布删除或F定位。
  if(event.isComposing||(event.target as HTMLElement).closest('input,textarea,[contenteditable=true],[role=textbox]'))return
  const modifier=event.ctrlKey||event.metaKey,key=event.key.toLowerCase()
  if(!modifier&&!event.altKey&&['+','=','-','1'].includes(key)){event.preventDefault();void stepCanvasZoom(key==='1'?0:key==='-'?-1:1);return}
  if(modifier&&key==='z'){event.preventDefault();undo(event.shiftKey);return}
  if(modifier&&key==='c'&&selectedId.value){event.preventDefault();copyNode(selectedId.value);return}
  if(modifier&&key==='d'&&selectedId.value){event.preventDefault();void duplicateNode(selectedId.value);return}
  if(modifier&&key==='v'&&canPasteCopiedNode.value){event.preventDefault();void pasteNode();return}
  if(event.key==='Escape'){void choose('');expanded.value=false}
  if((event.key==='Delete'||event.key==='Backspace')&&selectedId.value){event.preventDefault();removeOpen.value=true}
  if(event.key==='0')void fitAll()
  if(key==='v'&&!modifier&&!event.altKey)hand.value=false
  if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();void focusSelectedNode()}
}
// 外部结果卡/工具保存后的定位同样要移动镜头，不能只改变选中边框却把新版本留在屏外。
/** 批注另存完成后把原节点输入迁到新版本，仍通过同一节点草案保存/核价入口，不直接采购。 */
async function prepareEditedNode(id:string,prompt:string,parameters?:CreativeNodeParameters){
  await choose(id);if(selectedId.value!==id||!canEdit.value)return false
  draftPrompt.value=prompt
  if(parameters)updateNodeParameters(parameters)
  await focusNode(id);return true
}
/** 免费像素编辑的新版本紧邻来源空位；优先落在无遮挡视口，并把来源与裁剪结果一起取景。 */
async function placeDerived(id:string,parentId:string,aspectRatio?:number){
  let parent:CreativeNode|undefined,targetSize:{width:number;height:number}|undefined
  // 新结果选中后会进入编辑态并扩宽；必须等真实卡片和图片都完成测量再避让，不能按占位尺寸落位。
  let stableSize=''
  for(let attempt=0;attempt<60;attempt++){
    await nextTick()
    if(conflict.value)return false
    parent=nodes.value.find(node=>node.id===parentId)
    const target=nodes.value.find(node=>node.id===id),element=target&&renderedNodeElement(target)
    const rendered=element?.offsetWidth&&element?.offsetHeight?{width:element.offsetWidth,height:element.offsetHeight}:undefined
    const dimensions=flow.findNode(id)?.dimensions
    const measured=rendered|| (dimensions?.width&&dimensions?.height?{width:dimensions.width,height:dimensions.height}:undefined)
    const media=element?.querySelector<HTMLImageElement|HTMLVideoElement>('img,video')
    const mediaReady=!media||(media instanceof HTMLImageElement?media.complete&&media.naturalWidth>0:media.readyState>=1)
    const currentSize=measured?`${measured.width}x${measured.height}`:''
    if(ready.value&&parent&&target&&currentSize&&currentSize===stableSize&&mediaReady){targetSize=measured;break}
    stableSize=currentSize
    await new Promise<void>(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(()=>resolve()):setTimeout(resolve,16))
  }
  if(!ready.value||!parent)return false
  // 预览媒体网络读取慢时也不能把已保存版本留在默认列；Blob读取到的真实比例可推导安全卡片尺寸。
  // 优先Vue Flow/DOM实测尺寸，只有尺寸尚未稳定时才用实际裁后画幅估算。
  if(!targetSize){
    const target=nodes.value.find(node=>node.id===id)
    if(!target)return false
    const element=renderedNodeElement(target),dimensions=flow.findNode(id)?.dimensions
    targetSize=element?.offsetWidth&&element?.offsetHeight?{width:element.offsetWidth,height:element.offsetHeight}:
      dimensions?.width&&dimensions?.height?{width:dimensions.width,height:dimensions.height}:estimateNodeBounds('image',aspectRatio)
  }
  const parentBounds=renderedNodeBounds(parent),targetBounds={...estimateNodeBounds('image',aspectRatio),...targetSize}
  const occupied=memberBoxes(nodes.value.filter(node=>node.id!==id).map(node=>node.id))
  const preferred={x:parent.position.x+parentBounds.width+96,y:parent.position.y,width:targetBounds.width,height:targetBounds.height}
  // 裁剪/改比例另存仍是独立artifact；始终按来源附近的最近空位排布，当前缩放不能把它推到画布远端。
  // 提示词输入器锚定在选中来源下方；新版本底边必须留在来源底边上方，避免高竖图被输入器盖住。
  // 竖向近邻步长缩小后，密集画布也能在输入器上方寻找最近空位；原作与来源连线保持不变。
  const promptSafeBottom=parent.position.y+parentBounds.height-64
  const position=creativeNearbyPosition(preferred,occupied,undefined,promptSafeBottom)
  snapshot();layout.value.positions[id]=position;changed();await nextTick()
  // 使用来源实际尺寸与裁后文件比例直接联合取景，不依赖结果节点是否已完成Vue Flow投影。
  const parentPosition=layout.value.positions[parentId]||parent.position,targetPosition=layout.value.positions[id]!
  await frameBounds([
    {...parentBounds,...parentPosition},
    {...targetBounds,...targetPosition},
  ])
  return true
}
/** 普通画布保存裁剪版本时按固定业务来源定位原节点，不依赖编辑器是否为内嵌模式。 */
async function placeDerivedFromSource(id:string,source:WorkspaceSource,aspectRatio?:number){
  const sourceKey=resultNodeId(source)
  // 来源与裁剪结果可能在同一保存事务后分批进入图；短暂等待投影，避免回退到全画布默认列。
  for(let attempt=0;attempt<16;attempt++){
    await nextTick()
    if(conflict.value)return false
    const parent=nodes.value.find(node=>node.data.source&&resultNodeId(node.data.source)===sourceKey)
    if(ready.value&&parent)return placeDerived(id,parent.id,aspectRatio)
    await new Promise<void>(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(()=>resolve()):setTimeout(resolve,16))
  }
  return false
}
defineExpose({focus:async(id:string)=>{await choose(id);if(selectedId.value!==id)return false;if(id){magnifiedNodeId.value=id;await focusNode(id)}return true},viewScriptVersion:openScriptDocument,locateExtraction,reload:load,refreshProduction:loadProductionWorkspace,placeLibraryAsset,prepareMediaTool,prepareEditedNode,placeDerived,placeDerivedFromSource,submitEditedNode:async(id:string,prompt:string,parameters?:CreativeNodeParameters)=>{if(await prepareEditedNode(id,prompt,parameters))await generate()}})
</script>
<template>
  <!-- 画布始终全宽，遮挡值只移动空态/错误和镜头，不把聊天变成占位列。 -->
  <section ref="canvasElement" class="creative-canvas" :style="{'--liv-graph-left-inset':`${Math.max(0,leftInset||0)}px`,'--liv-graph-camera-zoom':flow.viewport.value.zoom}" tabindex="0" aria-label="Agent 创作画布" @keydown="keyboard" @wheel.capture="canvasZoomWheel" @pointerenter="canvasHovered=true" @pointerleave="canvasHovered=false">
    <!-- 右键菜单复用Nuxt UI，菜单弹层自动避让屏幕；只包裹画布，不拦截输入框原生编辑菜单。 -->
    <UContextMenu :items="contextItems" :ui="contextMenuUi" :content="contextMenuContent"><div class="creative-context-surface" @contextmenu.capture="prepareContextMenu" @pointerdown.capture="startCanvasPointer" @pointermove="moveGroupDrag($event);moveRightPan($event)" @pointerup="endGroupDrag();endRightPan()" @pointercancel="endGroupDrag();endRightPan()" @lostpointercapture="endGroupDrag();endRightPan()">
    <!-- 宿主先于节点挂载，Teleport无需另建弹窗或全屏遮罩；下方仍只有统一输入。 -->
    <div :id="nodeToolTargetId" ref="toolDockElement" class="creative-node-tool-dock nodrag nopan nowheel" :class="{'is-active':!!toolNodeId}" :style="toolPosition" aria-label="当前节点作品工具" @pointerdown.stop @click.stop/>
    <!-- 普通滚轮纵向平移，Ctrl滚轮缩放；右键拖动独立处理，中键及手型左键继续兼容。 -->
    <!-- 实色组底在节点和连线下面，交互边框仍留在上层。 -->
    <div class="creative-group-backdrops" aria-hidden="true"><div v-for="group in groupFrames" :key="group.id" :style="frameStyle(group)"/></div>
<VueFlow :id="graphId" v-model:nodes="flowNodes" :edges="viewEdges" :node-types="nodeTypes" :edge-types="edgeTypes" :min-zoom="CREATIVE_MIN_ZOOM" :max-zoom="2" :delete-key-code="null" :nodes-draggable="ready&&!hand&&!spacePan" :nodes-connectable="ready&&!hand&&!spacePan" :pan-on-drag="hand||spacePan?[0,1]:[1]" :selection-on-drag="!hand&&!spacePan" :class="{'is-hand-tool':hand||spacePan}" :zoom-on-double-click="false" :zoom-on-scroll="false" :zoom-on-pinch="true" zoom-activation-key-code="Control" :pan-on-scroll="true" pan-on-scroll-mode="vertical" @nodes-initialized="nodesInitialized" @connect="connect" @node-click="nodeClicked" @node-drag-start="dragStart" @node-drag-stop="dragStop" @selection-end="collectSelection" @selection-drag-start="dragStart" @selection-drag-stop="dragStop" @move-end="viewportEnd" @pane-click="choose('')">
      <template #node-creative="node">
        <CreativeCanvasNode v-bind="node" :editing="toolNodeId===node.id" :creation-items="node.data.scriptDocument||node.data.productionAsset?[]:nodeCreationItems(node.id)" :busy="busy" :playback-enabled="playbackEnabled!==false&&!removeOpen&&!previewNode&&!scriptReaderOpen" @upload-audio="file=>emit('uploadAudio',file)" @retry="retryPlanning" @refresh-file="refreshNodeFile" @focus="doubleClickNode" @toggle-selection="nodeModifierClicked" @tools="id=>{const item=nodes.find(value=>value.id===id);if(item)emit('tools',item)}">
          <template #media-editor><slot name="media-editor" :node="node" :tool-target="`#${nodeToolTargetId}`"/></template>
          <!-- 剧本卡仅有查看入口；点击正文只选中，不打开通用编辑面板。 -->
          <template v-if="node.data.scriptDocument" #script-view><UButton class="nodrag nopan" color="neutral" variant="soft" trailing-icon="i-lucide-arrow-right" @click.stop="openScriptDocument()">查看</UButton></template>
        </CreativeCanvasNode>
      </template>
      <template #edge-creative="edge"><CreativeCanvasEdge v-bind="edge" @remove="removeEdge"/></template>
      <MiniMap v-if="minimap" pannable zoomable/>
    </VueFlow>
    </div></UContextMenu>
    <!-- 桌面阶段索引挂到真实页头；窄屏保留画布内入口，避免挤占聊天/画布切换。 -->
    <Teleport v-if="dramaStages.length" :to="stageNavTarget||'body'" :disabled="!stageNavTarget" defer>
    <nav class="creative-drama-navigation" aria-label="短剧画布定位">
      <UButton v-for="stage in dramaStages" :key="stage.label" color="neutral" variant="ghost" :aria-current="activeDramaStage===stage.id?'location':undefined" @click="jumpDramaStage(stage.id)">{{stage.label}}</UButton>
    </nav>
    </Teleport>
    <!-- 普通组可拖动，生产组固定；分类和详情仍可操作。 -->
    <div class="creative-group-layer" aria-label="画布分组">
      <svg v-if="productionLinks.length" class="creative-production-links" aria-hidden="true"><path v-for="link in productionLinks" :key="link.id" :d="link.path"/></svg>
      <section v-for="group in groupFrames" :key="group.id" class="creative-group-frame" :class="{'is-selected':selectedGroupId===group.id,'is-production':isProductionGroup(group.id)}" :style="frameStyle(group)" :aria-label="`${group.title}，${group.visibleCount}个可见节点`">
        <div v-if="!isProductionGroup(group.id)" class="creative-group-grip" aria-hidden="true" @pointerdown.stop="startGroupDrag($event,group.id)" @pointermove.stop="moveGroupDrag" @pointerup.stop="endGroupDrag" @pointercancel="endGroupDrag" @lostpointercapture="endGroupDrag" @click.stop="selectGroup(group.id)"/>
        <!-- 名称是跟随画布缩放的小字，不让所有组的屏幕尺寸大标签挡住节点。 -->
        <span v-if="isProductionGroup(group.id)&&!isStandaloneGroup(group.id)" class="creative-group-label" :style="{zoom:Math.min(1,flow.viewport.value.zoom)}">{{group.label}}</span>
        <UButton v-else class="creative-group-label" color="neutral" variant="link" :title="group.label" :style="{zoom:Math.min(1,flow.viewport.value.zoom)}" :aria-label="`移动${group.label}`" @pointerdown.stop="startGroupDrag($event,group.id)" @pointermove.stop="moveGroupDrag" @pointerup.stop="endGroupDrag" @pointercancel="endGroupDrag" @lostpointercapture="endGroupDrag" @click.stop="selectGroup(group.id)">{{group.label}}</UButton>
        <UButton v-if="group.collapsed" class="creative-group-summary" color="neutral" variant="ghost" icon="i-lucide-panels-top-left" :aria-label="`展开${group.label}`" @click.stop="toggleGroup(group.id)">{{group.visibleCount}} 项 · 点击展开</UButton>
        <div v-if="!group.collapsed&&isProductionGroup(group.id)" class="creative-production-panel" :style="{width:`${group.width}px`,height:`${group.height}px`,zoom:flow.viewport.value.zoom}">
          <nav v-if="group.assetTabs.length" class="creative-asset-group-tabs nodrag nopan" aria-label="资产分类" @pointerdown.stop @mousedown.stop>
            <UButton v-for="tab in group.assetTabs" :key="tab.key" color="neutral" :variant="group.category===tab.key?'soft':'ghost'" :aria-pressed="group.category===tab.key" @click.stop="filterAssetGroup(group.id,tab.key)">{{tab.label}}（{{tab.count}}）</UButton>
          </nav>
          <span v-else class="creative-asset-group-tabs">{{group.cards.length}} 个镜头</span>
          <div class="creative-production-scroll nowheel" @wheel.stop>
          <div class="creative-production-grid">
            <UButton v-for="card in group.cards" :key="card.id" type="button" color="neutral" variant="ghost" class="creative-production-card" draggable="false" :aria-pressed="selectedId===card.id" @pointerdown.stop @mousedown.stop @dragstart.prevent @click.stop="choose(card.id)">
              <strong>{{card.data.title}}</strong>
              <div class="creative-production-card-body">
                <span class="creative-production-cover">
                  <CreationMediaPreview kind="image" :url="card.data.cover||(!card.data.productionShot?card.data.url:'')||''"/>
                  <span v-if="!card.data.cover" class="creative-production-placeholder">{{card.data.standaloneShot?'暂无预演图':card.data.productionShot?(card.data.url?'可播放镜头':shotPreviewLabels[card.data.productionShot.previewStatus||'']||'暂无预演图'):'暂无资产图'}}</span>
                </span>
                <span class="creative-production-card-details"><small>{{card.data.standaloneShot?`${card.data.standaloneShot.scene} · ${card.data.standaloneShot.durationMs/1000} 秒`:card.data.productionShot?(card.data.url?(card.data.productionShot.mockVideo?'视频测试样本':'镜头已选版'):shotVideoLabels[card.data.productionShot.videoStatus||'']||(card.data.productionShot.mockPreview?'首帧测试样本':'镜头说明')):'资产设定'}}</small><span class="creative-production-copy">{{card.data.prompt}}</span><span class="creative-production-detail-label">查看详情 →</span></span>
              </div>
            </UButton>
            <p v-if="!group.cards.length">该分类没有已提取的设定。</p>
          </div>
          </div>
        </div>
        <header v-if="selectedGroupId===group.id&&!isProductionGroup(group.id)" aria-label="选中分组操作">
          <!-- 工具栏只展示已接通操作；组名和边缘继续负责拖动。 -->
          <UDropdownMenu :items="[{label:'水平排列',icon:'i-lucide-columns-3',onSelect:()=>arrange(group.members,'horizontal')},{label:'垂直排列',icon:'i-lucide-rows-3',onSelect:()=>arrange(group.members,'vertical')}]" :ui="{content:'creative-group-menu'}">
            <UButton color="neutral" variant="ghost" icon="i-lucide-grip" trailing-icon="i-lucide-chevron-down">排序</UButton>
          </UDropdownMenu>
          <UDropdownMenu :items="[{label:group.collapsed?'展开':'收起',icon:group.collapsed?'i-lucide-unfold-vertical':'i-lucide-fold-vertical',onSelect:()=>toggleGroup(group.id)},{label:'解组',icon:'i-lucide-ungroup',onSelect:()=>ungroup(group.id)}]" :ui="{content:'creative-group-menu'}">
            <UButton color="neutral" variant="soft" icon="i-lucide-group" trailing-icon="i-lucide-chevron-down">编辑组</UButton>
          </UDropdownMenu>
          <UButton v-if="group.members.some(id=>compositionSourceIds([id]).length)" color="neutral" variant="ghost" icon="i-lucide-clapperboard" :disabled="!ready||conflict||busy||creatingNode" @click="emit('editWorkspace')">AI 剪辑</UButton>
        </header>
      </section>
    </div>
    <nav v-if="multipleIds.length>=2" class="creative-selection-tools" :style="selectionToolbarStyle" aria-label="多选节点工具">
      <span>{{multipleIds.length}} 项</span><UButton icon="i-lucide-group" color="neutral" variant="ghost" :disabled="conflict||!ready" @click="createGroup">打组</UButton>
      <UButton v-if="selectionCompositionSources.length" icon="i-lucide-clapperboard" color="neutral" variant="ghost" :disabled="conflict||!ready||busy||creatingNode" @click="composeNodes(multipleIds)">剪辑 / 合成</UButton>
      <UTooltip text="水平排列"><UButton square icon="i-lucide-columns-3" color="neutral" variant="ghost" aria-label="水平排列所选节点" @click="arrange(multipleIds,'horizontal')"/></UTooltip>
      <UTooltip text="垂直排列"><UButton square icon="i-lucide-rows-3" color="neutral" variant="ghost" aria-label="垂直排列所选节点" @click="arrange(multipleIds,'vertical')"/></UTooltip>
      <UButton square icon="i-lucide-x" color="neutral" variant="ghost" aria-label="取消多选" @click="choose('')"/>
    </nav>
    <!-- 正文的本机备份不等于云端保存，输入未提交时不能沿用旧布局的已保存提示。 -->
    <header class="creative-canvas-top"><span class="creative-save-state" role="status">{{saving?'保存中':inputChanged?'有未保存修改':saved?'已保存':''}}</span><span v-if="clipboardStatus" class="creative-copy-status" role="status">{{clipboardStatus}}</span></header>
    <!-- 生产资料后台自动同步；实际读取失败时才显示共用通知，不在页头放刷新入口。 -->
    <CreationWorkspaceNotice v-if="productionReadError&&!error&&!actionError" :text="productionReadError" error retry :busy="productionReading" retry-label="重试读取" @retry="loadProductionWorkspace"/>
    <!-- 布局保存和普通画布操作使用原通知；修订冲突仍保留选择。 -->
    <CreationWorkspaceNotice :text="error||actionError" :error="!!error||!!actionError" :busy="saving" :retry-label="ready?'重试画布保存':'重试画布读取'" dismiss-label="关闭画布操作提示" :retry="!!error&&!conflict" :dismissible="!error&&!!actionError" @retry="ready?persist():load()" @dismiss="actionError=''"><template #actions><template v-if="conflict"><button type="button" :disabled="saving" @click="resolveConflict(false)">使用云端画布</button><button type="button" :disabled="saving" @click="resolveConflict(true)">保留本机画布</button></template></template></CreationWorkspaceNotice>
    <div v-if="!nodes.length" class="creative-canvas-empty"><UIcon name="i-lucide-workflow"/><span>参考素材、方案与生成作品会出现在这里</span><span>也可以新建节点，从一个想法开始</span></div>
    <!-- 右侧竖栏沿用画布已有操作：新增、总览、小地图和手型/选择，不加入未接通的外站功能。 -->
    <nav class="creative-create-tools" aria-label="画布工具栏">
      <UDropdownMenu :items="newItems" :ui="{content:'creative-node-create-menu creative-toolbar-menu'}" :content="{side:'left',align:'start',sideOffset:8}"><UButton class="creative-create-primary" icon="i-lucide-plus" square aria-label="创建节点" :disabled="!ready"/></UDropdownMenu>
      <UTooltip text="画布列表"><UButton icon="i-lucide-panels-top-left" color="neutral" variant="ghost" square aria-label="画布列表" :aria-pressed="canvasListOpen" @click="emit('closeAssets');canvasListOpen=!canvasListOpen"/></UTooltip>
      <UTooltip text="打开资料库"><UButton icon="i-lucide-folder-heart" color="neutral" variant="ghost" square aria-label="打开资料库" :aria-pressed="assetPanelOpen" @click="canvasListOpen=false;emit('assets')"/></UTooltip>
      <span class="creative-create-tools-divider" aria-hidden="true"/>
      <UDropdownMenu :items="[{label:hand?'选择工具 · V':'✓ 选择工具 · V',icon:'i-lucide-mouse-pointer-2',onSelect:()=>hand=false},{label:hand?'✓ 手型工具 · 空格':'手型工具 · 空格',icon:'i-lucide-hand',onSelect:()=>hand=true}]" :ui="{content:'creative-node-create-menu creative-toolbar-menu'}" :content="{side:'left',align:'end',sideOffset:8}"><UButton :icon="hand?'i-lucide-hand':'i-lucide-mouse-pointer-2'" color="neutral" variant="ghost" square aria-label="切换画布操作工具" :aria-pressed="hand"/></UDropdownMenu>
    </nav>
    <aside v-if="canvasListOpen" class="creative-canvas-list" aria-label="画布列表">
      <header><strong>画布列表</strong><UButton icon="i-lucide-x" square color="neutral" variant="ghost" aria-label="关闭画布列表" @click="canvasListOpen=false"/></header>
      <div class="creative-canvas-list-filter"><USelect v-model="canvasListKind" :items="[{label:'全部',value:'all'},{label:'图片',value:'image'},{label:'视频',value:'video'},{label:'音频',value:'audio'},{label:'文本',value:'text'}]" aria-label="画布节点类型"/><UInput v-model="canvasListQuery" placeholder="搜索画布内节点" aria-label="搜索画布内节点" icon="i-lucide-search"/></div>
      <div class="creative-canvas-list-items">
        <UButton v-for="node in filteredCanvasNodes" :key="node.id" color="neutral" variant="ghost" :aria-label="`定位节点：${node.data.title}`" @click="focusSelectedNode(node.id)">
          <span class="creative-canvas-list-preview">
            <img v-if="node.data.cover || (node.data.kind==='image' && node.data.url)" :src="node.data.cover || node.data.url" alt="" loading="lazy"/>
            <video v-else-if="(node.data.kind==='video' || node.data.kind==='compose') && node.data.url" :src="node.data.url" preload="metadata" muted playsinline aria-hidden="true"/>
            <UIcon v-else :name="node.data.kind==='image'?'i-lucide-image':node.data.kind==='video'||node.data.kind==='compose'?'i-lucide-film':node.data.kind==='audio'?'i-lucide-audio-lines':'i-lucide-type'"/>
          </span>
          <span class="creative-canvas-list-copy"><span class="creative-canvas-list-title" :title="node.data.title">{{node.data.title}}</span><span class="creative-canvas-list-status">{{canvasListStatus(node)}}</span></span>
        </UButton>
        <p v-if="!filteredCanvasNodes.length">暂无匹配节点</p>
      </div>
    </aside>
    <!-- 完成提示与原任务列表共用真实节点，点击只定位，不重复提交或进入高级工作台。 -->
    <div ref="viewToolsElement" class="creative-view-tools"><UButton icon="i-lucide-undo-2" square color="neutral" variant="ghost" aria-label="撤销画布编辑" :disabled="!undoCount" @click="undo()"/><UButton icon="i-lucide-redo-2" square color="neutral" variant="ghost" aria-label="重做画布编辑" :disabled="!redoCount" @click="undo(true)"/><UButton icon="i-lucide-scan" square color="neutral" variant="ghost" aria-label="适应全部节点" @click="fitAll"/><UButton icon="i-lucide-map" square color="neutral" variant="ghost" aria-label="切换小地图" :aria-pressed="minimap" @click="minimap=!minimap"/><UTooltip text="定位选中节点（F / 双击节点）"><UButton icon="i-lucide-focus" square color="neutral" variant="ghost" aria-label="定位选中节点" :disabled="!selectedId" @click="focusSelectedNode()"/></UTooltip><UButton icon="i-lucide-minus" square color="neutral" variant="ghost" aria-label="缩小画布" @click="stepCanvasZoom(-1)"/><UButton color="neutral" variant="ghost" aria-label="缩放重置为100%" title="重置为 100%（1）" @click="stepCanvasZoom(0)">{{zoom}}%</UButton><UButton icon="i-lucide-plus" square color="neutral" variant="ghost" aria-label="放大画布" @click="stepCanvasZoom(1)"/></div>
    <!-- 任务列表定位同样等待离开确认，并扣除聊天/提示词遮挡，不能先移动镜头再判断取消。 -->
    <aside v-if="ready" ref="taskListElement" class="creative-task-list" aria-label="画布任务列表">
      <!-- 只有真实在途任务转圈；待核对不能无限转圈暗示仍在执行。 -->
      <UButton class="creative-task-summary" color="neutral" variant="ghost" :aria-expanded="taskOpen" aria-label="展开或收起画布任务列表" @click="taskOpen=!taskOpen"><span class="creative-task-symbol"><UIcon :class="{'creative-spin':running.some(node=>!['status_unavailable','result_error'].includes(node.data.status))}" :name="!running.length?'i-lucide-check':running.some(node=>!['status_unavailable','result_error'].includes(node.data.status))?'i-lucide-loader-circle':'i-lucide-circle-alert'"/></span><span><strong>任务列表</strong><small>{{running.length?`${running.length} 项${running.some(node=>['status_unavailable','result_error'].includes(node.data.status))?'待处理或核对':'正在处理'}`:'当前无任务'}}</small></span><UIcon :name="taskOpen?'i-lucide-chevron-down':'i-lucide-chevron-up'"/></UButton>
      <div v-if="taskOpen&&running.length" class="creative-task-items"><UButton v-for="node in running" :key="node.id" color="neutral" variant="ghost" @click="focusSelectedNode(node.id)"><UIcon :name="node.data.kind==='video'?'i-lucide-film':node.data.kind==='image'?'i-lucide-image':'i-lucide-file-text'"/><span class="creative-task-copy"><strong>{{node.data.title}}</strong><small>{{taskCaption(node)}}</small></span></UButton></div>
      <UButton v-for="notice in (taskOpen?completedNotices:[])" :key="notice.node.id" class="creative-completion-notice" color="neutral" variant="ghost" :aria-label="`定位完成作品：${notice.node.data.title}`" @click="focusSelectedNode(notice.node.id)"><CreationMediaPreview stable-thumbnail :kind="notice.node.data.kind==='compose'?'video':notice.node.data.kind" :url="notice.node.data.url||''" :cover="notice.node.data.cover"/><strong>{{notice.label}}</strong></UButton>
    </aside>
    <aside v-if="selected&&!selected.data.scriptDocument" ref="dockElement" class="creative-prompt-dock" :style="promptPosition" :class="{'is-expanded':expanded,'has-task-card':running.length,'has-node-tools':!!toolNodeId,'is-space-constrained':!expanded&&!!bottomInset}" aria-label="节点提示词编辑区">
      <!-- 作品工具只保留在节点上方；输入框标题栏仅保留编辑器自身的移除/展开/关闭。 -->
      <header><span>{{selected.data.productionAsset?'资产设定':selected.data.reference?.media_type==='document'?'文档参考':selected.data.kind==='compose'?'短片合成':'当前提示词'}}</span><span class="creative-dock-title">{{selected.data.title}}</span><UButton icon="i-lucide-trash-2" square color="neutral" variant="ghost" aria-label="从画布移除节点" :disabled="!ready" @click="removeOpen=true"/><UButton icon="i-lucide-maximize-2" square color="neutral" variant="ghost" aria-label="展开提示词输入框" @click="expanded=!expanded"/><UButton icon="i-lucide-x" square color="neutral" variant="ghost" aria-label="收起节点编辑器" @click="choose('')"/></header>
      <template v-if="selected.data.standaloneShot">
        <p class="creative-node-detail">{{selected.data.standaloneShot.scene}} · {{selected.data.standaloneShot.durationMs/1000}} 秒 · {{selected.data.standaloneShot.camera}}</p>
        <CanvasStandaloneShotEditor v-if="selected.data.runId" :key="selected.id" :session-id="sessionId" :run-id="selected.data.runId" :shot-id="selected.data.standaloneShot.id" :revision="selected.data.standaloneShot.revision" :visual="selected.data.prompt" @saved="(runId,plan)=>storyboardReceipts[runId]=plan"/>
      </template>
      <template v-else-if="selected.data.productionShot">
        <p class="creative-node-detail">第 {{selected.data.productionShot.episodeNo}} 集 · 当前分镜方案{{selected.data.productionShot.mockVideo?' · 视频测试样本':''}}</p>
        <video v-if="selected.data.url&&playbackEnabled!==false" :key="selected.data.url" :src="selected.data.url" :poster="selected.data.cover" class="w-full max-h-56 rounded-lg" controls playsinline preload="metadata" aria-label="已选镜头视频"/>
        <UTextarea :model-value="selected.data.prompt" readonly :rows="5" aria-label="镜头说明" class="w-full"/>
      </template>
      <template v-else-if="selected.data.productionEpisode">
        <p class="creative-node-detail">第 {{selected.data.productionEpisode.episodeNo}} 集 · 剪辑稿 V{{selected.data.productionEpisode.cutVersion}} · {{selected.data.productionEpisode.durationMs/1000}} 秒{{selected.data.productionEpisode.containsMock?' · 含测试样本':''}}</p>
        <UButton v-if="selected.data.url" :to="selected.data.url" download target="_blank" color="neutral" variant="soft" icon="i-lucide-download">下载成片</UButton>
        <p v-else class="creative-node-detail">{{selected.data.detail||(selected.data.status==='status_unavailable'?'成片文件暂不可用。':'成片还未就绪。')}}</p>
      </template>
      <template v-else-if="selected.data.productionAsset"><p class="creative-node-detail">{{selected.data.productionAsset.profileId?'来自已绑定短剧项目的资产档案；封面使用项目当前选中的图片版本。':'已提取文本设定，尚未生成图片；下方原文出处与补充设计建议分别标明。'}}</p><UTextarea :model-value="selected.data.prompt" readonly :rows="10" aria-label="资产设定与出处" class="w-full"/></template>
      <template v-else-if="selected.data.kind==='compose'&&selected.data.manual">
        <UDropdownMenu :items="compositionSourcesMenu"><UButton color="neutral" variant="outline" icon="i-lucide-link" :disabled="!compositionSourcesMenu.length||conflict" class="mb-2">连接已完成视频</UButton></UDropdownMenu>
        <CreativeCompositionEditor :key="selected.id" ref="compositionEditor" :session-id="sessionId" :owner-id="ownerId" :node-id="selected.id" :inputs="inputs" :before-save="ensureSaved" @changed="emit('compositionsChanged')"/>
      </template>
      <template v-else-if="selected.data.runId&&selected.data.itemId&&!sourceEditing">
        <!-- 条件分支和内容插槽分开，编辑器恢复或缺失时仍由父级提供明确反馈。 -->
        <slot name="plan-editor" :node="selected"/>
      </template>
      <template v-else>
        <div v-if="completedInputMenu.length" class="creative-input-resolution"><span>来源草案已有可用产物，请选择本次引用版本</span><UDropdownMenu :items="completedInputMenu"><UButton icon="i-lucide-link" color="neutral" variant="soft" :disabled="busy||submittingDraft||conflict">引用已完成结果</UButton></UDropdownMenu></div>
        <slot v-if="['text','image','video','audio'].includes(selected.data.kind)&&selected.data.reference?.media_type!=='document'&&$slots['node-editor']" name="node-editor" :node="selected" :prompt="draftPrompt" :readonly="!canEdit||conflict" :references="editorReferences" :open-reference="openEditorReference" :inputs="editorInputs" :value="editorParameters" :update="updateNodePrompt" :parameters="updateNodeParameters" :submit="generate" :save="saveNodePrompt" :busy="busy||submittingDraft"/>
        <template v-else>
        <UInput v-if="canEdit&&renaming" v-model="draftTitle" class="w-full mb-2" :maxlength="160" aria-label="节点名称" @keydown.enter="renaming=false"/>
        <div v-if="editorInputs.length" class="creative-input-refs" aria-label="当前节点引用素材"><span v-for="node in editorInputs" :key="node.id" :title="node.data.title"><img v-if="node.data.kind==='image'&&node.data.url" :src="node.data.url" :alt="node.data.title"><UIcon v-else :name="node.data.kind==='video'?'i-lucide-film':node.data.kind==='audio'?'i-lucide-music':'i-lucide-file-text'"/><small>{{node.data.title}}</small></span></div>
        <p v-if="['failed','needs_review','status_unavailable','result_error'].includes(selected.data.status)&&selected.data.detail" class="creative-node-detail" role="status">{{selected.data.detail}}</p>
        <p v-if="selected.data.url&&canEdit" class="creative-node-detail">当前预览为原作品；编辑稿需重新核价、确认后才生成。</p>
        <p v-if="selected.data.reference?.media_type==='document'" class="creative-node-detail">{{selected.data.detail}}。可派生文本、图片或视频继续创作。</p>
        <slot v-else name="prompt-input" :node="selected" :prompt="draftPrompt" :readonly="!canEdit||conflict" :update="updateNodePrompt" :submit="generate"><UTextarea v-model="draftPrompt" :readonly="!canEdit||conflict" :rows="5" :maxlength="20000" :ui="{base:'creative-prompt-input'}" placeholder="描述你想创作的画面…" aria-label="当前节点提示词" class="w-full"/></slot>
        <footer class="creative-prompt-toolbar">
          <slot v-if="canEdit&&['image','video'].includes(selected.data.kind)" name="node-controls" :node="selected" :inputs="editorInputs" :value="selected.data.parameters" :update="updateNodeParameters"><span class="creative-node-specification">{{selectedSpecification||'创作草案'}}</span></slot>
          <span v-else class="creative-node-specification" :title="selectedSpecification">{{selectedSpecification|| (canEdit?'创作草案':'原作品')}}</span>
          <UButton v-if="canEdit" icon="i-lucide-pencil" color="neutral" variant="ghost" square aria-label="修改节点名称" @click="renaming=!renaming"/>
          <UTooltip v-if="canEdit" :text="inputChanged?'保存当前修改，不生成、不扣点':'保存草案'"><UButton icon="i-lucide-save" color="neutral" variant="ghost" square aria-label="保存节点提示词" :disabled="!ready||conflict||submittingDraft" @click="saveNodePrompt"/></UTooltip>
          <UTooltip v-if="canEdit" :text="selected.data.kind==='text'?'交给 Agent':'整理方案并核价，确认后才生成'"><UButton icon="i-lucide-arrow-up" class="creative-prompt-send" square :aria-label="selected.data.kind==='text'?'交给 Agent':'整理方案并核价'" :loading="busy||submittingDraft" :disabled="!ready||conflict||busy||submittingDraft||!draftPrompt.trim()" @click="generate"/></UTooltip>
        </footer>
        </template>
      </template>
    </aside>
    <slot name="tools"/>
    <CanvasScriptDialog v-if="scriptOpen" :open="scriptOpen" :document="scriptState?.document||null" :busy="scriptBusy" :error="scriptError" @update:open="scriptOpen=$event" @save="saveScriptDocument"/>
    <CanvasScriptReader v-if="scriptReaderOpen&&scriptState?.document" :key="readerRevision??'current'" :initial-revision="readerRevision" :state="scriptState" :busy="scriptBusy" :error="scriptError" :disabled="!ready||conflict" @close="scriptReaderOpen=false" @save="saveScriptDocument" @discuss="discussScript">
      <template #production>
        <!-- 能力由宿主真实目录决定；阅读卡仍只有“查看”，这里仅填入来源不自动调用模型。 -->
        <slot name="storyboard-source-action" :source="{node_id:`script:${scriptState.document.id}`,revision:scriptState.revision}" :title="scriptState.document.title" :disabled="!ready||conflict||scriptBusy||busy" :close="()=>scriptReaderOpen=false"/>
        <CanvasProductionIntake :key="sessionId" :session-id="sessionId" :revision="scriptState.revision" :production="scriptState.document.production" :style-label="scriptState.production_style_name" :disabled="!ready||conflict||scriptBusy" @linked="loadProductionWorkspace"/>
        <CanvasAssetExtractionControls v-if="!productionWorkspace&&!productionReadError" :extraction="assetExtraction.extraction.value" :busy="assetExtraction.busy.value||conflict||!ready" :error="assetExtraction.error.value" @extract="assetExtraction.submit"/>
        <UButton v-if="assetExtraction.error.value" color="neutral" variant="link" @click="assetExtraction.reload">重新读取提取状态</UButton>
      </template>
    </CanvasScriptReader>
    <CanvasProductionBindingDialog v-if="productionBindingOpen" :session-id="sessionId" @close="productionBindingOpen=false" @bound="productionBindingOpen=false;loadProductionWorkspace()"/>
    <CreationImageLightbox v-if="previewNode" :node="previewNode" @close="previewNode=null"/>
    <LivDialog v-model:open="removeOpen" settings dark title="删除画布节点" description="只移除画布展示，不删除原媒体或任务。"><p>只移除此节点的画布展示或编辑草案，历史作品、素材和已提交任务保留。可以通过画布撤销恢复。</p><template #footer><!-- 操作组复用问题卡等宽胶囊规格，危险动作保留红字，不改删除范围。 --><div class="canvas-delete-actions"><LivButton settings block @click="removeOpen=false">取消</LivButton><LivButton settings block variant="danger" @click="removeNode">删除节点</LivButton></div></template></LivDialog>
  </section>
</template>
