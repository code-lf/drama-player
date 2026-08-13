import type { AccountProfile, AccountSecuritySummary, CreditLedgerPage, CreditPackage, PaymentOrder, PaymentOrderPage } from '~/entities/account/types'
import type { CanvasGraph } from '~/entities/canvas/types'
import type {
  DramaCreditPreview,
  DramaAssetItem,
  DramaIntentMode,
  DramaProjectCard,
  DramaProjectDetail,
  DramaRuntimeConfig,
  PublicVideoCapabilities
} from '~/entities/drama/types'
import type { EpisodeCutDraft, EpisodeCutSavePayload, EpisodeCutTask } from '~/entities/drama/episodeCutTypes'
import type { Project } from '~/entities/project/types'
import type { FeedbackPage, FeedbackSubmitPayload, LegalDocument, RedeemCodeResult, SupportCenter, UserFeedback, WebsiteInfo } from '~/entities/support/types'
import { defaultWebsiteInfo } from '~/entities/support/types'
import type {
  ProductImageCreditPreview,
  ProductImageGeneratePayload,
  ProductImageGenerateResult,
  ProductImageResult,
  ProductImageTemplate,
  ProductSellingPoint
} from '~/entities/product-image/types'
import type { ProductVideoCreatePayload, ProductVideoCreditPreview, ProductVideoHome, ProductVideoResult, ProductVideoTask, ProductVideoTemplate } from '~/entities/product-video/types'
import type {
  StoryboardClipContract,
  StoryboardContinuationPolicy,
  StoryboardContinuityState,
  StoryboardDirectorSegment,
  StoryboardPlanVersion,
  StoryboardPromptLoad,
  StoryboardQualityPolicy,
  StoryboardReferenceBinding,
  StoryboardRow,
  StoryboardTake,
  StoryboardWorkspace
} from '~/entities/storyboard/types'
import type { AuthSession } from '~/entities/auth/types'
import type { SystemAnnouncement } from '~/entities/announcement/types'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { getStoryboardCache, setStoryboardCache } from '~/shared/api/storyboardCache'
import type {
  ApiAdapter,
  ApiResponse,
  DramaAssetGeneratePayload,
  DramaAssetGenerationEstimate,
  DramaAssetGenerationRun,
  DramaAssetConsistencyEstimate,
  DramaAssetConsistencyRun,
  DramaAssetRepairEstimate,
  DramaAssetRepairRequest,
  DramaAssetWorkspace,
  DramaVisualBible,
  DramaWorkspaceAssetStatus,
  DramaWorkspaceAssetType,
  DramaCreditPreviewPayload,
  DramaEntryCreditPreviewPayload,
  DramaDeleteResult,
  DramaProjectCreatePayload,
  DramaPropUpdatePayload,
  DramaRoleUpdatePayload,
  DramaRoleVoiceUpdatePayload,
  DramaSceneUpdatePayload,
  DramaScriptIngestPayload,
  DramaScriptSceneUpdatePayload,
  DramaScriptOptimizationPayload,
  DramaStoryboardGeneratePayload,
  StoryboardBatchEstimate,
  StoryboardCreatePayload,
  StoryboardDirectorSegmentsPayload,
  StoryboardGeneratePayload,
  StoryboardReviewBatchPayload,
  StoryboardTuningPayload,
  StoryboardShotTuningPayload,
  StoryboardTuningPreview,
  StoryboardUpdatePayload,
  StoryboardVideoBatchPayload,
  StoryboardVideoBatchResult,
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

interface BackendEpisodeCut {
  id: string
  episode_no: number
  version_no: number
  status: string
  clips: Array<{
    storyboard_row_id: string
    take_id: string
    sort_index: number
    trim_in_ms: number
    trim_out_ms: number
    native_audio_gain: number
    native_audio_muted: boolean
  }>
  captions: Array<{
    sort_index: number
    start_ms: number
    end_ms: number
    text: string
  }>
  bgm_url: string
  bgm_gain: number
  bgm_fade_in_ms: number
  bgm_fade_out_ms: number
  subtitle_style: Record<string, unknown>
  export_settings: Record<string, unknown>
}

interface BackendEpisodeCutTask {
  id: string
  task_type: 'captions' | 'render' | 'editor_package'
  status: string
  progress: number
  output_url: string
  error_message: string
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
  plan_version_id?: string
  source_scene_ids?: string[]
  source_block_ids?: string[]
  beat_keys?: string[]
  context_hash?: string
  plan_status?: string
  review_status?: string
  risk_level?: 'low' | 'medium' | 'high'
  risk_reasons?: string[]
  previsualization_status?: string
  previsualization_url?: string
  audio_intent?: BackendStoryboardAudioIntent
  director_segments?: BackendStoryboardDirectorSegment[]
  selected_take_id?: string
  takes?: BackendStoryboardTake[]
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

interface BackendStoryboardDirectorSegment {
  id?: string
  sort_index?: number
  start_ms?: number
  end_ms?: number
  shot_size?: string
  camera_motion?: string
  visual_focus?: string
  action_desc?: string
  emotion_desc?: string
  audio_cue?: string
  extra?: Record<string, unknown>
}

interface BackendStoryboardAudioIntent {
  speakers?: string[]
  dialogue_lines?: Array<{ speaker?: string; text?: string }>
  ambience?: string
  foley?: string
  voice_required?: boolean
  voice_reference_status?: 'not_required' | 'ready' | 'missing' | 'stale'
}

interface BackendStoryboardTake {
  id?: string
  version_no?: number
  status?: string
  quality_policy?: string
  video_url?: string
  poster_url?: string
  qc?: Record<string, unknown>
  is_selected?: boolean
  created_at?: string
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
    episode_stages?: Record<string, {
      stage?: string
      progress?: number
      total_batches?: number
      completed_batches?: number
      retryable_nodes?: string[]
      error_message?: string
    }>
    generated_counts: Record<string, number>
    expected_counts: Record<string, number>
    model: string
    style: string
    error_message: string
    updated_at: string
  }
}

interface BackendRuntimeModelOption {
  provider: 'alibaba' | 'bytedance' | 'huoshan'
  model: string
  label: string
  description: string
  base_credits?: number
  billing_mode?: string
  limits?: {
    min_duration_sec?: number
    max_duration_sec?: number
    resolutions?: string[]
    max_reference_count?: number
    supports_silent?: boolean
  }
}

interface BackendRuntimeConfigResponse {
  theme_modes: Array<'dark' | 'light'>
  video_resolutions: string[]
  defaults: Record<string, string>
  text_models: BackendRuntimeModelOption[]
  image_models: BackendRuntimeModelOption[]
  video_models: BackendRuntimeModelOption[]
}

interface BackendPublicVideoCapabilitiesResponse {
  resolutions: string[]
  default_resolution: string
  min_duration_sec: number
  max_duration_sec: number
  supports_audio_upload?: boolean
  supports_audio_driven_video?: boolean
  audio_mix_modes?: string[]
}

interface BackendAccountProfileResponse {
  id: string
  nickname: string
  avatar_url: string
  credit_balance?: number
  creditBalance?: number
  credits_balance?: number
  credits?: number
  points?: number
  balance?: number
}

interface BackendAccountSecuritySummaryResponse {
  masked_phone: string
  phone_bound: boolean
  password_enabled: boolean
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

interface BackendPaymentOrderResponse {
  id: string
  order_no: string
  channel: 'wechat' | 'alipay'
  status: string
  package_name_snapshot: string
  credits_snapshot: number
  amount: number
  currency: string
  checkout_url?: string
  expires_at?: string
  paid_at?: string
  failure_code?: string
  failure_message?: string
  created_at: string
  updated_at: string
}

interface BackendPaymentOrderPageResponse {
  items: BackendPaymentOrderResponse[]
  total: number
  page: number
  page_size: number
}

interface BackendRedeemCodeResponse {
  reward_label: string
  reward_credits: number
  balance_after: number
  redeemed_at: string
}

interface BackendHelpArticle {
  id: string
  category: string
  title: string
  content: string
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

interface BackendSupportCenterResponse {
  support_email: string
  articles: BackendHelpArticle[]
}

interface BackendLoginAppearanceResponse {
  brand_name: string
  brand_subtitle: string
  hero_title_prefix: string
  hero_title_highlight: string
  hero_subtitle: string
  footer_copyright: string
  company_name: string
  icp_record_number: string
  icp_record_url: string
}

interface BackendLegalDocumentListResponse {
  items: Array<{
    id: string
    code: string
    sort_order: number
    is_active: boolean
    versions: Array<{
      id: string
      version: string
      title: string
      summary: string
      content: string
      status: 'draft' | 'published' | 'archived'
      requires_acceptance: boolean
      effective_at: string
      published_at: string
    }>
  }>
}

interface BackendFeedbackAttachment {
  id: string
  file_url: string
  file_name: string
  mime_type: string
  size_bytes: number
}

interface BackendFeedbackResponse {
  id: string
  user_id: string
  category: 'bug' | 'product' | 'billing' | 'other'
  content: string
  contact_email: string
  page_path: string
  status: 'submitted' | 'processing' | 'resolved' | 'closed'
  admin_reply: string
  replied_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  attachments: BackendFeedbackAttachment[]
}

interface BackendFeedbackPageResponse {
  items: BackendFeedbackResponse[]
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

interface BackendProductImageTemplateResponse {
  id: string
  code: string
  name: string
  category: string
  description?: string
  cover_url?: string
  style_name?: string
  aspect_ratio?: string
  is_featured?: boolean
  sort_order?: number
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
    core_theme?: string
    target_audience?: string
    story_type?: string
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
      age_label?: string
      role_label?: string
      gender?: string
      appearance?: string
      personality?: string
      goal?: string
      motivation?: string
      conflict?: string
      arc_steps?: Array<Record<string, string>>
    }>
    episode_summaries: Array<{
      episode_no: number
      title: string
      summary: string
      core_event?: string
      character_change?: string
      ending_hook?: string
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
    schema_version?: string
    character_relationships?: {
      nodes?: Array<{ key?: string; name?: string; role?: string; tone?: string; x?: number; y?: number }>
      links?: Array<{ source?: string; target?: string; label?: string; color?: string; strength?: number; summary?: string; direction?: 'forward' | 'both' | 'none' }>
      summaries?: string[]
      arc_steps?: Array<Record<string, string>>
    }
    episode_structures?: Array<{
      episode_no?: number
      title?: string
      status?: string
      estimated_duration?: string
      scene_count?: number
      main_characters?: string[]
      beats?: Array<{ key?: string; label?: string; time_range?: string; summary?: string; scene_refs?: string[]; status?: string }>
      ai_judgements?: Array<{ title?: string; detail?: string; status?: string }>
    }>
    script_scenes?: Array<{
      episode_id?: string
      scene_id?: string
      episode_no?: number
      index?: number
      title?: string
      place?: string
      time_of_day?: string
      characters?: string[]
      props?: string[]
      emotion?: string
      start_offset?: number
      end_offset?: number
      content?: string
      dialogues?: string[]
      suggestions?: string[]
    }>
    script_reviews?: Record<string, {
      title?: string
      score?: number
      tone?: string
      dimensions?: Array<{ key?: string; label?: string; value?: number; weight?: number; grade?: string; evidence?: string[]; suggestions?: string[] }>
      strengths?: Array<{ title?: string; status?: string; detail?: string; suggestion_id?: string }>
      warnings?: Array<{ title?: string; status?: string; detail?: string; suggestion_id?: string }>
      confidence?: number
      updated_at?: string
    }>
    script_reviews_source_version?: string
    script_reviews_stale?: boolean
    production_estimate?: {
      roles?: number
      scenes?: number
      scene_assets?: number
      scene_occurrences?: number
      props?: number
      shots?: number
      credits?: number
      episode_duration?: string
      total_duration?: string
      key_episode_count?: number
    }
    optimization_suggestions?: Array<{
      id?: string
      scope?: string
      priority?: string
      title?: string
      problem?: string
      advice?: string
      affected?: string
      boost?: string
      detail?: string
      evidence?: string[]
      impact?: string
      affected_episode_nos?: number[]
      affected_locations?: string[]
      confidence?: number
      source_version?: string
      original_text?: string
      suggested_text?: string
      problem_identification?: string
      modification_strategy?: string
      expected_effect?: string
      risk_control?: string
      character_impact?: string
      episode_impact?: string
      asset_impact?: string
      storyboard_impact?: string
      status?: string
      suggestion_status?: string
      draft_status?: string
      draft_requested?: boolean
      draft_error_code?: string
      draft_error_message?: string
      draft_retry_count?: number
      draft_source_version?: string
      source_block_ids?: string[]
      evidence_block_ids?: string[]
      draft_scope_block_ids?: string[]
      source_scope_type?: string
      source_segments?: Array<{
        episode_no?: number | null
        scene_id?: string
        scene_no?: number | null
        block_ids?: string[]
        start_offset?: number
        end_offset?: number
        text?: string
      }>
      scene_no?: number | null
      draft_revision?: number
      charged_credits?: number
      patches?: Array<Record<string, unknown>>
      source_locator?: {
        scope_type?: string
        episode_no?: number | null
        scene_id?: string
        scene_index?: number | null
        start_offset?: number
        end_offset?: number
        source_text_snapshot?: string
        source_version?: string
        status?: 'resolved' | 'ambiguous' | 'missing' | 'stale'
        confidence?: number
        candidates?: Array<{
          episode_no?: number | null
          scene_id?: string
          scene_index?: number | null
          start_offset?: number
          end_offset?: number
          excerpt?: string
          confidence?: number
        }>
      }
      actionable?: boolean
      storyboard_reference?: string
    }>
    script_versions?: Array<{
      version?: string
      status?: string
      current?: boolean
      optimized?: boolean
      created_at?: string
      applied_at?: string
      summary?: string
      score?: number
    }>
    current_script_version?: string
    confirmed_script_version_id?: string
    analysis_snapshot_id?: string
  }
  analysis_run: {
    run_id?: string
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
    structure_ready?: boolean
    asset_candidates_ready?: boolean
    reviews_ready?: boolean
    production_ready?: boolean
    pipeline_version?: string
    global_review_status?: string
    fulltext_batches?: Array<{
      batch_id?: string
      status?: string
      char_count?: number
      start_block_id?: string
      end_block_id?: string
      error_code?: string
      error_message?: string
    }>
    nodes?: Record<string, {
      key?: string
      status?: string
      attempt?: number
      progress?: number
      auto_backfill?: boolean
      error_code?: string
      error_message?: string
      started_at?: string
      finished_at?: string
    }>
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
  batch_id?: string
  runs: BackendStoryboardVideoRunResponse[]
}

interface BackendStoryboardWorkspaceResponse {
  project_id: string
  episode_no: number
  source_title: string
  source_summary: string
  source_script_version: string
  visual_bible: Record<string, unknown>
  asset_readiness: Record<string, unknown>
  current_plan: Record<string, unknown>
  summary: Record<string, unknown>
  rows: BackendStoryboardRow[]
  run?: BackendStoryboardRowsResponse['run']
  latest_batch?: {
    batch_id?: string
    status?: string
    quality_policy?: string
    estimated_credits?: number
    settled_credits?: number
    refunded_credits?: number
    counts?: Record<string, number>
    error_message?: string
    created_at?: string
  }
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
  entry_intent: DramaIntentMode
  effective_mode: DramaIntentMode
  style: string
  aspect_ratio: string
  resolution: string
  total_episodes: number
  completed_storyboards: number
  total_storyboards: number
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
    entryIntent: raw.entry_intent || 'drama',
    effectiveMode: raw.effective_mode || raw.entry_intent || 'drama',
    style: raw.style || '',
    aspectRatio: raw.aspect_ratio || '',
    resolution: raw.resolution || '',
    totalEpisodes: Number(raw.total_episodes || 1),
    completedStoryboards: Number(raw.completed_storyboards || 0),
    totalStoryboards: Number(raw.total_storyboards || 0),
    updatedAt: raw.updated_at || '',
    createdAt: raw.created_at || ''
  }
}

function mapAccountProfile(raw: BackendAccountProfileResponse): AccountProfile {
  // 后端历史版本和管理端可能返回不同命名，这里统一兜底映射，避免后台显示 200、用户端因为字段名不一致显示 0。
  const creditBalance = raw.credit_balance
    ?? raw.creditBalance
    ?? raw.credits_balance
    ?? raw.credits
    ?? raw.points
    ?? raw.balance
    ?? 0
  return {
    id: raw.id,
    nickname: raw.nickname || '',
    avatarUrl: raw.avatar_url || '',
    creditBalance: Number(creditBalance || 0)
  }
}

function mapAccountSecuritySummary(raw: BackendAccountSecuritySummaryResponse): AccountSecuritySummary {
  return {
    maskedPhone: raw.masked_phone || '',
    phoneBound: Boolean(raw.phone_bound),
    passwordEnabled: Boolean(raw.password_enabled)
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

function mapPaymentOrder(raw: BackendPaymentOrderResponse): PaymentOrder {
  return {
    id: raw.id,
    orderNo: raw.order_no,
    channel: raw.channel,
    status: raw.status,
    packageNameSnapshot: raw.package_name_snapshot,
    creditsSnapshot: Number(raw.credits_snapshot || 0),
    amount: Number(raw.amount || 0),
    currency: raw.currency || 'CNY',
    checkoutUrl: raw.checkout_url || '',
    expiresAt: raw.expires_at || '',
    paidAt: raw.paid_at || '',
    failureCode: raw.failure_code || '',
    failureMessage: raw.failure_message || '',
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || ''
  }
}

function mapPaymentOrderPage(raw: BackendPaymentOrderPageResponse): PaymentOrderPage {
  return {
    items: (raw.items || []).map(mapPaymentOrder),
    total: Number(raw.total || 0),
    page: Number(raw.page || 1),
    pageSize: Number(raw.page_size || 10)
  }
}

function mapSupportCenter(raw: BackendSupportCenterResponse): SupportCenter {
  return {
    supportEmail: raw.support_email || '',
    articles: (raw.articles || []).map(item => ({
      id: item.id,
      category: item.category || '使用指南',
      title: item.title || '',
      content: item.content || '',
      sortOrder: Number(item.sort_order || 100),
      isPublished: Boolean(item.is_published),
      createdAt: item.created_at || '',
      updatedAt: item.updated_at || ''
    }))
  }
}

function mapLoginAppearance(raw: BackendLoginAppearanceResponse): WebsiteInfo {
  // 公开文案仅接受非空字符串，异常字段回退产品默认值，避免登录页出现空标题。
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback
  const recordUrl = text(raw.icp_record_url, defaultWebsiteInfo.icpRecordUrl)
  return {
    brandName: text(raw.brand_name, defaultWebsiteInfo.brandName),
    brandSubtitle: text(raw.brand_subtitle, defaultWebsiteInfo.brandSubtitle),
    heroTitlePrefix: text(raw.hero_title_prefix, defaultWebsiteInfo.heroTitlePrefix),
    heroTitleHighlight: text(raw.hero_title_highlight, defaultWebsiteInfo.heroTitleHighlight),
    heroSubtitle: text(raw.hero_subtitle, defaultWebsiteInfo.heroSubtitle),
    footerCopyright: text(raw.footer_copyright, defaultWebsiteInfo.footerCopyright),
    companyName: text(raw.company_name, defaultWebsiteInfo.companyName),
    icpRecordNumber: text(raw.icp_record_number, defaultWebsiteInfo.icpRecordNumber),
    // 后台约束为 HTTPS；这里再做防御性校验，避免配置异常产生不安全跳转。
    icpRecordUrl: recordUrl.startsWith('https://') ? recordUrl : defaultWebsiteInfo.icpRecordUrl
  }
}

function mapLegalDocuments(raw: BackendLegalDocumentListResponse): LegalDocument[] {
  return (raw.items || []).map(document => ({
    id: document.id,
    code: document.code,
    sortOrder: Number(document.sort_order || 100),
    isActive: Boolean(document.is_active),
    versions: (document.versions || []).map(version => ({
      id: version.id,
      version: version.version,
      title: version.title,
      summary: version.summary || '',
      content: version.content || '',
      status: version.status,
      requiresAcceptance: Boolean(version.requires_acceptance),
      effectiveAt: version.effective_at || '',
      publishedAt: version.published_at || ''
    }))
  }))
}

function mapFeedback(raw: BackendFeedbackResponse): UserFeedback {
  return {
    id: raw.id,
    userId: raw.user_id,
    category: raw.category || 'other',
    content: raw.content || '',
    contactEmail: raw.contact_email || '',
    pagePath: raw.page_path || '',
    status: raw.status || 'submitted',
    adminReply: raw.admin_reply || '',
    repliedAt: raw.replied_at || '',
    resolvedAt: raw.resolved_at || '',
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || '',
    attachments: (raw.attachments || []).map(item => ({
      id: item.id,
      fileUrl: item.file_url,
      fileName: item.file_name || '',
      mimeType: item.mime_type || '',
      sizeBytes: Number(item.size_bytes || 0)
    }))
  }
}

function mapFeedbackPage(raw: BackendFeedbackPageResponse): FeedbackPage {
  return {
    items: (raw.items || []).map(mapFeedback),
    total: Number(raw.total || 0),
    page: Number(raw.page || 1),
    pageSize: Number(raw.page_size || 20)
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

/** 统一处理后端的 snake_case 模板字段，页面只使用 camelCase。 */
function mapProductImageTemplate(raw: BackendProductImageTemplateResponse): ProductImageTemplate {
  return {
    id: raw.id || '', code: raw.code || '', name: raw.name || '', category: raw.category || '',
    description: raw.description || '', coverUrl: raw.cover_url || '', styleName: raw.style_name || '电商质感',
    aspectRatio: raw.aspect_ratio || '1:1', isFeatured: Boolean(raw.is_featured), sortOrder: Number(raw.sort_order || 100)
  }
}

function buildProductImagePayload(payload: ProductImageGeneratePayload) {
  // 商品图请求统一在这里转成后端 snake_case，页面组件只维护 camelCase。
  return {
    prompt: payload.prompt,
    model: payload.model || '',
    template_id: payload.templateId || '',
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

/** 把后端 snake_case 的商品视频模板快照转换为页面使用的 camelCase。 */
function mapProductVideoTemplate(raw: any): ProductVideoTemplate {
  return {
    id: String(raw?.id || ''),
    code: String(raw?.code || ''),
    name: String(raw?.name || ''),
    category: String(raw?.category || '热门推荐'),
    description: String(raw?.description || ''),
    coverUrl: String(raw?.cover_url || ''),
    previewUrl: String(raw?.preview_url || ''),
    durationSec: Number(raw?.duration_sec || 10),
    aspectRatio: String(raw?.aspect_ratio || '9:16'),
    styleTags: Array.isArray(raw?.style_tags) ? raw.style_tags.map(String) : [],
    requiredCredits: Number(raw?.required_credits || 0),
    isFeatured: Boolean(raw?.is_featured),
    sortOrder: Number(raw?.sort_order || 100)
  }
}

/** 商品视频任务包含结果版本与进度，统一映射后才能在刷新时可靠恢复任务面板。 */
function mapProductVideoTask(raw: any): ProductVideoTask {
  return {
    id: String(raw?.id || ''),
    template: raw?.template ? mapProductVideoTemplate(raw.template) : null,
    creationType: ['product', 'model', 'image_to_video', 'digital_human'].includes(String(raw?.creation_type)) ? raw.creation_type : 'product',
    prompt: String(raw?.prompt || ''),
    sourceImages: Array.isArray(raw?.source_images) ? raw.source_images.map(String) : [],
    status: ['queued', 'running', 'succeeded', 'failed'].includes(String(raw?.status)) ? raw.status : 'queued',
    progress: Number(raw?.progress || 0),
    currentStep: String(raw?.current_step || ''),
    errorMessage: String(raw?.error_message || ''),
    durationSec: Number(raw?.duration_sec || 10),
    aspectRatio: String(raw?.aspect_ratio || '9:16'),
    resolution: String(raw?.resolution || '720p'),
    requiredCredits: Number(raw?.required_credits || 0),
    currentBalance: Number(raw?.current_balance || 0),
    balanceAfter: Number(raw?.balance_after || 0),
    selectedResultId: String(raw?.selected_result_id || ''),
    results: (Array.isArray(raw?.results) ? raw.results : []).map((item: any): ProductVideoResult => ({
      id: String(item?.id || ''),
      index: Number(item?.index || 1),
      videoUrl: String(item?.video_url || ''),
      coverUrl: String(item?.cover_url || ''),
      status: ['queued', 'running', 'succeeded', 'failed'].includes(String(item?.status)) ? item.status : 'queued',
      durationSec: Number(item?.duration_sec || raw?.duration_sec || 10)
    })),
    createdAt: String(raw?.created_at || ''),
    updatedAt: String(raw?.updated_at || '')
  }
}

function buildProductVideoPayload(payload: ProductVideoCreatePayload) {
  return {
    template_id: payload.templateId,
    creation_type: payload.creationType,
    prompt: payload.prompt,
    source_images: payload.sourceImages,
    duration_sec: payload.durationSec,
    aspect_ratio: payload.aspectRatio,
    resolution: payload.resolution,
    result_count: payload.resultCount,
    model: payload.model || ''
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

function mapStoryboardDirectorSegments(rows?: BackendStoryboardDirectorSegment[]): StoryboardDirectorSegment[] {
  return (rows || []).map((item, index) => ({
    id: item.id || `segment-${index + 1}`,
    sortIndex: Number(item.sort_index || index + 1),
    startMs: Number(item.start_ms || 0),
    endMs: Number(item.end_ms || 1000),
    shotSize: item.shot_size || '中景',
    cameraMotion: item.camera_motion || '固定',
    visualFocus: item.visual_focus || '',
    actionDesc: item.action_desc || '',
    emotionDesc: item.emotion_desc || '',
    audioCue: item.audio_cue || '',
    extra: item.extra || {}
  }))
}

function mapStoryboardTakes(rows?: BackendStoryboardTake[]): StoryboardTake[] {
  return (rows || []).map(item => ({
    id: item.id || '',
    versionNo: Number(item.version_no || 1),
    status: item.status || 'queued',
    qualityPolicy: (item.quality_policy || 'smart') as StoryboardTake['qualityPolicy'],
    videoUrl: item.video_url || '',
    posterUrl: item.poster_url || '',
    qc: item.qc || {},
    isSelected: Boolean(item.is_selected),
    createdAt: item.created_at || ''
  }))
}

function mapStoryboardPlan(raw?: Record<string, unknown>): StoryboardPlanVersion {
  return {
    id: String(raw?.id || ''),
    episodeNo: Number(raw?.episode_no || 1),
    versionNo: Number(raw?.version_no || 1),
    versionLabel: String(raw?.version_label || 'v1'),
    status: String(raw?.status || 'draft'),
    isCurrent: Boolean(raw?.is_current ?? true),
    sourceScriptVersion: String(raw?.source_script_version || ''),
    tuning: (raw?.tuning || {}) as Record<string, unknown>,
    validation: (raw?.validation || {}) as Record<string, unknown>,
    createdAt: String(raw?.created_at || '')
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
    planVersionId: row.plan_version_id || '',
    sourceSceneIds: row.source_scene_ids || [],
    sourceBlockIds: row.source_block_ids || [],
    beatKeys: row.beat_keys || [],
    contextHash: row.context_hash || '',
    planStatus: (row.plan_status || 'draft') as StoryboardRow['planStatus'],
    reviewStatus: (row.review_status || 'unreviewed') as StoryboardRow['reviewStatus'],
    riskLevel: row.risk_level || 'low',
    riskReasons: row.risk_reasons || [],
    previsualizationStatus: row.previsualization_status || 'not_required',
    previsualizationUrl: row.previsualization_url || '',
    audioIntent: {
      speakers: row.audio_intent?.speakers || [],
      dialogueLines: (row.audio_intent?.dialogue_lines || []).map(item => ({
        speaker: item.speaker || '',
        text: item.text || ''
      })),
      ambience: row.audio_intent?.ambience || '',
      foley: row.audio_intent?.foley || '',
      voiceRequired: Boolean(row.audio_intent?.voice_required),
      voiceReferenceStatus: row.audio_intent?.voice_reference_status || 'not_required'
    },
    directorSegments: mapStoryboardDirectorSegments(row.director_segments),
    selectedTakeId: row.selected_take_id || '',
    takes: mapStoryboardTakes(row.takes),
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

function mapStoryboardRun(run?: BackendStoryboardRowsResponse['run']): StoryboardWorkspace['run'] {
  return {
    status: run?.status || 'idle',
    totalEpisodes: run?.total_episodes || 1,
    currentEpisodeNo: run?.current_episode_no || 1,
    episodeStatuses: run?.episode_statuses || {},
    episodeProgresses: run?.episode_progresses || {},
    episodeStages: Object.fromEntries(Object.entries(run?.episode_stages || {}).map(([key, stage]) => [key, {
      stage: stage.stage || 'idle',
      progress: Number(stage.progress || 0),
      totalBatches: Number(stage.total_batches || 0),
      completedBatches: Number(stage.completed_batches || 0),
      totalScenes: Number(stage.total_scenes || 0),
      completedScenes: Number(stage.completed_scenes || 0),
      currentNodeLabel: stage.current_node_label || '',
      errorCode: stage.error_code || '',
      validationIssues: stage.validation_issues || [],
      retryableNodes: stage.retryable_nodes || [],
      errorMessage: stage.error_message || ''
    }])),
    generatedCounts: run?.generated_counts || {},
    expectedCounts: run?.expected_counts || {},
    style: run?.style || '',
    errorMessage: run?.error_message || '',
    updatedAt: run?.updated_at || ''
  }
}

function mapStoryboardWorkspace(raw: BackendStoryboardWorkspaceResponse): StoryboardWorkspace {
  const summary = raw.summary || {}
  const latestBatch = raw.latest_batch || {}
  return {
    projectId: raw.project_id,
    episodeNo: Number(raw.episode_no || 1),
    sourceTitle: raw.source_title || '',
    sourceSummary: raw.source_summary || '',
    sourceScriptVersion: raw.source_script_version || '',
    visualBible: raw.visual_bible || {},
    assetReadiness: raw.asset_readiness || {},
    currentPlan: mapStoryboardPlan(raw.current_plan),
    summary: {
      total: Number(summary.total || 0),
      planConfirmed: Number(summary.plan_confirmed || 0),
      reviewRequired: Number(summary.review_required || 0),
      videoQueued: Number(summary.video_queued || 0),
      videoRunning: Number(summary.video_running || 0),
      videoSucceeded: Number(summary.video_succeeded || 0),
      videoFailed: Number(summary.video_failed || 0),
      accepted: Number(summary.accepted || 0),
      estimatedDurationSec: Number(summary.estimated_duration_sec || 0)
    },
    rows: mapStoryboardRows(raw.project_id, `drama-${raw.project_id}`, raw.rows || []),
    latestBatch: {
      batchId: latestBatch.batch_id || '',
      status: latestBatch.status || '',
      qualityPolicy: (latestBatch.quality_policy || 'smart') as StoryboardQualityPolicy,
      estimatedCredits: Number(latestBatch.estimated_credits || 0),
      settledCredits: Number(latestBatch.settled_credits || 0),
      refundedCredits: Number(latestBatch.refunded_credits || 0),
      counts: latestBatch.counts || {},
      errorMessage: latestBatch.error_message || '',
      createdAt: latestBatch.created_at || ''
    },
    run: mapStoryboardRun(raw.run)
  }
}

function buildStoryboardTuningPayload(payload: StoryboardTuningPayload) {
  return {
    episode_no: payload.episodeNo,
    rhythm: payload.rhythm,
    shot_scale: payload.shotScale,
    camera_style: payload.cameraStyle,
    emotion_tone: payload.emotionTone,
    continuity_priority: payload.continuityPriority,
    quality_policy: payload.qualityPolicy,
    scope: payload.scope
  }
}

function mapStoryboardTuningPreview(raw: Record<string, unknown>): StoryboardTuningPreview {
  return {
    affectedRowIds: (raw.affected_row_ids || []) as string[],
    lockedRowIds: (raw.locked_row_ids || []) as string[],
    affectedCount: Number(raw.affected_count || 0),
    estimatedDurationSec: Number(raw.estimated_duration_sec || 0),
    createsNewVersion: Boolean(raw.creates_new_version),
    changes: (raw.changes || []) as string[]
  }
}

function buildStoryboardVideoBatchPayload(payload: StoryboardVideoBatchPayload) {
  // 兼容旧页面的 sound/silent，同时把新声音策略和裁切配置原样交给 API。
  const audioMode = payload.audioMode === 'sound'
    ? 'preserve_original'
    : payload.audioMode === 'silent'
      ? 'none'
      : payload.audioMode || 'preserve_original'
  return {
    episode_no: payload.episodeNo,
    model: payload.model || '',
    duration_sec: payload.durationSec,
    resolution: payload.resolution || '720p',
    audio: audioMode !== 'none',
    audio_mode: audioMode,
    audio_asset_id: payload.audioAssetId || '',
    audio_trim_start_ms: payload.audioTrimStartMs || 0,
    audio_trim_end_ms: payload.audioTrimEndMs ?? null,
    audio_mix_mode: payload.audioMixMode || 'replace',
    quality_policy: payload.qualityPolicy || 'smart',
    row_ids: payload.rowIds || [],
    idempotency_key: payload.idempotencyKey || ''
  }
}

function mapStoryboardBatchEstimate(raw: Record<string, unknown>): StoryboardBatchEstimate {
  return {
    eligibleRowIds: (raw.eligible_row_ids || []) as string[],
    blocked: (raw.blocked || []) as StoryboardBatchEstimate['blocked'],
    totalDurationSec: Number(raw.total_duration_sec || 0),
    estimatedCredits: Number(raw.estimated_credits || 0),
    totalCredits: Number(raw.total_credits || raw.estimated_credits || 0),
    costItems: ((raw.cost_items || []) as Array<Record<string, unknown>>).map(item => ({
      type: String(item.type || 'video_generation'),
      rowId: item.row_id ? String(item.row_id) : undefined,
      label: String(item.label || '视频生成'),
      credits: Number(item.credits || 0)
    })),
    currentBalance: Number(raw.current_balance || 0),
    sufficient: Boolean(raw.sufficient)
  }
}

function mapStoryboardVideoBatch(raw: BackendStoryboardVideoBatchResponse): StoryboardVideoBatchResult {
  return {
    batchId: raw.batch_id || '',
    runs: (raw.runs || []).map(run => ({
      storyboardRowId: run.storyboard_row_id,
      runId: run.run_id,
      status: run.status
    }))
  }
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

function mapDramaScriptReview(raw?: BackendDramaDetailResponse['analysis']['script_reviews'][string]) {
  return {
    title: raw?.title || '',
    // 剧本阶段已经收口为“真实模型结果优先”：
    // 后端没有返回体检分数时，前端只能展示空态/待解析，不能再默认 82 分误导测试。
    score: Number(raw?.score || 0),
    tone: raw?.tone || '',
    dimensions: (raw?.dimensions || []).map((item) => ({
      key: item.key || '',
      label: item.label || '',
      value: Number(item.value || 0),
      weight: Number(item.weight || 0),
      grade: item.grade || '',
      evidence: item.evidence || [],
      suggestions: item.suggestions || []
    })),
    strengths: (raw?.strengths || []).map((item) => ({
      title: item.title || '',
      status: item.status || 'good',
      detail: item.detail || '',
      suggestionId: item.suggestion_id || ''
    })),
    warnings: (raw?.warnings || []).map((item) => ({
      title: item.title || '',
      status: item.status || 'warning',
      detail: item.detail || '',
      suggestionId: item.suggestion_id || ''
    })),
    confidence: Number(raw?.confidence || 0),
    updatedAt: raw?.updated_at || ''
  }
}

function mapDramaDetail(raw: BackendDramaDetailResponse): DramaProjectDetail {
  const scriptReviews = raw.analysis?.script_reviews || {}
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
      coreTheme: raw.analysis?.core_theme || '',
      targetAudience: raw.analysis?.target_audience || '',
      storyType: raw.analysis?.story_type || '',
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
      schemaVersion: raw.analysis?.schema_version || 'script_stage_v2',
      characterBios: (raw.analysis?.character_bios || []).map((item) => ({
        key: item.key,
        name: item.name,
        identity: item.identity,
        summary: item.summary,
        traits: item.traits || [],
        ageLabel: item.age_label || '',
        roleLabel: item.role_label || '',
        gender: item.gender || '',
        appearance: item.appearance || '',
        personality: item.personality || '',
        goal: item.goal || '',
        motivation: item.motivation || '',
        conflict: item.conflict || '',
        arcSteps: item.arc_steps || []
      })),
      episodeSummaries: (raw.analysis?.episode_summaries || []).map((item) => ({
        episodeNo: item.episode_no,
        title: item.title,
        summary: item.summary,
        coreEvent: item.core_event || '',
        characterChange: item.character_change || '',
        endingHook: item.ending_hook || ''
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
        // 置信度必须以后端真实识别结果为准；缺失时显示 0/空态，
        // 不能再给 55% 这种看似真实的默认值。
        confidence: Number(raw.analysis?.intent_router?.confidence || 0),
        signals: raw.analysis?.intent_router?.signals || [],
        userOverrideMode: raw.analysis?.intent_router?.user_override_mode || '',
        effectiveMode: raw.analysis?.intent_router?.effective_mode || 'drama'
      },
      characterRelationships: {
        nodes: (raw.analysis?.character_relationships?.nodes || []).map((item) => ({
          key: item.key || '',
          name: item.name || '',
          role: item.role || '',
          tone: item.tone || 'blue',
          x: Number(item.x ?? 50),
          y: Number(item.y ?? 50)
        })),
        links: (raw.analysis?.character_relationships?.links || []).map((item) => ({
          source: item.source || '',
          target: item.target || '',
          label: item.label || '',
          color: item.color || '#2563eb',
          strength: Number(item.strength || 1),
          summary: item.summary || '',
          direction: item.direction || 'both'
        })),
        summaries: raw.analysis?.character_relationships?.summaries || [],
        arcSteps: raw.analysis?.character_relationships?.arc_steps || []
      },
      episodeStructures: (raw.analysis?.episode_structures || []).map((item) => ({
        episodeNo: Number(item.episode_no || 1),
        title: item.title || '',
        status: item.status || 'normal',
        estimatedDuration: item.estimated_duration || '',
        sceneCount: Number(item.scene_count || 0),
        mainCharacters: item.main_characters || [],
        beats: (item.beats || []).map((beat) => ({
          key: beat.key || '',
          label: beat.label || '',
          timeRange: beat.time_range || '',
          summary: beat.summary || '',
          sceneRefs: beat.scene_refs || [],
          status: beat.status || 'good'
        })),
        aiJudgements: (item.ai_judgements || []).map((judgement) => ({
          title: judgement.title || '',
          detail: judgement.detail || '',
          status: judgement.status || 'good',
          suggestionId: judgement.suggestion_id || '',
          dimension: judgement.dimension || '',
          affectedEpisodeNos: (judgement.affected_episode_nos || []).map((value) => Number(value)).filter(Number.isFinite)
        }))
      })),
      scriptScenes: (raw.analysis?.script_scenes || []).map((item) => ({
        episodeId: item.episode_id || '',
        sceneId: item.scene_id || '',
        episodeNo: Number(item.episode_no || 1),
        index: Number(item.index || 1),
        title: item.title || '',
        place: item.place || '',
        timeOfDay: item.time_of_day || '',
        characters: item.characters || [],
        props: item.props || [],
        emotion: item.emotion || '',
        startOffset: Number(item.start_offset || 0),
        endOffset: Number(item.end_offset || 0),
        content: item.content || '',
        dialogues: item.dialogues || [],
        suggestions: item.suggestions || []
      })),
      scriptReviews: {
        overview: mapDramaScriptReview(scriptReviews.overview),
        characters: mapDramaScriptReview(scriptReviews.characters),
        episodes: mapDramaScriptReview(scriptReviews.episodes),
        fullText: mapDramaScriptReview(scriptReviews.full_text)
      },
      scriptReviewsSourceVersion: raw.analysis?.script_reviews_source_version || '',
      scriptReviewsStale: Boolean(raw.analysis?.script_reviews_stale),
      productionEstimate: {
        roles: Number(raw.analysis?.production_estimate?.roles || 0),
        scenes: Number(raw.analysis?.production_estimate?.scenes || 0),
        sceneAssets: Number(raw.analysis?.production_estimate?.scene_assets || raw.analysis?.scenes?.length || 0),
        sceneOccurrences: Number(raw.analysis?.production_estimate?.scene_occurrences || raw.analysis?.script_scenes?.length || 0),
        props: Number(raw.analysis?.production_estimate?.props || 0),
        shots: Number(raw.analysis?.production_estimate?.shots || 0),
        credits: Number(raw.analysis?.production_estimate?.credits || 0),
        episodeDuration: raw.analysis?.production_estimate?.episode_duration || '',
        totalDuration: raw.analysis?.production_estimate?.total_duration || '',
        keyEpisodeCount: Number(raw.analysis?.production_estimate?.key_episode_count || 0)
      },
      optimizationSuggestions: (raw.analysis?.optimization_suggestions || []).map((item) => ({
        id: item.id || '',
        scope: item.scope || 'overview',
        priority: item.priority || 'medium',
        title: item.title || '',
        problem: item.problem || '',
        advice: item.advice || '',
        affected: item.affected || '',
        boost: item.boost || '',
        detail: item.detail || '',
        evidence: item.evidence || [],
        impact: item.impact || item.boost || '',
        affectedEpisodeNos: item.affected_episode_nos || [],
        affectedLocations: item.affected_locations || [],
        confidence: Number(item.confidence || 0),
        sourceVersion: item.source_version || '',
        reviewSourceVersion: item.review_source_version || '',
        historyReadonly: Boolean(item.history_readonly),
        archivedInVersion: item.archived_in_version || '',
        originalText: item.original_text || '',
        suggestedText: item.suggested_text || '',
        problemIdentification: item.problem_identification || '',
        modificationStrategy: item.modification_strategy || '',
        expectedEffect: item.expected_effect || '',
        riskControl: item.risk_control || '',
        characterImpact: item.character_impact || '',
        episodeImpact: item.episode_impact || '',
        assetImpact: item.asset_impact || '',
        storyboardImpact: item.storyboard_impact || '',
        status: item.status || 'pending',
        suggestionStatus: item.suggestion_status || '',
        draftStatus: item.draft_status || '',
        draftRequested: Boolean(item.draft_requested),
        draftErrorCode: item.draft_error_code || '',
        draftErrorMessage: item.draft_error_message || '',
        draftRetryCount: Number(item.draft_retry_count || 0),
        draftSourceVersion: item.draft_source_version || '',
        sourceBlockIds: item.source_block_ids || [],
        evidenceBlockIds: item.evidence_block_ids || [],
        draftScopeBlockIds: item.draft_scope_block_ids || [],
        sourceScopeType: item.source_scope_type || 'scene',
        sourceSegments: (item.source_segments || []).map(segment => ({
          episodeNo: segment.episode_no ?? null,
          sceneId: segment.scene_id || '',
          sceneNo: segment.scene_no ?? null,
          blockIds: segment.block_ids || [],
          startOffset: Number(segment.start_offset || 0),
          endOffset: Number(segment.end_offset || 0),
          text: segment.text || ''
        })),
        sceneNo: item.scene_no ?? null,
        draftRevision: Number(item.draft_revision || 0),
        chargedCredits: Number(item.charged_credits || 0),
        patches: item.patches || [],
        sourceLocator: {
          scopeType: item.source_locator?.scope_type || 'scene',
          episodeNo: item.source_locator?.episode_no ?? null,
          sceneId: item.source_locator?.scene_id || '',
          sceneIndex: item.source_locator?.scene_index ?? null,
          startOffset: Number(item.source_locator?.start_offset || 0),
          endOffset: Number(item.source_locator?.end_offset || 0),
          sourceTextSnapshot: item.source_locator?.source_text_snapshot || '',
          sourceVersion: item.source_locator?.source_version || '',
          status: item.source_locator?.status || 'missing',
          confidence: Number(item.source_locator?.confidence || 0),
          candidates: (item.source_locator?.candidates || []).map(candidate => ({
            episodeNo: candidate.episode_no ?? null,
            sceneId: candidate.scene_id || '',
            sceneIndex: candidate.scene_index ?? null,
            startOffset: Number(candidate.start_offset || 0),
            endOffset: Number(candidate.end_offset || 0),
            excerpt: candidate.excerpt || '',
            confidence: Number(candidate.confidence || 0)
          }))
        },
        actionable: item.actionable !== false,
        storyboardReference: item.storyboard_reference || ''
      })),
      scriptVersions: (raw.analysis?.script_versions || []).map((item) => ({
        version: item.version || '',
        status: item.status || '',
        current: Boolean(item.current),
        optimized: Boolean(item.optimized),
        createdAt: item.created_at || '',
        appliedAt: item.applied_at || '',
        summary: item.summary || '',
        score: Number(item.score || 0)
      })),
      currentScriptVersion: raw.analysis?.current_script_version || 'v1.2',
      confirmedScriptVersionId: raw.analysis?.confirmed_script_version_id || '',
      analysisSnapshotId: raw.analysis?.analysis_snapshot_id || ''
    },
    analysisRun: {
      runId: raw.analysis_run?.run_id || '',
      status: raw.analysis_run?.status || 'idle',
      currentStage: raw.analysis_run?.current_stage || '',
      stageStatuses: raw.analysis_run?.stage_statuses || {},
      stageProgresses: raw.analysis_run?.stage_progresses || {},
      coverStatus: raw.analysis_run?.cover_status || 'idle',
      coverErrorMessage: raw.analysis_run?.cover_error_message || '',
      startedAt: raw.analysis_run?.started_at || '',
      updatedAt: raw.analysis_run?.updated_at || '',
      finishedAt: raw.analysis_run?.finished_at || '',
      errorMessage: raw.analysis_run?.error_message || '',
      structureReady: Boolean(raw.analysis_run?.structure_ready),
      assetCandidatesReady: Boolean(raw.analysis_run?.asset_candidates_ready),
      reviewsReady: Boolean(raw.analysis_run?.reviews_ready),
      productionReady: Boolean(raw.analysis_run?.production_ready),
      pipelineVersion: raw.analysis_run?.pipeline_version || 'v2',
      globalReviewStatus: raw.analysis_run?.global_review_status || 'queued',
      fulltextBatches: (raw.analysis_run?.fulltext_batches || []).map((batch) => ({
        batchId: batch.batch_id || '',
        status: batch.status || 'queued',
        charCount: Number(batch.char_count || 0),
        startBlockId: batch.start_block_id || '',
        endBlockId: batch.end_block_id || '',
        errorCode: batch.error_code || '',
        errorMessage: batch.error_message || ''
      })),
      nodes: Object.fromEntries(Object.entries(raw.analysis_run?.nodes || {}).map(([key, node]) => [key, {
        key: node.key || key,
        status: node.status || 'queued',
        attempt: Number(node.attempt || 0),
        progress: Number(node.progress || 0),
        autoBackfill: Boolean(node.auto_backfill),
        errorCode: node.error_code || '',
        errorMessage: node.error_message || '',
        startedAt: node.started_at || '',
        finishedAt: node.finished_at || ''
      }]))
    },
    storyboardRun: {
      status: raw.storyboard_run?.status || 'idle',
      totalEpisodes: raw.storyboard_run?.total_episodes || 1,
      currentEpisodeNo: raw.storyboard_run?.current_episode_no || 1,
      episodeStatuses: raw.storyboard_run?.episode_statuses || {},
      episodeProgresses: raw.storyboard_run?.episode_progresses || {},
      episodeStages: Object.fromEntries(Object.entries(raw.storyboard_run?.episode_stages || {}).map(([key, stage]) => [key, {
        stage: stage.stage || 'idle',
        progress: Number(stage.progress || 0),
        totalBatches: Number(stage.total_batches || 0),
        completedBatches: Number(stage.completed_batches || 0),
        totalScenes: Number(stage.total_scenes || 0),
        completedScenes: Number(stage.completed_scenes || 0),
        currentNodeLabel: stage.current_node_label || '',
        errorCode: stage.error_code || '',
        validationIssues: stage.validation_issues || [],
        retryableNodes: stage.retryable_nodes || [],
        errorMessage: stage.error_message || ''
      }])),
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

function mapEpisodeCut(raw: BackendEpisodeCut): EpisodeCutDraft {
  return {
    id: raw.id,
    episodeNo: raw.episode_no,
    versionNo: raw.version_no,
    status: raw.status,
    clips: (raw.clips || []).map(clip => ({
      storyboardRowId: clip.storyboard_row_id,
      takeId: clip.take_id || '',
      sortIndex: clip.sort_index,
      trimInMs: clip.trim_in_ms,
      trimOutMs: clip.trim_out_ms,
      nativeAudioGain: clip.native_audio_gain,
      nativeAudioMuted: clip.native_audio_muted
    })),
    captions: (raw.captions || []).map(cue => ({
      sortIndex: cue.sort_index,
      startMs: cue.start_ms,
      endMs: cue.end_ms,
      text: cue.text
    })),
    bgmUrl: raw.bgm_url || '',
    bgmGain: raw.bgm_gain,
    bgmFadeInMs: raw.bgm_fade_in_ms,
    bgmFadeOutMs: raw.bgm_fade_out_ms,
    subtitleStyle: raw.subtitle_style || {},
    exportSettings: raw.export_settings || {}
  }
}

function mapEpisodeCutTask(raw: BackendEpisodeCutTask): EpisodeCutTask {
  return {
    id: raw.id,
    taskType: raw.task_type,
    status: raw.status,
    progress: raw.progress || 0,
    outputUrl: raw.output_url || '',
    errorMessage: raw.error_message || ''
  }
}

function buildEpisodeCutPayload(payload: EpisodeCutSavePayload) {
  return {
    clips: payload.clips.map(clip => ({
      storyboard_row_id: clip.storyboardRowId,
      take_id: clip.takeId,
      sort_index: clip.sortIndex,
      trim_in_ms: clip.trimInMs,
      trim_out_ms: clip.trimOutMs,
      native_audio_gain: clip.nativeAudioGain,
      native_audio_muted: clip.nativeAudioMuted
    })),
    captions: payload.captions.map(cue => ({
      sort_index: cue.sortIndex,
      start_ms: cue.startMs,
      end_ms: cue.endMs,
      text: cue.text
    })),
    bgm_url: payload.bgmUrl,
    bgm_gain: payload.bgmGain,
    bgm_fade_in_ms: payload.bgmFadeInMs,
    bgm_fade_out_ms: payload.bgmFadeOutMs,
    subtitle_style: payload.subtitleStyle,
    export_settings: payload.exportSettings
  }
}

async function request<T>(path: string, options?: Parameters<typeof $fetch<T>>[1]): Promise<T> {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBase as string
  let accessToken = ''

  // 用户端接口统一通过后端签名 token 鉴权，不再把 user_id 明文交给浏览器透传。
  if (import.meta.client) {
    try {
      const authStore = useAuthStore()
      accessToken = authStore.session.token || ''
    } catch {
      // 未初始化 Pinia 时继续按无登录态请求，由后端返回 401。
    }
  }

  const headers = {
    ...((options?.headers as Record<string, string>) || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  }

  // 网络请求必须只执行一次。此前请求也位于上面的 try/catch 中，业务错误会被误判为
  // Pinia 初始化失败并再次发送无鉴权请求，最终把明确的后端错误覆盖成“网络异常”。
  return $fetch<T>(`${baseUrl}${path}`, {
    ...options,
    headers
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

  async updateAccountProfile(payload) {
    const response = await request<BackendAccountProfileResponse>('/account/profile', {
      method: 'PATCH',
      body: { nickname: payload.nickname }
    })
    return ok(mapAccountProfile(response))
  },

  async uploadAccountAvatar(file) {
    const formData = new FormData()
    // 头像二进制仅经受鉴权的 multipart 接口上传，浏览器不直接写媒体存储。
    formData.append('file', file)
    const response = await request<BackendAccountProfileResponse>('/account/profile/avatar', {
      method: 'POST',
      body: formData
    })
    return ok(mapAccountProfile(response))
  },

  async getAccountSecurity() {
    const response = await request<BackendAccountSecuritySummaryResponse>('/account/security')
    return ok(mapAccountSecuritySummary(response))
  },

  async sendAccountSecurityCode(payload) {
    const response = await request<{ status: string; retry_after_seconds: number }>('/account/security/verification-code', {
      method: 'POST',
      body: { target: payload.target, new_phone: payload.newPhone || '' }
    })
    return ok({ status: response.status, retryAfterSeconds: Number(response.retry_after_seconds || 0) })
  },

  async rebindAccountPhone(payload) {
    const response = await request<BackendAccountSecuritySummaryResponse>('/account/security/phone-rebind', {
      method: 'POST',
      body: { new_phone: payload.newPhone, old_phone_code: payload.oldPhoneCode, new_phone_code: payload.newPhoneCode }
    })
    return ok(mapAccountSecuritySummary(response))
  },

  async changeAccountPassword(payload) {
    const response = await request<{ status: string }>('/account/security/password', {
      method: 'POST',
      // 改密采用绑定手机验证码验证身份，确认密码仍交由服务端再次校验，防止绕过前端提交不一致数据。
      body: { new_password: payload.newPassword, new_password_confirmation: payload.newPasswordConfirmation, verification_code: payload.verificationCode }
    })
    return ok(response)
  },

  async getAccountCreditPackages() {
    const response = await request<BackendCreditPackageResponse[]>('/account/credit-packages')
    return ok((response || []).map(mapCreditPackage))
  },

  async getAccountCreditLedgers(page = 1, pageSize = 10) {
    const response = await request<BackendCreditLedgerPageResponse>(`/account/credit-ledgers?page=${page}&page_size=${pageSize}`)
    return ok(mapCreditLedgerPage(response))
  },

  async createPaymentOrder(payload) {
    const response = await request<BackendPaymentOrderResponse>('/account/payment-orders', {
      method: 'POST',
      body: { package_id: payload.packageId, channel: payload.channel, idempotency_key: payload.idempotencyKey }
    })
    return ok(mapPaymentOrder(response))
  },

  async retryPaymentCheckout(orderNo) {
    const response = await request<BackendPaymentOrderResponse>(`/account/payment-orders/${encodeURIComponent(orderNo)}/checkout`, { method: 'POST' })
    return ok(mapPaymentOrder(response))
  },

  async getPaymentOrders(page = 1, pageSize = 20) {
    const response = await request<BackendPaymentOrderPageResponse>(`/account/payment-orders?page=${page}&page_size=${pageSize}`)
    return ok(mapPaymentOrderPage(response))
  },

  async redeemCode(code: string) {
    const response = await request<BackendRedeemCodeResponse>('/account/redeem-code', {
      method: 'POST',
      body: { code }
    })
    const result: RedeemCodeResult = {
      rewardLabel: response.reward_label || '',
      rewardCredits: Number(response.reward_credits || 0),
      balanceAfter: Number(response.balance_after || 0),
      redeemedAt: response.redeemed_at || ''
    }
    return ok(result)
  },

  async getSupportCenter() {
    const response = await request<BackendSupportCenterResponse>('/support-center')
    return ok(mapSupportCenter(response))
  },

  async getLoginAppearance() {
    const response = await request<BackendLoginAppearanceResponse>('/login-appearance')
    return ok(mapLoginAppearance(response))
  },

  async getLegalDocuments() {
    const response = await request<BackendLegalDocumentListResponse>('/legal-documents')
    return ok(mapLegalDocuments(response))
  },

  async submitFeedback(payload: FeedbackSubmitPayload) {
    const body = new FormData()
    body.append('category', payload.category)
    body.append('content', payload.content)
    body.append('contact_email', payload.contactEmail || '')
    body.append('page_path', payload.pagePath || '')
    for (const file of payload.files || []) body.append('files', file)
    const response = await request<BackendFeedbackResponse>('/feedback', { method: 'POST', body })
    return ok(mapFeedback(response))
  },

  async getMyFeedback(page = 1, pageSize = 20) {
    const response = await request<BackendFeedbackPageResponse>(`/feedback/mine?page=${page}&page_size=${pageSize}`)
    return ok(mapFeedbackPage(response))
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
        template_id: payload.templateId || '',
        count: payload.count,
        split_selling_points: payload.splitSellingPoints
      }
    })
    return ok(mapProductImageCreditPreview(response))
  },

  async listProductImageTemplates(params) {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.featured) query.set('featured', 'true')
    const response = await request<BackendProductImageTemplateResponse[]>(`/product-image/templates${query.size ? `?${query.toString()}` : ''}`)
    return ok((response || []).map(mapProductImageTemplate))
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

  async getProductVideoHome() {
    const response = await request<any>('/product-video/home')
    const result: ProductVideoHome = {
      featuredTemplates: (response?.featured_templates || []).map(mapProductVideoTemplate),
      recentTasks: (response?.recent_tasks || []).map(mapProductVideoTask)
    }
    return ok(result)
  },

  async listProductVideoTemplates(params) {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.featured) query.set('featured', 'true')
    const response = await request<any[]>(`/product-video/templates${query.size ? `?${query.toString()}` : ''}`)
    return ok((response || []).map(mapProductVideoTemplate))
  },

  async previewProductVideoCredits(payload) {
    const response = await request<any>('/product-video/credit-preview', { method: 'POST', body: buildProductVideoPayload({ ...payload, creationType: 'product', prompt: '', sourceImages: [], aspectRatio: '9:16', resolution: '720p' }) })
    const result: ProductVideoCreditPreview = {
      provider: String(response?.provider || ''),
      model: String(response?.model || ''),
      requiredCredits: Number(response?.required_credits || 0),
      currentBalance: Number(response?.current_balance || 0),
      balanceAfter: Number(response?.balance_after || 0),
      sufficient: Boolean(response?.sufficient),
      message: String(response?.message || '')
    }
    return ok(result)
  },

  async createProductVideoTask(payload) {
    const response = await request<any>('/product-video/tasks', { method: 'POST', body: buildProductVideoPayload(payload) })
    return ok(mapProductVideoTask(response))
  },

  async getProductVideoTask(taskId) {
    const response = await request<any>(`/product-video/tasks/${encodeURIComponent(taskId)}`)
    return ok(mapProductVideoTask(response))
  },

  async listProductVideoTasks() {
    const response = await request<any[]>('/product-video/tasks')
    return ok((response || []).map(mapProductVideoTask))
  },

  async selectProductVideoResult(taskId, resultId) {
    const response = await request<any>(`/product-video/tasks/${encodeURIComponent(taskId)}/results/${encodeURIComponent(resultId)}/select`, { method: 'POST' })
    return ok(mapProductVideoTask(response))
  },

  async accountLogin(account: string, password: string, acceptedDocumentCodes: string[] = []) {
    const res = await request<any>('/auth/account/login', {
      method: 'POST',
      body: { account, password, accepted_document_codes: acceptedDocumentCodes }
    })
    return ok({
      loggedIn: true,
      token: res.token,
      expiresAt: res.expires_at || '',
      user: {
        id: res.user_id,
        nickname: res.nickname || '测试创作者',
        avatar: res.avatar_url || ''
      }
    } as AuthSession)
  },

  async accountRegister(payload: { account: string; password: string; code: string; nickname?: string; acceptedDocumentCodes?: string[] }) {
    const res = await request<any>('/auth/account/register', {
      method: 'POST',
      body: { ...payload, accepted_document_codes: payload.acceptedDocumentCodes || [] }
    })
    return ok({
      loggedIn: true,
      token: res.token,
      expiresAt: res.expires_at || '',
      user: {
        id: res.user_id,
        nickname: res.nickname || '创作者',
        avatar: res.avatar_url || ''
      }
    } as AuthSession)
  },

  async sendSmsCode(phone: string, purpose: 'login' | 'register' = 'register') {
    const res = await request<any>('/auth/sms/send', {
      method: 'POST',
      body: { phone, purpose }
    })
    return ok({
      status: res.status || 'ok',
      message: res.message || '验证码已发送',
      retryAfterSeconds: res.retry_after_seconds
    })
  },

  async phoneLogin(phone: string, code: string, acceptedDocumentCodes: string[] = []) {
    // 验证码仅用于一次性登录，服务端校验成功后立即消费，不会降级为固定密码。
    const res = await request<any>('/auth/phone/login', {
      method: 'POST',
      body: { phone, code, accepted_document_codes: acceptedDocumentCodes }
    })
    return ok({
      loggedIn: true,
      token: res.token,
      expiresAt: res.expires_at || '',
      user: {
        id: res.user_id,
        nickname: res.nickname || '测试创作者',
        avatar: res.avatar_url || ''
      }
    } as AuthSession)
  },

  async getRuntimeConfig() {
    const response = await request<BackendRuntimeConfigResponse>('/config/runtime')
    
    const mapRuntimeModelOption = (raw: BackendRuntimeModelOption) => ({
      provider: raw.provider,
      model: raw.model,
      label: raw.label,
      description: raw.description,
      baseCredits: raw.base_credits ?? 1,
      billingMode: raw.billing_mode ?? 'per_call',
      // 清晰度统一转为小写，和项目、分镜接口现有的 720p/1080p 字段保持一致。
      limits: {
        minDurationSec: raw.limits?.min_duration_sec,
        maxDurationSec: raw.limits?.max_duration_sec,
        resolutions: (raw.limits?.resolutions || []).map((item) => String(item).toLowerCase()),
        maxReferenceCount: raw.limits?.max_reference_count,
        supportsSilent: raw.limits?.supports_silent,
      },
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

  async getPublicVideoCapabilities() {
    const response = await request<BackendPublicVideoCapabilitiesResponse>('/config/video-capabilities')
    const data: PublicVideoCapabilities = {
      resolutions: response.resolutions.map(item => String(item).toLowerCase()),
      defaultResolution: String(response.default_resolution).toLowerCase(),
      minDurationSec: response.min_duration_sec,
      maxDurationSec: response.max_duration_sec,
      supportsAudioUpload: response.supports_audio_upload !== false,
      supportsAudioDrivenVideo: response.supports_audio_driven_video === true,
      audioMixModes: (response.audio_mix_modes || ['replace', 'mix']).filter((item): item is 'replace' | 'mix' => item === 'replace' || item === 'mix'),
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
        entry_intent: payload.entryIntent || 'drama',
        // 项目列表快捷创建不会先经过入口配置面板，因此这里必须提供后端认可的有效默认值。
        style: payload.style || '东方玄幻 · 电影写实',
        aspect_ratio: payload.aspectRatio || '16:9',
        resolution: payload.resolution || '720p',
        episode_count: payload.episodeCount || 1
      }
    })
    return ok(mapDramaDetail(response), 'created')
  },

  async getDramaProject(projectId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}`)
    return ok(mapDramaDetail(response))
  },

  // 资产工作台接口保留后端 snake_case 字段，和数据库/任务日志中的命名保持一致，
  // 这样在排查生成、锁定及视觉版本问题时无需再经过一层容易遗漏字段的转换。
  async getDramaAssetWorkspace(projectId: string) {
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/asset-workspace`)
    return ok(response)
  },

  async updateDramaVisualBible(
    projectId: string,
    payload: Omit<DramaVisualBible, 'id' | 'version_no' | 'source_script_version' | 'status'>,
  ) {
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/visual-bible`, {
      method: 'PATCH',
      body: payload,
    })
    return ok(response)
  },

  async createDramaAssetProfile(projectId: string, payload: { asset_type: DramaWorkspaceAssetType; name: string; is_required?: boolean; data?: Record<string, unknown> }) {
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/assets`, { method: 'POST', body: payload })
    return ok(response)
  },

  async updateDramaAssetProfile(
    projectId: string,
    assetType: DramaWorkspaceAssetType,
    assetKey: string,
    payload: { name?: string; is_required?: boolean; production_status?: DramaWorkspaceAssetStatus; selected_asset_id?: string; data?: Record<string, unknown> },
  ) {
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}`, { method: 'PATCH', body: payload })
    return ok(response)
  },

  async deleteDramaAssetProfile(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string) {
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}`, { method: 'DELETE' })
    return ok(response)
  },

  async uploadDramaAssetReference(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}/upload`, { method: 'POST', body })
    return ok(response)
  },

  async estimateDramaAssetGeneration(projectId: string, targets: string[]) {
    const response = await request<DramaAssetGenerationEstimate>(`/drama/projects/${projectId}/assets/generation/estimate`, {
      method: 'POST', body: { targets },
    })
    return ok(response)
  },

  async generateDramaWorkspaceAssets(projectId: string, targets: string[], overwrite = false, compileHashes: Record<string, string> = {}, retryFailed = false) {
    const response = await request<DramaAssetGenerationRun>(`/drama/projects/${projectId}/assets/generate`, {
      method: 'POST', body: { targets, overwrite, compile_hashes: compileHashes, retry_failed: retryFailed },
    })
    return ok(response)
  },

  async lockDramaWorkspaceAsset(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, locked: boolean) {
    const action = locked ? 'lock' : 'unlock'
    const response = await request<DramaAssetWorkspace>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}/${action}`, { method: 'POST' })
    return ok(response)
  },

  async estimateDramaAssetConsistency(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string) {
    const response = await request<DramaAssetConsistencyEstimate>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}/consistency/estimate`, {
      method: 'POST',
    })
    return ok(response)
  },

  async checkDramaAssetConsistency(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, manual = true, force = false) {
    const response = await request<DramaAssetConsistencyRun>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}/consistency/check`, {
      method: 'POST', body: { manual, force },
    })
    return ok(response)
  },

  async estimateDramaAssetConsistencyRepair(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: DramaAssetRepairRequest) {
    const response = await request<DramaAssetRepairEstimate>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}/consistency/repair/estimate`, {
      method: 'POST', body: payload,
    })
    return ok(response)
  },

  async repairDramaAssetConsistency(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: DramaAssetRepairRequest) {
    const response = await request<DramaAssetGenerationRun>(`/drama/projects/${projectId}/assets/${assetType}/${assetKey}/consistency/repair`, {
      method: 'POST', body: payload,
    })
    return ok(response)
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

  async ingestDramaScriptFile(projectId: string, file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/script-file-ingest`, {
      method: 'POST',
      body
    })
    return ok(mapDramaDetail(response))
  },

  async previewDramaEntryCredits(payload: DramaEntryCreditPreviewPayload) {
    const response = await request<BackendDramaCreditPreviewResponse>('/drama/entry-credit-preview', {
      method: 'POST',
      body: {
        content: payload.content,
        model: payload.model || ''
      }
    })
    return ok(mapDramaCreditPreview(response))
  },

  async previewDramaEntryFileCredits(file: File, payload?: { model?: string }) {
    const body = new FormData()
    body.append('file', file)
    if (payload?.model) body.append('model', payload.model)
    const response = await request<BackendDramaCreditPreviewResponse>('/drama/entry-credit-preview/file', {
      method: 'POST',
      body
    })
    return ok(mapDramaCreditPreview(response))
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

  async createDramaScriptOptimization(projectId: string, payload: DramaScriptOptimizationPayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/script-optimizations`, {
      method: 'POST',
      body: {
        kind: payload.kind || 'global',
        task_type: payload.taskType || 'CREATE_OPTIMIZATION_DRAFT',
        suggestion_ids: payload.suggestionIds || [],
        scope: payload.scope || '',
        intensity: payload.intensity || 'balanced',
        episode_no: payload.episodeNo ?? null,
        scene_index: payload.sceneIndex ?? null,
        instruction: payload.instruction || '',
        source_version: payload.sourceVersion || '',
        adjustment_instruction: payload.adjustmentInstruction || '',
        adjusted_text: payload.adjustedText || '',
        selected_actions: payload.selectedActions || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async applyDramaScriptVersion(projectId: string, versionId: string) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/script-versions/${encodeURIComponent(versionId)}/apply`,
      { method: 'POST' }
    )
    return ok(mapDramaDetail(response))
  },

  async updateDramaScriptSuggestionStatus(projectId: string, suggestionId: string, payload: { status: 'open' | 'pending' | 'ignored'; scriptVersionId?: string }) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/script-suggestions/${encodeURIComponent(suggestionId)}`,
      {
        method: 'PATCH',
        body: {
          status: payload.status,
          script_version_id: payload.scriptVersionId || ''
        }
      }
    )
    return ok(mapDramaDetail(response))
  },

  async resolveDramaScriptSuggestionSource(projectId: string, suggestionId: string) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/script-suggestions/${encodeURIComponent(suggestionId)}/resolve-source`,
      { method: 'POST' }
    )
    return ok(mapDramaDetail(response))
  },

  async updateDramaScriptSuggestionSourceRange(projectId: string, suggestionId: string, payload: import('~/shared/api/types').DramaSuggestionSourceRangePayload) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/script-suggestions/${encodeURIComponent(suggestionId)}/source-range`,
      {
        method: 'PATCH',
        body: {
          episode_no: payload.episodeNo ?? null,
          scene_id: payload.sceneId || '',
          scene_index: payload.sceneIndex ?? null,
          start_offset: payload.startOffset,
          end_offset: payload.endOffset
        }
      }
    )
    return ok(mapDramaDetail(response))
  },

  async confirmDramaScriptVersion(projectId: string) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/script-versions/current/confirm`,
      { method: 'POST' }
    )
    return ok(mapDramaDetail(response))
  },

  async skipDramaScriptReviews(projectId: string) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/analysis/reviews/skip`,
      { method: 'POST' }
    )
    return ok(mapDramaDetail(response))
  },

  async updateDramaScriptScene(projectId: string, payload: DramaScriptSceneUpdatePayload) {
    // 完整剧本页的“场次正文编辑”是用户手动修文，不属于 AI 生成动作：
    // 这里只把当前场次内容保存进项目 analysis_json，不走点数扣费。
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/script-scenes`, {
      method: 'PATCH',
      body: {
        episode_no: payload.episodeNo,
        scene_index: payload.sceneIndex,
        scene_id: payload.sceneId || '',
        title: payload.title || '',
        place: payload.place || '',
        time_of_day: payload.timeOfDay || '',
        characters: payload.characters || [],
        content: payload.content
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
        aspect_ratio: payload.aspectRatio || '16:9',
        style: payload.style || '',
        force_reanalyze: payload.forceReanalyze ?? false,
        duration_sec: payload.durationSec || 5,
        resolution: payload.resolution || '',
        audio: payload.audio ?? true,
        overwrite: payload.overwrite ?? true,
        shot_count: payload.shotCount || 12,
        episode_nos: payload.episodeNos || [],
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

  async analyzeDrama(projectId: string, payload?: { model?: string; aspectRatio?: string; resolution?: string; style?: string; forceReanalyze?: boolean }) {
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

  async retryDramaAnalysisNode(projectId: string, nodeKey: string) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/analysis/nodes/${encodeURIComponent(nodeKey)}/retry`,
      { method: 'POST' }
    )
    return ok(mapDramaDetail(response))
  },

  async retryDramaSuggestionDraft(projectId: string, suggestionId: string) {
    const response = await request<BackendDramaDetailResponse>(
      `/drama/projects/${projectId}/script-suggestions/${encodeURIComponent(suggestionId)}/draft/retry`,
      { method: 'POST' }
    )
    return ok(mapDramaDetail(response))
  },

  async quoteDramaSuggestionDrafts(projectId: string, suggestionIds: string[]) {
    const response = await request<any>(`/drama/projects/${projectId}/script-suggestions/drafts/quote`, {
      method: 'POST',
      body: { suggestion_ids: suggestionIds }
    })
    return ok({
      items: (response.items || []).map((item: any) => ({
        suggestionId: item.suggestion_id || '',
        sourceScopeType: item.source_scope_type || 'scene',
        sourceChars: Number(item.source_chars || 0),
        estimatedTokens: Number(item.estimated_tokens || 0),
        estimatedCredits: Number(item.estimated_credits || 0)
      })),
      totalCredits: Number(response.total_credits || 0),
      currentBalance: Number(response.current_balance || 0),
      sufficient: Boolean(response.sufficient),
      expiresAt: response.expires_at || ''
    })
  },

  async generateDramaSuggestionDrafts(projectId: string, suggestionIds: string[]) {
    const response = await request<any>(`/drama/projects/${projectId}/script-suggestions/drafts/generate`, {
      method: 'POST',
      body: { suggestion_ids: suggestionIds }
    })
    return ok({
      runId: response.run_id || '',
      status: response.status || 'queued',
      total: Number(response.total || 0),
      succeeded: Number(response.succeeded || 0),
      failed: Number(response.failed || 0),
      running: Number(response.running || 0),
      chargedCredits: Number(response.charged_credits || 0),
      suggestionIds: response.suggestion_ids || []
    })
  },

  async getDramaSuggestionDraftRun(projectId: string, runId: string) {
    const response = await request<any>(`/drama/projects/${projectId}/script-suggestions/draft-runs/${encodeURIComponent(runId)}`)
    return ok({
      runId: response.run_id || '',
      status: response.status || 'running',
      total: Number(response.total || 0),
      succeeded: Number(response.succeeded || 0),
      failed: Number(response.failed || 0),
      running: Number(response.running || 0),
      chargedCredits: Number(response.charged_credits || 0),
      suggestionIds: response.suggestion_ids || []
    })
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
        planning_mode: payload?.planningMode || 'dynamic',
        style: payload?.style || '',
        provider: payload?.provider || 'alibaba',
        resolution: payload?.resolution || '360p',
        quality_policy: payload?.qualityPolicy || 'smart',
        episode_nos: payload?.episodeNos || []
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
        episodeStages: Object.fromEntries(Object.entries(response.run?.episode_stages || {}).map(([key, stage]) => [key, {
          stage: stage.stage || 'idle',
          progress: Number(stage.progress || 0),
          totalBatches: Number(stage.total_batches || 0),
          completedBatches: Number(stage.completed_batches || 0),
          totalScenes: Number(stage.total_scenes || 0),
          completedScenes: Number(stage.completed_scenes || 0),
          currentNodeLabel: stage.current_node_label || '',
          errorCode: stage.error_code || '',
          validationIssues: stage.validation_issues || [],
          retryableNodes: stage.retryable_nodes || [],
          errorMessage: stage.error_message || ''
        }])),
        generatedCounts: response.run?.generated_counts || {},
        expectedCounts: response.run?.expected_counts || {},
        model: response.run?.model || '',
        style: response.run?.style || '',
        errorMessage: response.run?.error_message || '',
        updatedAt: response.run?.updated_at || ''
      }
    })
  },

  async getStoryboardWorkspace(projectId: string, episodeNo = 1) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboard-workspace?episode_no=${episodeNo}`)
    return ok(mapStoryboardWorkspace(response))
  },

  async updateStoryboardDirectorSegments(projectId: string, rowId: string, payload: StoryboardDirectorSegmentsPayload) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/director-segments`, {
      method: 'PUT',
      body: {
        segments: payload.segments.map(segment => ({
          id: segment.id,
          sort_index: segment.sortIndex,
          start_ms: segment.startMs,
          end_ms: segment.endMs,
          shot_size: segment.shotSize,
          camera_motion: segment.cameraMotion,
          visual_focus: segment.visualFocus,
          action_desc: segment.actionDesc,
          emotion_desc: segment.emotionDesc,
          audio_cue: segment.audioCue,
          extra: segment.extra
        }))
      }
    })
    return ok(mapStoryboardWorkspace(response))
  },

  async tuneStoryboardShot(projectId: string, rowId: string, payload: StoryboardShotTuningPayload) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/tune`, {
      method: 'POST',
      body: {
        duration_sec: payload.durationSec,
        instruction: payload.instruction,
        preserve_assets: payload.preserveAssets !== false
      }
    })
    return ok(mapStoryboardWorkspace(response))
  },

  async generateStoryboardPrevisualization(projectId: string, rowId: string) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/previsualization`, {
      method: 'POST'
    })
    return ok(mapStoryboardWorkspace(response))
  },

  async reviewStoryboards(projectId: string, payload: StoryboardReviewBatchPayload) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboards/reviews`, {
      method: 'POST',
      body: {
        reviews: payload.reviews.map(item => ({
          row_id: item.rowId,
          status: item.status,
          note: item.note || ''
        }))
      }
    })
    return ok(mapStoryboardWorkspace(response))
  },

  async previewStoryboardTuning(projectId: string, payload: StoryboardTuningPayload) {
    const response = await request<Record<string, unknown>>(`/drama/projects/${projectId}/storyboard-tuning/preview`, {
      method: 'POST',
      body: buildStoryboardTuningPayload(payload)
    })
    return ok(mapStoryboardTuningPreview(response))
  },

  async applyStoryboardTuning(projectId: string, payload: StoryboardTuningPayload) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboard-tuning/apply`, {
      method: 'POST',
      body: buildStoryboardTuningPayload(payload)
    })
    return ok(mapStoryboardWorkspace(response))
  },

  async estimateStoryboardVideoBatch(projectId: string, payload: StoryboardVideoBatchPayload) {
    const response = await request<Record<string, unknown>>(`/drama/projects/${projectId}/storyboard-video-batches/estimate`, {
      method: 'POST',
      body: buildStoryboardVideoBatchPayload(payload)
    })
    return ok(mapStoryboardBatchEstimate(response))
  },

  async createStoryboardVideoBatch(projectId: string, payload: StoryboardVideoBatchPayload) {
    const response = await request<BackendStoryboardVideoBatchResponse>(`/drama/projects/${projectId}/storyboard-video-batches`, {
      method: 'POST',
      body: buildStoryboardVideoBatchPayload(payload)
    })
    return ok(mapStoryboardVideoBatch(response))
  },

  async retryFailedStoryboardVideoBatch(projectId: string, batchId: string) {
    const response = await request<BackendStoryboardVideoBatchResponse>(`/drama/projects/${projectId}/storyboard-video-batches/${batchId}/retry-failed`, {
      method: 'POST'
    })
    return ok(mapStoryboardVideoBatch(response))
  },

  async selectStoryboardTake(projectId: string, rowId: string, takeId: string, payload) {
    const response = await request<BackendStoryboardWorkspaceResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/takes/${takeId}/select`, {
      method: 'PATCH',
      body: { review_status: payload?.reviewStatus || 'passed' }
    })
    return ok(mapStoryboardWorkspace(response))
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
        sort_index: payload.sortIndex,
        duration_sec: payload.durationSec,
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
        plan_status: payload.planStatus,
        review_status: payload.reviewStatus,
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
        duration_sec: payload?.durationSec,
        resolution: payload?.resolution || '720p',
        reference_urls: payload?.referenceUrls || [],
        reference_bindings: payload?.referenceBindings || [],
        continuation_from_row_id: payload?.continuationFromRowId || '',
        continuation_policy: payload?.continuationPolicy || 'auto',
        retry_reason: payload?.retryReason || '',
        audio: !['silent', 'none'].includes(payload?.audioMode || ''),
        audio_mode: payload?.audioMode === 'sound' ? 'preserve_original' : payload?.audioMode || 'preserve_original',
        audio_asset_id: payload?.audioAssetId || '',
        audio_trim_start_ms: payload?.audioTrimStartMs || 0,
        audio_trim_end_ms: payload?.audioTrimEndMs ?? null,
        audio_mix_mode: payload?.audioMixMode || 'replace',
        quality_policy: payload?.qualityPolicy || 'smart'
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
      body: buildStoryboardVideoBatchPayload(payload)
    })
    return ok(mapStoryboardVideoBatch(response))
  },

  async getEpisodeCut(projectId: string, episodeNo: number) {
    const response = await request<BackendEpisodeCut>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut`)
    return ok(mapEpisodeCut(response))
  },

  async saveEpisodeCut(projectId: string, episodeNo: number, payload: EpisodeCutSavePayload) {
    const response = await request<BackendEpisodeCut>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut`, {
      method: 'PUT',
      body: buildEpisodeCutPayload(payload)
    })
    return ok(mapEpisodeCut(response))
  },

  async uploadEpisodeBgm(projectId: string, episodeNo: number, file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await request<BackendEpisodeCut>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut/bgm`, {
      method: 'POST',
      body
    })
    return ok(mapEpisodeCut(response))
  },

  async generateEpisodeCaptions(projectId: string, episodeNo: number) {
    const response = await request<BackendEpisodeCutTask>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut/captions/generate`, {
      method: 'POST'
    })
    return ok(mapEpisodeCutTask(response))
  },

  async renderEpisodeCut(projectId: string, episodeNo: number) {
    const response = await request<BackendEpisodeCutTask>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut/render`, {
      method: 'POST'
    })
    return ok(mapEpisodeCutTask(response))
  },

  async exportEpisodeEditorPackage(projectId: string, episodeNo: number) {
    const response = await request<BackendEpisodeCutTask>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut/editor-package`, {
      method: 'POST'
    })
    return ok(mapEpisodeCutTask(response))
  },

  async getEpisodeCutTask(projectId: string, episodeNo: number, taskId: string) {
    const response = await request<BackendEpisodeCutTask>(`/drama/projects/${projectId}/episodes/${episodeNo}/cut/tasks/${taskId}`)
    return ok(mapEpisodeCutTask(response))
  }
}
