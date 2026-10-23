<script setup lang="ts">
import CreationDurationSlider from './CreationDurationSlider.vue'
import { allowedDurations } from '../durationOptions'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import {compactCreditNumber} from '../referenceCreditLabel'
import CreationTemplateDialog from './CreationTemplateDialog.vue'
import CreationStyleDialog from './CreationStyleDialog.vue'
import type {LibraryItem} from '~/entities/library/types'
import {libraryService} from '~/shared/api/services/libraryService'
import {skillExample,skillExampleParts} from '../skillPresentation'
import {digitalHumanToolSkill} from '../toolSkills'
import type { ComposerReference, ComposerSegment, CreationCatalog, CreationEntryType, CreationParameterState, CreationTemplate, SystemSkill } from '../types'
import { skillExamples, localVisualStyles } from '../catalog'
import ReferenceMentionMenu from '~/features/library/components/ReferenceMentionMenu.vue'
import {activeMention} from '../workbenchRules'
import {modelDisplayName,modelDescription} from '../canvasNavigation'

const props = defineProps<{
  entry: CreationEntryType; skill: string; prompt: string; segments: ComposerSegment[]; references: ComposerReference[]
  parameters: CreationParameterState; catalog: CreationCatalog | null; templates: CreationTemplate[]; busy: boolean
  creditLabel: string; scriptFile: File | null; compact?: boolean; models: Array<{ code: string; name: string; description?: string; input_schema?: Record<string,any>;reference_pricing?:{credits:string;unit:string;note:string}|null }>
  ratios: string[]; resolutions: string[]; durationRange: { min: number; max: number; step?: number; values?: number[] }; musicSources: Array<{ id: string; label: string; cover?:string }>
  qualities?: string[]
  templateExample?: CreationTemplate | null
  showPlanner?:boolean; planningBusy?:boolean
  annotation?:{preview:string}|null
  conversational?:boolean
  working?:boolean; canStop?:boolean; stopReason?:string
  uploads?: Array<{ id: string; name: string; preview: string; progress: number | null; status: 'queued' | 'uploading' | 'failed' }>
  showLatest?:boolean
  docked?:boolean; minimized?:boolean; dockStyle?:Record<string,string>
  /** 只对应目录读取，不把生成、发送等业务过程伪装为加载占位。 */
  loading?:boolean
  /** 技能读取与校验状态，不冒充媒体生成进度。 */
  trialPending?:boolean
  /** 提示词替换历史由共用工作台持有，收起／展开不丢失。 */
  canUndoSkillPrompt?:boolean; skillPromptUndoReady?:boolean
}>()
const emit = defineEmits<{
  text: [prompt: string, segments: ComposerSegment[]]; skill: [id: string]; parameters: [patch: Partial<CreationParameterState>]
  upload: [files: File[]]; assets: []; remove: [index: number]; reorder: [index: number, delta: number]
  replace: [index: number, file: File]
  template: [template: CreationTemplate]; send: []; script: [file: File | null]
  reference: [value: ComposerReference]
  dismissUpload: [id: string]
  plan: []; stop: []
  latest: []
  tool: [id: string]
  expand: []; collapse: []
  undoSkillPrompt: []
}>()
const editor = ref<HTMLDivElement | null>(null), fileInput = ref<HTMLInputElement | null>(null)
/** 数量只接受 1–4 的整数，输入暂时清空时不把 NaN 写入草稿。 */
function updateCount(value:number|undefined){if(typeof value==='number'&&Number.isFinite(value))update({count:Math.min(4,Math.max(1,Math.round(value)))})}
/** 工具只把引用意图带回编辑器，定位到文字末尾；不模拟发送或触发收费。 */
async function focusInput(){await nextTick();if(!editor.value)return;editor.value.focus({preventScroll:true});const range=document.createRange();range.selectNodeContents(editor.value);range.collapse(false);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)}
defineExpose({focusInput})
// 仅显示积分数字，没有数值时隐藏整项；详细含义仍保留在读屏及悬停说明，不新增费用许可。
const creditNumber = computed(() => compactCreditNumber(props.creditLabel))
const popoverAnchor = ref<HTMLElement>()
const skillPopoverSide=ref<'top'|'bottom'>('top'),skillPopoverHeight=ref(422)
/** 只在打开时按四行菜单计算方向；全部／我的和分类筛选不触发重新翻转。 */
function lockSkillPlacement(){
  const anchor=popoverAnchor.value;if(!anchor)return
  const rect=anchor.getBoundingClientRect(),wanted=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--liv-skill-menu-height'))||422
  const above=Math.max(0,rect.top-20),below=Math.max(0,window.innerHeight-rect.bottom-20)
  skillPopoverSide.value=above>=wanted?'top':below>=wanted?'bottom':above>=below?'top':'bottom'
  skillPopoverHeight.value=Math.min(wanted,skillPopoverSide.value==='top'?above:below)
}
const popover = ref(''), query = ref(''), category = ref('全部'), mentionOpen = ref(false), mentionIndex = ref(0)
const composing = ref(false)
const mentionKind=computed<'image'|'video'|'music'|'drama'>(()=>props.entry==='drama'?'drama':isMusic.value?'music':isVideo.value?'video':'image')
const mentionMenu=ref<InstanceType<typeof ReferenceMentionMenu>|null>(null),mentionQuery=ref(''),mentionStyle=ref<Record<string,string>>({})
let mentionRange:Range|null=null
/** 光标锚点独立于工具栏，滚动和缩放时重算；视口下方不足时向上展开。 */
function positionMention(){if(!mentionOpen.value||!editor.value||!mentionRange)return;const caret=mentionRange.cloneRange();caret.collapse(false);let rect=caret.getBoundingClientRect();if(!rect.width&&!rect.height)rect=editor.value.getBoundingClientRect();const width=Math.min(350,window.innerWidth-24),height=340;const top=rect.bottom+height+10<window.innerHeight?rect.bottom+7:Math.max(12,rect.top-height-7);mentionStyle.value={position:'fixed',zIndex:'390',left:`${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`,top:`${top}px`,width:`${width}px`,maxHeight:`${window.innerHeight-top-12}px`,overflowY:'auto'}}
function selectMention(values:ComposerReference[]){if(!editor.value||!mentionRange)return;if(props.references.length+values.filter(value=>!props.references.some(item=>item.version_id===value.version_id)).length>12)return;const selection=window.getSelection();const range=mentionRange.cloneRange();if(!editor.value.contains(range.startContainer))return;range.deleteContents();for(const value of values){emit('reference',value);const chip=referenceNode(value.version_id,`@${value.name}`),space=document.createTextNode(' ');range.insertNode(chip);range.setStartAfter(chip);range.collapse(true);range.insertNode(space);range.setStartAfter(space);range.collapse(true)}selection?.removeAllRanges();selection?.addRange(range);mentionOpen.value=false;editor.value.focus();changed()}
const replacementIndex = ref<number | null>(null), previewImage = ref<{url:string;name:string} | null>(null), hiddenExample = ref('')
const hoverPreview = ref<{ url: string; name: string; style: Record<string, string> } | null>(null)
/** 按图片真实比例显示，最多缩小到视口内；悬浮预览独立挂载，不继承48px附件样式。 */
function showReferencePreview(event: MouseEvent, reference: ComposerReference) {
  const image = event.currentTarget as HTMLImageElement
  if (!image.naturalWidth || !image.naturalHeight) return
  const rect = image.getBoundingClientRect()
  const scale = Math.min(1, 320 / image.naturalWidth, (window.innerWidth - 24) / image.naturalWidth, (window.innerHeight - 24) / image.naturalHeight)
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale
  const top = rect.bottom + 8 + height <= window.innerHeight - 12 ? rect.bottom + 8 : Math.max(12, rect.top - height - 8)
  hoverPreview.value = { url: reference.preview_url, name: reference.name, style: { width: `${width}px`, height: `${height}px`, left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, top: `${top}px` } }
}
watch(() => props.references, () => { hoverPreview.value = null }, { deep: true })
const editorFocused = ref(false), animatedPlaceholder = ref('')
let placeholderTimer: ReturnType<typeof setTimeout> | null = null
/** 占位提示保持完整静态文本，聚焦与输入法组合期间不启动动画或重写输入。 */
function stopPlaceholder(){if(placeholderTimer)clearTimeout(placeholderTimer);placeholderTimer=null;animatedPlaceholder.value=placeholder.value}
function animatePlaceholder(){stopPlaceholder()}
const parameterButton = ref<HTMLButtonElement | null>(null), parameterPanelStyle = ref<Record<string, string>>({}), exampleVideoOpen = ref(false)
const skillButton = ref<HTMLButtonElement | null>(null)
/** 参数面板跟随按钮定位；会话底栏向上展开，首页保持向下，滚动时更新位置。 */
function positionParameters() {
  if (!['parameters', 'skill'].includes(popover.value)) return
  const anchor = popover.value === 'skill' ? skillButton.value : parameterButton.value
  if (!anchor) return
  if (window.innerWidth <= 600) { parameterPanelStyle.value = {}; return }
  // 中等桌面宽度下避免覆盖左侧导航，面板始终限制在创作主体内。
  const rect = anchor.getBoundingClientRect()
  const mainLeft = anchor.closest('.dashboard-main')?.getBoundingClientRect().left || anchor.closest('.creation-studio')?.getBoundingClientRect().left || 0
  const leftBoundary = Math.max(12, mainLeft + 12), width = Math.min(popover.value === 'skill' ? 460 : 500, window.innerWidth - leftBoundary - 12)
  if (popover.value === 'skill') {
    // 技能列表较高时限制在视口内，不让分类与搜索被页面顶部裁切。
    const height = Math.min(560, window.innerHeight - 24)
    parameterPanelStyle.value = { position: 'fixed', bottom: 'auto', top: `${Math.max(12, rect.top - height - 10)}px`, left: `${Math.min(Math.max(leftBoundary, rect.left), window.innerWidth - width - 12)}px`, width: `${width}px`, maxHeight: `${height}px`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    return
  }
  const placement = props.compact
    ? { top: 'auto', bottom: `${window.innerHeight - rect.top + 10}px`, maxHeight: `${Math.max(120, rect.top - 24)}px` }
    : { bottom: 'auto', top: `${rect.bottom + 10}px`, maxHeight: `${Math.max(120, window.innerHeight - rect.bottom - 24)}px` }
  parameterPanelStyle.value = { position: 'fixed', ...placement, left: `${Math.max(leftBoundary, Math.min(rect.right - width, window.innerWidth - width - 12))}px`, width: `${width}px`, overflowY: 'auto' }
}
// 按次与Token模型共享合法时长索引，不按采购计费方式分叉控件。
const sliderDurations=computed(()=>allowedDurations(props.durationRange,props.durationRange.min,props.durationRange.max))
const styleCategory = ref('全部'), styleScope = ref('all'), templateDialogOpen=ref(false)
const styleDialogOpen=ref(false)
/** 空自由技能使用目录中的真实自由能力，不凭显示名称扩大素材权限。 */
const styleReferenceAllowed=computed(()=>!!(selectedSkill.value||(!props.skill?props.catalog?.skills.find(row=>row.id==='free'):undefined))?.media_types.includes('image')&&props.references.length<12)
const recentStyles = ref<string[]>([]), recentTemplates = ref<string[]>([])
const placeholder = computed(() => !props.skill?'可以先聊聊想法，或选择技能开始创作。':skillExamples[props.skill] || '描述你希望创作的内容，输入 @ 引用素材。')
watch(placeholder,animatePlaceholder)
onMounted(animatePlaceholder)
onBeforeUnmount(stopPlaceholder)
// 所有已发布的音乐配方均按真实目录展示，不把剧情／动感 MV 硬编码过滤掉。
const skillList = computed(() => (props.catalog?.skills || []).filter(item => item.entries.includes(props.entry) && item.is_active!==false).map(item=>item.id==='song'?{...item,label:'音乐生成'}:item))
// 技能分类、说明和素材要求从数据库目录读取，不再与前端写死的配方分离。
const skillPresentation = computed(() => Object.fromEntries(skillList.value.map(item => [item.id, item])))
const skillCategory = ref('全部')
const skillScope = ref('all')
const skillCategories = computed(() => ['全部', ...new Set(skillList.value.map(item => item.category || '通用'))])
const visibleSkills = computed(() => skillList.value.filter(item => (skillScope.value !== 'mine' || item.kind === 'user') && (skillCategory.value === '全部' || item.category === skillCategory.value) && (!query.value || `${item.label}${item.description || ''}`.includes(query.value))))
// 专用口播工具在全部技能中展示，不进入“我的配方”，也不把未配置状态当作可生成。
const showDigitalHumanSkill = computed(() => !props.catalog?.skills.some(row=>row.home_showcase?.category==='presenter') && digitalHumanToolSkill.entries.includes(props.entry) && skillScope.value==='all' && (skillCategory.value==='全部'||skillCategory.value===digitalHumanToolSkill.category) && (!query.value||`${digitalHumanToolSkill.label}${digitalHumanToolSkill.description}`.includes(query.value)))
const selectedSkill = computed(() => skillList.value.find(item => item.id === props.skill))
// 仅实际技能变化触发，初次挂载不闪动；缩放使用transform，不推挤工具栏与发送按钮。
const skillPulse=ref(0)
watch(()=>props.skill,()=>{skillPulse.value++})
// 自由入口的未选技能历史值为空，显示与能力判断必须和明确 free 一致；其他入口不放宽权限。
const baseSkill = computed(()=>selectedSkill.value?.base_code || props.skill || (props.entry==='free'?'free':''))
const isInstrumental=computed(()=>baseSkill.value==='instrumental' || (['free','song'].includes(baseSkill.value) && !!props.parameters.extra.instrumental))
/** 自由音频仍保留自由技能，不把音乐专用技能错误放进自由入口。 */
function chooseMusicType(instrumental:boolean){if(['free','song'].includes(baseSkill.value))update({customLyrics:false,extra:{...props.parameters.extra,instrumental}});else {emit('skill','song');update({customLyrics:false,extra:{...props.parameters.extra,instrumental}})}}
const fileAccept = computed(() => props.entry === 'drama' ? '.txt,.docx,.pdf' : isMusic.value?'audio/*': (selectedSkill.value?.media_types || ['image', 'video', 'audio']).map(type => type === 'document' ? '.txt,.docx,.pdf' : `${type}/*`).join(','))
// 音乐入口也包含 MV；仅写歌使用曲风与音乐引擎，MV 必须沿用视觉风格目录。
const isMusic = computed(() => !isMv.value && (selectedSkill.value?.target === 'music' || props.entry === 'music' || (baseSkill.value==='free' && props.parameters.output==='music')))
const isMv = computed(() => (selectedSkill.value?.base_code || props.skill).startsWith('mv-'))
// 固定能力不暴露空模型菜单；自由创作仍保留跨图片、视频、音乐的切换入口。
const showModelSelector = computed(() => !isMv.value && (baseSkill.value === 'free' || (selectedSkill.value?.model_strategy !== 'fixed' && !isMusic.value && props.entry !== 'drama' && props.models.length > 1)))
// 显式输出只属于自由创作，切回图片技能后不能沿用上一视频的时长参数区。
const isVideo = computed(() => selectedSkill.value?.target === 'video' || (baseSkill.value === 'free' && props.parameters.output === 'video'))
// 导演模式时长为全片规划目标，不把单个生成镜头的秒数冒充整片长度。
const isDirectorProduction = computed(() => ['ad','story'].includes(baseSkill.value) && props.parameters.workflow === 'director')
const isImage = computed(() => !isMv.value && !isMusic.value && !isVideo.value && props.entry !== 'drama')
/** 所有入口固定六种常用比例，不追加模型扩展项；实际能否选择仍按能力校验。 */
const commonRatios = computed(() => ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'])
/** 比例显示不代表模型支持，按钮与实际更新必须使用同一能力校验。 */
function chooseAspectRatio(ratio:string){
  if(!props.ratios.includes(ratio)||isParameterLocked('aspectRatio'))return
  update({aspectRatio:ratio})
}
function ratioUnavailableReason(ratio:string){
  return !props.ratios.includes(ratio)?'当前模型或制作流程不支持此比例，请切换兼容模型或入口':isParameterLocked('aspectRatio')?'当前技能已固定比例':''
}
/** 用实际宽高比例绘制粗线框，横竖画幅不依赖同一个通用图标。 */
function ratioIconSize(ratio: string) {
  const [width=16, height=9] = ratio.split(':').map(Number), scale = 20 / Math.max(width, height)
  return { width: `${Math.round(width * scale)}px`, height: `${Math.round(height * scale)}px` }
}
const mentionItems = computed(() => props.references.filter(item => !query.value || item.name.includes(query.value)))
/** 后台 render_medium 是完整描述而非分类名，不能原样作为长按钮显示。 */
function styleGroup(item: { display_name: string; render_medium: string }) {
  const text = `${item.display_name} ${item.render_medium}`
  return /3D|三维|CG/.test(text) ? '3D' : /2D|二维|动画/.test(text) ? '2D' : /仙侠|国风/.test(text) ? '国风' : '写实'
}
const allStyles = computed(() => [...(props.entry === 'drama' || props.parameters.workflow === 'director' ? [] : localVisualStyles), ...(props.catalog?.styles || [])])
// 本地风格不写入 styleId，需用实际前缀反查名称；未知自定义风格也保留可清除入口。
const activeStyle=computed(()=>allStyles.value.find(item=>(!!props.parameters.styleId&&item.style_id===props.parameters.styleId)||((!!props.parameters.style)&&[item.runtime_style_prefix,item.display_name].includes(props.parameters.style))))
const activeStyleLabel=computed(()=>activeStyle.value?.display_name||props.parameters.style||'已选风格')
const hasActiveStyle=computed(()=>!!(props.parameters.style||props.parameters.styleId))
const styleItems = computed(() => allStyles.value.filter(item => (styleScope.value !== 'recent' || recentStyles.value.includes(item.style_id)) && (styleCategory.value === '全部' || styleGroup(item) === styleCategory.value) && (!query.value || item.display_name.includes(query.value))))
const styleCategories = computed(() => ['全部', ...new Set(allStyles.value.map(styleGroup))])
// MV 只展示比例，不把暂时收起的制作范围继续拼在参数摘要里。
// 质量名称只表达接口等级，不再用速度或“精细”替代，参数值与报价保持不变。
const parameterLabel = computed(() => isMv.value || props.entry==='drama' ? props.parameters.aspectRatio : isMusic.value ? props.skill==='lyric-video' ? '歌词视频' : isInstrumental.value ? '纯音乐' : `歌词 · ${{ m: '男声', f: '女声' }[String(props.parameters.extra.vocal_gender)] || '自动'}` : `${props.parameters.aspectRatio} · ${isVideo.value ? `${props.parameters.durationSec}s · ` : ''}${props.parameters.resolution}${!isVideo.value ? ` · ${{low:'低',medium:'中',high:'高'}[props.parameters.quality]}` : ''}`)
type ModelKind='image'|'video'|'music'
type ModelOption={code:string;name:string;description?:string;input_schema?:Record<string,any>;sort_order?:number;badges?:Array<{text:string;tone:string}>;reference_pricing?:{credits:string;unit:string;note:string}|null}
const modelKind=ref<ModelKind>('image'),modelListRoot=ref<HTMLElement|null>(null)
let modelScrollTarget:{top:number;kind:ModelKind}|null=null
const modelSections: Array<{kind:ModelKind;label:string;icon:string}>=[{kind:'image',label:'图片',icon:'i-lucide-image'},{kind:'video',label:'视频',icon:'i-lucide-video'},{kind:'music',label:'音频',icon:'i-lucide-music'}]
/** 分组浏览与已选模型完全分离，滚动和切 Tab 不发送参数更新。 */
function modelsFor(kind:ModelKind):ModelOption[]{
  if(baseSkill.value!=='free'&&kind!==(isMusic.value?'music':isVideo.value?'video':'image'))return []
  if(kind==='music')return (props.catalog?.capabilities?.platform.music.enabled??props.catalog?.music_operations.some(row=>row.operation==='generation'&&row.enabled))?[{code:'',name:'Suno · 音乐引擎',description:'文字生成歌曲或纯音乐，引擎版本由后台配置。'}]:[]
  if(baseSkill.value!=='free')return props.models
  const resolved=props.catalog?.skill_models?.[`${props.skill||'free'}:${kind}`]
  if(resolved)return resolved
  const profile=props.catalog?.profiles[kind==='video'?'product_video':'product_image']
  return profile?[profile.model,...(profile.supports_user_model_selection?profile.allowed_models.filter(row=>row.code!==profile.model.code):[])]:[]
}
const modelGroups=computed(()=>modelSections.map(section=>({...section,items:[...modelsFor(section.kind)].sort((a,b)=>(a.sort_order??100)-(b.sort_order??100)||a.code.localeCompare(b.code))})).filter(section=>section.items.length))
function scrollModelGroup(kind:ModelKind){
  const root=modelListRoot.value,section=root?.querySelector<HTMLElement>(`[data-model-kind="${kind}"]`)
  if(root&&section){modelKind.value=kind;root.scrollTo({top:section.offsetTop,behavior:'instant'});modelScrollTarget={top:root.scrollTop,kind}}
}
function syncModelGroup(){
  const root=modelListRoot.value
  if(!root)return
  // 末组不足一屏时滚动会被浏览器截短，保留显式 Tab 意图，直到用户真正继续滚动。
  if(modelScrollTarget&&Math.abs(root.scrollTop-modelScrollTarget.top)<1){modelKind.value=modelScrollTarget.kind;return}
  modelScrollTarget=null
  const groups=[...root.querySelectorAll<HTMLElement>('[data-model-kind]')]
  // 最后一组可能不足一屏；到达底部时仍应激活音频，不能被上一组标题反抢。
  if(root.scrollHeight>root.clientHeight&&root.scrollTop+root.clientHeight>=root.scrollHeight-2){modelKind.value=(groups.at(-1)?.dataset.modelKind||modelKind.value) as ModelKind;return}
  const current=groups.filter(section=>section.offsetTop<=root.scrollTop+16).at(-1)||groups[0]
  if(current)modelKind.value=current.dataset.modelKind as ModelKind
}
watch(popover,value=>{if(value==='model')void nextTick(()=>scrollModelGroup(modelKind.value))})
/** 选定媒体模型时才把空技能归一为自由技能，不清空草稿或根据当前作品切换技能。 */
function chooseModel(code:string,kind:ModelKind=modelKind.value){
  modelKind.value=kind
  if(baseSkill.value==='free'&&!props.skill)emit('skill','free')
  update({model:code,...(baseSkill.value==='free'?{output:modelKind.value}:{})})
  popover.value=''
}
function open(name: string, event?: MouseEvent) { if(name==='style'&&!isMusic.value){popover.value='';mentionOpen.value=false;styleDialogOpen.value=true;return}if(event?.currentTarget instanceof HTMLElement)popoverAnchor.value=event.currentTarget; if(name==='skill'&&popover.value!=='skill')lockSkillPlacement();if(name==='model')modelKind.value=isMusic.value?'music':isVideo.value?'video':'image';popover.value = popover.value === name ? '' : name; query.value = ''; category.value = '全部'; skillCategory.value = '全部'; mentionOpen.value = false; if (['parameters', 'skill'].includes(popover.value)) void nextTick(positionParameters) }
function isParameterLocked(key: string){return !!selectedSkill.value?.allowed_parameter_keys && !selectedSkill.value.allowed_parameter_keys.includes(key)}
function update(patch: Partial<CreationParameterState>) { emit('parameters', Object.fromEntries(Object.entries(patch).filter(([key])=>!['aspectRatio','durationSec','resolution','quality','count','style'].includes(key) || !isParameterLocked(key)))) }
function chooseSkill(item: SystemSkill) { emit('skill', item.id); popover.value = '' }
/** 最近使用只保存公开预设编号，不存提示词、账号信息或文件地址。 */
function remember(key: string, id: string, values: typeof recentStyles) {
  values.value = [id, ...values.value.filter(value => value !== id)].slice(0, 12)
  try { localStorage.setItem(key, JSON.stringify(values.value)) } catch { /* 浏览器禁用本地存储时不影响创作。 */ }
}
function chooseStyle(item: NonNullable<CreationCatalog['styles']>[number]) { if(isParameterLocked('style')||props.busy)return;update({ style: item.runtime_style_prefix || item.display_name, styleId: item.style_id.startsWith('local-') ? '' : item.style_id }); remember('creation-recent-styles', item.style_id, recentStyles); styleDialogOpen.value=false;popover.value = '' }
/** 个人风格沿用资料库固定版本引用，不把图片地址冒充后台注册风格编号。 */
function chooseImageStyle(item:LibraryItem){
  const version=item.versions[0];if(!version||props.busy||isParameterLocked('style')||!styleReferenceAllowed.value)return
  emit('reference',{item_id:item.id,version_id:version.id,name:item.name,media_type:'image',purpose:'reference',preview_url:libraryService.previewUrl(version.preview_url)})
  update({style:`参考已上传图片「${item.name}」的视觉风格、色彩与材质，不复制其主体；保留当前创作需求。`,styleId:''})
  styleDialogOpen.value=false
}
/** 清除仅移除风格正文与编号，不改写用户文字、素材、模型或规格。 */
function clearStyle(){if(isParameterLocked('style'))return;update({style:'',styleId:''});popover.value=''}
function chooseTemplate(item: CreationTemplate) { emit('template', item); remember('creation-recent-templates', item.id, recentTemplates); templateDialogOpen.value=false; popover.value = '' }
/** 模板使用独立大弹窗；只关闭工具浮层，不清空编辑器、附件或已选参数。 */
function openTemplates(){popover.value='';mentionOpen.value=false;templateDialogOpen.value=true}

/** 编辑器只读取文字和固定素材标签，绝不保存粘贴的 HTML。 */
function readSegments(): ComposerSegment[] {
  const result: ComposerSegment[] = []
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) { if (node.textContent) result.push({ type: 'text', text: node.textContent }); return }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.reference) { result.push({ type: 'reference', version_id: node.dataset.reference, label: node.textContent || '' }); return }
    if (node.dataset.templateField) { result.push({ type: 'text', text: node.textContent || '', field: node.dataset.templateField }); return }
    if (node.tagName === 'BR') { result.push({ type: 'text', text: '\n' }); return }
    for (const child of node.childNodes) visit(child)
    if (['DIV', 'P'].includes(node.tagName)) result.push({ type: 'text', text: '\n' })
  }
  for (const node of editor.value?.childNodes || []) visit(node)
  return result
}
function changed() {
  if (composing.value) return
  const segments = readSegments()
  // 删除已有标签也移除对应附件；未插入文字的普通附件不受影响。
  const removed=props.segments.filter(part=>part.type==='reference'&&!segments.some(value=>value.type==='reference'&&value.version_id===part.version_id))
  for(const part of removed){if(part.type==='reference'){const index=props.references.findIndex(value=>value.version_id===part.version_id);if(index>=0)emit('remove',index)}}
  emit('text', segments.map(part => part.type === 'text' ? part.text : part.label).join(''), segments)
  const selection = window.getSelection()
  let cursorNode=selection?.anchorNode||null,cursorOffset=selection?.anchorOffset||0
  // 粘贴或程序填入后光标可能落在元素边界，向前定位文字节点，但不跨过素材标签。
  if(cursorNode?.nodeType===Node.ELEMENT_NODE&&cursorOffset>0){let previous:Node|null=cursorNode.childNodes[cursorOffset-1]||null;while(previous instanceof HTMLElement&&previous.contentEditable!=='false'&&previous.lastChild)previous=previous.lastChild;if(previous?.nodeType===Node.TEXT_NODE){cursorNode=previous;cursorOffset=previous.textContent?.length||0}}
  const before = cursorNode?.nodeType === Node.TEXT_NODE ? (cursorNode.textContent || '').slice(0,cursorOffset) : ''
  const match = activeMention(before,before.length)
  mentionOpen.value = Boolean(match)
  if (match && selection?.rangeCount && cursorNode) { mentionQuery.value=match.query;mentionRange=selection.getRangeAt(0).cloneRange();mentionRange.setStart(cursorNode,match.start);popover.value='';nextTick(positionMention) }
}
/** 外部模板和历史恢复用 DOM 文本节点重建，避免 XSS 及中文输入法被重置。 */
function renderText() {
  if (!editor.value || composing.value) return
  const current = readSegments().map(part => part.type === 'text' ? part.text : part.label).join('')
  if (current === props.prompt) return
  editor.value.replaceChildren()
  const segments = props.segments.length ? props.segments : [{ type: 'text' as const, text: props.prompt }]
  for (const part of segments) {
    if (part.type === 'text' && part.field) {
      // 字段内容直接在原位编辑；文本节点赋值避免模板注入 HTML。
      const field = document.createElement('span')
      field.dataset.templateField = part.field; field.className = 'creation-template-field'
      field.textContent = part.text; field.title = `点击修改${part.field}`
      editor.value.append(field)
    }
    else if (part.type === 'text') editor.value.append(document.createTextNode(part.text))
    else editor.value.append(referenceNode(part.version_id, part.label))
  }
}
/** 点击模板高亮字段时选中该字段，用户可直接输入替换，不影响素材引用标签。 */
function selectTemplateField(event: MouseEvent) {
  const field = (event.target as HTMLElement).closest<HTMLElement>('[data-template-field]')
  if (!field || !editor.value?.contains(field)) return
  const range = document.createRange(); range.selectNodeContents(field)
  const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
}
function referenceNode(id: string, label: string) {
  const chip = document.createElement('span')
  chip.contentEditable = 'false'; chip.dataset.reference = id; chip.className = 'creation-reference-chip'; chip.textContent = label
  return chip
}
function mention(item: ComposerReference) {
  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : document.createRange()
  if (!editor.value) return
  if (!selection?.anchorNode || !editor.value.contains(selection.anchorNode)) { range.selectNodeContents(editor.value); range.collapse(false) }
  else if (selection.anchorNode.nodeType === Node.TEXT_NODE) {
    const before = (selection.anchorNode.textContent || '').slice(0, selection.anchorOffset)
    const start = before.lastIndexOf('@')
    if (start >= 0 && mentionOpen.value) range.setStart(selection.anchorNode, start)
  }
  range.deleteContents()
  const chip = referenceNode(item.version_id, `@${item.name}`), space = document.createTextNode(' ')
  range.insertNode(space); range.insertNode(chip); range.setStartAfter(space); range.collapse(true)
  selection?.removeAllRanges(); selection?.addRange(range)
  mentionOpen.value = false; editor.value.focus(); changed()
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing || composing.value) return
  // 只拦截当前技能填入的撤销；普通打字、Shift+Ctrl+Z和输入法仍遵循原生编辑行为。
  if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&event.key.toLowerCase()==='z'&&props.skillPromptUndoReady&&!props.busy&&!props.working){event.preventDefault();emit('undoSkillPrompt');return}
  if (mentionOpen.value) {
    if (event.key === 'Escape') { event.preventDefault(); mentionOpen.value = false; return }
    if (mentionMenu.value?.keydown(event)) return
  }
  // 只有空输入、正向 Tab 且无运行任务时才接受公开技能示例；Shift+Tab 保持键盘导航。
  if(event.key==='Tab'&&!event.shiftKey&&!props.busy&&!props.working&&!props.prompt.trim()&&skillExample(selectedSkill.value)){event.preventDefault();const parts=skillExampleParts(selectedSkill.value);emit('text',parts.map(part=>part.text).join(''),parts);nextTick(renderText)}
  // 输入法与引用菜单已优先处理；普通回车发送，Shift+回车保留编辑器原生换行。
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!props.busy && !props.working && props.prompt.trim()) emit('send') }
}
const dragDepth = ref(0)
/** 三种入口复用现有权限、技能兼容和固定版本流程，拖入 URL 或网页 HTML 不当作文件。 */
function acceptFiles(files: File[]) {
  if (!files.length || props.busy) return
  if (props.entry === 'drama') emit('script', files[0] || null)
  else emit('upload', files)
}
function dragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault(); dragDepth.value++
}
function dragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault(); if(event.dataTransfer)event.dataTransfer.dropEffect = props.busy ? 'none' : 'copy'
}
function dropFiles(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault(); event.stopPropagation(); dragDepth.value = 0
  acceptFiles(Array.from(event.dataTransfer.files))
}
function paste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files || [])
  if (files.length) { event.preventDefault(); acceptFiles(files); return }
  // 非编辑器的其他输入框继续使用原生文字粘贴，避免错误插入到创作正文。
  if (!editor.value?.contains(event.target as Node)) return
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') || ''
  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  if (!range) return
  range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); changed()
}
function filesChanged(event: Event) {
  const input = event.target as HTMLInputElement
  if (replacementIndex.value !== null) {
    const file=input.files?.[0];if(file)emit('replace',replacementIndex.value,file)
    replacementIndex.value=null;input.value='';return
  }
  acceptFiles(Array.from(input.files || []))
  input.value = ''
}
/** 浮层与素材菜单均支持 Esc 关闭，不拦截编辑器其他按键。 */
function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') { popover.value = ''; mentionOpen.value = false } }
watch(() => [props.prompt, props.segments], () => nextTick(renderText), { deep: true })
onMounted(() => {
  window.addEventListener('keydown', closeOnEscape)
  window.addEventListener('resize', positionParameters)
  window.addEventListener('scroll', positionParameters, true)
  window.addEventListener('scroll',positionMention,true)
  window.addEventListener('resize',positionMention)
  renderText()
  try { recentStyles.value = JSON.parse(localStorage.getItem('creation-recent-styles') || '[]'); recentTemplates.value = JSON.parse(localStorage.getItem('creation-recent-templates') || '[]') } catch { /* 损坏的预设缓存直接忽略。 */ }
})
watch(() => props.templateExample?.id, () => { exampleVideoOpen.value = false })
onBeforeUnmount(() => { window.removeEventListener('scroll',positionMention,true);window.removeEventListener('resize',positionMention);window.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', positionParameters); window.removeEventListener('scroll', positionParameters, true) })
</script>

<template>
  <!-- 报价和创建请求期间锁定输入，展示的费用始终对应这一份确认草稿。 -->
  <section class="creation-composer" :style="docked ? dockStyle : undefined" :class="{ 'is-drama': entry === 'drama', 'is-mv': isMv, 'is-compact': compact, 'is-dragging': dragDepth > 0, 'is-docked':docked, 'is-minimized':docked && minimized }" @paste="paste" @dragenter="dragEnter" @dragover="dragOver" @dragleave="dragDepth=Math.max(0,dragDepth-1)" @drop="dropFiles" @keydown.esc="popover = ''; mentionOpen = false; dragDepth=0">
    <!-- 首页只收起同一个编辑器的呈现，不复制输入框、清空草稿或自动发送。 -->
    <button v-if="docked && minimized" class="creation-dock-launcher" aria-label="展开创作输入框" aria-expanded="false" @click="emit('expand')"><UIcon name="i-lucide-plus"/><span v-if="selectedSkill" class="creation-dock-skill" :title="selectedSkill.label"><UIcon name="i-lucide-zap"/>{{selectedSkill.label}}</span><span class="creation-dock-hint">{{prompt.trim() || '描述你的创意…'}}</span><span class="creation-dock-arrow"><UIcon name="i-lucide-arrow-up"/></span></button>
    <UButton v-if="docked && !minimized" class="creation-dock-collapse" icon="i-lucide-chevron-down" aria-label="收起创作输入框" color="neutral" variant="ghost" square @click="emit('collapse')"/>
    <!-- 按钮跟随输入框真实顶部，而不是按固定高度猜位置；正文变长也不遮挡输入。 -->
    <UTooltip v-if="showLatest" text="回到最新" :delay-duration="0" :content="{ side: 'top', sideOffset: 8, avoidCollisions: false }"><UButton class="liv-back-latest" icon="i-lucide-arrow-down" aria-label="回到最新" square color="neutral" variant="soft" @click="emit('latest')"/></UTooltip>
    <div v-if="dragDepth > 0" class="creation-drop-hint">松开即可添加素材</div>
    <div v-if="uploads?.length" class="creation-upload-list" aria-label="素材上传进度">
      <div v-for="item in uploads" :key="item.id" class="creation-upload-thumb" :title="item.name">
        <img v-if="item.preview" :src="item.preview" :alt="item.name"><UIcon v-else name="i-lucide-file-up" />
        <span class="creation-upload-status">{{item.status==='failed'?'上传失败':item.status==='queued'?'等待上传':item.progress===100?'正在处理':item.progress===null?'上传中':`${item.progress}%`}}</span>
        <div v-if="item.status!=='failed'" class="creation-upload-track" role="progressbar" :aria-label="`${item.name} 上传进度`" :aria-valuenow="item.progress ?? undefined" aria-valuemin="0" aria-valuemax="100"><i :class="{'is-indeterminate':item.progress===null}" :style="{width:item.progress===null?'35%':`${item.progress}%`}" /></div>
        <button v-else class="remove" :aria-label="`移除失败上传 ${item.name}`" @click="emit('dismissUpload',item.id)">×</button>
      </div>
    </div>
    <input ref="fileInput" class="creation-hidden" type="file" :multiple="entry !== 'drama'" :accept="fileAccept" @change="filesChanged">
    <!-- 三项仍是原有输入方式，只改变页签呈现；切换清除文件选择，不丢弃已输入的文字。 -->
    <UTabs v-if="entry==='drama'" class="creation-drama-tabs" :model-value="String(parameters.extra.director_input_mode || 'file')" :content="false" :items="[{value:'file',label:'上传剧本',icon:'i-lucide-paperclip',disabled:busy},{value:'script',label:'粘贴剧本',icon:'i-lucide-clipboard-paste',disabled:busy},{value:'idea',label:'描述想法',icon:'i-lucide-pencil-line',disabled:busy}]" :ui="{list:'creation-drama-tab-list',trigger:'creation-drama-tab',indicator:'creation-drama-tab-indicator',leadingIcon:'creation-drama-tab-icon'}" @update:model-value="value=>{emit('script',null);update({extra:{...parameters.extra,director_input_mode:value}})}"/>
    <div v-if="entry === 'drama' && (!parameters.extra.director_input_mode || parameters.extra.director_input_mode==='file')" class="creation-script-upload">
      <UIcon name="i-lucide-file-up" class="large-icon" />
      <!-- 空态仅保留上传动作；选中文件后展示名称，格式与大小说明放到按钮下方。 -->
      <h3 v-if="scriptFile">{{ scriptFile.name }}</h3>
      <button class="creation-pill active" @click="fileInput?.click()"><UIcon name="i-lucide-upload" />{{ scriptFile ? '更换文件' : '上传文件' }}</button>
      <p>{{ scriptFile ? `${(scriptFile.size / 1024).toFixed(0)} KB · 已准备好` : 'TXT、DOCX、PDF · 最大 20 MB' }}</p>
      <button v-if="scriptFile" class="creation-subtle" @click="emit('script', null)">移除</button>
    </div>
    <template v-else-if="skill==='lyric-video' && entry === 'music'">
      <div class="creation-mv-source"><UIcon name="i-lucide-film" class="large-icon" /><h3>把你的歌曲制作成歌词视频</h3><p>当前支持歌词视频，选择本人已完成的歌曲继续。</p><LivSelect :value="parameters.sourceTask" @change="update({ sourceTask: ($event.target as HTMLSelectElement).value })"><option value="">选择已完成歌曲</option><option v-for="source in musicSources" :key="source.id" :value="source.id">{{ source.label }}</option></LivSelect></div>
    </template>
    <template v-else>
      <!-- MV 先选择歌曲，空素材区不再占位；音频来源由同一个选歌弹窗管理。 -->
      <slot v-if="isMv" name="audio-source" />
      <div v-if="(!compact && !isMv) || annotation || references.length || (!isMv && isMusic && templateExample && hiddenExample!==templateExample.id)" class="creation-attachments">
        <div v-if="annotation" class="creation-annotation-thumb" aria-label="批注预览"><img :src="annotation.preview" alt="批注"><span>批注</span></div>
        <button v-if="!compact && !isMv && entry!=='drama'" class="creation-add" aria-label="添加素材" @click="open('add', $event)"><UIcon name="i-lucide-plus" /></button>
        <div v-if="!isMv && isMusic && templateExample && hiddenExample!==templateExample.id" class="creation-attachment"><img :src="templateExample.example_image || templateExample.cover" :alt="templateExample.name" @click="previewImage={url:templateExample.example_image || templateExample.cover,name:templateExample.name}"><button class="remove" aria-label="移除示意封面" @click="hiddenExample=templateExample.id">×</button><small class="cover-only">封面预览</small></div>
        <div v-for="(reference, index) in references" v-show="!annotation||reference.media_type!=='image'" :key="reference.version_id" class="creation-attachment" :class="{'is-song-card':reference.media_type==='audio'}" :title="reference.name">
          <!-- 音频地址不能交给 img；歌曲使用独立封面，缺封面显示设计占位，不伪造图片。 -->
          <template v-if="reference.media_type==='audio'"><div class="creation-song-cover"><img v-if="reference.cover_url||musicSources.find(item=>item.id===parameters.sourceTask)?.cover" :src="reference.cover_url||musicSources.find(item=>item.id===parameters.sourceTask)?.cover" alt="歌曲封面" @error="($event.target as HTMLImageElement).style.display='none'"><UIcon name="i-lucide-disc-3"/></div><div class="creation-song-copy"><strong>{{reference.name}}</strong><small>{{isMv?'MV 歌曲来源':'音频素材'}} · 已引用</small></div><UButton icon="i-lucide-x" aria-label="移除歌曲" :disabled="busy" color="neutral" variant="ghost" square @click="emit('remove',index)"/></template>
          <template v-else>
          <img v-if="reference.media_type === 'image'" :src="reference.preview_url" :alt="reference.name" @mouseenter="showReferencePreview($event,reference)" @mouseleave="hoverPreview=null" @click="hoverPreview=null;previewImage={url:reference.preview_url,name:reference.name}"><UIcon v-else :name="reference.media_type === 'audio' ? 'i-lucide-audio-lines' : 'i-lucide-film'" />
          <span>{{ index + 1 }}</span><button class="remove" :aria-label="`移除 ${reference.name}`" @click="emit('remove', index)">×</button>
          <button class="attachment-replace" :aria-label="`替换 ${reference.name}`" @click="replacementIndex=index;fileInput?.click()"><UIcon name="i-lucide-refresh-cw"/></button>
          </template>
        </div>
      </div>
      <div class="creation-editor-wrap" :class="{'has-skill-prompt-undo':canUndoSkillPrompt}">
        <!-- 恢复卡片置于正文首行前，独立于可编辑内容，复制与发送不携带按钮文案。 -->
        <UButton v-if="canUndoSkillPrompt" class="creation-skill-prompt-undo" color="neutral" variant="soft" size="xs" :disabled="busy||working" aria-label="恢复原提示词" @click="emit('undoSkillPrompt')">Ctrl+Z 恢复原提示词</UButton>
        <UTooltip v-if="showPlanner" text="整理需求" :delay-duration="0" :content="{ side: 'top', sideOffset: 6, avoidCollisions: false }"><button class="creation-plan-icon" aria-label="整理需求" :disabled="planningBusy||busy||!prompt.trim()" @click="emit('plan')"><UIcon :name="planningBusy?'i-lucide-loader-circle':'i-lucide-wand-sparkles'"/></button></UTooltip><div ref="editor" class="creation-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="创作需求" @click="selectTemplateField" @input="changed" @keydown="keydown" @focus="editorFocused=true;stopPlaceholder()" @blur="editorFocused=false" @compositionstart="composing = true;stopPlaceholder()" @compositionend="composing = false; changed()" />
        <p v-if="!prompt.trim()" class="creation-placeholder">{{skillExample(selectedSkill)?'按下 Tab 键填入以下参考示例：\n'+skillExampleParts(selectedSkill).map(part=>part.text).join(''):isMv?'描述 MV 创意，可直接粘贴歌词；纯音乐请在这里说明。':'说说想法，拖拽／粘贴素材，输入 @ 引用资料库。'}}</p>
      </div>
      <Teleport to="body"><div v-if="mentionOpen" :style="mentionStyle"><ReferenceMentionMenu ref="mentionMenu" :query="mentionQuery" :kind="mentionKind" :model="parameters.model" :allowed-media-types="selectedSkill?.media_types||['image','document']" :existing="references" @select="selectMention" @browse="mentionOpen=false;emit('assets')" @close="mentionOpen=false"/></div></Teleport>
      <div v-if="baseSkill === 'story'" class="creation-workflow"><button v-if="selectedSkill?.workflows.includes('direct')" :class="{ active: parameters.workflow === 'direct' }" @click="update({ workflow: 'direct' })"><UIcon name="i-lucide-zap" />直接生成</button><button v-if="selectedSkill?.workflows.includes('director')" :class="{ active: parameters.workflow === 'director' }" @click="update({ workflow: 'director' })"><UIcon name="i-lucide-clapperboard" />故事导演制作</button></div>
      <!-- 输出类型由模型选择统一确定，避免与模型浮层的图片／视频／音频分类重复。 -->
    </template>
    <DashboardSkeleton v-if="loading" variant="toolbar" aria-label="正在加载创作工具栏"/>
    <template v-else>
    <footer class="creation-toolbar">
      <!-- 工具提示零延迟显示在图标上方，禁用自动翻转；浮层挂到页面根部，避免窄栏裁切。 -->
      <!-- 大输入框保留上方上传入口，底栏不重复加号；紧凑输入框仍保留唯一素材入口。 -->
      <UTooltip v-if="compact && !isMv && entry!=='drama'" :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" text="添加素材：上传文件或从资料库选择"><button class="creation-tool creation-compact-add" aria-label="添加素材" :aria-expanded="popover==='add'" @click="open('add', $event)"><UIcon name="i-lucide-plus" /></button></UTooltip>
      <!-- 使用现有闪电图标的 SVG 模式填充实心，不新增平行图标资源。 -->
      <UTooltip v-if="entry!=='drama'" :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" :text="`选择技能：${selectedSkill?.label || '技能'}`"><button ref="skillButton" class="creation-tool creation-skill" aria-label="选择创作技能" :aria-busy="trialPending" :disabled="trialPending" @click="open('skill', $event)"><span :key="skillPulse" class="creation-skill-feedback" :class="{'is-switched':skillPulse>0&&!trialPending}"><UIcon :name="trialPending?'i-lucide-loader-circle':'i-lucide-zap'" mode="svg" :class="trialPending?'animate-spin':'creation-solid-zap'" /><span class="creation-skill-label">{{ trialPending?'正在准备…':selectedSkill?.label || '自由创作' }}</span></span><UIcon name="i-lucide-chevron-down" /></button></UTooltip>
      <!-- 单引擎也保留可聚焦按钮，自由创作可切回其他媒体。 -->
      <!-- MV 使用服务端导演制作链，不把写歌引擎冒充其固定制作模型。 -->
      <UTooltip v-if="showModelSelector" :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" :text="`模型：${isMusic?'音乐引擎':models.find(item=>item.code===parameters.model)?.name||'模型'}`"><button class="creation-tool creation-icon-tool" aria-label="选择模型" @click="open('model',$event)"><UIcon name="i-lucide-boxes"/><span class="creation-tool-label">{{isMusic?'音乐引擎':models.find(item=>item.code===parameters.model)?.name||'模型'}}</span></button></UTooltip>
      <div v-if="hasActiveStyle" class="creation-selected-style">
        <UTooltip :text="activeStyleLabel" :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }"><button type="button" class="creation-selected-style-open" :aria-label="`更换风格：${activeStyleLabel}`" :disabled="isParameterLocked('style')" @click="open('style',$event)"><img v-if="activeStyle?.cover_url" :src="activeStyle.cover_url" alt=""><UIcon v-else name="i-lucide-palette"/><span class="creation-selected-style-label">{{activeStyleLabel}}</span></button></UTooltip>
        <UTooltip text="清除风格" :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }"><UButton type="button" class="creation-selected-style-clear" icon="i-lucide-x" aria-label="清除风格" square color="neutral" variant="solid" :disabled="isParameterLocked('style')" @click.stop="clearStyle"/></UTooltip>
      </div>
      <UTooltip v-else :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" text="选择风格"><button class="creation-tool creation-icon-tool" aria-label="选择风格" :disabled="isParameterLocked('style')" @click="open('style', $event)"><UIcon name="i-lucide-palette" /><span class="creation-tool-label">风格</span></button></UTooltip>
      <!-- 只隐藏短剧输入框模板入口，案例复刻及关联模板保留。 -->
      <UTooltip v-if="entry!=='drama'" :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" text="选择创作模板"><button class="creation-tool creation-icon-tool" aria-label="选择创作模板" @click="openTemplates"><UIcon name="i-lucide-lightbulb" /><span class="creation-tool-label">模板</span></button></UTooltip>
      <div class="creation-toolbar-spacer" />
      <!-- 参数、积分和发送不可拆行；积分始终紧贴发送按钮左侧。 -->
      <div class="creation-submit-actions">
      <UTooltip :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" :text="`创作参数：${parameterLabel}`"><button ref="parameterButton" class="creation-param creation-icon-tool" :aria-label="isMv?'调整 MV 比例':'调整创作参数'" :aria-expanded="popover === 'parameters'" @click="open('parameters', $event)"><UIcon :name="isMv?'i-lucide-rectangle-horizontal':'i-lucide-sliders-horizontal'" /><span class="creation-tool-label">{{ parameterLabel }}</span><UIcon v-if="!compact" name="i-lucide-chevron-down" /></button></UTooltip>
      <span class="creation-cost" v-if="creditNumber" role="status" :aria-label="creditLabel" :title="creditLabel"><CreditIcon size="xs" />{{ creditNumber }}</span>
      <UTooltip :delay-duration="0" :content="{ side: 'top', align: 'center', sideOffset: 8, avoidCollisions: false }" :text="working||busy ? stopReason||'处理中，暂不能中断当前请求' : `预估费用并继续创作 · ${creditLabel}`"><button class="creation-send" :class="{'is-working':working||busy}" :disabled="working||busy ? !canStop : false" :aria-label="working||busy ? (canStop?'停止整理需求':'生成进行中，暂不支持暂停') : conversational ? '发送给 Liv 创作助手' : '预估费用并继续创作'" @click="working||busy ? (canStop&&emit('stop')) : emit('send')"><span v-if="working||busy" class="creation-stop-square" aria-hidden="true"/><UIcon v-else name="i-lucide-arrow-up" /></button></UTooltip>
      </div>
    </footer>
    </template>
    <!-- 工具浮层统一复用 Nuxt UI 的锚定与外部点击关闭行为。 -->
    <UPopover :open="!!popover" :reference="popoverAnchor" :content="{side:popover==='skill'?skillPopoverSide:'top',align:'start',sideOffset:8,collisionPadding:12,avoidCollisions:popover!=='skill'}" :ui="{content:'bg-transparent shadow-none ring-0 z-[200]'}" @update:open="value=>{if(!value)popover=''}"><template #content>
    <div v-if="popover" class="creation-popover" :class="{ 'is-wide': ['style', 'templates'].includes(popover), 'is-skills': popover === 'skill', 'is-mv-ratios': popover === 'parameters' && isMv, 'is-music-parameters': popover === 'parameters' && isMusic && !isMv, 'is-parameters': popover === 'parameters', 'is-models': popover === 'model', 'is-add-menu': popover === 'add' }" :style="{position:'relative',inset:'auto',width:popover==='parameters'?'min(var(--liv-creation-parameters-width), calc(100vw - 24px))':popover==='skill'?'min(var(--liv-skill-menu-width), calc(100vw - 24px))':popover==='model'?'min(320px, calc(100vw - 24px))':popover==='add'?'min(260px, calc(100vw - 24px))':['style','templates'].includes(popover)?'min(460px, calc(100vw - 24px))':'min(500px, calc(100vw - 24px))',height:popover==='skill'?`${skillPopoverHeight}px`:undefined,maxHeight:popover==='skill'?`${skillPopoverHeight}px`:'min(560px, 75dvh)',overflowY:popover==='skill'?'hidden':'auto',display:'flex',flexDirection:'column'}">
      <header v-if="!['parameters','skill'].includes(popover)"><b>{{ ({ add: '添加素材', model: '选择模型', style: '选择风格', templates: '创作模板' } as Record<string, string>)[popover] }}</b><button aria-label="关闭选项" @click="popover = ''"><UIcon name="i-lucide-x" /></button></header>
      <button v-else-if="popover==='parameters'" class="creation-parameter-close" aria-label="关闭创作参数" @click="popover = ''"><UIcon name="i-lucide-x" /></button>
      <template v-if="popover === 'add'"><button class="creation-menu-row" @click="fileInput?.click(); popover = ''"><UIcon name="i-lucide-upload" />上传文件</button><button class="creation-menu-row" @click="emit('assets'); popover = ''"><UIcon name="i-lucide-folder-open" />从资料库选择</button></template>
