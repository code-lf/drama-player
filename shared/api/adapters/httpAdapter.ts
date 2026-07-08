import type { AccountProfile, CreditLedgerPage, CreditPackage } from '~/entities/account/types'
import type { CanvasGraph } from '~/entities/canvas/types'
import type {
  DramaCreditPreview,
  DramaAssetItem,
  DramaIntentMode,
  DramaProjectCard,
  DramaProjectDetail,
  DramaRuntimeConfig
} from '~/entities/drama/types'
import type { Project } from '~/entities/project/types'
import type {
  ProductImageCreditPreview,
  ProductImageGeneratePayload,
  ProductImageGenerateResult,
  ProductImageResult,
  ProductSellingPoint
} from '~/entities/product-image/types'
import type {
  StoryboardClipContract,
  StoryboardContinuationPolicy,
  StoryboardContinuityState,
  StoryboardPromptLoad,
  StoryboardReferenceBinding,
  StoryboardRow
} from '~/entities/storyboard/types'
import type { AuthSession } from '~/entities/auth/types'
import type { SystemAnnouncement } from '~/entities/announcement/types'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { getStoryboardCache, setStoryboardCache } from '~/shared/api/storyboardCache'
import type {
  ApiAdapter,
  ApiResponse,
  DramaAssetGeneratePayload,
  DramaCreditPreviewPayload,
  DramaDeleteResult,
  DramaProjectCreatePayload,
  DramaPropUpdatePayload,
  DramaRoleUpdatePayload,
  DramaRoleVoiceUpdatePayload,
  DramaSceneUpdatePayload,
  DramaScriptIngestPayload,
  DramaStoryboardGeneratePayload,
  StoryboardCreatePayload,
  StoryboardGeneratePayload,
  StoryboardUpdatePayload,
  StoryboardVideoBatchPayload,
  StoryboardVideoGeneratePayload,
  WorkflowRunCreatePayload,
} from '~/shared/api/types'

interface BackendProjectItem {
  id: string
  title: string
  cover_url: string
  category: string
  status: 'draft' | 'generating' | 'published'
  updated_at: string
}

interface BackendProjectListResponse {
  items: BackendProjectItem[]
  total: number
}

interface BackendCanvasResponse {
  project_id: string
  version_no: number
  graph: CanvasGraph
}

interface BackendStoryboardRow {
  id?: string
  source_node_id?: string
  episode_no?: number
  sort_index?: number
  shot_no: number
  duration_sec: number
  scene_description: string
  role_name: string
  shot_type: string
  action_desc: string
  mood_desc: string
  sound_fx: string
  dialogue: string
  storyboard_prompt: string
  camera_motion_prompt: string
  role_keys?: string[]
  scene_keys?: string[]
  prop_keys?: string[]
  video_prompt?: string
  video_model?: string
  video_duration_sec?: number
  video_status?: string
  video_progress?: number
  video_task_id?: string
  video_url?: string
  video_error_message?: string
  generation_status?: string
  generation_progress?: number
  generation_error_message?: string
  extra?: Record<string, unknown>
}

interface BackendStoryboardGenerateResponse {
  title: string
  rows: BackendStoryboardRow[]
}

interface BackendStoryboardRowsResponse {
  rows: BackendStoryboardRow[]
  run?: {
    status: string
    total_episodes: number
    current_episode_no: number
    episode_statuses: Record<string, string>
    episode_progresses: Record<string, number>
    generated_counts: Record<string, number>
    expected_counts: Record<string, number>
    model: string
    style: string
    error_message: string
    updated_at: string
  }
}

interface BackendRuntimeModelOption {
  provider: 'alibaba' | 'bytedance'
  model: string
  label: string
  description: string
}

interface BackendRuntimeConfigResponse {
  theme_modes: Array<'dark' | 'light'>
  video_resolutions: string[]
  defaults: Record<string, string>
  text_models: BackendRuntimeModelOption[]
  image_models: BackendRuntimeModelOption[]
  video_models: BackendRuntimeModelOption[]
}

interface BackendAccountProfileResponse {
  id: string
  nickname: string
  avatar_url: string
  credit_balance: number
}

