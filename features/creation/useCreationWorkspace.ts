import type { LibraryItem } from '~/entities/library/types'
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import type { ProductImageGeneratePayload, ProductImageHistoryBatch } from '~/entities/product-image/types'
import type { ProductVideoCreatePayload, ProductVideoTask } from '~/entities/product-video/types'
import type { MusicQuote, MusicTask } from '~/shared/api/services/musicService'
import type { CreationCatalog, CreationDraft, CreationEntryType, CreationMessage, CreationParameterState, CreationSession, CreationTarget, ComposerReference, ComposerSegment, DirectorPreview, SkillExecution } from './types'
import { defaultParameters, defaultSkills } from './catalog'
import { allowedDurations, referenceDurationValues } from './durationOptions'
import { imageRatioOptions } from './imageRatioOptions'
import { creationService } from '~/shared/api/services/creationService'
import { productImageService } from '~/shared/api/services/productImageService'
import { productVideoService } from '~/shared/api/services/productVideoService'
import { musicService } from '~/shared/api/services/musicService'
import { dramaService } from '~/shared/api/services/dramaService'
import { libraryService } from '~/shared/api/services/libraryService'
import { request, buildProductImagePayload, buildProductVideoPayload } from '~/shared/api/adapters/httpAdapter'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { fallbackDramaVisualStyleOptions } from '~/shared/constants/dramaVisualStyles'
import { sessionErrorText } from './sessionRecovery'
import {hasCompleteResults} from './resultCatalog'
import {resultReadState,shouldRefreshTaskBalance} from './workflowState'
import { createCreditHint } from './creditHint'
import { imageQualityError } from './imageQuality'