<template v-else-if="popover === 'skill'"><div class="creation-filter creation-skill-tabs"><button :class="{active:skillScope==='all'}" @click="skillScope='all'">全部技能</button><button :class="{active:skillScope==='mine'}" @click="skillScope='mine'">我的</button></div><div class="creation-filter creation-skill-categories"><button v-for="name in skillCategories" :key="name" :class="{active:skillCategory===name}" @click="skillCategory=name">{{ name }}</button></div><div class="creation-skill-list" style="overflow-y:auto;min-height:0;flex:1"><button class="creation-skill-card" :class="{active:!skill || skill==='free'}" @click="emit('skill',catalog?.skills.some(item=>item.id==='free')?'free':'');popover=''"><img :src="catalog?.skills.find(item=>item.id==='free')?.cover || '/creation-presets/liv-creative-seed.png'" alt="自由创作"><span><b>自由创作</b><span>不限定技能，先聊聊你的想法</span></span></button><button v-if="showDigitalHumanSkill" class="creation-skill-card" @click="emit('tool','digital-human');popover=''"><img :src="digitalHumanToolSkill.cover" :alt="digitalHumanToolSkill.label"><span><b>{{digitalHumanToolSkill.label}}</b><span>{{digitalHumanToolSkill.description}}</span></span></button><button v-for="item in visibleSkills.filter(item=>item.id!=='free')" :key="item.id" class="creation-skill-card" :class="{active:item.id===skill}" @click="chooseSkill(item)"><img v-if="item.cover" :src="item.cover" :alt="item.label"><span><b>{{ item.label }}</b><span>{{ item.description }}</span></span><UIcon v-if="item.id===skill" name="i-lucide-check" /></button><p v-if="!visibleSkills.length&&!showDigitalHumanSkill">没有符合条件的技能。</p></div><NuxtLink to="/dashboard-skills" class="creation-pill" style="flex-shrink:0;margin:12px 0 0 auto;width:fit-content">＋ 创建技能</NuxtLink></template>
      <template v-else-if="popover === 'model'">
        <div class="creation-filter creation-model-tabs" role="tablist" aria-label="模型分类"><button v-for="section in modelSections" :key="section.kind" role="tab" :class="{active:modelKind===section.kind}" :aria-selected="modelKind===section.kind" :disabled="!modelGroups.some(group=>group.kind===section.kind)" @click="scrollModelGroup(section.kind)"><UIcon :name="section.icon"/>{{section.label}}</button></div>
        <div ref="modelListRoot" class="creation-model-list" @scroll.passive="syncModelGroup">
          <section v-for="group in modelGroups" :key="group.kind" :data-model-kind="group.kind"><h4>{{group.label}}</h4>
            <button v-for="item in group.items" :key="item.code||group.kind" class="creation-menu-row creation-model-row" :class="{active:item.code===parameters.model&&(group.kind==='music'?isMusic:isVideo?group.kind==='video':group.kind==='image')}" @click="chooseModel(item.code,group.kind)">