interface BackendCreditPackageResponse {
  id: string
  package_name: string
  credits_amount: number
  price_amount: number
  original_price: number
  is_active: boolean
  sort_order: number
  meta_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface BackendCreditLedgerResponse {
  id: string
  user_id: string
  transaction_type: string
  amount: number
  balance_after: number
  reference_id: string
  description: string
  created_at: string
}

interface BackendCreditLedgerPageResponse {
  items: BackendCreditLedgerResponse[]
  total: number
  page: number
  page_size: number
}

interface BackendAnnouncementResponse {
  id: string
  title: string
  content: string
  level: SystemAnnouncement['level']
  placement: string
  link_text: string
  link_url: string
  is_pinned: boolean
  dismissible: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

interface BackendProductSellingPointResponse {
  index: number
  title: string
  description: string
}

interface BackendProductImageCreditPreviewResponse {
  provider: string
  model: string
  required_credits: number
  current_balance: number
  balance_after: number
  count: number
  split_selling_points: boolean
  sufficient: boolean
  message: string
}

interface BackendProductImageResultResponse {
  id: string
  image_url: string
  prompt: string
  selling_point: BackendProductSellingPointResponse | null
  provider: string
  model: string
  status: string
}

interface BackendProductImageGenerateResponse {
  batch_id: string
  provider: string
  model: string
  required_credits: number
  current_balance: number
  balance_after: number
  count: number
  split_selling_points: boolean
  selling_points: BackendProductSellingPointResponse[]
  results: BackendProductImageResultResponse[]
}

interface BackendDramaAssetItem {
  id: string
  image_url: string
  prompt: string
  status: string
  meta: Record<string, unknown>
}

interface BackendDramaVoiceAssetItem {
  id: string
  audio_url: string
  file_name: string
  mime_type: string
  size_bytes: number
  duration_sec: number | null
  meta: Record<string, unknown>
  created_at: string
}

interface BackendDramaRole {
  key: string
  name: string
  age_identity: string
  personality: string
  appearance: string
  voice_ref: string
  prompt: string
  generation_status: string
  generation_progress: number
  generation_error_message: string
  assets: BackendDramaAssetItem[]
  voice_asset?: BackendDramaVoiceAssetItem | null
}

interface BackendDramaScene {
  key: string
  name: string
  description: string
  prompt: string
  asset: BackendDramaAssetItem | null
}

interface BackendDramaProp {
  key: string
  name: string
  description: string
  prompt: string
  asset: BackendDramaAssetItem | null
}

interface BackendDramaDetailResponse {
  id: string
  project_id: string
  title: string
  current_stage: string
  status: string
  theme_mode: 'dark' | 'light'
  source_script_text: string
  source_file_name: string
  analysis: {
    title: string
    genre: string
    logline: string
    synopsis: string
    total_episodes: number
    current_episode_no: number
    display_meta: {
      aspect_ratio: string
      resolution: string
      style: string
    }
    tags: string[]
    cover_prompt: string
    cover_image_url: string
    outline: string
    background_traits: string
    character_bios: Array<{
      key: string
      name: string
      identity: string
      summary: string
      traits: string[]
    }>
    episode_summaries: Array<{
      episode_no: number
      title: string
      summary: string
    }>
    episode_details: Array<{
      episode_no: number
      title: string
      content: string
    }>
    roles: BackendDramaRole[]
    scenes: BackendDramaScene[]
    props: BackendDramaProp[]
    intent_router?: {
      entry_intent?: DramaIntentMode
      detected_mode?: DramaIntentMode
      confidence?: number
      signals?: string[]
      user_override_mode?: DramaIntentMode | ''
      effective_mode?: DramaIntentMode
    }
  }
  analysis_run: {
    status: string
    current_stage: string
    stage_statuses: Record<string, string>
    stage_progresses: Record<string, number>
    cover_status: string
    cover_error_message?: string
    started_at: string
    updated_at: string
    finished_at: string
    error_message: string
  }
  storyboard_run?: BackendStoryboardRowsResponse['run']
  storyboards: BackendStoryboardRow[]
}

interface BackendDramaCreditPreviewResponse {
  action: string
  task_type: string
  provider: string
  model: string
  required_credits: number
  current_balance: number
  balance_after: number
  sufficient: boolean
  quantity: number
  quantity_unit: string
  pricing_snapshot: Record<string, unknown>
  message: string
  warnings?: string[]
  prompt_load?: StoryboardPromptLoad
  mode_hint?: DramaIntentMode
  repair_patch_summary?: string
}

interface BackendStoryboardVideoRunResponse {
  storyboard_row_id: string
  run_id: string
  status: string
}

interface BackendStoryboardVideoPromptResponse {
  storyboard_row_id: string
  video_prompt: string
  video_model: string
  video_duration_sec: number
  clip_contract?: {
    intent?: string
    subject?: string
    scene_anchor?: string
    action_anchor?: string
    endpoint?: string
    mode?: 'drama' | 'ad' | 'general'
    story_function?: 'hook' | 'conflict' | 'reveal' | 'transition' | 'payoff' | 'cta'
    camera_goal?: string
    performance_focus?: string
    must_keep?: string[]
    forbidden_drift?: string[]
    shot_budget?: string
  }
  reference_bindings?: Array<{
    url?: string
    type?: 'image' | 'video'
    role?: 'identity' | 'scene' | 'prop' | 'motion' | 'endpoint'
    priority?: number
    label?: string
    source?: string
  }>
  continuity_state?: {
    accepted_take_id?: string
    last_frame_summary?: string
    screen_direction?: string
    camera_phase?: string
    locked_appearance?: string[]
    locked_props?: string[]
    next_beat?: string
  }
  retry_reason?: '' | 'identity' | 'motion' | 'camera' | 'scene' | 'prop' | 'rhythm' | 'quality'
  warnings?: string[]
  prompt_load?: StoryboardPromptLoad
  mode_hint?: DramaIntentMode
  repair_patch_summary?: string
}

interface BackendStoryboardVideoBatchResponse {
  runs: BackendStoryboardVideoRunResponse[]
}

function formatStoryboardVideoErrorMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (cleaned.includes('InvalidParameter') && cleaned.includes('Failed to download')) {
    return '参考图链接已失效，阿里视频服务无法下载当前分镜绑定的素材。请重新生成或重新上传角色图、场景图或道具图后，再次提交视频生成。'
  }
  if (cleaned.includes('当前分镜没有可用参考图')) {
    return '当前分镜缺少可用参考图。请先绑定至少一张已生成的角色图、场景图或道具图，再生成视频。'
  }
  if (cleaned.includes('InvalidParameter')) {
    return '视频生成参数不符合当前模型要求，请检查参考图、时长、分辨率和音频模式后重试。'
  }
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned
}

function normalizeStoryboardVideoPrompt(prompt: string, targetDuration: number): string {
  const lines = (prompt || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
  if (!lines.length || !lines.every(line => /^镜头\d+/.test(line))) return prompt || ''

  const pattern = /^镜头(?<index>\d+)\s+(?:(?<start>\d+(?:\.\d+)?)s-(?<end>\d+(?:\.\d+)?)s|(?<duration>\d+(?:\.\d+)?)s)时间[:：]?(?<timeLabel>[^\[,，]+)(?<suffix>.*)$/
  const parsed = lines.map((line) => {
    const matched = line.match(pattern)
    if (!matched?.groups) return null
    const currentDuration = matched.groups.start && matched.groups.end
      ? Math.max(0, Number(matched.groups.end) - Number(matched.groups.start))
      : Number(matched.groups.duration || 0)
    return {
      index: matched.groups.index,
      duration: currentDuration,
      timeLabel: (matched.groups.timeLabel || '日').trim(),
      suffix: (matched.groups.suffix || '').trim(),
      raw: line
    }
  })
  if (parsed.some(item => !item) || !parsed.length) return prompt || ''

  const totalDuration = parsed.reduce((sum, item) => sum + Number(item?.duration || 0), 0)
  if (totalDuration <= 0) return prompt || ''

  let cursor = 0
  const safeDuration = Math.max(0.1, Number(targetDuration || totalDuration))
  return parsed.map((item, index) => {
    const duration = Number(item?.duration || 0)
    const scaledDuration = duration * (safeDuration / totalDuration)
    const endTime = index === parsed.length - 1 ? safeDuration : cursor + scaledDuration
    const line = `镜头${item?.index} ${Number(cursor.toFixed(1)).toString().replace(/\.0$/, '')}-${Number(endTime.toFixed(1)).toString().replace(/\.0$/, '')}s时间:${item?.timeLabel}${item?.suffix}`
    cursor = endTime
    return line
  }).join('\n')
}

interface BackendWorkflowRunCreateResponse {
  run_id: string
  status: string
  created_at: string
}

interface BackendWorkflowRunStatusResponse {
  run_id: string
  status: string
  error_code: string
  error_message: string
  output_snapshot: Record<string, unknown>
}

interface BackendWechatTicketResponse {
  ticket_code: string
  qr_code_url: string
  expires_in_sec: number
}

interface BackendWechatPollResponse {
  status: 'pending' | 'scanned' | 'confirmed' | 'expired'
  token: string
}

function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    success: true,
    message,
    data
  }
}

interface BackendDramaProjectCardResponse {
  id: string
  project_id: string
  title: string
  status: string
  current_stage: string
  cover_image_url: string
  genre: string
  tags: string[]
  updated_at: string
  created_at: string
}

interface BackendDramaProjectPageResponse {
  items: BackendDramaProjectCardResponse[]
  total: number
  page: number
  page_size: number
}

function mapProject(raw: BackendProjectItem): Project {
  return {
    id: raw.id,
    title: raw.title,
    coverUrl: raw.cover_url || 'linear-gradient(140deg, #1f2b3f, #c27f86)',
    status: raw.status,
    category: raw.category || 'AI漫剧',
    // 后端首期暂未返回作者字段，这里给统一展示占位，避免页面渲染分支过多。
    author: '创作导演',
    updatedAt: raw.updated_at
  }
}

function mapDramaProjectCard(raw: BackendDramaProjectCardResponse): DramaProjectCard {
  return {
    id: raw.id,
    projectId: raw.project_id,
    title: raw.title,
    status: raw.status,
    currentStage: raw.current_stage,
    coverImageUrl: raw.cover_image_url || '',
    genre: raw.genre || '',
    tags: raw.tags || [],
    updatedAt: raw.updated_at || '',
    createdAt: raw.created_at || ''
  }
}

function mapAccountProfile(raw: BackendAccountProfileResponse): AccountProfile {
  return {
    id: raw.id,
    nickname: raw.nickname || '',
    avatarUrl: raw.avatar_url || '',
    creditBalance: raw.credit_balance || 0
  }
}

function mapCreditPackage(raw: BackendCreditPackageResponse): CreditPackage {
  return {
    id: raw.id,
    packageName: raw.package_name,
    creditsAmount: raw.credits_amount,
    priceAmount: Number(raw.price_amount || 0),
    originalPrice: Number(raw.original_price || 0),
    isActive: raw.is_active,
    sortOrder: raw.sort_order || 100,
    metaJson: raw.meta_json || {},
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || ''
  }
}

function mapCreditLedgerPage(raw: BackendCreditLedgerPageResponse): CreditLedgerPage {
  return {
    items: (raw.items || []).map((item) => ({
      id: item.id,
      userId: item.user_id,
      transactionType: item.transaction_type,
      amount: item.amount,
      balanceAfter: item.balance_after,
      referenceId: item.reference_id || '',
      description: item.description || '',
      createdAt: item.created_at || ''
    })),
    total: raw.total || 0,
    page: raw.page || 1,
    pageSize: raw.page_size || 10
  }
}

function mapAnnouncement(raw: BackendAnnouncementResponse): SystemAnnouncement {
  return {
    id: raw.id,
    title: raw.title || '',
    content: raw.content || '',
    level: raw.level || 'info',
    placement: raw.placement || 'global',
    linkText: raw.link_text || '',
    linkUrl: raw.link_url || '',
    isPinned: Boolean(raw.is_pinned),
    dismissible: Boolean(raw.dismissible),
    sortOrder: Number(raw.sort_order || 100),
    startsAt: raw.starts_at || '',
    endsAt: raw.ends_at || '',
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || ''
  }
}

function mapProductSellingPoint(raw: BackendProductSellingPointResponse): ProductSellingPoint {
  return {
    index: raw.index || 1,
    title: raw.title || '',
    description: raw.description || ''
  }
}

function mapProductImageCreditPreview(raw: BackendProductImageCreditPreviewResponse): ProductImageCreditPreview {
  return {
    provider: raw.provider || '',
    model: raw.model || '',
    requiredCredits: raw.required_credits || 0,
    currentBalance: raw.current_balance || 0,
    balanceAfter: raw.balance_after || 0,
    count: raw.count || 1,
    splitSellingPoints: Boolean(raw.split_selling_points),
    sufficient: Boolean(raw.sufficient),
    message: raw.message || ''
  }
}

function mapProductImageResult(raw: BackendProductImageResultResponse): ProductImageResult {
  return {
    id: raw.id || '',
    imageUrl: raw.image_url || '',
    prompt: raw.prompt || '',
    sellingPoint: raw.selling_point ? mapProductSellingPoint(raw.selling_point) : null,
    provider: raw.provider || '',
    model: raw.model || '',
    status: raw.status || ''
  }
}

function mapProductImageGenerateResult(raw: BackendProductImageGenerateResponse): ProductImageGenerateResult {
  return {
    batchId: raw.batch_id || '',
    provider: raw.provider || '',
    model: raw.model || '',
    requiredCredits: raw.required_credits || 0,
    currentBalance: raw.current_balance || 0,
    balanceAfter: raw.balance_after || 0,
    count: raw.count || 0,
    splitSellingPoints: Boolean(raw.split_selling_points),
    sellingPoints: (raw.selling_points || []).map(mapProductSellingPoint),
    results: (raw.results || []).map(mapProductImageResult)
  }
}

function buildProductImagePayload(payload: ProductImageGeneratePayload) {
  // 商品图请求统一在这里转成后端 snake_case，页面组件只维护 camelCase。
  return {
    prompt: payload.prompt,
    model: payload.model || '',
    count: payload.count,
    split_selling_points: payload.splitSellingPoints,
    aspect_ratio: payload.aspectRatio,
    resolution: payload.resolution,
    style: payload.style,
    negative_prompt: payload.negativePrompt || '',
    reference_images: (payload.referenceImages || []).map((item) => ({
      name: item.name,
      data_url: item.dataUrl
    }))
  }
}

function mapStoryboardClipContract(raw?: Record<string, unknown>): StoryboardClipContract {
  return {
    intent: String(raw?.intent || ''),
    subject: String(raw?.subject || ''),
    sceneAnchor: String(raw?.scene_anchor || raw?.sceneAnchor || ''),
    actionAnchor: String(raw?.action_anchor || raw?.actionAnchor || ''),
    endpoint: String(raw?.endpoint || ''),
    mode: ['drama', 'ad', 'general'].includes(String(raw?.mode || '')) ? raw?.mode as StoryboardClipContract['mode'] : 'drama',
    storyFunction: ['hook', 'conflict', 'reveal', 'transition', 'payoff', 'cta'].includes(String(raw?.story_function || raw?.storyFunction || ''))
      ? String(raw?.story_function || raw?.storyFunction) as StoryboardClipContract['storyFunction']
      : 'transition',
    cameraGoal: String(raw?.camera_goal || raw?.cameraGoal || ''),
    performanceFocus: String(raw?.performance_focus || raw?.performanceFocus || ''),
    mustKeep: Array.isArray(raw?.must_keep) ? raw.must_keep as string[] : (Array.isArray(raw?.mustKeep) ? raw.mustKeep as string[] : []),
    forbiddenDrift: Array.isArray(raw?.forbidden_drift) ? raw.forbidden_drift as string[] : (Array.isArray(raw?.forbiddenDrift) ? raw.forbiddenDrift as string[] : []),
    shotBudget: String(raw?.shot_budget || raw?.shotBudget || '')
  }
}

function mapStoryboardReferenceBindings(raw?: Array<Record<string, unknown>>): StoryboardReferenceBinding[] {
  return (raw || []).map((binding) => ({
    url: String(binding?.url || ''),
    type: binding?.type === 'video' ? 'video' : 'image',
    role: ['identity', 'scene', 'prop', 'motion', 'endpoint'].includes(String(binding?.role || ''))
      ? binding.role as StoryboardReferenceBinding['role']
      : 'identity',
    priority: Number(binding?.priority || 100),
    label: String(binding?.label || ''),
    source: String(binding?.source || '')
  })).filter((binding) => binding.url)
}

function mapStoryboardContinuityState(raw?: Record<string, unknown>): StoryboardContinuityState {
  return {
    acceptedTakeId: String(raw?.accepted_take_id || raw?.acceptedTakeId || ''),
    lastFrameSummary: String(raw?.last_frame_summary || raw?.lastFrameSummary || ''),
    screenDirection: String(raw?.screen_direction || raw?.screenDirection || ''),
    cameraPhase: String(raw?.camera_phase || raw?.cameraPhase || ''),
    lockedAppearance: Array.isArray(raw?.locked_appearance) ? raw.locked_appearance as string[] : (Array.isArray(raw?.lockedAppearance) ? raw.lockedAppearance as string[] : []),
    lockedProps: Array.isArray(raw?.locked_props) ? raw.locked_props as string[] : (Array.isArray(raw?.lockedProps) ? raw.lockedProps as string[] : []),
    nextBeat: String(raw?.next_beat || raw?.nextBeat || '')
  }
}

function mapStoryboardRuntimeExtra(raw?: Record<string, unknown>) {
  return {
    ...raw,
    clipContract: mapStoryboardClipContract((raw?.clip_contract as Record<string, unknown> | undefined) || (raw?.clipContract as Record<string, unknown> | undefined)),
    referenceBindings: mapStoryboardReferenceBindings((raw?.reference_bindings as Array<Record<string, unknown>> | undefined) || (raw?.referenceBindings as Array<Record<string, unknown>> | undefined)),
    continuityState: mapStoryboardContinuityState((raw?.continuity_state as Record<string, unknown> | undefined) || (raw?.continuityState as Record<string, unknown> | undefined)),
    retryReason: String(raw?.retry_reason || raw?.retryReason || ''),
    warnings: Array.isArray(raw?.warnings) ? raw.warnings as string[] : [],
    promptLoad: String(raw?.prompt_load || raw?.promptLoad || 'low') as StoryboardPromptLoad,
    continuationPolicy: (String(raw?.continuation_policy || raw?.continuationPolicy || 'auto') as StoryboardContinuationPolicy),
    continuationFromRowId: String(raw?.continuation_from_row_id || raw?.continuationFromRowId || ''),
    resolvedContinuationFromRowId: String(raw?.resolved_continuation_from_row_id || raw?.resolvedContinuationFromRowId || ''),
    autoContinuityReason: String(raw?.auto_continuity_reason || raw?.autoContinuityReason || ''),
    acceptedTakeId: String(raw?.accepted_take_id || raw?.acceptedTakeId || ''),
    acceptedSummary: String(raw?.accepted_summary || raw?.acceptedSummary || ''),
    repairPatchSummary: String(raw?.repair_patch_summary || raw?.repairPatchSummary || ''),
    repairRevision: Number(raw?.repair_revision || raw?.repairRevision || 0),
    lastRetryReason: String(raw?.last_retry_reason || raw?.lastRetryReason || '')
  }
}

function mapStoryboardRows(projectId: string, nodeId: string, rows: BackendStoryboardRow[]): StoryboardRow[] {
  return rows.map((row) => ({
    id: row.id || `${projectId}-${row.source_node_id || nodeId}-${row.shot_no}`,
    sourceNodeId: row.source_node_id || nodeId,
    episodeNo: row.episode_no || 1,
    sortIndex: row.sort_index || row.shot_no,
    shotNo: row.shot_no,
    durationSec: row.duration_sec,
    sceneDescription: row.scene_description,
    roleName: row.role_name,
    shotType: row.shot_type,
    actionDesc: row.action_desc,
    moodDesc: row.mood_desc,
    soundFx: row.sound_fx,
    dialogue: row.dialogue || '',
    storyboardPrompt: row.storyboard_prompt,
    cameraMotionPrompt: row.camera_motion_prompt,
    roleKeys: row.role_keys || [],
    sceneKeys: row.scene_keys || [],
    propKeys: row.prop_keys || [],
    videoPrompt: normalizeStoryboardVideoPrompt(
      row.video_prompt || row.camera_motion_prompt || row.action_desc || '',
      row.video_duration_sec || row.duration_sec || 5
    ),
    videoModel: row.video_model || '',
    videoDurationSec: row.video_duration_sec || 5,
    videoStatus: row.video_status || 'idle',
    videoProgress: row.video_progress || 0,
    videoTaskId: row.video_task_id || '',
    videoUrl: row.video_url || '',
    videoErrorMessage: formatStoryboardVideoErrorMessage(row.video_error_message || ''),
    generationStatus: row.generation_status || 'idle',
    generationProgress: row.generation_progress || 0,
    generationErrorMessage: row.generation_error_message || '',
    extra: mapStoryboardRuntimeExtra(row.extra || {})
  }))
}

function mapDramaAsset(raw: BackendDramaAssetItem): DramaAssetItem {
  return {
    id: raw.id,
    imageUrl: raw.image_url,
    prompt: raw.prompt,
    status: raw.status,
    meta: raw.meta || {}
  }
}

function mapDramaVoiceAsset(raw?: BackendDramaVoiceAssetItem | null) {
  if (!raw) return null
  return {
    id: raw.id,
    audioUrl: raw.audio_url || '',
    fileName: raw.file_name || '',
    mimeType: raw.mime_type || '',
    sizeBytes: Number(raw.size_bytes || 0),
    durationSec: raw.duration_sec === null || raw.duration_sec === undefined ? null : Number(raw.duration_sec),
    meta: raw.meta || {},
    createdAt: raw.created_at || ''
  }
}

function mapDramaDetail(raw: BackendDramaDetailResponse): DramaProjectDetail {
  return {
    id: raw.id,
    projectId: raw.project_id,
    title: raw.title,
    currentStage: raw.current_stage,
    status: raw.status,
    themeMode: raw.theme_mode,
    sourceScriptText: raw.source_script_text,
    sourceFileName: raw.source_file_name,
    analysis: {
      title: raw.analysis?.title || '',
      genre: raw.analysis?.genre || '',
      logline: raw.analysis?.logline || '',
      synopsis: raw.analysis?.synopsis || '',
      totalEpisodes: raw.analysis?.total_episodes || 1,
      currentEpisodeNo: raw.analysis?.current_episode_no || 1,
      displayMeta: {
        aspectRatio: raw.analysis?.display_meta?.aspect_ratio || '',
        resolution: raw.analysis?.display_meta?.resolution || '',
        style: raw.analysis?.display_meta?.style || ''
      },
      tags: raw.analysis?.tags || [],
      coverPrompt: raw.analysis?.cover_prompt || '',
      coverImageUrl: raw.analysis?.cover_image_url || '',
      outline: raw.analysis?.outline || '',
      backgroundTraits: raw.analysis?.background_traits || '',
      characterBios: (raw.analysis?.character_bios || []).map((item) => ({
        key: item.key,
        name: item.name,
        identity: item.identity,
        summary: item.summary,
        traits: item.traits || []
      })),
      episodeSummaries: (raw.analysis?.episode_summaries || []).map((item) => ({
        episodeNo: item.episode_no,
        title: item.title,
        summary: item.summary
      })),
      episodeDetails: (raw.analysis?.episode_details || []).map((item) => ({
        episodeNo: item.episode_no,
        title: item.title,
        content: item.content
      })),
      roles: (raw.analysis?.roles || []).map((role) => ({
        key: role.key,
        name: role.name,
        ageIdentity: role.age_identity,
        personality: role.personality,
        appearance: role.appearance,
        voiceRef: role.voice_ref,
        prompt: role.prompt,
        generationStatus: role.generation_status || 'idle',
        generationProgress: role.generation_progress || 0,
        generationErrorMessage: role.generation_error_message || '',
        assets: (role.assets || []).map(mapDramaAsset),
        voiceAsset: mapDramaVoiceAsset(role.voice_asset)
      })),
      scenes: (raw.analysis?.scenes || []).map((scene) => ({
        key: scene.key,
        name: scene.name,
        description: scene.description,
        prompt: scene.prompt,
        asset: scene.asset ? mapDramaAsset(scene.asset) : null
      })),
      props: (raw.analysis?.props || []).map((prop) => ({
        key: prop.key,
        name: prop.name,
        description: prop.description,
        prompt: prop.prompt,
        asset: prop.asset ? mapDramaAsset(prop.asset) : null
      })),
      intentRouter: {
        entryIntent: raw.analysis?.intent_router?.entry_intent || 'drama',
        detectedMode: raw.analysis?.intent_router?.detected_mode || 'drama',
        confidence: Number(raw.analysis?.intent_router?.confidence || 0.55),
        signals: raw.analysis?.intent_router?.signals || [],
        userOverrideMode: raw.analysis?.intent_router?.user_override_mode || '',
        effectiveMode: raw.analysis?.intent_router?.effective_mode || 'drama'
      }
    },
    analysisRun: {
      status: raw.analysis_run?.status || 'idle',
      currentStage: raw.analysis_run?.current_stage || '',
      stageStatuses: raw.analysis_run?.stage_statuses || {},
      stageProgresses: raw.analysis_run?.stage_progresses || {},
      coverStatus: raw.analysis_run?.cover_status || 'idle',
      coverErrorMessage: raw.analysis_run?.cover_error_message || '',
      startedAt: raw.analysis_run?.started_at || '',
      updatedAt: raw.analysis_run?.updated_at || '',
      finishedAt: raw.analysis_run?.finished_at || '',
      errorMessage: raw.analysis_run?.error_message || ''
    },
    storyboardRun: {
      status: raw.storyboard_run?.status || 'idle',
      totalEpisodes: raw.storyboard_run?.total_episodes || 1,
      currentEpisodeNo: raw.storyboard_run?.current_episode_no || 1,
      episodeStatuses: raw.storyboard_run?.episode_statuses || {},
      episodeProgresses: raw.storyboard_run?.episode_progresses || {},
      generatedCounts: raw.storyboard_run?.generated_counts || {},
      expectedCounts: raw.storyboard_run?.expected_counts || {},
      model: raw.storyboard_run?.model || '',
      style: raw.storyboard_run?.style || '',
      errorMessage: raw.storyboard_run?.error_message || '',
      updatedAt: raw.storyboard_run?.updated_at || ''
    },
    storyboards: mapStoryboardRows(raw.project_id, `drama-${raw.project_id}`, raw.storyboards || [])
  }
}

function mapDramaCreditPreview(raw: BackendDramaCreditPreviewResponse): DramaCreditPreview {
  return {
    action: raw.action,
    taskType: raw.task_type,
    provider: raw.provider,
    model: raw.model,
    requiredCredits: raw.required_credits || 0,
    currentBalance: raw.current_balance || 0,
    balanceAfter: raw.balance_after || 0,
    sufficient: Boolean(raw.sufficient),
    quantity: Number(raw.quantity || 0),
    quantityUnit: raw.quantity_unit || '',
    pricingSnapshot: raw.pricing_snapshot || {},
    message: raw.message || '',
    warnings: raw.warnings || [],
    promptLoad: raw.prompt_load || 'low',
    modeHint: raw.mode_hint || 'drama',
    repairPatchSummary: raw.repair_patch_summary || ''
  }
}

function createEmptyGraph(): CanvasGraph {
  return {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

async function request<T>(path: string, options?: Parameters<typeof $fetch<T>>[1]): Promise<T> {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBase as string
  let resolvedUserId = '00000000-0000-0000-0000-000000000001'
  if (import.meta.client) {
    try {
      const authStore = useAuthStore()
      resolvedUserId = authStore.session.user?.id || resolvedUserId
    } catch {
      resolvedUserId = '00000000-0000-0000-0000-000000000001'
    }
  }

  return $fetch<T>(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...((options?.headers as Record<string, string>) || {}),
      'X-User-Id': resolvedUserId
    }
  })
}

export const httpAdapter: ApiAdapter = {
  async getLandingProjects(category) {
    const response = await request<BackendProjectListResponse>('/projects')
    const items = response.items.map(mapProject)
    const filtered = category && category !== '全部' ? items.filter((item) => item.category === category) : items
    return ok(filtered)
  },

  async createProject(payload) {
    const created = await request<BackendProjectItem>('/projects', {
      method: 'POST',
      body: {
        title: payload.title || '未命名项目',
        category: payload.category || 'AI漫剧'
      }
    })

    return ok(mapProject(created), 'created')
  },

  async getDramaProjects(page = 1, pageSize = 10) {
    const response = await request<BackendDramaProjectPageResponse>(`/drama/projects?page=${page}&page_size=${pageSize}`)
    return ok({
      items: (response.items || []).map(mapDramaProjectCard),
      total: response.total || 0,
      page: response.page || page,
      pageSize: response.page_size || pageSize
    })
  },

  async deleteDramaProject(projectId) {
    const response = await request<{ deleted_ids: string[] }>(`/drama/projects/${projectId}`, {
      method: 'DELETE'
    })
    const result: DramaDeleteResult = {
      deletedIds: response.deleted_ids || []
    }
    return ok(result)
  },

  async batchDeleteDramaProjects(ids) {
    const response = await request<{ deleted_ids: string[] }>('/drama/projects/batch-delete', {
      method: 'POST',
      body: { ids }
    })
    const result: DramaDeleteResult = {
      deletedIds: response.deleted_ids || []
    }
    return ok(result)
  },

  async getWechatLoginTicket() {
    const ticket = await request<BackendWechatTicketResponse>('/auth/wechat/ticket', { method: 'POST' })
    return ok({
      qrCode: ticket.qr_code_url,
      ticketId: ticket.ticket_code,
      expiresInSec: ticket.expires_in_sec
    })
  },

  async checkWechatLogin(ticketId) {
    const poll = await request<BackendWechatPollResponse>(`/auth/wechat/poll?ticket_code=${encodeURIComponent(ticketId)}`)
    const loggedIn = poll.status === 'confirmed'
    const session: AuthSession = {
      loggedIn,
      token: poll.token || '',
      expiresAt: '',
      user: loggedIn
        ? {
            id: '00000000-0000-0000-0000-000000000001',
            nickname: '创作导演',
            avatar: 'https://placehold.co/120x120/png'
          }
        : undefined
    }
    return ok(session)
  },

  async getAccountProfile() {
    const response = await request<BackendAccountProfileResponse>('/account/me')
    return ok(mapAccountProfile(response))
  },

  async getAccountCreditPackages() {
    const response = await request<BackendCreditPackageResponse[]>('/account/credit-packages')
    return ok((response || []).map(mapCreditPackage))
  },

  async getAccountCreditLedgers(page = 1, pageSize = 10) {
    const response = await request<BackendCreditLedgerPageResponse>(`/account/credit-ledgers?page=${page}&page_size=${pageSize}`)
    return ok(mapCreditLedgerPage(response))
  },

  async getActiveAnnouncements(placement = 'global') {
    const response = await request<BackendAnnouncementResponse[]>(`/announcements/active?placement=${encodeURIComponent(placement)}`)
    return ok((response || []).map(mapAnnouncement))
  },

  async previewProductImageCredits(payload) {
    const response = await request<BackendProductImageCreditPreviewResponse>('/product-image/credit-preview', {
      method: 'POST',
      body: {
        prompt: payload.prompt,
        model: payload.model || '',
        count: payload.count,
        split_selling_points: payload.splitSellingPoints
      }
    })
    return ok(mapProductImageCreditPreview(response))
  },

  async splitProductSellingPoints(payload) {
    const response = await request<BackendProductSellingPointResponse[]>('/product-image/selling-points', {
      method: 'POST',
      body: payload
    })
    return ok((response || []).map(mapProductSellingPoint))
  },

  async generateProductImages(payload) {
    const response = await request<BackendProductImageGenerateResponse>('/product-image/generate', {
      method: 'POST',
      body: buildProductImagePayload(payload)
    })
    return ok(mapProductImageGenerateResult(response))
  },

  async phoneLogin(phone: string, code: string) {
    const res = await request<any>('/auth/phone/login', {
      method: 'POST',
      body: { phone, code }
    })
    return ok({
      loggedIn: true,
      token: res.token,
      expiresAt: '',
      user: {
        id: res.user_id,
        nickname: `用户_${phone.slice(-4)}`,
        avatar: 'https://placehold.co/120x120/png'
      }
    } as AuthSession)
  },

  async sendSmsCode(phone: string) {
    const res = await request<any>('/auth/sms/send', {
      method: 'POST',
      body: { phone }
    })
    return ok(res)
  },

  async getRuntimeConfig() {
    const response = await request<BackendRuntimeConfigResponse>('/config/runtime')
    
    const mapRuntimeModelOption = (raw: any) => ({
      provider: raw.provider as 'alibaba' | 'bytedance',
      model: raw.model,
      label: raw.label,
      description: raw.description,
      baseCredits: raw.base_credits ?? 1,
      billingMode: raw.billing_mode ?? 'per_call'
    })

    const data: DramaRuntimeConfig = {
      themeModes: response.theme_modes,
      videoResolutions: response.video_resolutions,
      defaults: response.defaults,
      textModels: response.text_models.map(mapRuntimeModelOption) as any,
      imageModels: response.image_models.map(mapRuntimeModelOption) as any,
      videoModels: response.video_models.map(mapRuntimeModelOption) as any
    }
    return ok(data)
  },

  async getCanvasGraph(projectId) {
    try {
      const response = await request<BackendCanvasResponse>(`/canvas/${projectId}`)
      return ok(response.graph)
    } catch (error: any) {
      // 首次创建项目时后端还没有画布记录，返回空图而不是抛错，避免打断创作入口。
      if (error?.status === 404 || error?.statusCode === 404) {
        return ok(createEmptyGraph(), 'empty')
      }
      throw error
    }
  },

  async saveCanvasGraph(projectId, graph) {
    await request<BackendCanvasResponse>(`/canvas/${projectId}`, {
      method: 'PUT',
      body: graph
    })
    return ok(true, 'saved')
  },

  async getStoryboardRows(projectId) {
    try {
      const response = await request<BackendStoryboardRowsResponse>(`/storyboard/rows?project_id=${encodeURIComponent(projectId)}`)
      const rows = mapStoryboardRows(projectId, 'storyboard', response.rows)
      setStoryboardCache(projectId, rows)
      return ok(rows)
    } catch (error: any) {
      // 兼容旧版本后端尚未提供 rows 接口时，继续沿用本地缓存兜底。
      if (error?.status === 404 || error?.statusCode === 404) {
        return ok(getStoryboardCache(projectId), 'cache-fallback')
      }
      throw error
    }
  },

  async generateStoryboard(payload: StoryboardGeneratePayload) {
    const response = await request<BackendStoryboardGenerateResponse>('/storyboard/generate', {
      method: 'POST',
      body: {
        project_id: payload.projectId,
        node_id: payload.nodeId,
        content: payload.content,
        shot_count: payload.shotCount,
        model: payload.model || '',
        provider: payload.provider || 'alibaba',
        resolution: payload.resolution || '',
        style: payload.style || '',
        camera_preset: payload.cameraPreset || '',
        script_input_mode: payload.scriptInputMode || 'plot'
      }
    })

    const rows = mapStoryboardRows(payload.projectId, payload.nodeId, response.rows)
    setStoryboardCache(payload.projectId, rows)
    return ok(rows, 'generated')
  },

  async createWorkflowRun(payload: WorkflowRunCreatePayload) {
    const response = await request<BackendWorkflowRunCreateResponse>('/workflow/runs', {
      method: 'POST',
      body: {
        project_id: payload.projectId,
        trigger_node_id: payload.triggerNodeId,
        input_snapshot: payload.inputSnapshot
      }
    })

    return ok({
      runId: response.run_id,
      status: response.status
    })
  },

  async getWorkflowRun(runId: string) {
    const response = await request<BackendWorkflowRunStatusResponse>(`/workflow/runs/${runId}`)
    return ok({
      runId: response.run_id,
      status: response.status,
      errorCode: response.error_code || '',
      errorMessage: response.error_message || '',
      outputSnapshot: response.output_snapshot || {}
    })
  },

  async createDramaProject(payload: DramaProjectCreatePayload) {
    const response = await request<BackendDramaDetailResponse>('/drama/projects', {
      method: 'POST',
      body: {
        title: payload.title || '未命名短剧项目',
        theme_mode: payload.themeMode || 'dark',
        entry_intent: payload.entryIntent || 'drama'
      }
    })
    return ok(mapDramaDetail(response), 'created')
  },

  async getDramaProject(projectId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}`)
    return ok(mapDramaDetail(response))
  },

  async ingestDramaScript(projectId: string, payload: DramaScriptIngestPayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/script-ingest`, {
      method: 'POST',
      body: {
        content: payload.content,
        file_name: payload.fileName || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaIntentRouter(projectId: string, payload: { mode: DramaIntentMode }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/intent-router`, {
      method: 'PATCH',
      body: {
        mode: payload.mode
      }
    })
    return ok(mapDramaDetail(response))
  },

  async previewDramaCredits(projectId: string, payload: DramaCreditPreviewPayload) {
    const response = await request<BackendDramaCreditPreviewResponse>(`/drama/projects/${projectId}/credit-preview`, {
      method: 'POST',
      body: {
        action: payload.action,
        model: payload.model || '',
        provider: payload.provider || '',
        duration_sec: payload.durationSec || 5,
        resolution: payload.resolution || '',
        audio: payload.audio ?? true,
        overwrite: payload.overwrite ?? true,
        shot_count: payload.shotCount || 12,
        row_id: payload.rowId || '',
        role_keys: payload.roleKeys || [],
        scene_keys: payload.sceneKeys || [],
        prop_keys: payload.propKeys || [],
        reference_urls: payload.referenceUrls || [],
        reference_bindings: payload.referenceBindings || [],
        continuation_from_row_id: payload.continuationFromRowId || '',
        continuation_policy: payload.continuationPolicy || 'auto',
        retry_reason: payload.retryReason || ''
      }
    })
    return ok(mapDramaCreditPreview(response))
  },

  async analyzeDrama(projectId: string, payload?: { model?: string; aspectRatio?: string; resolution?: string; style?: string }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/analyze`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        aspect_ratio: payload?.aspectRatio || '',
        resolution: payload?.resolution || '',
        style: payload?.style || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async regenerateDramaCover(projectId: string, payload?: { style?: string }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/cover-regenerate`, {
      method: 'POST',
      body: {
        style: payload?.style || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async createDramaRole(projectId: string, payload: { name: string; ageIdentity: string; gender: string; voiceRef?: string; prompt?: string; description?: string }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/roles`, {
      method: 'POST',
      body: {
        name: payload.name,
        age_identity: payload.ageIdentity,
        gender: payload.gender,
        voice_ref: payload.voiceRef || '',
        prompt: payload.prompt || '',
        description: payload.description || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaRole(projectId: string, roleKey: string, payload: DramaRoleUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/roles/${encodeURIComponent(roleKey)}`, {
      method: 'PATCH',
      body: {
        personality: payload.personality || '',
        appearance: payload.appearance || '',
        prompt: payload.prompt || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async uploadDramaRoleVoice(projectId: string, roleKey: string, file: File) {
    // 角色音色上传走原始二进制 body，避免后端额外依赖 multipart 解析包。
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/roles/${encodeURIComponent(roleKey)}/voice/upload?file_name=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        }
      }
    )
    return ok(mapDramaDetail(response))
  },

  async updateDramaRoleVoice(projectId: string, roleKey: string, payload: DramaRoleVoiceUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/roles/${encodeURIComponent(roleKey)}/voice`, {
      method: 'PATCH',
      body: {
        voice_ref: payload.voiceRef || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async deleteDramaRoleVoice(projectId: string, roleKey: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/roles/${encodeURIComponent(roleKey)}/voice`, {
      method: 'DELETE'
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/assets/roles/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        style: payload?.style || '',
        overwrite: payload?.overwrite ?? true,
        role_keys: payload?.roleKeys || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaScene(projectId: string, sceneKey: string, payload: DramaSceneUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/scenes/${encodeURIComponent(sceneKey)}`, {
      method: 'PATCH',
      body: {
        description: payload.description || '',
        prompt: payload.prompt || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/assets/scenes/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        style: payload?.style || '',
        overwrite: payload?.overwrite ?? true,
        scene_keys: payload?.sceneKeys || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaProp(projectId: string, propKey: string, payload: DramaPropUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/props/${encodeURIComponent(propKey)}`, {
      method: 'PATCH',
      body: {
        description: payload.description || '',
        prompt: payload.prompt || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaPropAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/assets/props/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        style: payload?.style || '',
        overwrite: payload?.overwrite ?? true,
        prop_keys: payload?.propKeys || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaStoryboards(projectId: string, payload?: DramaStoryboardGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        shot_count: payload?.shotCount || 12,
        style: payload?.style || '',
        provider: payload?.provider || 'alibaba',
        resolution: payload?.resolution || '360p'
      }
    })
    return ok(mapDramaDetail(response))
  },

  async listDramaStoryboards(projectId: string, episodeNo?: number) {
    const query = typeof episodeNo === 'number' ? `?episode_no=${episodeNo}` : ''
    const response = await request<BackendStoryboardRowsResponse>(`/drama/projects/${projectId}/storyboards${query}`)
    return ok({
      rows: mapStoryboardRows(projectId, `drama-${projectId}`, response.rows || []),
      run: {
        status: response.run?.status || 'idle',
        totalEpisodes: response.run?.total_episodes || 1,
        currentEpisodeNo: response.run?.current_episode_no || 1,
        episodeStatuses: response.run?.episode_statuses || {},
        episodeProgresses: response.run?.episode_progresses || {},
        generatedCounts: response.run?.generated_counts || {},
        expectedCounts: response.run?.expected_counts || {},
        model: response.run?.model || '',
        style: response.run?.style || '',
        errorMessage: response.run?.error_message || '',
        updatedAt: response.run?.updated_at || ''
      }
    })
  },

  async createDramaStoryboard(projectId: string, payload: StoryboardCreatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards`, {
      method: 'POST',
      body: {
        episode_no: payload.episodeNo || 1,
        after_sort_index: payload.afterSortIndex ?? null
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaStoryboard(projectId: string, rowId: string, payload: StoryboardUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/${rowId}`, {
      method: 'PATCH',
      body: {
        scene_description: payload.sceneDescription,
        role_name: payload.roleName,
        shot_type: payload.shotType,
        action_desc: payload.actionDesc,
        mood_desc: payload.moodDesc,
        sound_fx: payload.soundFx,
        dialogue: payload.dialogue,
        storyboard_prompt: payload.storyboardPrompt,
        camera_motion_prompt: payload.cameraMotionPrompt,
        role_keys: payload.roleKeys,
        scene_keys: payload.sceneKeys,
        prop_keys: payload.propKeys,
        video_prompt: payload.videoPrompt,
        video_model: payload.videoModel,
        video_duration_sec: payload.videoDurationSec,
        extra_json: payload.extra
      }
    })
    return ok(mapDramaDetail(response))
  },

  async copyDramaStoryboard(projectId: string, rowId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/copy`, {
      method: 'POST'
    })
    return ok(mapDramaDetail(response))
  },

  async deleteDramaStoryboard(projectId: string, rowId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/${rowId}`, {
      method: 'DELETE'
    })
    return ok(mapDramaDetail(response))
  },

  async generateStoryboardVideoPrompt(projectId: string, rowId: string, payload) {
    const response = await request<BackendStoryboardVideoPromptResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/video-prompt`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        duration_sec: payload?.durationSec || 5,
        resolution: payload?.resolution || '720p',
        reference_bindings: payload?.referenceBindings || [],
        continuation_from_row_id: payload?.continuationFromRowId || '',
        continuation_policy: payload?.continuationPolicy || 'auto',
        retry_reason: payload?.retryReason || ''
      }
    })
    return ok({
      storyboardRowId: response.storyboard_row_id,
      videoPrompt: response.video_prompt,
      videoModel: response.video_model,
      videoDurationSec: response.video_duration_sec,
      clipContract: mapStoryboardClipContract(response.clip_contract),
      referenceBindings: mapStoryboardReferenceBindings(response.reference_bindings),
      continuityState: mapStoryboardContinuityState(response.continuity_state),
      retryReason: response.retry_reason || '',
      warnings: response.warnings || [],
      promptLoad: response.prompt_load || 'low',
      modeHint: response.mode_hint || 'drama',
      repairPatchSummary: response.repair_patch_summary || ''
    })
  },

  async generateStoryboardVideo(projectId: string, rowId: string, payload?: StoryboardVideoGeneratePayload) {
    const response = await request<BackendStoryboardVideoRunResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/videos`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        duration_sec: payload?.durationSec || 5,
        resolution: payload?.resolution || '720p',
        reference_urls: payload?.referenceUrls || [],
        reference_bindings: payload?.referenceBindings || [],
        continuation_from_row_id: payload?.continuationFromRowId || '',
        continuation_policy: payload?.continuationPolicy || 'auto',
        retry_reason: payload?.retryReason || '',
        audio: payload?.audioMode !== 'silent'
      }
    })
    return ok({
      storyboardRowId: response.storyboard_row_id,
      runId: response.run_id,
      status: response.status
    })
  },

  async batchGenerateStoryboardVideos(projectId: string, payload) {
    const response = await request<BackendStoryboardVideoBatchResponse>(`/drama/projects/${projectId}/storyboards/videos/batch`, {
      method: 'POST',
      body: {
        episode_no: payload.episodeNo,
        model: payload.model || '',
        duration_sec: payload.durationSec || 5,
        resolution: payload.resolution || '720p',
        audio: payload.audioMode !== 'silent'
      }
    })
    return ok(
      (response.runs || []).map((run) => ({
        storyboardRowId: run.storyboard_row_id,
        runId: run.run_id,
        status: run.status
      }))
    )
  }
}