/** 入口、报价及会话使用同一冻结草稿，防止报价后改参数而错扣点。 */
export function useCreationWorkspace(options:{beforeSubmit?:()=>Promise<()=>Promise<void>>;beforeScopeChange?:()=>Promise<void>;beforeExecute?:()=>Promise<void>;entryPath?:()=>string}={}) {
  const { auth, requireLogin } = useWorkbenchAuth()
  const explicitLogout=useState<boolean>('workbench-explicit-logout',()=>false)
  let draftOwner=auth.session.user?.id
  let pendingReferences:ComposerReference[]=[]
  const route = useRoute(), router = useRouter(), account = useAccountStore()
  const { $siteAsset: siteAsset } = useNuxtApp()
  const entry = ref<CreationEntryType>('free'), skill = ref(''), prompt = ref(''), segments = ref<ComposerSegment[]>([])
  const references = ref<ComposerReference[]>([]), parameters = ref(defaultParameters()), scriptFile = ref<File | null>(null)
  // 上传临时状态不进入草稿、会话或固定素材引用；服务端成功后才加入正式附件。
  const uploads = ref<Array<{ id: string; name: string; preview: string; progress: number | null; status: 'queued' | 'uploading' | 'failed' }>>([])
  function dismissUpload(id: string) {
    const item = uploads.value.find(value => value.id === id)
    if (item?.preview) URL.revokeObjectURL(item.preview)
    uploads.value = uploads.value.filter(value => value.id !== id)
  }
  const catalog = ref<CreationCatalog | null>(null), sessions = useState<CreationSession[]>('creation-recent-sessions', () => []), session = ref<CreationSession | null>(null)
  const messages = ref<CreationMessage[]>([]), focusedMessage = ref(''), busy = ref(false), loading = ref(false), error = ref('')
  const sessionLoading = ref(false), sessionError = ref(''), pendingSession = ref('')
  const taskActivity=ref<Record<string,{phase:string;label:string;progress:number|null;can_cancel?:boolean;cancel_reason?:string;progress_source?:string;progress_updated_at?:string}>>({})
  let restoreRevision = 0, restoreController: AbortController | null = null
  const director = ref<DirectorPreview | null>(null), directorAccepted = ref(false), musicTasks = ref<MusicTask[]>([])
  const taskData = reactive<Record<string, { status: string; progress: number; detail: string; images?: ProductImageHistoryBatch; video?: ProductVideoTask; music?: MusicTask }>>({})
  const confirmation = ref<{ draft: CreationDraft; credits: number; sufficient: boolean; target: CreationTarget; quote: unknown; payload: unknown; requestId: string; scriptFile?: File; director?: DirectorPreview; execution?: SkillExecution; fingerprint?: string; createdAt?: number } | null>(null)
  let pollTimer: ReturnType<typeof setTimeout> | null = null, disposed = false, revision = 0, refreshingResults=false, pollFailures=0
  const entryDrafts = new Map<CreationEntryType, { skill: string; prompt: string; segments: ComposerSegment[]; references: ComposerReference[]; parameters: CreationParameterState; file: File | null }>()
  // 会话切换只保存本页内存草稿，禁止写入跨账号缓存；返回首页不会丢弃未发送附件。
  const sessionDrafts = new Map<string, { entry: CreationEntryType; skill: string; prompt: string; segments: ComposerSegment[]; references: ComposerReference[]; parameters: CreationParameterState; file: File | null }>()
  function rememberSessionDraft() {
    if (!session.value) return
    sessionDrafts.set(session.value.id, { entry: entry.value, skill: skill.value, prompt: prompt.value, segments: JSON.parse(JSON.stringify(segments.value)), references: JSON.parse(JSON.stringify(references.value)), parameters: JSON.parse(JSON.stringify(parameters.value)), file: scriptFile.value })
  }
  // 首页游客文字也只保留在本页内存；不再写入浏览器持久缓存。
  const selectedSkill = computed(() => catalog.value?.skills.find(item => item.id === skill.value))
  const target = computed<CreationTarget>(() => entry.value === 'drama' ? 'drama' : (selectedSkill.value?.base_code || skill.value) === 'free' ? parameters.value.output === 'auto' ? 'image' : parameters.value.output : selectedSkill.value?.target || 'image')
  const profile = computed(() => catalog.value?.profiles[target.value === 'video' ? 'product_video' : 'product_image'])
  const modelSchema = computed<Record<string, any>>(() => {
    const bound=catalog.value?.skill_models?.[`${skill.value}:${target.value}`]?.find(item=>item.code===parameters.value.model)
    if(bound?.input_schema)return bound.input_schema
    const selected = profile.value?.allowed_models.find(item => item.code === parameters.value.model) as { input_schema?: Record<string, any> } | undefined
    return selected?.input_schema || profile.value?.input_schema || {}
  })
  const models = computed(() => {
    if (['drama', 'music'].includes(target.value)) return []
    const resolved=catalog.value?.skill_models?.[`${skill.value}:${target.value}`]
    if(resolved)return resolved
    const value = profile.value
    if (!value) return []
    const options = [value.model, ...(value.supports_user_model_selection ? value.allowed_models.filter(item => item.code !== value.model.code) : [])]
    const spec = selectedSkill.value
    const allowed = spec?.model_strategy === 'fixed' ? [spec.default_model] : spec?.model_strategy === 'candidates' ? spec.allowed_models || [] : null
    return options.filter(item => !allowed || allowed.includes(item.code))
  })
  // MV 走通用导演项目，六种画幅与服务端创建契约一致；具体镜头报价继续校验模型能力。
  // 广告／故事导演规划的是整片，画幅使用项目创建契约，不受当前单镜头模型目录影响。
  const isDirectorProduction = computed(() => ['ad','story'].includes(selectedSkill.value?.base_code || skill.value) && parameters.value.workflow === 'director')
  const ratios = computed(() => (selectedSkill.value?.base_code || skill.value).startsWith('mv-') || isDirectorProduction.value ? ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'] : target.value === 'drama' ? ['16:9', '9:16'] : imageRatioOptions(modelSchema.value,parameters.value.resolution))
  const resolutions = computed(() => target.value === 'drama' ? ['480p', '720p'] : (modelSchema.value.resolution || modelSchema.value.resolutions || []).map((value: string) => target.value === 'image' ? value.toUpperCase() : value.toLowerCase()))
  // 生图质量沿用后端能力白名单；旧能力目录未列举时使用接口已有的三个合法值。
  const qualities = computed<string[]>(() => (modelSchema.value.quality || ['low', 'medium', 'high']).filter((value: string) => ['low', 'medium', 'high'].includes(value)))
  const estimateLabel = ref('填写需求后预估')
  const creditHint=createCreditHint(label=>{estimateLabel.value=label})
  // 比较业务内容而非对象引用，打开弹层、重复选择相同参数或目录刷新不撤销有效报价。
  watch([()=>canonical(draft()), scriptFile, models, ()=>auth.session.loggedIn, ()=>auth.session.user?.id], (values, previous) => {
    // 目录重读只刷新参考提示；只有业务草稿或文件真的变化才撤销旧报价。
    if (!previous || values[0] !== previous[0] || values[1] !== previous[1]) confirmation.value = null
    // 尚无本次费用的导演／短剧阶段不显示占位文案，实际阶段报价仍由确认卡提供。
    creditHint.refresh()
    if (!['image','video'].includes(target.value) || parameters.value.workflow === 'director') return
    // 游客只查不含私人素材的公开预算；本人素材仍走登录后的权限校验，不能降成无参考图价格。
    if (!auth.session.loggedIn && (references.value.length || scriptFile.value)) return
    if (!models.value.some(item=>item.code===parameters.value.model)) return
    // 复用正式计价参数编译与服务端公式；只读预算不调用LLM、不冻结快照、不创建任务或扣费。
    const value=JSON.parse(JSON.stringify(draft())) as CreationDraft
    const kind=target.value
    creditHint.refresh(async()=>{
      const body=kind==='image'?buildProductImagePayload(imagePayload(value,'')):buildProductVideoPayload(videoPayload(value,''))
        const endpoint=auth.session.loggedIn?'credit-preview':'public-credit-preview'
        const quote=await request<{required_credits:number}>(`/product-${kind}/${endpoint}`,{method:'POST',body:{...body,hint_only:true}})
      return quote.required_credits
    })
  }, { deep: true })
  // 模型时长既支持连续范围，也支持离散选项；不把 5/10 秒模型伪装成任意秒数。
  const durationRange = computed(() => {
    // DirectorDraft 的 4–120 秒是脚本目标总长；切回直接生成时仍按原模型重新收敛。
    if (isDirectorProduction.value) return {min:4,max:120,step:1,values:[] as number[]}
    const spec = modelSchema.value.duration_sec || modelSchema.value.duration || {}
    // 技能下限也须参与离散档过滤，否则会把6秒重新吸附到要求至少10秒的技能。
    const values = referenceDurationValues(allowedDurations(Array.isArray(spec)?spec:{min:spec.min||4,max:spec.max||15,step:spec.step||1,...spec},Math.max(1,selectedSkill.value?.minimum_duration_sec||1),30),modelSchema.value.duration_constraints,references.value)
    return { min: values[0]||0, max: values[values.length-1]||0, step: Math.max(1,Number(spec.step||1)), values }
  })
  const musicSources = computed(() => musicTasks.value.filter(item => item.status === 'completed' && ['generation', 'coverSong', 'uploadCover', 'extend'].includes(item.operation)).flatMap(item => {
    const songs = Array.isArray(item.result.music) ? item.result.music as Record<string, unknown>[] : []
    return songs.map((song, index) => ({ id: `${item.id}:${index}`, label: `${String(song.title || item.label)} · 第${index + 1}首`, cover:String(song.image_large_url||song.image_url||song.cover_url||'') }))
  }))
  const focused = computed(() => messages.value.find(item => item.id === focusedMessage.value) || messages.value[messages.value.length - 1])
  const activeResult = computed(() => focused.value ? taskData[focused.value.id] : undefined)
  const active = computed(() => Boolean(session.value))
  /** 侧栏切换仅改变查询参数，组件不重建；明确恢复目标会话，避免仍显示上一个结果。 */
  watch(() => route.query.session, (id) => {
    if (typeof id === 'string' && id !== session.value?.id) void restore(id).catch(cause => { error.value = message(cause) })
    else if (!id && session.value) {
      rememberSessionDraft()
      ++restoreRevision; restoreController?.abort(); if(pollTimer)clearTimeout(pollTimer)
      session.value=null;messages.value=[];focusedMessage.value='';confirmation.value=null;director.value=null;sessionLoading.value=false;sessionError.value=''
      // “首页”保留当前草稿；“新建创作”明确开始空白输入，原会话草稿仍可恢复。
      // 新建项目可选择短剧入口；清空草稿时不能强行降回自由创作。
      if (route.query.new === '1') { entry.value=['free','drama','commerce','marketing','music','image'].includes(String(route.query.entry))?route.query.entry as CreationEntryType:'free';skill.value=defaultSkills[entry.value];parameters.value=defaultParameters();prompt.value='';segments.value=[];references.value=[];scriptFile.value=null }
    }
  })

  function patchParameters(patch: Partial<CreationParameterState>) { const before=canonical(draft());parameters.value = { ...parameters.value, ...patch }; applyCapabilities();if(before!==canonical(draft()))confirmation.value = null }
  function setText(text: string, parts: ComposerSegment[]) { const before=canonical(draft());prompt.value = text; segments.value = parts;if(before!==canonical(draft()))confirmation.value = null }
  function setSkill(id: string) {
    // 重复选择当前技能不重置规格或报价；显式切换到其他技能才应用其默认值。
    if(id===skill.value)return
    skill.value = id
    // 仅切换技能时应用后台推荐参数，用户后续手动修改不被反复覆盖。
    parameters.value = { ...parameters.value, ...selectedSkill.value?.defaults }
    if (!selectedSkill.value?.workflows?.includes(parameters.value.workflow)) parameters.value.workflow = selectedSkill.value?.workflows?.[0] || 'direct'
    if ((selectedSkill.value?.base_code || id).startsWith('mv-') || id === 'lyric-video') parameters.value.musicMode = 'mv'
    else if (selectedSkill.value?.target === 'music') parameters.value.musicMode = 'create'
    const base=selectedSkill.value?.base_code || id
    if (['song', 'instrumental'].includes(base)) parameters.value.musicOperation = 'generation'
    if (base === 'instrumental') parameters.value.customLyrics = false
    else if (base === 'reference') parameters.value.musicOperation = 'inspo'
    else if (base === 'remix') parameters.value.musicOperation = 'coverSong'
    else if (base === 'lyric-video') parameters.value.musicOperation = 'generateMp4'
    applyCapabilities(); confirmation.value = null
  }
  /** 模型切换只使用后端能力白名单，非法旧参数被收敛到当前默认值。 */
  function applyCapabilities() {
    // 后台限制允许流程时同步收敛前端选项，不能继续选择已停用的导演/直接模式。
    if (selectedSkill.value?.workflows?.length && !selectedSkill.value.workflows.includes(parameters.value.workflow)) parameters.value.workflow = selectedSkill.value.workflows[0]!
    if (target.value === 'drama') {
      if(!['480p','720p','1080p'].includes(parameters.value.resolution))parameters.value.resolution='720p'
      // 仅 MV 扩展画幅；其他历史导演草稿的三种合法值保持兼容。
      const allowedRatios=(selectedSkill.value?.base_code || skill.value).startsWith('mv-')?ratios.value:['16:9','9:16','1:1']
      if(!allowedRatios.includes(parameters.value.aspectRatio))parameters.value.aspectRatio='16:9'
      return
    }
    if (target.value === 'music') return
    const current = profile.value
    if (!current) return
    if(!models.value.length){parameters.value.model='';parameters.value.durationSec=Math.max(parameters.value.durationSec,selectedSkill.value?.minimum_duration_sec||0);error.value='当前技能暂无兼容且可报价的模型，请联系管理员。';return}
    if(error.value==='当前技能暂无兼容且可报价的模型，请联系管理员。')error.value=''
    // 自由入口可暂不选择模型；仅真实技能流程自动采用后台的兼容默认值。
    if (!(entry.value === 'free' && !skill.value && !parameters.value.model) && !models.value.some(item => item.code === parameters.value.model)) parameters.value.model = models.value.find(item => item.code === selectedSkill.value?.default_model)?.code || models.value[0]?.code || ''
    const defaults = current.default_params
    // 后台锁定项回落到技能或功能目录默认值，不能留下一个无法修改又不能提交的旧规格。
    const allowed=new Set(selectedSkill.value?.allowed_parameter_keys || ['aspectRatio','durationSec','resolution','quality','count','style'])
    const lockedDefaults={aspectRatio:String(defaults.aspect_ratio||'16:9'),resolution:String(defaults.resolution||'1K'),durationSec:Number(defaults.duration_sec||10),quality:String(defaults.quality||'medium'),count:1,style:'',...selectedSkill.value?.defaults}
    for(const [key,value] of Object.entries(lockedDefaults)){if(!allowed.has(key))(parameters.value as unknown as Record<string,unknown>)[key]=value}
    if (!ratios.value.includes(parameters.value.aspectRatio)) parameters.value.aspectRatio = ratios.value.includes(String(defaults.aspect_ratio)) ? String(defaults.aspect_ratio) : ratios.value[0] || ''
    if (!resolutions.value.includes(parameters.value.resolution)) parameters.value.resolution = resolutions.value[0] || ''
    // 记住会话质量；不兼容时由报价校验提示，不静默降档或改变收费参数。
    error.value = imageQualityError(error.value,target.value,parameters.value.quality,qualities.value)
    parameters.value.durationSec = Math.min(durationRange.value.max, Math.max(durationRange.value.min, parameters.value.durationSec))
    const range = durationRange.value
    if (range.values.length) parameters.value.durationSec = range.values.reduce((best, value) => Math.abs(value - parameters.value.durationSec) < Math.abs(best - parameters.value.durationSec) ? value : best)
    else parameters.value.durationSec = Math.min(range.max, range.min + Math.round((parameters.value.durationSec - range.min) / range.step) * range.step)
  }
  watch(() => parameters.value.model, applyCapabilities)
  // 用户重新选回合法质量时立即撤销旧错误，而不是一直挂到刷新页面。
  watch(() => parameters.value.quality, applyCapabilities)
  watch(target, applyCapabilities)
  watch(modelSchema, applyCapabilities, { deep: true })
  // 清晰度切换后立即收敛比例；图片报价/确认只能消费当前合法组合。
  watch(() => parameters.value.resolution, applyCapabilities)
  // 上传、移除或恢复参考素材后重新吸附，不能留下协议不支持但仍可确认的旧秒数。
  watch(() => durationRange.value.values.join(','), applyCapabilities)
  // 剧本修改使之前的解析报价失效，不允许按旧脚本价格提交新脚本。
  watch(()=>[director.value?.title,director.value?.script],()=>{confirmation.value=null;directorAccepted.value=false})
  watch(scriptFile,(file,previous)=>{if(file!==previous){director.value=null;directorAccepted.value=false}})
  /** 目录封面复用同一映射，异步准备新入口时不提前改动当前目录或草稿。 */
  function catalogWithCovers(value:CreationCatalog):CreationCatalog{
    return {...value,styles:value.styles.map(item=>{
      const option=fallbackDramaVisualStyleOptions.find(option=>option.styleId===item.style_id)
      return {...item,cover_url:option?.image?option.image.startsWith('http')?option.image:siteAsset(option.image):undefined}
    })}
  }
  async function loadCatalog() {
    const current = ++revision
    loading.value = true
    try {
      const value = await (auth.session.loggedIn ? creationService.catalog(entry.value) : creationService.publicCatalog(entry.value))
      if (disposed || current !== revision) return
      catalog.value = catalogWithCovers(value); applyCapabilities()
      // 仅音乐入口或需要音频来源的技能读取曲目，避免普通聊天反复请求音乐目录。
      musicTasks.value = auth.session.loggedIn && (entry.value==='music'||target.value==='music') ? await musicService.tasks(30) : []
    } catch (cause) { if (current === revision) error.value = message(cause) }
    finally { if (current === revision) loading.value = false }
  }
  async function chooseEntry(value: CreationEntryType) {
    // 入口状态先变化会改变草稿作用域，因此必须在变更之前补存当前内容。
    await options.beforeScopeChange?.()
    // 离开会话时取消恢复；尚未完成的旧请求不得覆盖首页草稿。
    ++restoreRevision; ++revision; restoreController?.abort(); busy.value=false;sessionLoading.value=false;sessionError.value='';pendingSession.value=''
    // 每个入口保留当前草稿，切换前存入内存；任务历史独立于首页草稿。
    if (!session.value) entryDrafts.set(entry.value, { skill: skill.value, prompt: prompt.value, segments: segments.value, references: references.value, parameters: parameters.value, file: scriptFile.value })
    entry.value = value; skill.value = defaultSkills[value]; parameters.value = defaultParameters()
    prompt.value = ''; segments.value = []; references.value = []; director.value = null; directorAccepted.value = false
    scriptFile.value = null; session.value = null; messages.value = []; error.value = ''; confirmation.value = null
    const prior = entryDrafts.get(value)
    if (prior) { skill.value = prior.skill; prompt.value = prior.prompt; segments.value = prior.segments; references.value = prior.references; parameters.value = prior.parameters; scriptFile.value = prior.file }
    // 技能页只切换入口草稿，不为试用跳回首页；正式发送后仍走原会话路由。
    await router.replace({ path: options.entryPath?.() || '/dashboard', query: { entry: value } }); await loadCatalog()
  }
  function draft(): CreationDraft {
    return { entry: entry.value, skill: skill.value, prompt: prompt.value,
      references: references.value.map(({ item_id, version_id, purpose, start, end }) => ({ item_id, version_id, purpose, ...(start === undefined ? {} : { start, end }) })),
      reference_names: Object.fromEntries(references.value.map(item => [item.version_id, item.name])),
      parameters: { ...JSON.parse(JSON.stringify(parameters.value)), reference_types: references.value.map(item => item.media_type) },
      segments: JSON.parse(JSON.stringify(segments.value)) }
  }
  async function upload(files: File[]) {
    if (!requireLogin()) return
    if (busy.value) return
    busy.value = true; error.value = ''
    const owner = auth.session.user?.id
    const jobs = files.map(file => ({ file, id: crypto.randomUUID() }))
    uploads.value.push(...jobs.map(({ file, id }) => ({ id, name: file.name, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '', progress: 0, status: 'queued' as const })))
    try {
      for (const { file, id } of jobs) {
        if (disposed || auth.session.user?.id !== owner) break
        const job = uploads.value.find(value => value.id === id)
        if (!job) continue
        job.status = 'uploading'
        try {
        const media = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'document'
        if (!allowedMedia(media)) throw new Error(`当前技能不能使用${({ image: '图片', video: '视频', audio: '音频', document: '文档' } as Record<string, string>)[media]}，请切换技能。`)
        const item = await libraryService.upload(file, media === 'audio' ? 'music' : ['commerce','marketing'].includes(entry.value) ? 'product' : 'other', percent => { job.progress = percent })
        if (disposed || auth.session.user?.id !== owner) break
        const version = item.versions[0]
        if (!version) throw new Error('上传文件尚未生成可引用版本，请从资料库检查。')
        addReference({ item_id: item.id, version_id: version.id, purpose: media === 'video' ? 'reference_video' : 'reference', name: item.name, media_type: media, preview_url: libraryService.previewUrl(version.preview_url) })
        dismissUpload(id)
        } catch (cause) { job.status = 'failed'; error.value = `${file.name}：${message(cause)}` }
      }
    } catch (cause) { error.value = message(cause) }
    finally { for (const { id } of jobs) { if (uploads.value.find(value => value.id === id)?.status !== 'failed') dismissUpload(id) }; busy.value = false }
  }
  function allowedMedia(media: string) { return (selectedSkill.value?.media_types || []).includes(media) }
  async function replaceReference(index: number, file: File) {
    // 替换成功后保持原顺序；失败不删除旧素材，也不留下半完成的新引用。
    const old = [...references.value], item = old[index]
    if (!item) return
    await upload([file])
    const next = references.value.find(ref => !old.some(value => value.version_id === ref.version_id))
    if (next) references.value = old.map((value,position)=>position===index?next:value)
  }
  function addReference(value: ComposerReference) {
    if (!references.value.some(item => item.version_id === value.version_id)) references.value.push(value)
    confirmation.value = null
  }
  function removeReference(index: number) {
    const item = references.value[index]
    if (!item) return
    references.value.splice(index, 1)
    segments.value = segments.value.filter(segment => segment.type !== 'reference' || segment.version_id !== item.version_id)
    prompt.value = segments.value.map(part => part.type === 'text' ? part.text : part.label).join('')
  }
  function reorder(index: number, delta: number) {
    const next = index + delta
    if (next < 0 || next >= references.value.length) return
    const [item] = references.value.splice(index, 1); if (item) references.value.splice(next, 0, item)
  }
  async function refreshSessions() { sessions.value = auth.session.loggedIn ? await creationService.sessions() : [] }
  async function focusMessage(id: string) {
    if (busy.value) return
    const value = messages.value.find(item => item.id === id)
    if (!value) return
    busy.value = true; error.value = ''
    try {
      // 查看历史仅切换作品；下一轮草稿和质量独立保存，明确引用工具才改变创作输入。
      focusedMessage.value = id
      if (value.task_id) return
      entry.value = value.content.entry; skill.value = value.content.skill
      parameters.value = { ...defaultParameters(), ...value.content.parameters }
      prompt.value = value.content.original_prompt ?? value.content.prompt; segments.value = value.content.segments
      references.value = []; confirmation.value = null
      // 已提交附件属于历史消息，不回填下一轮输入；仅未提交草稿恢复可编辑素材。
      for (const reference of (value.task_id ? [] : value.content.references)) {
        try {
          const item = await request<LibraryItem>(`/library/${reference.item_id}`)
          const version = item.versions.find(version => version.id === reference.version_id)
          if (version) addReference({ ...reference, name: item.name, media_type: item.media_type, preview_url: libraryService.previewUrl(version.preview_url) })
        } catch { error.value = '部分原素材已归档或不可用，历史作品仍保留；继续创作请重新选择素材。' }
      }
      await loadCatalog()
    } catch (cause) { error.value = message(cause) }
    finally { busy.value = false }
  }
  async function restore(id: string) {
    if(!requireLogin())return
    rememberSessionDraft()
    const current = ++restoreRevision
    ++revision
    restoreController?.abort(); restoreController = new AbortController()
    const signal = restoreController.signal
    const stale = () => disposed || current !== restoreRevision
    pendingSession.value=id;sessionLoading.value=true;sessionError.value=''
    busy.value = true; error.value = '';confirmation.value=null
    // 立即隐藏旧会话，防止加载失败后把上一份作品误标成目标会话。
    session.value=null;messages.value=[];taskActivity.value={};focusedMessage.value='';references.value=[];prompt.value='';segments.value=[]
    director.value=null;directorAccepted.value=false;scriptFile.value=null
    try {
      const value = await creationService.session(id, signal)
      if (stale()) return
      session.value = value; messages.value = value.messages || []; entry.value = value.entry;skill.value=value.skill;parameters.value=defaultParameters()
      const last = messages.value[messages.value.length - 1]
      // 尚未生成媒体的会话没有 CreationMessage；必须从真实运行快照恢复入口参数，不能回落到“标准”。
      let conversationParameters: CreationParameterState | undefined
      if (!last) {
        const runs = await creationService.runs(id)
        if (stale()) return
        const saved = sessionDrafts.get(id)
        const latest = runs[runs.length - 1]
        if (saved || latest) {
          entry.value = saved?.entry ?? latest!.draft.entry
          skill.value = saved?.skill ?? latest!.draft.skill
          conversationParameters = structuredClone(saved?.parameters ?? latest!.draft.parameters)
        }
      }
      if (last) {
        const savedDraft = sessionDrafts.get(id)
        entry.value = savedDraft?.entry ?? last.content.entry
        skill.value = savedDraft?.skill ?? last.content.skill; parameters.value = { ...defaultParameters(), ...(savedDraft?.parameters ?? last.content.parameters) }
        prompt.value = savedDraft?.prompt ?? (last.task_id ? '' : last.content.original_prompt ?? last.content.prompt)
        segments.value = savedDraft?.segments ?? (last.task_id ? [] : last.content.segments)
        scriptFile.value = savedDraft?.file ?? null
        references.value = []
        for (const reference of (savedDraft?.references ?? (last.task_id ? [] : last.content.references))) {
          try {
            const item = await request<LibraryItem>(`/library/${reference.item_id}`, {signal})
            if (stale()) return
            const version = item.versions.find(version => version.id === reference.version_id)
            if (version) addReference({ ...reference, name: item.name, media_type: item.media_type, preview_url: libraryService.previewUrl(version.preview_url) })
          } catch { if(stale())return;error.value = '部分原素材已归档，历史结果仍可查看；继续创作可重新选择素材。' }
        }
        focusedMessage.value = last.id
      }
      await loadCatalog(); if(stale())return
      // 目录先就绪再校验原始规格，避免旧入口的能力监听器提前覆盖新会话的质量与画幅。
      if (conversationParameters) { parameters.value = { ...defaultParameters(), ...conversationParameters }; applyCapabilities() }
      await refreshResults(); if(stale())return
      // 刷新同会话时保留已选视频深链；主动切换其他会话不能携带旧作品选择。
      const videoQuery=route.query.session===id&&typeof route.query.videoRun==='string'&&typeof route.query.videoItem==='string'
        ?{videoRun:route.query.videoRun,videoItem:route.query.videoItem}:{}
      await router.replace({ path: '/dashboard', query: { session: id,...videoQuery } })
    } catch (cause) { if(!stale()){session.value=null;messages.value=[];sessionError.value=sessionErrorText(cause)} }
    finally { if(!stale()){busy.value = false;sessionLoading.value=false} }
  }
  const resultReadAttempts=new Map<string,number>()
  // 限流冷却属于只读查询，不创建任务；即使手点刷新也不能持续撞同一个窗口。
  let resultRateLimitedUntil=0
  async function refreshResults(force=false) {
    if (disposed || refreshingResults) return
    if(Date.now()<resultRateLimitedUntil){
      if(pollTimer)clearTimeout(pollTimer)
      pollTimer=setTimeout(()=>void refreshResults(),resultRateLimitedUntil-Date.now()+250)
      return
    }
    if(import.meta.client && document.visibilityState==='hidden'){if(pollTimer)clearTimeout(pollTimer);pollTimer=setTimeout(()=>void refreshResults(),15000);return}
    refreshingResults=true
    let failed=false,balanceChanged=false
    const owner=auth.session.user?.id
    const sid=session.value?.id
    try{
    if(sid)try{const value=await creationService.activity(sid);if(owner===auth.session.user?.id&&sid===session.value?.id)taskActivity.value=value}catch(cause){
      // 活动接口限流时，紧接着请求每个产物只会继续耗尽窗口；后续任务查询统一冷却。
      if(Number((cause as {statusCode?:number}).statusCode)===429)resultRateLimitedUntil=Date.now()+60000
    }
    await Promise.all(messages.value.filter(item => item.task_id && (force===true || !taskData[item.id] || ['queued','submitting','in_progress','pending','running','result_pending','status_unavailable'].includes(taskData[item.id]!.status) || hasPendingLyrics(taskData[item.id]?.music))).map(async item => {
      try {
        const previousStatus=taskData[item.id]?.status
        if(Date.now()<resultRateLimitedUntil)throw Object.assign(new Error('任务状态正在等待同步'),{statusCode:429})
        if (item.task_type === 'image') {
          const images = await productImageService.getHistory(item.task_id)
          if(owner!==auth.session.user?.id||sid!==session.value?.id)return
          // 失败详情复用旧版安全错误出口，正常阶段仍显示实际步骤。
          taskData[item.id] = { status: normalizeStatus(images.status), progress: images.progress || 0, detail: images.errorMessage || images.currentStep || '', images }
        } else if (item.task_type === 'video') {
          const video = await productVideoService.getTask(item.task_id)
          if(owner!==auth.session.user?.id||sid!==session.value?.id)return
          taskData[item.id] = { status: normalizeStatus(video.status), progress: video.progress, detail: video.errorMessage || video.currentStep, video }
        } else if (item.task_type === 'music') {
          const music = await musicService.task(item.task_id)
          if(owner!==auth.session.user?.id||sid!==session.value?.id)return
          taskData[item.id] = { status: music.status, progress: music.progress, detail: music.error_message, music }
          musicTasks.value = [music, ...musicTasks.value.filter(existing => existing.id !== music.id)]
        }
        const state=taskData[item.id]
        if(state&&['completed','success','succeeded'].includes(state.status)&&!hasCompleteResults(state,item.content?.parameters?.count)){
          const attempt=force===true?1:(resultReadAttempts.get(item.id)||0)+1;resultReadAttempts.set(item.id,attempt)
          const pending=resultReadState(state.status,false,attempt);state.status=pending.status;state.detail=pending.detail
        }else if(state&&hasCompleteResults(state,item.content?.parameters?.count))resultReadAttempts.delete(item.id)
        if(state&&shouldRefreshTaskBalance(previousStatus,state.status))balanceChanged=true
      } catch (cause) {
        if(owner!==auth.session.user?.id||sid!==session.value?.id)return
        failed=true
        // 查询断线不能沿用旧百分比冒充实时生成，也不能认定原任务失败后重新创建。
        const prior=taskData[item.id]
        if(!prior||['queued','submitting','in_progress','pending','running','result_pending','status_unavailable'].includes(prior.status)){
          taskData[item.id]={...prior,status:'status_unavailable',progress:prior?.progress||0,detail:'状态同步中，请稍候',images:prior?.images,video:prior?.video,music:prior?.music}
        }
        if(Number((cause as {statusCode?:number;response?:{status?:number}}).statusCode||(cause as {response?:{status?:number}}).response?.status)===429)resultRateLimitedUntil=Date.now()+60000
        // 查询错误只显示在对应任务，不污染另一轮尚未提交方案的报价确认卡。
      }
    }))
    // 同一轮多个任务结束只读一次账户；失败退款后不能一直显示创建时的预扣余额。
    if(balanceChanged&&!disposed&&owner===auth.session.user?.id&&sid===session.value?.id)void account.refreshProfile().catch(()=>{})
    pollFailures=failed?Math.min(4,pollFailures+1):0
    if (pollTimer) clearTimeout(pollTimer)
    if (!disposed && messages.value.some(item => {
      const state = taskData[item.id]
      return item.task_id && (!state || ['queued', 'submitting', 'in_progress','pending','running','result_pending','status_unavailable'].includes(state.status) || hasPendingLyrics(state.music))
    })) pollTimer = setTimeout(() => void refreshResults(), Math.max(resultRateLimitedUntil-Date.now(),Math.min(60000,5000*2**pollFailures)))
    }finally{refreshingResults=false;if(!disposed&&sid!==session.value?.id)queueMicrotask(()=>void refreshResults())}
  }
  function imagePayload(value: CreationDraft, id: string): ProductImageGeneratePayload {
    const p = value.parameters
    const base=catalog.value?.skills.find(row=>row.id===value.skill)?.base_code || value.skill
    return { batchId: id, prompt: value.prompt, sourcePrompt: (value.original_prompt ?? value.prompt).slice(0,2000), model: p.model, templateId: p.templateId.startsWith('image:') ? p.templateId.slice(6) : '',
      count: p.count, splitSellingPoints: false, aspectRatio: p.aspectRatio, resolution: p.resolution, quality: p.quality, background: 'auto', outputFormat: 'png', style: p.style,
      workspaceMode: base === 'product' ? 'product' : base === 'poster' ? 'poster' : base === 'edit' ? 'edit' : 'free',
      creationMethod: 'single', referenceImages: [], libraryRefs: value.references, inputOrder: value.references.map((_, index) => `library:${index}`) }
  }
  function videoPayload(value: CreationDraft, id: string): ProductVideoCreatePayload {
    const p = value.parameters
    const base=catalog.value?.skills.find(row=>row.id===value.skill)?.base_code || value.skill
    const videoTemplate = p.templateId.startsWith('video:') ? p.templateId.slice(6) : catalog.value?.video_templates[0]?.id
    if (!videoTemplate) throw new Error('当前没有可用的视频模板，请稍后重试。')
    return { requestId: id, templateId: videoTemplate, creationType: value.references.some(ref => ref.purpose === 'reference_video') ? 'reference_video' : base === 'showcase' ? 'product' : base === 'ad' ? 'ad' : base === 'story' ? 'story' : 'free',
      prompt: [value.prompt, p.style ? `视觉风格：${p.style}` : ''].filter(Boolean).join('\n'), sourceImages: [], libraryRefs: value.references,
      inputOrder: value.references.map((_, index) => `library:${index}`), durationSec: p.durationSec, aspectRatio: p.aspectRatio, resolution: p.resolution, resultCount: p.count, model: p.model }
  }
  function musicInputs(value: CreationDraft) {
    const base=catalog.value?.skills.find(row=>row.id===value.skill)?.base_code || value.skill
    const p = value.parameters, operation = base==='free'?(value.references.length?'inspo':'generation'):base === 'lyric-video' ? 'generateMp4' : base === 'reference' ? 'inspo' : base === 'remix' ? p.musicOperation : p.musicOperation || 'generation'
    const source = musicTasks.value.find(item => item.id === p.sourceTask.split(':')[0])
    const index = Number(p.sourceTask.split(':')[1] || 0)
    const spec = catalog.value?.music_operations.find(item => item.operation === operation)
    if (!spec?.enabled) throw new Error('当前音乐操作暂未开放。')
    const data: Record<string, unknown> = { ...p.extra }
    if (spec.fields.task_id) { if (!source) throw new Error('请先选择来源歌曲。'); data.task_id = source.provider_task_id; data.audio_index = index }
    if (operation === 'generation' || operation === 'coverSong') {
      data.custom = p.customLyrics
      data[p.customLyrics ? 'prompt' : 'gpt_description'] = value.prompt
      data.style = p.style
      if (operation === 'generation') { data.instrumental = base === 'instrumental' || (['free','song'].includes(base)&&!!p.extra.instrumental);if(data.instrumental)delete data.vocal_gender }
    } else if (operation === 'inspo') {
      const refs = value.references.map(({ item_id, version_id }) => ({ item_id, version_id }))
      if (refs.length) data.audio_refs = refs
      if (p.sourceUrl) data.audio_urls = p.sourceUrl.split(/\n/).filter(Boolean)
    } else if (spec.fields.prompt) data.prompt = value.prompt
    // 能力目录白名单过滤高级参数，不能把上一操作的字段透传给另一收费接口。
    return { operation, inputs: Object.fromEntries(Object.entries(data).filter(([key, val]) => spec.fields[key] && val !== '' && val !== undefined)) }
  }
  async function prepare(quoteOnly=false, proposalDraft?:CreationDraft) {
    if (!requireLogin()) return
    if (busy.value) return
    // 已显示的报价对应当前输入才可点击即提交，过期或修改后的报价必须重新显示。
    if (quoteOnly!==true && confirmation.value?.fingerprint === canonical(draft()) && Date.now() - (confirmation.value.createdAt || 0) < 540000) { await submit(); return }
    busy.value = true; error.value = ''; confirmation.value = null
    try {
      // 助手方案可独立报价，不必把已发送的需求重新填回用户正在编辑的输入框。
      let inputFingerprint=canonical(draft())
      let value = proposalDraft ? JSON.parse(JSON.stringify(proposalDraft)) as CreationDraft : draft(), nextTarget = target.value
      // 已发送附件已移到消息区；后续阶段消费规划时的同一输入，而不是空的编辑器。
      if(directorAccepted.value && director.value?.input_draft){
        const snapshot=director.value.input_draft
        const keys=['mv_lyrics','mv_instrumental','mv_range_mode','mv_start_sec','mv_end_sec','mv_song_version','mv_alignment_id','mv_alignment_confirmation']
        if(director.value.mv_run_id && keys.some(key=>JSON.stringify(snapshot.parameters.extra?.[key])!==JSON.stringify(parameters.value.extra[key]))){
          directorAccepted.value=false
          throw new Error('歌曲、歌词或范围已改变，请重新发送需求规划 MV 剧本。')
        }
        if(parameters.value.extra.director_input_mode!=='file' && !snapshot.parameters.extra.script_file_name && prompt.value.trim() && ![snapshot.prompt,snapshot.original_prompt].includes(prompt.value)){
          directorAccepted.value=false
          throw new Error('创作需求已改变，请重新规划脚本。')
        }
        value=JSON.parse(JSON.stringify(snapshot)) as CreationDraft
        value.parameters={...value.parameters,...parameters.value,extra:{...value.parameters.extra,...parameters.value.extra}}
      }
      if (entry.value === 'drama' && !directorAccepted.value && (!value.parameters.extra.director_input_mode || value.parameters.extra.director_input_mode === 'file')) {
        if (!scriptFile.value) throw new Error('请上传剧本文件。')
        if (scriptFile.value.size > 20 * 1024 * 1024 || !/\.(txt|docx|pdf)$/i.test(scriptFile.value.name)) throw new Error('剧本仅支持 20 MB 内的 TXT、DOCX 或 PDF。')
        // 文件内容摘要区分同名剧本；刷新后重新选择相同文件仍可恢复原创建编号。
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await scriptFile.value.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, '0')).join('')
        value.parameters.extra = { ...value.parameters.extra, script_file_sha256: hash, script_file_name: scriptFile.value.name }
        director.value=await creationService.directorFile(value,scriptFile.value)
        parameters.value.extra={...parameters.value.extra,director_run_id:director.value.director_run_id}
        await router.replace({path:'/dashboard',query:{...route.query,entry:entry.value,skill:skill.value,run:director.value.director_run_id}})
        return
      } else if (!value.prompt.trim() && !['reference', 'lyric-video'].includes(value.skill) && !value.skill.startsWith('mv-')) throw new Error('请先描述创作要求。')
      if (skill.value === 'free' && !value.parameters.extra.creation_run_id) {
        const suggested = parameters.value.output === 'auto' ? await creationService.route(value) : { target: parameters.value.output, skill: parameters.value.output === 'video' ? 'story' : parameters.value.output === 'music' ? 'free' : 'image' }
        nextTarget = suggested.target; value.skill = suggested.skill; skill.value = suggested.skill; applyCapabilities(); value.parameters = {...draft().parameters,output:nextTarget}
        inputFingerprint=canonical(draft())
      }
      const incompatible = references.value.filter(item => !(catalog.value?.skills.find(spec => spec.id === value.skill)?.media_types || []).includes(item.media_type))
      if (incompatible.length) throw new Error(`请先移除当前技能不支持的素材：${incompatible.map(item => item.name).join('、')}`)
      // 在导演或报价前校验素材并编译提示词，固定版本随消息落库，不触发收费生成。
      const recipe = await creationService.prepareSkill(value)
      value = recipe.draft
      if ((selectedSkill.value?.base_code || value.skill).startsWith('mv-') && !directorAccepted.value) {
        director.value = await creationService.mv(value)
        parameters.value.extra={...parameters.value.extra,mv_run_id:director.value.mv_run_id}
        await router.replace({path:'/dashboard',query:{...route.query,entry:entry.value,skill:skill.value,run:director.value.mv_run_id}})
        return
      }
      const base=selectedSkill.value?.base_code || value.skill
      if ((base==='director' && value.parameters.extra.director_input_mode && value.parameters.extra.director_input_mode!=='file' || ['ad', 'story'].includes(base) && value.parameters.workflow === 'director') && !directorAccepted.value) {
        director.value = await creationService.director(value, base === 'ad' ? 'ad' : 'general')
        parameters.value.extra={...parameters.value.extra,director_run_id:director.value.director_run_id}
        await router.replace({path:'/dashboard',query:{...route.query,entry:entry.value,skill:skill.value,run:director.value.director_run_id}})
        return
      }
      if (directorAccepted.value && director.value) nextTarget = 'drama'
      const pending = messages.value[messages.value.length - 1]
      const requestId = pending && !pending.task_id && canonical(pending.content) === canonical(value) ? pending.request_id : crypto.randomUUID()
      if (nextTarget === 'image') {
        if (value.skill === 'edit' && !value.references.length) throw new Error('图片修改需要上传或选择原图。')
        const payload = {...imagePayload(value, requestId),creationContext:recipe.creation_context}, quote = await productImageService.previewCredits(payload)
        confirmation.value = { draft: value, credits: quote.requiredCredits, sufficient: quote.sufficient, target: nextTarget, quote, payload: { ...payload, inputSnapshotId: quote.inputSnapshotId }, requestId }
      } else if (nextTarget === 'video') {
        const payload = {...videoPayload(value, requestId),creationContext:recipe.creation_context}, quote = await productVideoService.previewCredits(payload)
        confirmation.value = { draft: value, credits: quote.requiredCredits, sufficient: quote.sufficient, target: nextTarget, quote, payload: { ...payload, inputSnapshotId: quote.inputSnapshotId }, requestId }
      } else if (nextTarget === 'music') {
        const payload = {...musicInputs(value),creationContext:recipe.creation_context}, quote = await musicService.quote(payload.operation, payload.inputs, value.parameters.rightsConfirmed)
        confirmation.value = { draft: value, credits: quote.retail_credits, sufficient: Number(account.profile?.creditBalance ?? Infinity) >= quote.retail_credits, target: nextTarget, quote, payload, requestId }
      } else {
        const quote = director.value ? await dramaService.previewEntryCredits({ content: director.value.script }) : await dramaService.previewEntryFileCredits(scriptFile.value!)
        confirmation.value = { draft: value, credits: quote.requiredCredits, sufficient: quote.sufficient, target: 'drama', quote, payload: null, requestId, scriptFile: director.value ? undefined : scriptFile.value || undefined, director: director.value ? JSON.parse(JSON.stringify(director.value)) : undefined }
      }
      if (confirmation.value) {
        // 报价期间用户改了草稿，旧价格只作废，不能绑定到新的参数或正文。
        if(inputFingerprint!==canonical(draft())){confirmation.value=null;return}
        confirmation.value.execution = recipe.execution
        confirmation.value.fingerprint = canonical(draft()); confirmation.value.createdAt = Date.now()
        if (['image','video','music'].includes(confirmation.value.target)) (confirmation.value.payload as ProductImageGeneratePayload).creationContext = recipe.creation_context
      }
    } catch (cause) { error.value = message(cause) }
    finally { busy.value = false }
  }
  async function submit() {
    if(!requireLogin())return
    const confirmed = confirmation.value
    if (!confirmed || busy.value || !confirmed.sufficient) return
    busy.value = true; error.value = ''
    try {
      const clearSubmittedDraft=await options.beforeSubmit?.()
      // 点击时只复核已有快照，不自动接受变价；金额改变后要求用户再次点击。
      if (confirmed.target === 'image' || confirmed.target === 'video') {
        const quote = confirmed.target === 'image' ? await productImageService.previewCredits(confirmed.payload as ProductImageGeneratePayload) : await productVideoService.previewCredits(confirmed.payload as ProductVideoCreatePayload)
        if (quote.requiredCredits !== confirmed.credits || !quote.sufficient) {
          confirmed.credits = quote.requiredCredits; confirmed.sufficient = quote.sufficient; confirmed.quote = quote
          error.value = quote.sufficient ? '价格已更新，请核对金额后再次点击生成。' : '积分不足，请充值后继续。'
          return
        }
      } else if (confirmed.target==='music') {
        const input=confirmed.payload as {operation:string;inputs:Record<string,unknown>}
        const quote=await musicService.quote(input.operation,input.inputs,confirmed.draft.parameters.rightsConfirmed)
        if(quote.retail_credits!==confirmed.credits){confirmed.credits=quote.retail_credits;confirmed.quote=quote;error.value='价格已更新，请核对后再次点击生成。';return}
      } else if (confirmed.target==='drama') {
        const quote=confirmed.scriptFile ? await dramaService.previewEntryFileCredits(confirmed.scriptFile) : await dramaService.previewEntryCredits({content:confirmed.director!.script})
        if(quote.requiredCredits!==confirmed.credits || !quote.sufficient){confirmed.credits=quote.requiredCredits;confirmed.sufficient=quote.sufficient;confirmed.quote=quote;error.value=quote.sufficient?'解析价格已更新，请核对后再次点击。':'积分不足，请充值后继续。';return}
      }
      if (!session.value) {
        session.value = await creationService.create({ id: crypto.randomUUID(), entry: confirmed.draft.entry, skill: confirmed.draft.skill, title: (scriptFile.value?.name || confirmed.draft.prompt || '音乐创作').slice(0, 100) })
      }
      // 会话创建完成后再核发许可，首次会话的恢复监听不能误撤销尚未执行的授权。
      await options.beforeExecute?.()
      const saved = await creationService.message(session.value.id, confirmed.requestId, confirmed.draft)
      if (!messages.value.some(item => item.id === saved.id)) messages.value.push(saved)
      focusedMessage.value = saved.id
      await router.replace({ path: '/dashboard', query: { session: session.value.id } })
      let taskId = saved.task_id
      if (!taskId) {
        if (confirmed.target === 'image') {
          taskId = (await creationService.imageTask(confirmed.payload as ProductImageGeneratePayload)).batch_id
        } else if (confirmed.target === 'video') taskId = (await creationService.videoTask(confirmed.payload as ProductVideoCreatePayload)).id
        else if (confirmed.target === 'music') {
          const payload = confirmed.payload as { operation: string; inputs: Record<string, unknown>; creationContext:string }
          taskId = (await creationService.musicTask(payload.operation, payload.inputs, confirmed.draft.parameters.rightsConfirmed, confirmed.requestId, confirmed.quote as MusicQuote, payload.creationContext)).id
        } else {
          const p = confirmed.draft.parameters
          const created = await dramaService.createProject({ title: (confirmed.director?.title || confirmed.scriptFile?.name || '短剧创作').slice(0, 128), themeMode: 'dark', entryIntent: confirmed.draft.skill === 'ad' ? 'ad' : confirmed.draft.entry === 'drama' ? 'drama' : 'general', style: p.style, styleId: p.styleId, aspectRatio: p.aspectRatio, resolution: p.resolution, idempotencyKey: confirmed.requestId })
          taskId = created.projectId
          if (confirmed.director?.mv_run_id) await creationService.attachMv(taskId,confirmed.director.mv_run_id)
          if (confirmed.draft.entry === 'drama' && confirmed.scriptFile) await dramaService.ingestScriptFile(taskId, confirmed.scriptFile)
          else await dramaService.ingestScript(taskId, { content: confirmed.director!.script })
          await dramaService.analyze(taskId, { aspectRatio: p.aspectRatio, resolution: p.resolution, style: p.style })
        }
        const bound = await creationService.bind(session.value.id, saved.id, confirmed.target, taskId)
        messages.value = messages.value.map(item => item.id === saved.id ? bound : item)
      }
      // 任务创建并绑定成功后才清空整份输入；失败保留原图与文字，便于安全重试。
      await clearSubmittedDraft?.()
      if(confirmed.fingerprint===canonical(draft())){
        confirmation.value = null; prompt.value = ''; segments.value = []; references.value = []; scriptFile.value = null; director.value = null; directorAccepted.value = false
        const extra={...parameters.value.extra};delete extra.workspace_tool;parameters.value={...parameters.value,extra}
      }
      await refreshSessions(); await refreshResults()
      if (confirmed.target === 'drama') await router.push(`/drama/${taskId}`)
      void account.refreshProfile().catch(() => {})
    } catch (cause) {
      error.value = message(cause)
      // 明确的快照冲突丢弃旧报价；网络响应丢失则保留提交编号供安全重试。
      const failure=cause as {statusCode?:number;status?:number;response?:{status?:number}}
      if(Number(failure?.statusCode || failure?.status || failure?.response?.status)===409){confirmation.value=null;estimateLabel.value='请重新预估'}
    }
    finally { busy.value = false }
  }
  async function continueImage(batch: string, result: string, video = false) {
    if(busy.value||!requireLogin())return false
    const owner=auth.session.user?.id,sid=session.value?.id,scope=restoreRevision,stamp=canonical(draft())
    const sameScope=()=>!disposed&&owner===auth.session.user?.id&&sid===session.value?.id&&scope===restoreRevision
    /** 私人素材和用户新输入都不能被旧请求回填；内部准备不改动全局草稿。 */
    const current=()=>{if(!sameScope())return false;if(stamp!==canonical(draft())){error.value='准备图片期间草稿已变化，未替换当前输入，请重新选择工具。';return false}return true}
    busy.value = true; error.value = ''
    try {
      const item = await libraryService.saveResult('product_image', batch, result, 'other'), version = item.versions[0]
      if(!current())return false
      if(!version||item.media_type!=='image')throw new Error('原图片尚未形成可用的固定版本。')
      const nextSkill=video?'animate':'edit'
      let nextEntry=entry.value,nextCatalog=catalog.value
      if (!nextCatalog?.skills.some(item => item.id === nextSkill)) {
        nextCatalog=catalogWithCovers(await creationService.catalog('free'));nextEntry='free'
        if(!current())return false
      }
      if(!nextCatalog?.skills.some(item=>item.id===nextSkill))throw new Error('当前修改能力未开放，请选择其他技能。')
      // 同步提交已准备好的目录/来源；使旧目录请求失效，但不提交媒体或费用授权。
      ++revision;loading.value=false;entry.value=nextEntry;catalog.value=nextCatalog
      references.value = [{ item_id: item.id, version_id: version.id, purpose: 'reference', name: item.name, media_type: 'image', preview_url: libraryService.previewUrl(version.preview_url) }]
      // 原海报模板和规划编号不属于新工具；保留它们会把修改误编译为旧模板任务。
      director.value=null;directorAccepted.value=false;confirmation.value=null
      const extra={...parameters.value.extra};for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool'])delete extra[key]
      parameters.value={...parameters.value,extra,templateId:'',selectedTemplateId:'',workflow:'direct',output:video?'video':'image'}
      setSkill(nextSkill); prompt.value = ''; segments.value = []
      return true
    } catch (cause) { if(sameScope())error.value = message(cause);return false }
    // 换号/切会话的新请求自行管理忙碌状态，旧请求不能提前解锁它。
    finally { if(sameScope())busy.value = false }
  }
  async function recordToolTask(task: MusicTask | ProductVideoTask, kind: 'music' | 'video') {
    // 旧工具仍自行报价和创建任务；此处只把已经成功创建的任务接回当前会话。
    try {
      const content = draft()
      content.references = []; content.reference_names = {}
      // 广告来源工具结果回到当前广告会话，不强制改写为旧电商入口。
      content.entry = kind === 'music' ? 'music' : entry.value === 'marketing' ? 'marketing' : 'commerce'
      content.skill = kind === 'music' ? 'remix' : 'showcase'
      content.prompt = kind === 'music' ? `音频工具：${(task as MusicTask).label}` : (task as ProductVideoTask).prompt
      content.segments = [{ type: 'text', text: content.prompt }]
      if (kind === 'music') {
        const music = task as MusicTask
        content.parameters.musicOperation = music.operation
        content.parameters.extra = music.input
      }
      if (!session.value) session.value = await creationService.create({ id: crypto.randomUUID(), entry: content.entry, skill: content.skill, title: content.prompt.slice(0, 100) })
      const bound = await creationService.message(session.value.id, task.id, content, kind, task.id)
      messages.value = [...messages.value.filter(item => item.id !== bound.id), bound]; focusedMessage.value = bound.id
      entry.value = content.entry; setSkill(content.skill)
      await router.replace({ path: '/dashboard', query: { session: session.value.id } }); await refreshSessions(); await refreshResults()
    } catch (cause) { error.value = `任务已创建，可以从工具历史中查看；会话关联未完成：${message(cause)}` }
  }
  onMounted(async () => {
    explicitLogout.value=false
    try {
      let initial: CreationEntryType = route.path === '/dashboard-product' ? 'commerce' : route.path === '/dashboard-product-video' ? 'commerce' : route.path === '/dashboard-music' ? 'music' : ['free', 'drama', 'commerce', 'marketing', 'music', 'image'].includes(String(route.query.entry)) ? route.query.entry as CreationEntryType : 'free'
      // 清理旧版游客文字缓存，不读取或复活其中内容；会话恢复仍走原流程。
      try{localStorage.removeItem('liv-workbench-guest-draft')}catch{/* 存储被禁用不影响当前输入。 */}
      entry.value = initial; skill.value = typeof route.query.skill === 'string' ? route.query.skill : route.path === '/dashboard-product-video' ? 'showcase' : defaultSkills[initial]
      // 深链会话独立恢复，目录或侧栏请求失败不能阻止会话错误和重试入口展示。
      if (typeof route.query.session === 'string' && requireLogin()) await restore(route.query.session)
      else { await loadCatalog(); if (!catalog.value?.skills.some(item => item.id === skill.value)) setSkill(defaultSkills[entry.value]) }
      try { await refreshSessions() } catch { if(!sessionError.value)error.value='会话列表暂时不可用，请稍后刷新。' }
    } catch { if(!sessionError.value)error.value='创作服务暂时不可用，请稍后重试。' }
  })
  watch(() => auth.session.user?.id, async (owner, previous) => {
    sessionDrafts.clear()
    // 清除旧账号的界面请求锁，不表示取消该账号已经提交的媒体任务。
    busy.value=false
    // 账号变化立即撤销临时预览；在途上传的响应也必须匹配原账号才能成为引用。
    for (const item of [...uploads.value]) dismissUpload(item.id)
    // 过期只保留编号意图，同账号重新登录后重新鉴权；显式退出或换号则清空。
    if(previous&&!owner&&!explicitLogout.value)pendingReferences=references.value.map(value=>({...value,preview_url:''}))
    const clearText=explicitLogout.value||!!(owner&&draftOwner&&owner!==draftOwner)
    if(clearText){prompt.value='';segments.value=[];pendingReferences=[];draftOwner=undefined}
    explicitLogout.value=false
    // 登录失效保留文字草稿，但立刻清理上一账号的私人结果、素材与报价。
    ++restoreRevision;restoreController?.abort();if(pollTimer)clearTimeout(pollTimer);sessions.value=[]; messages.value=[]; musicTasks.value=[]; session.value=null; focusedMessage.value=''; references.value=[]; confirmation.value=null; director.value=null
    for(const key of Object.keys(taskData)) delete taskData[key]
    taskActivity.value={}
    entryDrafts.clear()
    segments.value=segments.value.filter(part=>part.type==='text')
    prompt.value=segments.value.map(part=>part.type==='text'?part.text:'').join('')
    if(owner){
      try{localStorage.removeItem('liv-workbench-guest-draft')}catch{/* 清理失败不影响真实账户登录。 */}
      const resume=(!draftOwner||draftOwner===owner)?pendingReferences:[]
      draftOwner=owner;pendingReferences=[]
      await loadCatalog();await refreshSessions()
      if(!previous&&typeof route.query.session==='string'&&!prompt.value.trim())await restore(route.query.session)
      else for(const ref of resume){try{const item=await libraryService.detail(ref.item_id),version=item.versions.find(value=>value.id===ref.version_id);if(version&&auth.session.user?.id===owner)addReference({...ref,name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)})}catch{/* 失效素材不恢复为有效附件，历史任务仍保留。 */}}
    }else await loadCatalog()
  })
  onBeforeUnmount(() => { disposed = true; creditHint.dispose(); uploads.value.forEach(item => { if(item.preview)URL.revokeObjectURL(item.preview) }); restoreController?.abort(); if (pollTimer) clearTimeout(pollTimer) })
  return { taskActivity, entry, skill, prompt, segments, references, parameters, scriptFile, catalog, sessions, session, messages, focusedMessage, busy, loading, error, director, directorAccepted,
    musicTasks, taskData, confirmation, selectedSkill, target, profile, modelSchema, models, ratios, resolutions, qualities, estimateLabel, durationRange, musicSources, focused, activeResult, active,
    uploads, dismissUpload, sessionLoading, sessionError, pendingSession, patchParameters, setText, setSkill, chooseEntry, upload, addReference, removeReference, replaceReference, reorder, refreshSessions, restore, focusMessage, refreshResults, draft, prepare, submit, continueImage, recordToolTask }
}
export function normalizeStatus(status: string) { return ({ success: 'completed', succeeded: 'completed', running: 'in_progress', processing: 'in_progress' } as Record<string, string>)[status] || status }
export function hasPendingLyrics(task?: MusicTask) { return Array.isArray(task?.result.music) && task.result.music.some((song: Record<string, unknown>) => ['queued', 'submitting', 'in_progress'].includes(String(song.lyrics_status))) }
function message(cause: unknown) { return cause instanceof Error ? cause.message : '创作服务暂时不可用，请稍后重试。' }
/** PostgreSQL JSONB 不保留对象字段顺序，重试比较按键排序但保留素材和文本片段顺序。 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