<span class="creation-model-icon"><UIcon :name="group.icon"/></span><span class="creation-model-copy"><b><span>{{modelDisplayName(item.name)}}</span><span v-for="(badge,index) in item.badges" :key="index" class="creation-model-badge" :data-tone="badge.tone">{{badge.text}}</span></b><small>{{modelDescription(item.description||'')||'按当前模型配置创作'}}</small></span>
              <UIcon name="i-lucide-check" :style="{visibility:item.code===parameters.model&&(group.kind==='music'?isMusic:isVideo?group.kind==='video':group.kind==='image')?'visible':'hidden'}"/>
            </button>
          </section>
          <p v-if="!modelGroups.length" class="creation-muted">暂无兼容模型。</p>
        </div>
      </template>
      <template v-else-if="popover === 'style'"><input v-model="query" placeholder="搜索风格" aria-label="搜索风格"><p v-if="isMusic" class="creation-muted">曲风直接填写，例如：流行、民谣、钢琴、电子。</p><input v-if="isMusic" :value="parameters.style" placeholder="填写曲风" @input="update({ style: ($event.target as HTMLInputElement).value })"><template v-else><div class="creation-filter"><button :class="{ active: styleScope === 'all' }" @click="styleScope = 'all'">全部风格</button><button :class="{ active: styleScope === 'recent' }" @click="styleScope = 'recent'">最近使用</button></div><div class="creation-filter"><button v-for="name in styleCategories" :key="name" :class="{ active: name === styleCategory }" @click="styleCategory = name">{{ name }}</button></div><div class="creation-style-grid"><button v-for="item in styleItems" :key="item.style_id" :class="{ active: parameters.styleId === item.style_id || parameters.style === item.runtime_style_prefix }" @click="chooseStyle(item)"><img v-if="item.cover_url" :src="item.cover_url" :alt="item.display_name"><UIcon v-else name="i-lucide-palette" /><b>{{ item.display_name }}</b><small>{{ styleGroup(item) }}</small></button></div><p v-if="!styleItems.length" class="creation-muted">没有符合条件的风格。</p></template></template>
      <template v-else-if="popover === 'parameters'">
        <!-- 暂时只开放 MV 画幅；历史范围参数仍原样保留，后端时长上限继续校验。 -->
        <div v-if="isMv" class="creation-parameter-fields"><label class="creation-ratio-field">比例<div class="creation-choice-row creation-ratio-options"><button v-for="ratio in commonRatios" :key="ratio" :class="{active:parameters.aspectRatio===ratio}" :disabled="!!ratioUnavailableReason(ratio)" :title="ratioUnavailableReason(ratio)" @click="chooseAspectRatio(ratio)"><span class="creation-ratio-icon-slot" aria-hidden="true"><span class="creation-ratio-icon" :style="ratioIconSize(ratio)"/></span><span>{{ratio}}</span></button></div></label></div>
        <template v-else-if="isMusic"><label>音乐类型<div class="creation-choice-row"><button :class="{active:!isInstrumental}" @click="chooseMusicType(false)">歌词</button><button :class="{active:isInstrumental}" @click="chooseMusicType(true)">纯音乐</button></div></label><label v-if="!isInstrumental">人声<div class="creation-choice-row"><button v-for="voice in [{id:'',label:'自动'},{id:'m',label:'男声'},{id:'f',label:'女声'}]" :key="voice.id" :class="{active:(parameters.extra.vocal_gender||'')===voice.id}" @click="update({extra:{...parameters.extra,vocal_gender:voice.id}})">{{ voice.label }}</button></div></label><label v-if="skill==='reference'">授权音频链接<input :value="parameters.sourceUrl" @input="update({sourceUrl:($event.target as HTMLInputElement).value})"></label><label v-if="['remix','lyric-video'].includes(skill)">来源作品<LivSelect :value="parameters.sourceTask" @change="update({sourceTask:($event.target as HTMLSelectElement).value})"><option value="">选择作品</option><option v-for="source in musicSources" :key="source.id" :value="source.id">{{ source.label }}</option></LivSelect></label></template>
        <div v-else class="creation-parameter-fields">
          <label class="creation-ratio-field">比例<div class="creation-choice-row creation-ratio-options"><button v-for="ratio in commonRatios" :key="ratio" :class="{ active: parameters.aspectRatio === ratio }" :disabled="!!ratioUnavailableReason(ratio)" :title="ratioUnavailableReason(ratio)" @click="chooseAspectRatio(ratio)"><span class="creation-ratio-icon-slot" aria-hidden="true"><span class="creation-ratio-icon" :style="ratioIconSize(ratio)" /></span><span>{{ ratio }}</span></button></div></label>
          <div v-if="isVideo" class="creation-duration-field"><CreationDurationSlider :model-value="parameters.durationSec" :values="sliderDurations" :label="isDirectorProduction?'目标总时长':'时长'" :disabled="isParameterLocked('durationSec')" @update:model-value="update({durationSec:$event})"/></div>
          <label v-if="entry!=='drama'">清晰度<div class="creation-choice-row"><button v-for="value in resolutions" :key="value" :class="{ active: parameters.resolution === value }" :disabled="isParameterLocked('resolution')" @click="update({ resolution: value })">{{ value }}</button></div></label>
          <label v-if="isImage">质量<div class="creation-choice-row"><button v-for="value in (qualities || ['low', 'medium', 'high'])" :key="value" :class="{ active: parameters.quality === value }" :disabled="isParameterLocked('quality')" @click="update({ quality: value as CreationParameterState['quality'] })">{{ ({ low: '低', medium: '中', high: '高' } as Record<string,string>)[value] || value }}</button></div></label>
          <label v-if="isImage">数量<UInputNumber class="creation-number-stepper" aria-label="生成数量" :model-value="parameters.count" :disabled="isParameterLocked('count')" :min="1" :max="4" :step="1" :format-options="{maximumFractionDigits:0}" :increment="{ 'aria-label':'增加数量' }" :decrement="{ 'aria-label':'减少数量' }" disable-wheel-change @update:model-value="updateCount"/></label>
        </div>
      </template>
    </div>
    </template></UPopover>
    <CreationTemplateDialog v-model:open="templateDialogOpen" :templates="templates" :recent="recentTemplates" @select="chooseTemplate"/>
    <CreationStyleDialog v-model:open="styleDialogOpen" :styles="allStyles" :recent="recentStyles" :selected="activeStyle?.style_id||''" :busy="busy||working||isParameterLocked('style')" :reference-allowed="styleReferenceAllowed" @select="chooseStyle" @reference="chooseImageStyle"/>
  </section>
  <Teleport to="body"><div v-if="hoverPreview" class="creation-reference-hover" :style="hoverPreview.style"><img :src="hoverPreview.url" :alt="hoverPreview.name"></div><div v-if="previewImage" class="creation-modal-backdrop" @click.self="previewImage=null"><section class="creation-case-preview creation-original-image"><header><h2>{{previewImage.name}}</h2><button aria-label="关闭图片预览" @click="previewImage=null">×</button></header><img :src="previewImage.url" :alt="previewImage.name"></section></div></Teleport>
  <Teleport to="body"><div v-if="exampleVideoOpen && templateExample?.preview_video" class="creation-modal-backdrop" @click.self="exampleVideoOpen = false"><section class="creation-case-preview" role="dialog" aria-modal="true" aria-label="模板示例视频"><header><h2>{{ templateExample.name }}</h2><button aria-label="关闭示例视频" @click="exampleVideoOpen = false"><UIcon name="i-lucide-x" /></button></header><video :src="templateExample.preview_video" controls autoplay playsinline preload="none" /><p>{{ templateExample.description }}</p></section></div></Teleport>
