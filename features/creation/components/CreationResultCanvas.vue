<script setup lang="ts">
import {taskStatusText,compactTaskFailure} from '../taskPresentation'
import CreationResultRail from './CreationResultRail.vue'
import type {SessionResult} from '../resultCatalog'
import {zoomAt} from '../canvasNavigation'
import {sameSavedEdit} from '../workflowState'
import {ref,computed,watch,onBeforeUnmount,onMounted,nextTick} from 'vue'
import type {WorkspaceSource} from '../types'
import {renderEdits,renderEditLayers,paintStroke,type ImageEdit} from '../imageEditor'
import {Star as StarIcon} from '@lucide/vue'
import WorkspaceSelect from './WorkspaceSelect.vue'
import MusicPlayer from '~/features/music/components/MusicPlayer.vue'
import {creationService} from '~/shared/api/services/creationService'
import {centeredRatio,cropFromPoints,pixelCrop,clampUnit,type CropBox} from '../cropGeometry'
export interface CanvasVersion {key:string;title:string;kind:'image'|'video'|'audio';url:string;cover?:string;lyrics?:string;alignment?:unknown;source:WorkspaceSource;parentUrl?:string}
const props=defineProps<{versions:CanvasVersion[];results?:SessionResult[];selectedResult?:string;unreadResults?:string[];selectionDisabled?:boolean;selected:string;status?:string;detail?:string;progress?:number|null;progressUpdatedAt?:string;saveBusy?:boolean;musicTools?:Array<{code:string;name:string}>;favorite?:boolean}>()
export interface AnnotationDraft {file:Blob;source:WorkspaceSource;operations:Record<string,unknown>[];requestId:string;preview:string}
const emit=defineEmits<{select:[key:string];result:[key:string];save:[value:{file:Blob;source:WorkspaceSource;operations:Record<string,unknown>[];requestId:string}];annotation:[value:AnnotationDraft|null];ai:[action:string,source:WorkspaceSource];music:[code:string];video:[];refresh:[];favorite:[]}>()
const version=computed(()=>props.versions.find(v=>v.key===props.selected)||props.versions[0])
// 创作台属于新任务入口，不暗示任意视频均支持同款复刻或口播转换；打开不会执行生成。
const tool=ref(''),zoom=ref(100),compare=ref(false),split=ref(50),error=ref(''),working=ref(false)
const operations=ref<ImageEdit[]>([]),cursor=ref(0),preview=ref(''),original=ref(''),width=ref(0),height=ref(0)
const text=ref(''),color=ref('#ff595e'),brush=ref(6),cropBox=ref<CropBox|null>(null),annotating=ref(false),drawing=ref(false)
const liveCanvas=ref<HTMLCanvasElement|null>(null),textInput=ref<HTMLTextAreaElement|null>(null),textPosition=ref<{x:number;y:number}|null>(null),discardOpen=ref(false)
const continueButton=ref<HTMLButtonElement|null>(null)
const ratioOpen=ref(false),colorOpen=ref(false),downloading=ref(false),fullscreen=ref(false)
const swatches=['#ffffff','#64748b','#78350f','#ef4444','#f97316','#f59e0b','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#a855f7','#ec4899','#000000']
const rgb=computed(()=>{const hex=color.value.replace('#','');return[0,2,4].map(start=>parseInt(hex.slice(start,start+2),16)||0)})
function setRgb(index:number,event:Event){const values=[...rgb.value];values[index]=Math.max(0,Math.min(255,Math.round(Number((event.target as HTMLInputElement).value)||0)));color.value='#'+values.map(value=>value.toString(16).padStart(2,'0')).join('')}
const versionOptions=computed(()=>props.versions.map(value=>({value:value.key,label:value.title})))
const zoomOptions=computed(()=>[...new Set([50,100,150,200,Number(zoom.value)])].sort((a,b)=>a-b).map(value=>({value,label:`${value}%`})))
/** 下载受权字节后在本页触发文件保存，不打开新标签或跳转媒体地址。 */
async function download(){if(!version.value||downloading.value)return;downloading.value=true;try{await commitText();const file=version.value.kind==='image'&&canvas?await new Promise<Blob|null>(resolve=>canvas!.toBlob(resolve,'image/png')):await creationService.sourceMedia(version.value.source);if(!file)throw new Error('下载文件暂不可用。');const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;const extension=file.type.split('/')[1]?.split(';')[0]?.replace('jpeg','jpg')||'bin';link.download=`Livliv-${version.value.kind}-${Date.now()}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(cause){error.value='下载暂时失败，请稍后重试。'}finally{downloading.value=false}}
/** 采用页内全屏，兼容嵌入式浏览器，不依赖宿主窗口的 Fullscreen 权限。 */
async function toggleFullscreen(){fullscreen.value=!fullscreen.value;await nextTick();workspace.value?.focus({preventScroll:true})}
const workspace=ref<HTMLElement|null>(null),hand=ref(false),spaceHeld=ref(false),pan=ref({x:0,y:0}),panning=ref(false)
let panStart:{x:number;y:number;left:number;top:number}|null=null
/** 平移仅改变查看位置，不改像素或批注坐标，不产生新版本和费用。 */
function startPan(event:PointerEvent){
  if(event.button!==0||version.value?.kind!=='image'||(!hand.value&&!spaceHeld.value&&tool.value!=='pointer'))return
  if((event.target as HTMLElement).closest('textarea,input,button,select'))return
  event.preventDefault();event.stopPropagation();workspace.value?.focus({preventScroll:true})
  panStart={x:event.clientX,y:event.clientY,left:pan.value.x,top:pan.value.y};panning.value=true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function movePan(event:PointerEvent){if(!panStart)return;event.preventDefault();event.stopPropagation();pan.value={x:panStart.left+event.clientX-panStart.x,y:panStart.top+event.clientY-panStart.y}}
function endPan(event?:PointerEvent){if(!panStart)return;event?.stopPropagation();panStart=null;panning.value=false}
function fitCanvas(){zoom.value=100;pan.value={x:0,y:0}}
/** 仅拦截图片画布内的组合滚轮，输入区域和普通滚动不受影响。 */
function canvasWheel(event:WheelEvent){
  if(!(event.ctrlKey||event.metaKey)||version.value?.kind!=='image'||discardOpen.value||colorOpen.value)return
  if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true],[role=dialog],button'))return
  const rect=canvasImage.value?.getBoundingClientRect();if(!rect)return
  event.preventDefault()
  const center={x:rect.left+rect.width/2-pan.value.x,y:rect.top+rect.height/2-pan.value.y}
  const next=zoomAt(zoom.value,pan.value,{x:event.clientX-center.x,y:event.clientY-center.y},event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?300:1))
  zoom.value=next.zoom;pan.value=next.pan
}
function focusWorkspace(event:PointerEvent){if(!(event.target as HTMLElement).closest('input,textarea,select,button,a'))workspace.value?.focus({preventScroll:true})}
async function undoEdit(redo=false){await commitText();if(working.value||drawing.value)return;if(redo?canRedo.value:dirty.value){cursor.value+=redo?1:-1;await redraw()}}
/** 快捷键只服务当前画布；输入文字、中文组合输入及其他弹窗不会被工具快捷键抢走。 */
function canvasKey(event:KeyboardEvent){
  if(event.isComposing||event.defaultPrevented||colorOpen.value)return
  if(discardOpen.value){if(event.key==='Escape'){event.preventDefault();resolveDiscard(false)}return}
  const target=event.target as HTMLElement
  if(target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return
  if(!workspace.value?.contains(document.activeElement))return
  if(event.key==='Escape'){event.preventDefault();if(fullscreen.value){fullscreen.value=false;return}if(annotating.value)void exitAnnotation();else{tool.value='';cropBox.value=null;compare.value=false;hand.value=false}return}
  if(version.value?.kind!=='image')return
  const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey
  if(modifier&&(key==='z'||key==='y')){event.preventDefault();void undoEdit(key==='y'||event.shiftKey);return}
  if(modifier||event.altKey)return
  if(event.code==='Space'){event.preventDefault();spaceHeld.value=true;return}
  if(key==='h'||key==='v'){event.preventDefault();if(annotating.value)void annotationTool('pointer');else hand.value=!hand.value}
  else if(annotating.value&&['b','t','e'].includes(key)){event.preventDefault();void annotationTool(key==='b'?'draw':key==='e'?'erase':'text')}
  else if(key==='0'){event.preventDefault();fitCanvas()}
  else if(key==='+'||key==='='){event.preventDefault();zoom.value=Math.min(400,Number(zoom.value)+25)}
  else if(key==='-'){event.preventDefault();zoom.value=Math.max(25,Number(zoom.value)-25)}
}
function releaseSpace(event?:KeyboardEvent){if(!event||event.code==='Space'){spaceHeld.value=false;endPan()}}
function releasePanOnBlur(){releaseSpace()}
onMounted(()=>{window.addEventListener('keydown',canvasKey);window.addEventListener('keyup',releaseSpace);window.addEventListener('blur',releasePanOnBlur)})
onBeforeUnmount(()=>{window.removeEventListener('keydown',canvasKey);window.removeEventListener('keyup',releaseSpace);window.removeEventListener('blur',releasePanOnBlur)})
watch(()=>version.value?.key,()=>{fitCanvas();hand.value=false;releaseSpace()})
watch(discardOpen,async value=>{if(value){await nextTick();continueButton.value?.focus()}})
let discardResolution:((value:boolean)=>void)|null=null,thumbnailTimer:ReturnType<typeof setTimeout>|undefined
let cropDrag:{mode:string;start:{x:number;y:number};box:CropBox}|null=null
const ratioOptions=[{label:'正方形',value:'1:1',ratio:1},{label:'竖向',value:'3:4',ratio:3/4},{label:'故事模式',value:'9:16',ratio:9/16},{label:'横向',value:'4:3',ratio:4/3},{label:'宽屏',value:'16:9',ratio:16/9}]
const cropStyle=computed(()=>cropBox.value?{left:`${cropBox.value.x*100}%`,top:`${cropBox.value.y*100}%`,width:`${cropBox.value.width*100}%`,height:`${cropBox.value.height*100}%`}:{})
const canvasImage=ref<HTMLImageElement|null>(null),video=ref<HTMLVideoElement|null>(null)
const canvasTop=ref<HTMLElement|null>(null),canvasFooter=ref<HTMLElement|null>(null),canvasStage=ref<HTMLElement|null>(null)
const topToolsStyle=ref<Record<string,string>>({}),bottomToolsStyle=ref<Record<string,string>>({}),resultShelfStyle=ref<Record<string,string>>({})
const resultShelf=ref<HTMLElement|null>(null)
const canvasLayoutStyle=ref<Record<string,string>>({})
let toolFrame=0,toolObserver:ResizeObserver|undefined
/** 工具跟随图片可见边界，超出时钳制在画布内，不跟随像素一起缩放。 */
function positionTools(){
  cancelAnimationFrame(toolFrame);toolFrame=requestAnimationFrame(()=>{
    if(!workspace.value||!canvasImage.value||pending.value||failed.value){topToolsStyle.value={};bottomToolsStyle.value={};resultShelfStyle.value={};return}
    const root=workspace.value.getBoundingClientRect(),imageRect=canvasImage.value.getBoundingClientRect()
    const topHeight=canvasTop.value?.offsetHeight||40,footerHeight=canvasFooter.value?.offsetHeight||64
    // 产物栏位于说明文字与画布底边之间的空白中点，给整组工具保留必要可操作高度。
    const railHeight=props.results?.length?(resultShelf.value?.offsetHeight||64):0,width=Math.min(root.width-24,Math.max(380,imageRect.width))
    // 先给工具、说明及产物栏预留真实高度，不能靠向上钳制工具去覆盖图片。
    canvasLayoutStyle.value={'--canvas-bottom-space':`${footerHeight+railHeight+40}px`}
    const left=Math.max(12,Math.min(root.width-width-12,imageRect.left-root.left+(imageRect.width-width)/2))
    topToolsStyle.value={left:`${left}px`,width:`${width}px`,top:`${Math.max(8,Math.min(imageRect.top-root.top-topHeight-8,root.height-railHeight-footerHeight-topHeight-24))}px`}
    const visibleBottom=Math.min(imageRect.bottom,canvasStage.value?.getBoundingClientRect().bottom??imageRect.bottom)
    const footerTop=Math.max(topHeight+16,Math.min(visibleBottom-root.top+8,root.height-railHeight-footerHeight-24))
    bottomToolsStyle.value={left:'12px',right:'12px',top:`${footerTop}px`}
    const textBottom=footerTop+footerHeight
    resultShelfStyle.value={left:'12px',right:'12px',top:`${Math.max(textBottom+8,textBottom+(root.height-textBottom-railHeight)/2)}px`}
  })
}
onMounted(()=>{toolObserver=new ResizeObserver(positionTools);if(workspace.value)toolObserver.observe(workspace.value);if(canvasStage.value)toolObserver.observe(canvasStage.value)})
watch([canvasFooter,resultShelf],(nodes,previous)=>{previous?.forEach(node=>{if(node)toolObserver?.unobserve(node)});nodes.forEach(node=>{if(node)toolObserver?.observe(node)});positionTools()},{flush:'post'})
watch(canvasImage,(node,prior)=>{if(prior)toolObserver?.unobserve(prior);if(node)toolObserver?.observe(node);positionTools()},{flush:'post'})
watch([zoom,pan,()=>props.results?.length,()=>version.value?.key],positionTools,{deep:true,flush:'post'})
onBeforeUnmount(()=>{toolObserver?.disconnect();cancelAnimationFrame(toolFrame)})
const beforeRatio=ref(0),afterRatio=ref(0)
let image:HTMLImageElement|null=null,canvas:HTMLCanvasElement|null=null,revision=0,renderRevision=0,requestId='',stroke:Array<{x:number;y:number}>=[]
let liveLayers:ReturnType<typeof renderEditLayers>|null=null
const dirty=computed(()=>cursor.value>0),canRedo=computed(()=>cursor.value<operations.value.length)
const pending=computed(()=>['queued','submitting','in_progress','processing','pending','running','result_pending'].includes(props.status||''))
const failed=computed(()=>['failed','needs_review','result_error'].includes(props.status||''))
// 标题与详情相同时只显示一次；进度时间仍在数据层保留。
const statusDetail=computed(()=>{const detail=taskStatusText(props.detail||'');return detail&&detail!==stage.value?detail:''})
const stage=computed(()=>props.status==='result_pending'?'正在读取生成结果':props.status==='queued'?'正在等待执行资源':props.status==='submitting'?'正在提交创作请求':'正在生成作品')
const sideBySide=computed(()=>!!beforeRatio.value&&!!afterRatio.value&&Math.abs(beforeRatio.value-afterRatio.value)>.01)
const shownUrl=computed(()=>preview.value||version.value?.url)
const beforeUrl=computed(()=>original.value||version.value?.parentUrl||version.value?.url)
/** 未保存修改由用户明确放弃；切换历史、版本或离开页面均复用此保护。 */
async function confirmLeave(){
  await commitText()
  if(!dirty.value&&!drawing.value){if(annotating.value)clean();return true}
  if(discardResolution)return false
  discardOpen.value=true
  return new Promise<boolean>(resolve=>{discardResolution=resolve})
}
/** 站内离开只用自定义确认；红字放弃才丢弃本地修改，继续编辑不改变任何内容。 */
function resolveDiscard(discard:boolean){discardOpen.value=false;const resolve=discardResolution;discardResolution=null;if(discard)clean();resolve?.(discard)}
function clean(){colorOpen.value=false;liveLayers=null;clearTimeout(thumbnailTimer);thumbnailTimer=undefined;if(preview.value)URL.revokeObjectURL(preview.value);if(original.value)URL.revokeObjectURL(original.value);preview.value='';original.value='';operations.value=[];cursor.value=0;image=null;canvas=null;requestId='';tool.value='';cropBox.value=null;cropDrag=null;compare.value=false;error.value='';annotating.value=false;drawing.value=false;textPosition.value=null;text.value='';emit('annotation',null);revision++}
watch(()=>version.value?.key,clean)
onBeforeUnmount(()=>{clean();discardResolution?.(false)})
onBeforeRouteLeave(()=>confirmLeave())
/** 迟到的保存只标记原快照，用户后来新增的编辑不能被清空。 */
function markSaved(source?:WorkspaceSource,savedOperations?:Record<string,unknown>[]){
  requestId=''
  if(source&&!sameSavedEdit(source,version.value?.kind==='image'?savedOperations:[],version.value?.source,operations.value.slice(0,cursor.value)))return false
  cursor.value=0;operations.value=[];annotating.value=false;tool.value='';emit('annotation',null);return true
}
defineExpose({confirmLeave,markSaved,finishAnnotation:async()=>{await commitText();if(drawing.value)await pointerUp();await redraw()}})
async function select(key:string){if(key===version.value?.key||!await confirmLeave())return;emit('select',key)}
/** 同源受权字节仅用于本地编辑，防止跨域画布污染；版本切换后丢弃迟到读取。 */
async function loadImage(){
  if(image)return image
  if(!version.value)return null
  const current=revision;working.value=true
  try{const blob=await creationService.sourceMedia(version.value.source);if(current!==revision)return null;const url=URL.createObjectURL(blob),loaded=new Image();try{await new Promise<void>((resolve,reject)=>{loaded.onload=()=>resolve();loaded.onerror=()=>reject(new Error('原图读取失败。'));loaded.src=url})}catch(cause){URL.revokeObjectURL(url);throw cause}if(current!==revision){URL.revokeObjectURL(url);return null}original.value=url;image=loaded;width.value=loaded.naturalWidth;height.value=loaded.naturalHeight;return loaded}catch(cause){error.value=(cause as Error).message;return null}finally{if(current===revision)working.value=false}
}
async function chooseTool(value:string){
  if(annotating.value&&!await confirmLeave())return
  hand.value=false;error.value='';compare.value=false;tool.value=tool.value===value?'':value
  if(['crop','resize'].includes(value)){await loadImage();if(tool.value==='crop'&&image)cropBox.value={x:.1,y:.1,width:.8,height:.8}}
}
/** 批注与几何/生成工具分开，进入后默认画笔即可直接落笔，不再弹参数大面板。 */
async function enterAnnotation(){if(dirty.value&&!await confirmLeave())return;if(!(await loadImage()))return;hand.value=false;annotating.value=true;compare.value=false;tool.value='draw';await nextTick()}
async function annotationTool(value:string){await commitText();hand.value=false;tool.value=value}
async function exitAnnotation(){if(await confirmLeave())clean()}
/** 保存版本也读取真实宽高；不同画幅使用并排比较，不拉伸或错误叠合。 */
async function toggleCompare(){tool.value='';if(compare.value){compare.value=false;return}const current=revision;try{const ratios=await Promise.all([beforeUrl.value,shownUrl.value].map(url=>new Promise<number>((resolve,reject)=>{const media=new Image();media.onload=()=>resolve(media.naturalWidth/media.naturalHeight);media.onerror=()=>reject(new Error('对比图片暂不可用。'));media.src=url||''})));if(current!==revision)return;beforeRatio.value=ratios[0]!;afterRatio.value=ratios[1]!;compare.value=true}catch(cause){error.value=(cause as Error).message}}
async function redraw(){const request=++renderRevision,source=await loadImage();if(!source||request!==renderRevision)return;const current=revision;try{canvas=renderEdits(source,operations.value.slice(0,cursor.value));width.value=canvas.width;height.value=canvas.height;const blob=await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(value=>value?resolve(value):reject(new Error('图片预览失败。')),'image/png'));if(current!==revision||request!==renderRevision)return;if(preview.value)URL.revokeObjectURL(preview.value);preview.value=URL.createObjectURL(blob);requestId='';if(annotating.value){if(dirty.value)publishAnnotation(blob,canvas);else emit('annotation',null)}}catch(cause){error.value=(cause as Error).message}}
/** 本地缩略图随批注刷新；仅在显式提交时保存固定版本，不逐笔上传或扣点。 */
function publishAnnotation(file:Blob,surface:HTMLCanvasElement){if(!version.value)return;requestId ||= crypto.randomUUID();const thumb=document.createElement('canvas'),scale=Math.min(1,240/surface.width);thumb.width=Math.max(1,Math.round(surface.width*scale));thumb.height=Math.max(1,Math.round(surface.height*scale));thumb.getContext('2d')!.drawImage(surface,0,0,thumb.width,thumb.height);emit('annotation',{file,source:version.value.source,operations:[...operations.value.slice(0,cursor.value),...(drawing.value&&stroke.length?[{type:tool.value==='erase'?'erase':'draw',points:[...stroke],size:brush.value,color:color.value}]:[]),...(textPosition.value&&text.value.trim()?[{type:'text',text:text.value,...textPosition.value,size:Math.max(16,brush.value*4),color:color.value}]:[])] as unknown as Record<string,unknown>[],requestId,preview:thumb.toDataURL('image/png')})}
function scheduleThumbnail(){if(thumbnailTimer)return;const current=revision;thumbnailTimer=setTimeout(()=>{thumbnailTimer=undefined;if(!drawing.value||!liveCanvas.value)return;const surface=liveCanvas.value;surface.toBlob(file=>{if(file&&current===revision&&drawing.value)publishAnnotation(file,surface)},'image/png')},70)}
/** 实时橡皮操作透明批注层，再与原图合成，保持画布和附件预览一致。 */
function paintLive(points:Array<{x:number;y:number}>){if(!liveLayers||!liveCanvas.value)return;const ink=liveLayers.annotations.getContext('2d')!;ink.save();ink.globalCompositeOperation=tool.value==='erase'?'destination-out':'source-over';paintStroke(ink,points,brush.value,color.value);ink.restore();const ctx=liveCanvas.value.getContext('2d')!;ctx.clearRect(0,0,width.value,height.value);ctx.drawImage(liveLayers.base,0,0);ctx.drawImage(liveLayers.annotations,0,0)}
async function add(edit:ImageEdit){error.value='';if(!(await loadImage()))return;const previous=operations.value.slice(),oldCursor=cursor.value;operations.value=[...operations.value.slice(0,cursor.value),edit];cursor.value++;await redraw();if(error.value){operations.value=previous;cursor.value=oldCursor}}
async function applyCrop(){if(!cropBox.value)return;await add(pixelCrop(cropBox.value,width.value,height.value));if(!error.value){cropBox.value=null;tool.value=''}}
async function applyRatio(ratio:number){if(!(await loadImage()))return;await add(pixelCrop(centeredRatio(width.value,height.value,ratio),width.value,height.value));if(!error.value)tool.value=''}
function cropPoint(event:PointerEvent){const bounds=canvasImage.value!.getBoundingClientRect();return{x:clampUnit((event.clientX-bounds.left)/bounds.width),y:clampUnit((event.clientY-bounds.top)/bounds.height)}}
/** 可直接新建选区、拖动选区及拉四角；真实像素仅在确认时换算。 */
function startCrop(event:PointerEvent,mode='new'){if(!image||working.value||event.button!==0)return;event.preventDefault();event.stopPropagation();const start=cropPoint(event),box=cropBox.value||{x:start.x,y:start.y,width:0,height:0};cropDrag={mode,start,box:{...box}};if(mode==='new')cropBox.value={x:start.x,y:start.y,width:0,height:0};(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}
function moveCrop(event:PointerEvent){if(!cropDrag)return;const p=cropPoint(event),{mode,start,box}=cropDrag;if(mode==='move'){cropBox.value={...box,x:Math.max(0,Math.min(1-box.width,box.x+p.x-start.x)),y:Math.max(0,Math.min(1-box.height,box.y+p.y-start.y))}}else if(mode==='new')cropBox.value=cropFromPoints(start,p);else{const anchor={x:mode.includes('w')?box.x+box.width:box.x,y:mode.includes('n')?box.y+box.height:box.y};cropBox.value=cropFromPoints(anchor,p)}}
function endCrop(){cropDrag=null}
function cropKey(event:KeyboardEvent){if(event.key==='Enter'){event.preventDefault();void applyCrop();return}if(event.key==='Escape'){tool.value='';return}if(!cropBox.value||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const box=cropBox.value,delta=event.shiftKey?.05:.005;cropBox.value={...box,x:Math.max(0,Math.min(1-box.width,box.x+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0))),y:Math.max(0,Math.min(1-box.height,box.y+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)))}}
function point(event:PointerEvent){const bounds=canvasImage.value!.getBoundingClientRect();return{x:Math.max(0,Math.min(width.value,(event.clientX-bounds.left)/bounds.width*width.value)),y:Math.max(0,Math.min(height.value,(event.clientY-bounds.top)/bounds.height*height.value))}}
async function pointerDown(event:PointerEvent){if(!annotating.value||!image||!canvasImage.value||!['draw','erase','text'].includes(tool.value)||event.button!==0)return;event.preventDefault();const target=event.currentTarget as HTMLElement;await commitText();if(tool.value==='text'){textPosition.value=point(event);text.value='';await nextTick();textInput.value?.focus();return}stroke=[point(event)];drawing.value=true;const surface=liveCanvas.value!;surface.width=width.value;surface.height=height.value;liveLayers=renderEditLayers(image,operations.value.slice(0,cursor.value));paintLive(stroke);target.setPointerCapture(event.pointerId);scheduleThumbnail()}
function pointerMove(event:PointerEvent){if(!drawing.value||!stroke.length||!liveCanvas.value)return;const next=point(event),previous=stroke[stroke.length-1]!;stroke.push(next);paintLive([previous,next]);scheduleThumbnail()}
async function pointerUp(){clearTimeout(thumbnailTimer);thumbnailTimer=undefined;if(stroke.length){const points=[...stroke];stroke=[];await add({type:tool.value==='erase'?'erase':'draw',points,size:brush.value,color:color.value});drawing.value=false;liveLayers=null}}
async function commitText(){if(!textPosition.value)return;const position=textPosition.value,value=text.value;textPosition.value=null;text.value='';if(value.trim())await add({type:'text',text:value,...position,size:Math.max(16,brush.value*4),color:color.value})}
function previewText(){clearTimeout(thumbnailTimer);const current=revision;thumbnailTimer=setTimeout(()=>{thumbnailTimer=undefined;if(!image||!textPosition.value)return;if(!text.value.trim()){void redraw();return}const value=text.value,position={...textPosition.value},surface=renderEdits(image,[...operations.value.slice(0,cursor.value),{type:'text',text:value,...position,size:Math.max(16,brush.value*4),color:color.value}]);surface.toBlob(file=>{if(file&&current===revision&&text.value===value&&textPosition.value)publishAnnotation(file,surface)},'image/png')},60)}
function textKey(event:KeyboardEvent){if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();textPosition.value=null;text.value=''}else if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void commitText()}}
async function save(){if(!version.value||!canvas||!dirty.value||working.value||props.saveBusy)return;const file=await new Promise<Blob|null>(resolve=>canvas!.toBlob(resolve,'image/png'));if(file){requestId ||= crypto.randomUUID();emit('save',{file,source:version.value.source,operations:operations.value.slice(0,cursor.value) as unknown as Record<string,unknown>[],requestId})}}
/** 截帧单独读取受权视频，不把远程播放器直接绘入画布；只保存静态派生图片。 */
async function capture(){if(!version.value||!video.value)return;const source=version.value.source,time=video.value.currentTime,current=revision;working.value=true;let url='';try{url=URL.createObjectURL(await creationService.sourceMedia(source));const player=document.createElement('video');player.preload='auto';player.src=url;await new Promise<void>((resolve,reject)=>{player.onloadeddata=()=>resolve();player.onerror=()=>reject(new Error('视频读取失败。'))});if(time>0)await new Promise<void>((resolve,reject)=>{player.onseeked=()=>resolve();player.onerror=()=>reject(new Error('视频定位失败。'));player.currentTime=time});if(current!==revision)return;const frame=document.createElement('canvas');frame.width=player.videoWidth;frame.height=player.videoHeight;frame.getContext('2d')!.drawImage(player,0,0);const file=await new Promise<Blob|null>(resolve=>frame.toBlob(resolve,'image/png'));if(file)emit('save',{file,source,operations:[{type:'frame',time}],requestId:crypto.randomUUID()});player.removeAttribute('src');player.load()}catch(cause){error.value=(cause as Error).message}finally{if(url)URL.revokeObjectURL(url);if(current===revision)working.value=false}}
async function ai(action:string){if(!version.value||!await confirmLeave())return;emit('ai',action,version.value.source)}
</script>

<template>
  <section ref="workspace" class="liv-canvas" :style="canvasLayoutStyle" :class="{'is-fullscreen':fullscreen,'is-image-result':version?.kind==='image'&&!pending&&!failed}" aria-label="作品画布" tabindex="0" @pointerdown.capture="focusWorkspace">
    <header ref="canvasTop" class="canvas-top" :style="topToolsStyle">
      <div class="canvas-version"><UIcon :name="version?.kind==='video'?'i-lucide-film':version?.kind==='audio'?'i-lucide-disc-3':'i-lucide-image'"/><WorkspaceSelect v-if="versions.length" label="作品版本" :value="version?.key||''" :items="versionOptions" @select="select(String($event))"/><span v-else>作品画布</span></div>
      <div v-if="version" class="canvas-controls">
        <WorkspaceSelect v-if="version.kind==='image'" label="画布缩放" :value="Number(zoom)" :items="zoomOptions" @select="zoom=Number($event)"/>
        <UTooltip v-if="version.kind!=='audio'" text="适应窗口（0）；Ctrl / Cmd + 滚轮缩放" :delay-duration="0" :content="{side:'bottom'}"><button aria-label="适应窗口" @click="fitCanvas"><UIcon name="i-lucide-shrink"/></button></UTooltip>
        <UTooltip v-if="version.kind!=='audio'" :text="fullscreen?'退出全屏':'全屏画布'" :delay-duration="0" :content="{side:'bottom'}"><button :aria-label="fullscreen?'退出全屏':'全屏画布'" @click="toggleFullscreen"><UIcon :name="fullscreen?'i-lucide-minimize':'i-lucide-maximize'"/></button></UTooltip>
        <UTooltip v-if="version.source.kind==='image'" :text="favorite?'取消收藏作品':'收藏作品'" :delay-duration="0" :content="{side:'bottom'}"><button :aria-label="favorite?'取消收藏作品':'收藏作品'" :class="{'is-favorite':favorite}" @click="emit('favorite')"><StarIcon :fill="favorite?'currentColor':'none'"/></button></UTooltip>
        <UTooltip text="下载作品" :delay-duration="0" :content="{side:'bottom'}"><button aria-label="下载作品" :disabled="downloading" @click="download"><UIcon :name="downloading?'i-lucide-loader-circle':'i-lucide-download'" :class="{'animate-spin':downloading}"/></button></UTooltip>
      </div>
    </header>
    <div v-if="error" class="canvas-error" role="alert">{{error}} <button @click="error=''">关闭</button></div>
    <main ref="canvasStage" class="canvas-stage" :class="{'is-hand':hand||spaceHeld||tool==='pointer','is-panning':panning,'is-music-stage':version?.kind==='audio'&&!pending&&!failed}" @wheel="canvasWheel" @scroll.passive="positionTools" @pointerdown.capture="startPan" @pointermove.capture="movePan" @pointerup.capture="endPan" @pointercancel.capture="endPan" @lostpointercapture="endPan">
      <div v-if="status==='status_unavailable'" class="canvas-state" role="status"><UIcon name="i-lucide-refresh-cw"/><h3>正在同步任务状态</h3><p>连接暂时中断，未重复提交</p><button @click="emit('refresh')">刷新状态</button></div>
      <div v-else-if="pending" class="canvas-state" role="status"><div class="liv-orbit"><img src="/creation-presets/liv-creative-seed.png" alt=""/></div><div v-if="progress!=null" class="canvas-provider-progress" aria-label="生成进度"><UProgress :model-value="progress" color="primary"/><span>生成进度 · {{progress}}%</span></div><h3>{{stage}}</h3><p v-if="statusDetail">{{statusDetail}}</p></div>
      <div v-else-if="status==='cancelled'" class="canvas-state"><UIcon name="i-lucide-circle-stop"/><h3>已取消生成</h3><p>任务已取消，积分退回状态以账单为准。再次生成需要重新核对方案与报价。</p></div>
      <div v-else-if="failed" class="canvas-state"><UIcon name="i-lucide-circle-alert"/><h3>这次创作未能完成</h3><UTooltip :text="taskStatusText(detail||'请刷新状态，核对原因后再决定是否重新提交。')"><p tabindex="0">{{compactTaskFailure(detail||'')}}</p></UTooltip><button @click="emit('refresh')">刷新状态</button></div>
      <template v-else-if="version">
        <div v-if="version.kind==='image'" class="canvas-image-stage" :style="{'--canvas-zoom':zoom/100,'--canvas-pan-x':`${pan.x}px`,'--canvas-pan-y':`${pan.y}px`}">
          <div v-if="compare&&sideBySide" class="canvas-side-by-side"><figure><img :src="beforeUrl" alt="修改前"><figcaption>修改前</figcaption></figure><figure><img :src="shownUrl" alt="修改后"><figcaption>修改后</figcaption></figure></div>
          <div v-else class="canvas-image-wrap"><img ref="canvasImage" @load="positionTools" class="canvas-image" :class="{'is-painting':['text','draw'].includes(tool)}" :src="shownUrl" alt="当前作品" draggable="false" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="stroke=[]"><canvas v-if="annotating" ref="liveCanvas" class="annotation-surface" :class="{'is-drawing':drawing,'is-text':tool==='text','is-pointer':tool==='pointer'}" aria-label="图片批注画布" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp"/><textarea v-if="annotating&&textPosition" ref="textInput" v-model="text" class="annotation-text-input" aria-label="批注文字" placeholder="输入文字" :style="{left:`${textPosition.x/width*100}%`,top:`${textPosition.y/height*100}%`,color,fontSize:`${Math.max(16,brush*4)*(canvasImage?.clientWidth||width)/width}px`}" @input="previewText" @keydown="textKey" @blur="commitText" @pointerdown.stop/><div v-if="tool==='crop'&&!working" class="crop-overlay" role="group" aria-label="图片裁剪选区" tabindex="0" @pointerdown="startCrop($event)" @pointermove="moveCrop" @pointerup="endCrop" @pointercancel="endCrop" @lostpointercapture="endCrop" @keydown="cropKey"><div v-if="cropBox" class="crop-box" :style="cropStyle" @pointerdown.stop="startCrop($event,'move')"><span class="crop-grid"/><span v-for="corner in ['nw','ne','sw','se']" :key="corner" :class="['crop-handle',corner]" @pointerdown.stop="startCrop($event,corner)"/></div></div><template v-if="compare"><img class="canvas-before" :src="beforeUrl" alt="修改前" :style="{clipPath:`inset(0 ${100-split}% 0 0)`}"><div class="compare-line" :style="{left:`${split}%`}"><span>↔</span></div><div class="compare-labels"><span>修改前</span><span>修改后</span></div><input v-model="split" type="range" min="0" max="100" aria-label="修改前后对比滑块" class="compare-slider"></template></div>
        </div>
        <video v-else-if="version.kind==='video'" ref="video" :key="version.key" class="canvas-video" :src="version.url" :poster="version.cover" controls playsinline preload="metadata"/>
        <MusicPlayer v-else :url="version.url" :title="version.title" :cover="version.cover" :lyrics="version.lyrics" :alignment="version.alignment" :task-id="version.source.kind==='music'?version.source.id:undefined" :track-number="version.source.audio_index??0" downloadable @download="download" :tracks="versions.filter(item=>item.kind==='audio').map(item=>({key:item.key,title:item.title,cover:item.cover}))" :selected="version.key" @select="select"><template #actions><UButton icon="i-lucide-film" color="neutral" variant="outline" @click="emit('music','make-mv')">生成视频 MV</UButton></template></MusicPlayer>
      </template>
      <div v-else class="canvas-state"><img src="/creation-presets/liv-creative-seed.png" alt="Liv 创作助手"/><h3>让想法在这里成形</h3><p>选择左侧历史消息查看作品，或继续描述你的想法。</p></div>
    </main>
    <div v-if="tool==='crop'&&version?.kind==='image'" class="crop-actions"><span>拖动框选，拉动四角调整</span><button @click="tool='';cropBox=null">取消</button><button class="canvas-primary" :disabled="working||!cropBox||cropBox.width<.005||cropBox.height<.005" @click="applyCrop">确认裁剪</button></div>

    <footer v-if="version&&!pending&&!failed" ref="canvasFooter" class="canvas-footer" :style="bottomToolsStyle">
      <div v-if="version.kind==='image'&&annotating" class="canvas-toolbar annotation-toolbar" aria-label="批注工具栏">
        <UTooltip v-for="item in [{id:'pointer',icon:'hand',label:'拖动图片',shortcut:'H / 空格'},{id:'draw',icon:'pencil',label:'画笔',shortcut:'B'},{id:'text',icon:'type',label:'文字',shortcut:'T'},{id:'erase',icon:'eraser',label:'橡皮擦',shortcut:'E'}]" :key="item.id" :text="`${item.label}（${item.shortcut}）`" :delay-duration="0" :content="{side:'top'}"><button :class="{active:tool===item.id}" :aria-label="item.label" @click="annotationTool(item.id)"><UIcon :name="`i-lucide-${item.icon}`"/></button></UTooltip>
        <UPopover v-model:open="colorOpen" :content="{side:'top',align:'center',sideOffset:12}" :ui="{content:'rounded-2xl shadow-xl z-[550]'}">
          <button class="palette-trigger" aria-label="批注色板"><span :style="{background:color}"/></button>
          <template #content><div class="palette-panel" aria-label="批注颜色选择"><UColorPicker v-model="color" format="hex" size="sm"/><div class="palette-rgb"><label v-for="(value,index) in rgb" :key="index"><input type="number" min="0" max="255" :aria-label="['红色 R','绿色 G','蓝色 B'][index]" :value="value" @change="setRgb(index,$event)"><span>{{['R','G','B'][index]}}</span></label></div><div class="palette-swatches"><button v-for="swatch in swatches" :key="swatch" :style="{background:swatch}" :class="{selected:color.toLowerCase()===swatch}" :aria-label="`选择颜色 ${swatch}`" @click="color=swatch"/></div></div></template>
        </UPopover>
        <input v-model.number="brush" class="annotation-width" type="range" min="2" max="60" aria-label="批注粗细"><i/>
        <button aria-label="撤销批注" title="撤销" :disabled="!dirty||working" @click="cursor--;redraw()"><UIcon name="i-lucide-undo-2"/></button><button aria-label="重做批注" title="重做" :disabled="!canRedo||working" @click="cursor++;redraw()"><UIcon name="i-lucide-redo-2"/></button><i/><button aria-label="退出批注" title="退出批注" @click="exitAnnotation"><UIcon name="i-lucide-x"/></button>
      </div>
      <div v-else-if="version.kind==='image'" class="canvas-toolbar">
        <UTooltip text="拖动图片（H / 按住空格）；0 复位" :delay-duration="0" :content="{side:'top'}"><button aria-label="拖动图片" :class="{active:hand}" @click="hand=!hand"><UIcon name="i-lucide-hand"/></button></UTooltip>
        <button aria-label="批注" :disabled="working" @click="enterAnnotation"><UIcon name="i-lucide-pencil-line"/>批注</button>
        <button aria-label="裁剪" title="裁剪" :class="{active:tool==='crop'}" :disabled="working" @click="chooseTool('crop')"><UIcon name="i-lucide-crop"/></button>
        <button aria-label="旋转90度" title="旋转90度" :disabled="working" @click="add({type:'rotate',degrees:90})"><UIcon name="i-lucide-rotate-cw"/></button><i/>
        <button aria-label="撤销" title="撤销" :disabled="!dirty||working" @click="cursor--;redraw()"><UIcon name="i-lucide-undo-2"/></button><button aria-label="重做" title="重做" :disabled="!canRedo||working" @click="cursor++;redraw()"><UIcon name="i-lucide-redo-2"/></button><button v-if="dirty||version.parentUrl" :class="{active:compare}" @click="toggleCompare()"><UIcon name="i-lucide-columns-2"/>对比</button><i/>
        <button @click="ai('background')">背景</button><button @click="ai('style')">风格</button><UPopover v-model:open="ratioOpen" :content="{side:'top',align:'center',sideOffset:12}" :ui="{content:'z-[550] rounded-2xl'}"><button aria-label="尺寸" :class="{active:ratioOpen}" :disabled="working"><UIcon name="i-lucide-scaling"/>尺寸</button><template #content><div class="canvas-ratio-options" aria-label="图片尺寸"><UButton v-for="option in ratioOptions" :key="option.value" variant="ghost" color="neutral" @click="applyRatio(option.ratio);ratioOpen=false"><span class="ratio-shape" :style="{aspectRatio:String(option.ratio)}"/><span>{{option.label}}</span><small>{{option.value}}</small></UButton></div></template></UPopover><button @click="ai('image_to_video')"><UIcon name="i-lucide-film"/>转视频</button><button :disabled="!dirty||saveBusy||working" class="canvas-primary" @click="save">{{saveBusy?'保存中…':'保存版本'}}</button>
      </div>
      <div v-else-if="version.kind==='video'" class="canvas-toolbar" role="toolbar" aria-label="视频作品工具">
        <UTooltip text="将当前播放位置保存为图片，不生成新视频"><UButton variant="ghost" color="neutral" :disabled="working||saveBusy||version.source.kind!=='video'" icon="i-lucide-camera" @click="capture">{{working?'正在截帧…':'保存截帧'}}</UButton></UTooltip>
        <UTooltip v-if="version.source.kind==='video'" text="把当前视频作为参考，在对话中继续创作；生成前核对报价"><UButton variant="ghost" color="neutral" :disabled="working||saveBusy" icon="i-lucide-message-circle-plus" @click="ai('video_reference')">引用续作</UButton></UTooltip>
        <i aria-hidden="true"/>
      </div>
      <!-- 音乐业务命令已放在播放器曲名下，底部仅保留真实费用边界说明。 -->
      <p>{{working?'正在读取原始媒体…':dirty?'本地预览 · 尚未保存，不扣积分':'本地编辑免费；AI 工具需在对话中核对报价后提交'}}</p>
    </footer>
    <div v-if="results?.length" ref="resultShelf" class="canvas-result-shelf" :style="resultShelfStyle"><CreationResultRail :items="results" :selected="selectedResult||''" :unread="unreadResults||[]" :disabled="selectionDisabled" @select="emit('result',$event)"/></div>
  </section>
  <Teleport to="body"><div v-if="discardOpen" class="annotation-discard-mask" @click.self="resolveDiscard(false)" @keydown.esc.stop="resolveDiscard(false)"><section class="annotation-discard-dialog" role="dialog" aria-modal="true" aria-labelledby="annotation-discard-title"><div class="annotation-discard-symbol"><UIcon name="i-lucide-pencil-line"/></div><h2 id="annotation-discard-title">放弃改动？</h2><p>当前修改尚未保存，放弃后不会保留。</p><button ref="continueButton" class="continue-edit" @click="resolveDiscard(false)">继续编辑</button><button class="discard-edit" @click="resolveDiscard(true)">放弃改动</button></section></div></Teleport>
</template>

<style scoped>
/* 音乐舞台独立纵向滚动，面板撑满可用宽度，不沿用图片居中点阵与大边距。 */
.canvas-stage.is-music-stage{display:block;padding:8px 12px;background-image:none}.canvas-stage.is-music-stage :deep(.liv-music-player){margin:0;min-height:100%}
.canvas-provider-progress{width:min(300px,70vw);font-size:12px;color:var(--liv-ui-primary-foreground);display:flex;flex-direction:column;gap:12px}.canvas-stage:has(.liv-music-player){align-items:flex-start}
.liv-canvas.is-fullscreen{position:fixed;inset:0;z-index:500;width:100vw;height:100dvh;border-radius:0}
.liv-canvas:fullscreen{width:100vw;height:100dvh;border-radius:0}.canvas-controls button.is-favorite{color:#fbbf24}.palette-trigger{padding:5px!important}.palette-trigger>span{display:block;width:23px;height:23px;border-radius:50%;border:1px solid #ffffff50}.palette-panel{padding:14px;background:#292a30;border:1px solid #484a53;border-radius:16px;width:248px;color:#eef0f6}.palette-rgb{display:flex;gap:8px;margin:12px 0}.palette-rgb label{flex:1;min-width:0;text-align:center;font-size:10px;color:#b7bac4}.palette-rgb input{width:100%;background:#191a20;border:1px solid #53555e;border-radius:7px;color:white;text-align:center;padding:5px 0;margin-bottom:4px;font-size:12px}.palette-swatches{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.palette-swatches button{width:24px;height:24px;border-radius:50%;border:1px solid #ffffff40;cursor:pointer}.palette-swatches button.selected{outline:2px solid #A5B4FC;outline-offset:2px}
/* 位移与缩放分离；拖动模式覆盖图层光标，避免误以为仍可落笔。 */
.canvas-image-stage{translate:var(--canvas-pan-x,0px) var(--canvas-pan-y,0px)}.canvas-stage.is-hand,.canvas-stage.is-hand *{cursor:grab!important;touch-action:none}.canvas-stage.is-panning,.canvas-stage.is-panning *{cursor:grabbing!important}.liv-canvas{outline:none}.liv-canvas:focus-visible{box-shadow:inset 0 0 0 1px #4F46E550}
.annotation-surface{position:absolute;inset:0;width:100%;height:100%;opacity:0;touch-action:none;cursor:crosshair}.annotation-surface.is-drawing{opacity:1}.annotation-surface.is-text{cursor:text}.annotation-surface.is-pointer{cursor:default}.annotation-text-input{position:absolute;z-index:5;min-width:90px;max-width:60%;min-height:1.8em;height:2em;background:#14151940;border:1px dashed #4F46E5;border-radius:3px;outline:none;padding:2px 5px;resize:both;line-height:1.25;font-family:sans-serif;overflow:auto}.annotation-text-input::placeholder{color:#fff9}.annotation-toolbar{gap:5px}.annotation-toolbar .annotation-width{width:65px;accent-color:#4F46E5}.annotation-color{width:23px;height:23px;border-radius:50%;overflow:hidden;margin:0 4px;border:1px solid #ffffff40;cursor:pointer}.annotation-color input{width:34px;height:34px;max-width:none;padding:0;border:0;transform:translate(-6px,-6px);cursor:pointer}.annotation-discard-mask{position:fixed;inset:0;z-index:600;background:#05060980;backdrop-filter:blur(7px);display:grid;place-items:center;padding:20px}.annotation-discard-dialog{width:min(350px,100%);background:#25262c;border:1px solid #42444d;border-radius:22px;padding:28px;color:#eee;text-align:center;box-shadow:0 24px 100px #0008}.annotation-discard-symbol{display:grid;place-items:center;margin:0 auto 14px;background:#4F46E516;border:1px solid #4F46E525;border-radius:14px;width:42px;height:42px;color:#A5B4FC}.annotation-discard-dialog h2{font-size:18px;font-weight:650;margin:0 0 10px}.annotation-discard-dialog p{font-size:12px;line-height:1.7;color:#a8abb6;margin:0 0 22px}.annotation-discard-dialog button{display:block;width:100%;border:0;border-radius:22px;padding:11px 15px;margin-top:10px;font-size:13px;cursor:pointer}.annotation-discard-dialog button:focus-visible{outline:2px solid #4F46E5;outline-offset:3px}.continue-edit{background:#ebedf2;color:#17191f}.discard-edit{background:#f2676812;color:#ff7679}.discard-edit:hover{background:#f2676825}
.canvas-top{padding:10px 14px!important}.canvas-version,.canvas-controls{height:32px!important;padding:3px 9px!important;border-radius:16px!important;gap:6px!important;font-size:11px!important}.canvas-version select{max-width:155px}.canvas-controls button,.canvas-controls a{width:20px;height:22px}.canvas-controls :deep(svg),.canvas-version :deep(svg){width:14px;height:14px}.crop-overlay{position:absolute;inset:0;touch-action:none;cursor:crosshair;overflow:hidden;outline:none}.crop-overlay:focus-visible{outline:2px solid #4F46E5;outline-offset:3px}.crop-box{position:absolute;border:1px solid white;box-shadow:0 0 0 9999px #0008;cursor:move;touch-action:none;min-width:1px;min-height:1px}.crop-grid{position:absolute;inset:0;background:linear-gradient(to right,transparent 33%,#ffffff50 33%,#ffffff50 calc(33% + 1px),transparent calc(33% + 1px),transparent 66%,#ffffff50 66%,#ffffff50 calc(66% + 1px),transparent calc(66% + 1px)),linear-gradient(to bottom,transparent 33%,#ffffff50 33%,#ffffff50 calc(33% + 1px),transparent calc(33% + 1px),transparent 66%,#ffffff50 66%,#ffffff50 calc(66% + 1px),transparent calc(66% + 1px));pointer-events:none}.crop-handle{position:absolute;width:12px;height:12px;background:white;border:1px solid #4F46E5;z-index:1}.crop-handle.nw{left:-6px;top:-6px;cursor:nwse-resize}.crop-handle.ne{right:-6px;top:-6px;cursor:nesw-resize}.crop-handle.sw{left:-6px;bottom:-6px;cursor:nesw-resize}.crop-handle.se{right:-6px;bottom:-6px;cursor:nwse-resize}.crop-actions{position:absolute;bottom:112px;left:50%;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:8px;padding:6px 8px;background:#27282dec;border:1px solid #414249;border-radius:12px;white-space:nowrap;font-size:11px}.crop-actions>span{color:#b5b7c0}.crop-actions button{padding:5px 8px!important}.canvas-settings.is-ratios{width:182px;padding:6px;gap:0;bottom:105px}.canvas-settings.is-ratios button{display:flex;align-items:center;justify-content:flex-start;padding:9px 10px;border-radius:7px;font-size:12px;gap:10px}.canvas-settings.is-ratios button:hover{background:#ffffff12}.canvas-settings.is-ratios small{margin-left:auto}.ratio-shape{display:block;max-width:15px;height:14px;border:1px solid #a6a8b3;border-radius:2px}.canvas-footer{padding-bottom:9px!important}.canvas-footer>p{font-size:10px!important}@media(max-width:760px){.crop-actions>span{display:none}.canvas-settings.is-ratios{left:auto;width:182px}}
.liv-canvas{height:100%;min-height:0;position:relative;display:flex;flex-direction:column;background:var(--liv-workspace-surface);border-radius:18px;overflow:hidden;color:#ededf0}.canvas-top{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;gap:10px;z-index:2}.canvas-version,.canvas-controls{display:flex;align-items:center;gap:8px;font-size:12px}.canvas-version,.canvas-controls{border:1px solid #35363c;background:#202125c9;border-radius:22px;padding:5px 10px}.liv-canvas select{background:transparent;color:inherit;border:0;max-width:200px;outline:none}.liv-canvas option{background:#24252a}.liv-canvas button,.canvas-controls a{display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;color:inherit;white-space:nowrap}.liv-canvas button:disabled{opacity:.35;cursor:default}.liv-canvas button:focus-visible,.liv-canvas a:focus-visible{outline:2px solid #4F46E5;outline-offset:2px}.liv-canvas :deep(svg){width:17px;height:17px;flex:none}.canvas-stage{container-type:size;min-height:0;flex:1;display:flex;align-items:center;justify-content:center;padding:20px 28px;overflow:auto;background-image:radial-gradient(#ffffff0c .65px,transparent .65px);background-size:18px 18px}.canvas-image-stage{max-width:100%;max-height:100%;display:flex;justify-content:center;align-items:center;transform:scale(var(--canvas-zoom,1));transform-origin:center}.canvas-image-wrap{position:relative;display:flex;max-width:100%;max-height:100%;box-shadow:0 16px 60px #0004}.canvas-image{display:block;max-width:100%;max-height:100cqh;object-fit:contain;width:auto;height:auto;user-select:none}.canvas-image.is-painting{cursor:crosshair;touch-action:none}.canvas-before{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}.compare-line{position:absolute;top:0;bottom:0;width:2px;background:#fff;pointer-events:none;display:flex;align-items:center;justify-content:center}.compare-line span{background:#fff;color:#17181c;border-radius:50%;padding:5px;box-shadow:0 2px 15px #0005}.compare-slider{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:ew-resize}.compare-labels{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;pointer-events:none;font-size:11px}.compare-labels span{background:#0008;padding:4px 9px;border-radius:10px}.canvas-side-by-side{display:flex;align-items:center;gap:16px;max-width:100%}.canvas-side-by-side figure{flex:1;min-width:0;text-align:center}.canvas-side-by-side img{max-width:100%;max-height:calc(100dvh - 280px);object-fit:contain}.canvas-side-by-side figcaption{font-size:12px;color:#aaa;margin-top:8px}.canvas-footer{flex:none;padding:10px 14px 15px;display:flex;flex-direction:column;align-items:center;gap:9px;z-index:3}.canvas-toolbar{display:flex;align-items:center;gap:3px;flex-wrap:wrap;justify-content:center;background:var(--liv-workspace-surface);border:1px solid #414249;border-radius:15px;padding:5px;box-shadow:0 8px 30px #0005;backdrop-filter:blur(16px);font-size:12px}.canvas-toolbar button{padding:8px;border-radius:9px;min-height:34px}.canvas-toolbar button:hover,.canvas-toolbar button.active{background:#4F46E525;color:#A5B4FC}.canvas-toolbar i{width:1px;height:18px;background:#51525b;margin:0 3px}.liv-canvas .canvas-primary{background:#4F46E5;color:white;border-radius:9px;padding:8px 13px}.canvas-footer>p{font-size:11px;color:#80838d;margin:0;text-align:center}.canvas-settings{position:absolute;z-index:4;right:18px;bottom:118px;width:245px;padding:16px;border-radius:17px;background:#25262bf5;border:1px solid #414249;box-shadow:0 10px 35px #0005;font-size:12px;display:flex;flex-direction:column;gap:12px}.canvas-settings header{display:flex;justify-content:space-between;align-items:center}.canvas-settings input:not([type=color]):not([type=range]){background:#16171b;border:1px solid #44454d;border-radius:8px;padding:7px;width:100%;color:inherit}.canvas-settings small{color:#9b9da6;font-size:11px}.canvas-size{display:flex;gap:10px}.canvas-size label{min-width:0;flex:1}.canvas-size input{margin-top:5px}.canvas-settings label{display:flex;align-items:center;gap:8px}.canvas-size label{display:block}.canvas-video{width:100%;height:100%;max-height:calc(100dvh - 230px);object-fit:contain}.canvas-state{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:400px;gap:16px;padding:30px;color:#a2a5af;font-size:13px}.canvas-state>img,.liv-orbit img{width:72px;height:72px;object-fit:contain}.canvas-state h3{font-size:17px;color:#e6e7eb}.canvas-state p{line-height:1.8}.canvas-state button{border:1px solid #414249;padding:7px 14px;border-radius:8px}.liv-orbit{position:relative;animation:breathe 2s ease-in-out infinite}.liv-orbit:after{content:'';position:absolute;inset:-12px;border:1px solid #4F46E555;border-radius:50%;border-top-color:#4F46E5;animation:spin 2s linear infinite}.canvas-error{margin:0 18px;padding:10px 12px;background:#54242c;border-radius:9px;font-size:12px;z-index:4}.canvas-music{display:flex;align-items:center;gap:35px;max-width:850px;width:100%;padding:35px}.music-art{width:40%;aspect-ratio:1;flex:none;background:linear-gradient(135deg,#1a3450,#282037);border:1px solid #ffffff12;border-radius:22px;display:grid;place-items:center;box-shadow:0 20px 60px #0005;overflow:hidden}.music-art img{width:100%;height:100%;object-fit:cover}.music-art :deep(svg){width:100px;height:100px;color:#729fc4}.music-info{min-width:0;flex:1}.music-info>span{font-size:11px;color:#A5B4FC}.music-info h2{font-size:23px;margin:10px 0 22px}.music-info audio{width:100%}.music-info pre{font:13px/2 inherit;white-space:pre-wrap;max-height:32vh;overflow:auto;color:#bdc0cb;margin-top:24px}.music-info p{font-size:12px;color:#9b9da6;margin-top:20px}@keyframes breathe{50%{transform:translateY(-5px)}}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.liv-orbit,.liv-orbit:after{animation:none}}@media(max-width:760px){.canvas-top{padding:10px}.canvas-stage{padding:12px}.canvas-image{max-height:calc(100dvh - 300px)}.canvas-settings{bottom:135px;right:12px;left:12px;width:auto}.canvas-toolbar{font-size:11px}.canvas-toolbar button{padding:7px}.canvas-music{flex-direction:column;padding:16px;gap:20px}.music-art{width:min(220px,70%)}.music-info{width:100%}.music-info h2{font-size:18px}.canvas-version select{max-width:140px}}
/* 浮层通过触发器定位，内容不继承画布绝对定位规则。 */
.canvas-ratio-options{display:grid;gap:4px;padding:12px;min-width:180px;background:var(--color-panel);color:var(--color-text-main)}.canvas-ratio-options button{justify-content:flex-start;gap:12px}.canvas-ratio-options small{margin-left:auto}
/* 适应画布以作品为中心，工具栏紧随媒体，不留整屏空白。 */
.liv-canvas.is-image-result .canvas-stage{flex:1;height:auto;margin:64px 0 var(--canvas-bottom-space,192px);padding:0 24px;overflow:hidden}
.liv-canvas.is-image-result .canvas-top{position:absolute;padding:0!important;z-index:5}
.liv-canvas.is-image-result .canvas-footer{position:absolute;margin:0;padding:0;gap:8px;z-index:4}
/* 产物栏在说明下方独立居中，不紧贴工具、不吸附底边。 */
.canvas-result-shelf{display:flex;justify-content:center;min-width:0;flex:none;z-index:4}
.is-image-result .canvas-result-shelf{position:absolute}
.canvas-result-shelf :deep(.liv-result-rail){width:max-content;max-width:100%;border:0;border-radius:12px;padding:4px 8px;gap:8px}
/* 操作尺寸使用统一 40px 档；窄画布横向滚动，不能挤掉保存按钮。 */
.canvas-toolbar{max-width:100%;flex-wrap:nowrap!important;overflow-x:auto;justify-content:flex-start!important;font-size:14px!important;scrollbar-width:thin}
.canvas-toolbar button{flex:none;min-height:40px!important;padding:8px 12px!important;font-size:14px!important}
.canvas-toolbar :deep(svg),.canvas-toolbar :deep(.iconify){width:20px!important;height:20px!important}
.canvas-top .canvas-version{min-width:0}.canvas-top .canvas-controls{flex:none}.canvas-top .canvas-version :deep(.workspace-select){overflow:hidden;text-overflow:ellipsis}
.canvas-top .canvas-controls :deep(.workspace-select){font-size:12px;font-variant-numeric:tabular-nums;min-width:52px}
@media(max-width:600px){.canvas-top{gap:4px}.canvas-version{padding:4px;max-width:36%}.canvas-controls{gap:4px;padding:4px}.canvas-top :deep(svg){width:16px;height:16px}.liv-canvas.is-image-result .canvas-stage{margin-top:56px;padding:0 12px}}
</style>