</template>

<style scoped>
/* 歌曲引用为完整横向媒体卡，不再把音频压成无封面的方形图片附件。 */
.creation-attachment.is-song-card{display:flex!important;align-items:center;gap:12px;width:100%!important;max-width:100%;height:auto!important;min-height:88px;padding:12px!important;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--color-panel);overflow:hidden}.creation-song-cover{position:relative;display:grid;place-items:center;flex:0 0 64px;width:64px;height:64px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,var(--liv-ui-primary-deep),var(--liv-music-stage));color:var(--liv-music-highlight)}.creation-song-cover img{position:absolute;inset:0;width:100%!important;height:100%!important;object-fit:cover;z-index:1}.creation-song-cover>.iconify{width:28px;height:28px}.creation-song-copy{flex:1;min-width:0;display:grid;gap:4px}.creation-song-copy strong{font-size:14px;font-weight:500;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.creation-song-copy small{font-size:12px;line-height:1.6;color:var(--liv-settings-muted)}.creation-attachment.is-song-card>button{position:static!important;flex:none;width:32px!important;height:32px!important;padding:0!important;min-height:32px;display:grid;place-items:center;border-radius:50%}
/* 数字输入复用组件自带加减与键盘边界逻辑，清除页面通用 input/button 对步进器的挤压。 */
.creation-number-stepper{display:inline-flex;width:160px;max-width:100%}
.creation-number-stepper :deep(input){height:36px;padding:0 36px!important;text-align:center;background:var(--liv-number-surface)!important;border:1px solid var(--color-border-soft)!important;border-radius:8px}
.creation-number-stepper :deep(button){display:inline-flex;justify-content:center;align-items:center;width:32px;min-width:32px;height:32px;min-height:32px;padding:0!important;border:0;background:transparent;color:var(--liv-chat-assistant-text)}
/* 停止生成与暂停音乐分开：实心主题色按钮内使用白色实心方块。 */
.creation-send.is-working{background:var(--liv-ui-primary,#4F46E5);color:#fff;opacity:1}.creation-stop-square{width:10px;height:10px;background:#fff;border-radius:2px;display:block}.creation-engine-label{color:var(--liv-settings-muted);cursor:default}
/* 模型未选时使用正文色；技能名称和说明各占一行。 */
.creation-tool[aria-label="选择模型"]{color:var(--liv-chat-assistant-text)}
.creation-popover.is-skills .creation-skill-tabs{gap:16px;margin:0!important}
.creation-popover.is-skills .creation-skill-tabs button{font-size:16px!important;font-weight:600!important;line-height:24px;min-height:28px;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--liv-settings-muted)}
.creation-popover.is-skills .creation-skill-tabs button.active{color:var(--liv-chat-assistant-text)}
.creation-popover.is-skills .creation-skill-categories{gap:8px;margin:0!important}
.creation-popover.is-skills .creation-skill-categories button{min-height:28px;padding:4px 8px!important;font-size:12px!important}
.creation-popover.is-skills .creation-skill-list{margin:0;display:flex;flex-direction:column;gap:4px}
.creation-popover.is-skills .creation-skill-card{display:grid!important;grid-template-columns:48px minmax(0,1fr) 16px;column-gap:12px;padding:8px 10px!important;min-height:64px;text-align:left}
.creation-popover.is-skills .creation-skill-card>img{width:48px;height:48px;border-radius:8px;object-fit:cover}
.creation-popover.is-skills .creation-skill-card>span{gap:4px}
.creation-popover.is-skills .creation-skill-card>.iconify{grid-column:3;justify-self:center;width:16px;height:16px}
.creation-skill-card>span{display:flex;flex-direction:column;gap:8px;min-width:0}
.creation-skill-card>span>b{font-size:14px;font-weight:600}
.creation-skill-card>span>span{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--liv-settings-muted)}
.creation-popover.is-skills{box-sizing:border-box;display:grid!important;grid-template-rows:28px 28px minmax(0,1fr) 40px;gap:8px;padding:16px;overflow:hidden!important}
.creation-popover.is-skills .creation-skill-list{height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.creation-popover.is-skills .creation-skill-card{height:var(--liv-skill-menu-row-height);min-height:var(--liv-skill-menu-row-height);flex-shrink:0}
.creation-popover.is-skills>.creation-pill{margin:0!important;align-self:end;justify-self:end;height:40px;display:flex;align-items:center}
/* 会话底栏只显示参数图标，完整规格继续由上方 Tooltip 展示；首页保留文字摘要。 */
.is-compact .creation-icon-tool .creation-tool-label{display:none}
/* 已选风格为单独可编辑标签，清除按钮与选择按钮平级，避免嵌套按钮；窄栏允许文字省略。 */
/* 大输入框标签随名称自然伸缩，不预留固定字数空白；受容器限制时仍可收缩省略。 */
.creation-selected-style{position:relative;display:flex;align-items:center;flex:0 1 auto;width:max-content;min-width:32px;max-width:100%;height:32px;font-size:14px;border-radius:8px;background:var(--liv-number-surface)}
.creation-selected-style-open{display:flex!important;align-items:center;gap:6px;width:100%;min-width:0;height:32px;min-height:32px!important;padding:4px 8px!important;border:0;border-radius:8px;background:transparent;color:var(--liv-chat-assistant-text);font-size:14px;line-height:20px}
.creation-selected-style-open>img,.creation-selected-style-open>.iconify{width:24px;height:24px;flex:none;border-radius:6px;object-fit:cover}
.creation-selected-style-open>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.creation-selected-style-clear{position:absolute!important;right:-6px;top:-6px;z-index:1;display:grid!important;place-items:center;min-width:16px!important;width:16px!important;min-height:16px!important;height:16px!important;padding:0!important;border-radius:999px;background:var(--liv-settings-panel)!important;color:var(--liv-settings-text)!important}
.creation-selected-style-clear :deep(.iconify){width:12px;height:12px}
.creation-selected-style-open:not(:disabled):hover{background:var(--color-surface-hover)}
.creation-selected-style-open:focus-visible,.creation-selected-style-clear:focus-visible{outline:2px solid var(--liv-ui-primary);outline-offset:2px}
/* 小输入框只留缩略图和清除叉号，名称由悬停提示与无障碍名称承载。 */
.is-compact .creation-selected-style{flex:0 0 32px;width:32px;max-width:32px}
.is-compact .creation-selected-style-open{justify-content:center;gap:0;padding:4px!important}
.is-compact .creation-selected-style-label{display:none}
.is-compact .creation-param .creation-tool-label{display:none!important}
.creation-composer.is-compact .creation-toolbar .creation-param{width:32px!important;min-width:32px;height:32px;flex:none;justify-content:center;white-space:nowrap}
/* 按编辑器实际宽度恢复工具文字，不以页面宽度或会话模式决定；双栏窄聊天仍保持图标。 */
.creation-composer.is-compact{container-type:inline-size;container-name:creation-composer}
@container creation-composer (min-width:640px){
  .creation-composer.is-compact .creation-toolbar .creation-icon-tool{width:auto!important;max-width:156px;flex:0 1 auto;padding:5px 8px!important;gap:6px;min-width:32px}
  .creation-composer.is-compact .creation-toolbar .creation-tool-label{display:block!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .creation-composer.is-compact .creation-toolbar .creation-skill-label{max-width:112px}
  .creation-composer.is-compact .creation-toolbar .creation-selected-style{flex:0 1 auto;width:auto;max-width:120px}
  .creation-composer.is-compact .creation-toolbar .creation-selected-style-open{justify-content:flex-start;gap:6px;padding:4px 8px!important}
  .creation-composer.is-compact .creation-toolbar .creation-selected-style-label{display:block}
  /* 中等宽度先展开工具，参数仍用图标，防止长模型名把发送键挤出。 */
  .creation-composer.is-compact .creation-toolbar .creation-param{width:32px!important;flex:none;padding:5px!important}
  .creation-composer.is-compact .creation-toolbar .creation-param .creation-tool-label{display:none!important}
}
@container creation-composer (min-width:820px){
  .creation-composer.is-compact .creation-toolbar .creation-param{width:auto!important;max-width:180px;padding:5px 8px!important}
  .creation-composer.is-compact .creation-toolbar .creation-param .creation-tool-label{display:block!important}
}
/* 输入框上方的轻量返回按钮，只显示向下箭头，不占输入框和消息排版。 */
.creation-composer .liv-back-latest{position:absolute;top:-44px;right:12px;z-index:4;width:32px!important;height:32px!important;min-width:32px;min-height:32px!important;padding:0!important;border:1px solid var(--color-border-soft)!important;border-radius:50%!important;background:var(--liv-button-bg)!important;color:var(--liv-chat-assistant-text);box-shadow:0 2px 8px #0004}
/* 底部停靠输入区留出案例阅读空间，展开仍复用原编辑器与工具栏。 */
.creation-composer.is-docked{position:fixed;z-index:40;background:var(--liv-workspace-surface)!important;box-shadow:0 8px 32px #0005;max-height:70dvh;overflow:visible}
/* 收起栏复用当前技能与草稿，仅改变同一输入框的显示，不再创建第二个简版编辑器。 */
.creation-dock-skill{display:flex;align-items:center;gap:4px;max-width:42%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;font-weight:600;color:var(--liv-ui-primary-foreground)}
.creation-dock-skill .iconify{width:14px;height:14px;flex:none}
.creation-composer.is-minimized{padding:0!important;min-height:0;height:var(--liv-home-dock-height);box-sizing:border-box;border-radius:999px!important;background:var(--liv-home-dock-surface)!important;border-color:transparent!important;overflow:hidden;transition:background-color .2s,border-color .2s}
/* 整个胶囊只用一层低不透明度白膜与背景模糊；去掉渐变、提亮和内高光，避免上沿出现色带。滤镜保持稳定，悬停只切换底色。 */
.creation-composer.is-minimized{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.creation-composer.is-minimized:hover,.creation-composer.is-minimized:focus-within{background:var(--liv-home-dock-glass)!important;border-color:var(--liv-home-dock-glass-border)!important;box-shadow:0 8px 24px #0002}
.creation-composer.is-minimized:hover .creation-dock-hint,.creation-composer.is-minimized:focus-within .creation-dock-hint{color:var(--liv-home-dock-glass-text);border-color:var(--liv-home-dock-glass-border)}
.creation-composer.is-minimized>:not(.creation-dock-launcher){display:none!important}
.creation-dock-launcher{width:100%;height:100%;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:8px 16px!important;border:0;border-radius:999px;background:transparent!important;text-align:left}
.creation-dock-launcher>.creation-dock-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;color:var(--liv-settings-muted);border-left:1px solid var(--color-border-soft);padding-left:16px}
.creation-dock-arrow{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:50%;background:var(--liv-home-dock-arrow);color:var(--liv-chat-assistant-text)}
.creation-dock-arrow .iconify{width:20px;height:20px}
.creation-dock-launcher>.iconify{width:20px;height:20px;flex:none}
.creation-dock-collapse{position:absolute;top:12px;right:12px;z-index:2}
</style>
<style scoped>
/* 模型列表固定图标、两行说明和选择标记，长文不挤乱列宽。 */
/* 模型菜单使用固定图标列及等宽分类，正文只保留名称与一行能力说明。 */
.creation-model-row{display:grid!important;grid-template-columns:32px minmax(0,1fr) 18px;align-items:center;gap:8px!important;text-align:left!important;width:100%;padding:8px;min-height:56px}
.creation-model-row>.creation-model-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--color-surface-hover);flex:none}
.creation-model-icon>.iconify{width:18px;height:18px}
.creation-model-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:3px;border-radius:8px;background:var(--color-surface-hover);margin-bottom:8px}
.creation-model-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;height:28px;padding:0 8px;border:0;font-size:12px;font-weight:700;border-radius:6px}
.creation-model-tabs .iconify{width:14px;height:14px;flex:none}
.creation-popover.is-models{padding:12px}
.creation-popover.is-models header{margin-bottom:12px}
.creation-popover.is-models .creation-model-row.active{color:var(--liv-settings-text)}
.creation-popover.is-models .creation-model-row>.iconify:last-child{color:var(--liv-ui-primary-foreground)}
.creation-model-copy{min-width:0;display:grid;gap:0;line-height:16px}.creation-model-copy b,.creation-model-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0!important}
.creation-model-copy b{display:flex;align-items:center;gap:4px}
/* 只缩放闪电和技能名；不改变真实字号或布局，减少动态效果偏好下不播放。 */
.creation-skill-feedback{display:inline-flex;align-items:center;gap:6px;min-width:0;transform-origin:left center}
.creation-skill-feedback.is-switched{animation:liv-skill-switch-pop 320ms ease-out}
@keyframes liv-skill-switch-pop{0%,100%{transform:scale(1)}40%{transform:scale(1.12)}}
@media(prefers-reduced-motion:reduce){.creation-skill-feedback.is-switched{animation:none}}
.creation-model-copy b{font-size:13px;font-weight:600;line-height:16px}.creation-model-copy small{font-size:11px;line-height:16px;color:var(--liv-settings-muted)}
</style>
