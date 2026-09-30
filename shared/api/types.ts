import type { AuthSession } from '~/entities/auth/types'
import type { SystemAnnouncement } from '~/entities/announcement/types'
import type { AccountProfile, AccountSecuritySummary, CreditLedgerPage, CreditPackage, PaymentOrder, PaymentOrderPage } from '~/entities/account/types'
import type { CanvasGraph } from '~/entities/canvas/types'
import type { DramaVisualStyleContract } from '~/shared/constants/dramaVisualStyles'
import type {
  DramaCreditPreview,
  DramaIntentMode,
  DramaProjectCard,
  DramaProjectDetail,
  DramaProjectPage,
  DramaRuntimeConfig,
  PublicVideoCapabilities
} from '~/entities/drama/types'
import type { EpisodeCutDraft, EpisodeCutSavePayload, EpisodeCutTask, EpisodeCutTaskList } from '~/entities/drama/episodeCutTypes'
import type { Project } from '~/entities/project/types'
import type { FeedbackPage, FeedbackSubmitPayload, RedeemCodeResult, SupportCenter, UserFeedback, WebsiteInfo } from '~/entities/support/types'
import type {
  ProductImageCreditPreview,
  ProductImageGeneratePayload,
  ProductImageGenerateResult,
  ProductImageHistoryBatch,
  ProductImageResult,
  ProductImageTemplate,
  ProductSellingPoint
} from '~/entities/product-image/types'
import type { DigitalHumanAvailability, DigitalHumanQuote, ProductVideoCreatePayload, ProductVideoCreditPreview, ProductVideoHome, ProductVideoReferenceAnalysis, ProductVideoReferenceLinkInspection, ProductVideoScriptOptimization, ProductVideoTask, ProductVideoTemplate } from '~/entities/product-video/types'
import type {
  StoryboardClipContract,
  StoryboardContinuationPolicy,
  StoryboardContinuityState,
  StoryboardDirectorSegment,
  StoryboardMicroEdit,
  StoryboardMicroEditEstimate,
  StoryboardMicroEditMode,
  StoryboardMicroEditReference,
  StoryboardPromptLoad,
  StoryboardQualityPolicy,
  StoryboardReferenceBinding,
  StoryboardRetryReason,
  StoryboardRow,
  StoryboardTake,
  StoryboardVideoInputMode,
  StoryboardWorkspace,
  StoryboardPlanHistory
} from '~/entities/storyboard/types'

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

/** 后端按业务功能公开的模型能力快照；不包含供应商密钥和采购信息。 */
export interface GenerationProfile {
  use_case_key: string
  task_type: 'image' | 'video' | string
  profile_version: number
  selection_mode: 'locked' | 'advanced_optional' | string
  /** 短剧生产功能为 false：前台不得展示模型选择器，也不能提交模型覆盖后台路由。 */
  supports_user_model_selection: boolean
  model: { id: string; code: string; name: string }
  input_schema: Record<string, unknown>
  limits: Record<string, unknown>
  default_params: Record<string, unknown>
  basic_override_keys: string[]
  advanced_override_keys: string[]
  allowed_models: Array<{ id: string; code: string; name: string }>
}

export interface WechatLoginTicket {
  qrCode: string
  ticketId: string
  expiresInSec: number
}

export interface StoryboardGeneratePayload {
  projectId: string
  nodeId: string
  content: string
  shotCount: number
  model?: string
  provider?: 'bytedance' | 'alibaba'
  resolution?: string
  style?: string
  cameraPreset?: string
  scriptInputMode?: 'plot' | 'videoRef' | 'roleRef'
}

export interface WorkflowRunCreatePayload {
  projectId: string
  triggerNodeId: string
  inputSnapshot: Record<string, unknown>
}

export interface WorkflowRunInfo {
  runId: string
  status: string
  errorCode?: string
  errorMessage?: string
  outputSnapshot?: Record<string, unknown>
}

export interface DramaProjectCreatePayload {
  title?: string
  themeMode?: 'dark' | 'light'
  entryIntent?: DramaIntentMode
  style?: string
  styleId?: string
  aspectRatio?: string
  resolution?: string
  episodeCount?: number
  /** 一次首页创建动作稳定复用同一键，避免网络重试产生重复项目。 */
  idempotencyKey?: string
}

export interface DramaScriptIngestPayload {
  content: string
  fileName?: string
}

export interface DramaAnalyzePayload {
  model?: string
  aspectRatio?: string
  resolution?: string
  style?: string
  /** 默认复用相同输入的已有解析；仅用户明确要求重新生成时设为 true。 */
  forceReanalyze?: boolean
}

export interface DramaAssetGeneratePayload {
  model?: string
  style?: string
  overwrite?: boolean
  roleKeys?: string[]
  sceneKeys?: string[]
  propKeys?: string[]
}

export interface DramaCoverRegeneratePayload {
  style?: string
}

export interface DramaRoleCreatePayload {
  name: string
  ageIdentity: string
  gender: string
  voiceRef?: string
  prompt?: string
  description?: string
}

export interface DramaRoleUpdatePayload {
  personality?: string
  appearance?: string
  prompt?: string
}

export interface DramaRoleVoiceUpdatePayload {
  voiceRef: string
}

export interface DramaSceneUpdatePayload {
  description?: string
  prompt?: string
}

export interface DramaPropUpdatePayload {
  description?: string
  prompt?: string
}

export interface DramaStoryboardGeneratePayload {
  model?: string
  shotCount?: number
  // 商业前台默认由 AI 根据剧情密度动态规划镜头数量，fixed 仅用于管理端联调。
  planningMode?: 'dynamic' | 'fixed'
  style?: string
  provider?: 'bytedance' | 'alibaba'
  resolution?: string
  qualityPolicy?: StoryboardQualityPolicy
  /** 明确指定本次规划集数；空数组仅用于兼容旧客户端的全剧模式。 */
  episodeNos?: number[]
}

export interface DramaCreditPreviewPayload {
  action:
    | 'analysis'
    | 'roles'
    | 'scenes'
    | 'props'
    | 'storyboards'
    | 'storyboard_video'
    // 剧本阶段新增的 AI 体检/优化动作。它们仍然按文字模型计费，
    // 但单独命名后，前后端流水能明确区分“解析剧本”和“生成优化版本”。
    | 'script_optimization'
    | 'script_global_optimization'
    | 'script_character_optimization'
    | 'script_episode_optimization'
    | 'script_scene_optimization'
    | 'script_text_optimization'
  model?: string
  provider?: string
  /** 剧本解析的作品参数用于识别相同运行，避免重复创建任务和扣点。 */
  aspectRatio?: string
  style?: string
  forceReanalyze?: boolean
  durationSec?: number
  resolution?: string
  videoInputMode?: StoryboardVideoInputMode
  audio?: boolean
  overwrite?: boolean
  shotCount?: number
  /** 分镜报价范围必须和正式提交范围一致。 */
  episodeNos?: number[]
  rowId?: string
  roleKeys?: string[]
  sceneKeys?: string[]
  propKeys?: string[]
  referenceUrls?: string[]
  referenceBindings?: StoryboardReferenceBinding[]
  continuationFromRowId?: string
  continuationPolicy?: StoryboardContinuationPolicy
  retryReason?: StoryboardRetryReason
}

export interface DramaEntryCreditPreviewPayload {
  content: string
  model?: string
}

export interface DramaIntentRouterUpdatePayload {
  mode: DramaIntentMode
}

export interface DramaScriptOptimizationPayload {
  kind?: 'global' | 'suggestion' | 'character' | 'episode' | 'scene' | 'text'
  /**
   * 剧本优化任务类型，用于严格区分整剧解析和单条建议操作。
   * 注意：该接口只处理优化任务，不允许传入 FULL_SCRIPT_PARSE。
   */
  taskType?: 'CREATE_OPTIMIZATION_DRAFT' | 'LOCAL_SUGGESTION_RECHECK' | 'REGENERATE_SUGGESTION_DRAFT' | 'REFRESH_STALE_SUGGESTION' | 'APPLY_SUGGESTION_TO_DRAFT'
  suggestionIds?: string[]
  scope?: string
  intensity?: 'conservative' | 'balanced' | 'deep'
  episodeNo?: number | null
  sceneIndex?: number | null
  instruction?: string
  sourceVersion?: string
  adjustmentInstruction?: string
  adjustedText?: string
  selectedActions?: string[]
}

export interface DramaSuggestionSourceRangePayload {
  episodeNo?: number | null
  sceneId?: string
  sceneIndex?: number | null
  startOffset: number
  endOffset: number
}

export interface DramaSuggestionDraftQuote {
  items: Array<{
    suggestionId: string
    sourceScopeType: string
    sourceChars: number
    estimatedTokens: number
    estimatedCredits: number
  }>
  totalCredits: number
  currentBalance: number
  sufficient: boolean
  expiresAt: string
}

export interface DramaSuggestionDraftRun {
  runId: string
  status: string
  total: number
  succeeded: number
  failed: number
  running: number
  chargedCredits: number
  suggestionIds: string[]
}

export interface DramaScriptSceneUpdatePayload {
  episodeNo: number
  sceneIndex: number
  sceneId?: string
  title?: string
  place?: string
  timeOfDay?: string
  characters?: string[]
  content: string
}

export interface StoryboardCreatePayload {
  episodeNo?: number
  afterSortIndex?: number | null
}

export interface StoryboardUpdatePayload {
  sortIndex?: number
  durationSec?: number
  sceneDescription?: string
  roleName?: string
  shotType?: string
  actionDesc?: string
  moodDesc?: string
  soundFx?: string
  dialogue?: string
  storyboardPrompt?: string
  cameraMotionPrompt?: string
  roleKeys?: string[]
  sceneKeys?: string[]
  propKeys?: string[]
  videoPrompt?: string
  videoModel?: string
  videoDurationSec?: number
  // 调整时长、资产或导演方案后，显式同步方案与验收状态，避免旧方案继续生成。
  planStatus?: 'draft' | 'preflight_running' | 'review_required' | 'confirmed' | 'stale'
  reviewStatus?: 'unreviewed' | 'passed' | 'needs_revision'
  extra?: Record<string, unknown>
}

export interface StoryboardVideoGeneratePayload {
  model?: string
  durationSec?: number
  resolution?: string
  /** 资产全能参考或首尾帧边界参考；两种模式不会混发。 */
  videoInputMode?: StoryboardVideoInputMode
  referenceUrls?: string[]
  referenceBindings?: StoryboardReferenceBinding[]
  continuationFromRowId?: string
  continuationPolicy?: StoryboardContinuationPolicy
  retryReason?: StoryboardRetryReason
  /** 默认 preserve_original 对应火山 generate_audio=true；none/silent 才明确静音。 */
  audioMode?: 'preserve_original' | 'drive_video' | 'none' | 'sound' | 'silent'
  audioAssetId?: string
  audioTrimStartMs?: number
  audioTrimEndMs?: number | null
  audioMixMode?: 'replace' | 'mix'
  qualityPolicy?: StoryboardQualityPolicy
}

export interface StoryboardVideoPromptGeneratePayload {
  model?: string
  durationSec?: number
  resolution?: string
  videoInputMode?: StoryboardVideoInputMode
  referenceBindings?: StoryboardReferenceBinding[]
  continuationFromRowId?: string
  continuationPolicy?: StoryboardContinuationPolicy
  retryReason?: StoryboardRetryReason
}

export interface StoryboardVideoPromptInfo {
  storyboardRowId: string
  videoPrompt: string
  videoModel: string
  videoDurationSec: number
  clipContract: StoryboardClipContract
  referenceBindings: StoryboardReferenceBinding[]
  continuityState: StoryboardContinuityState
  retryReason: StoryboardRetryReason | ''
  warnings: string[]
  promptLoad: StoryboardPromptLoad
  modeHint: DramaIntentMode
  repairPatchSummary: string
}

export interface StoryboardVideoRunInfo {
  storyboardRowId: string
  runId: string
  status: string
}

export interface StoryboardVideoBatchPayload {
  episodeNo: number
  model?: string
  durationSec?: number
  resolution?: string
  videoInputMode?: StoryboardVideoInputMode
  /** 默认 preserve_original 对应火山 generate_audio=true；none/silent 才明确静音。 */
  audioMode?: 'preserve_original' | 'drive_video' | 'none' | 'sound' | 'silent'
  audioAssetId?: string
  audioTrimStartMs?: number
  audioTrimEndMs?: number | null
  audioMixMode?: 'replace' | 'mix'
  qualityPolicy?: StoryboardQualityPolicy
  /** 用户已在生成确认弹窗中接受“无参考图生成”的一致性风险。 */
  allowMissingReferences?: boolean
  rowIds?: string[]
  idempotencyKey?: string
}

export interface StoryboardDirectorSegmentsPayload {
  segments: StoryboardDirectorSegment[]
}

export interface StoryboardReviewBatchPayload {
  reviews: Array<{
    rowId: string
    status: 'passed' | 'needs_revision'
    note?: string
  }>
}

export interface StoryboardTuningPayload {
  episodeNo: number
  rhythm: 'fast' | 'standard' | 'slow'
  shotScale: 'close' | 'balanced' | 'wide'
  cameraStyle: 'stable' | 'light' | 'dynamic'
  emotionTone: 'restrained' | 'dramatic' | 'lyrical'
  continuityPriority: 'character' | 'scene' | 'style'
  qualityPolicy: StoryboardQualityPolicy
  scope: 'issues' | 'unconfirmed' | 'ungenerated' | 'all'
}

export interface StoryboardTuningPreview {
  affectedRowIds: string[]
  lockedRowIds: string[]
  affectedCount: number
  estimatedDurationSec: number
  createsNewVersion: boolean
  changes: string[]
}

export interface StoryboardShotTuningPayload {
  durationSec: number
  instruction: string
  preserveAssets?: boolean
}

export interface StoryboardBatchEstimate {
  eligibleRowIds: string[]
  blocked: Array<{ row_id?: string; rowId?: string; reason: string }>
  warnings: Array<{ row_id?: string; rowId?: string; reason: string }>
  totalDurationSec: number
  estimatedCredits: number
  totalCredits: number
  costItems: Array<{ type: string; rowId?: string; label: string; credits: number }>
  currentBalance: number
  sufficient: boolean
}

export interface StoryboardVideoBatchResult {
  batchId: string
  runs: StoryboardVideoRunInfo[]
}

export interface DramaDeleteResult {
  deletedIds: string[]
}

// -----------------------------
// 短剧资产工作台（第二阶段）
// -----------------------------
// 这些类型直接对应后端结构化资产档案。前端只负责编辑结构化字段，
// 最终生图 Prompt 由后端结合已确认剧本和视觉基准统一编译，避免不同页面各自拼词导致风格漂移。
export type DramaWorkspaceAssetType = 'role' | 'scene' | 'prop'
export type DramaWorkspaceAssetStatus = 'candidate' | 'planned' | 'queued' | 'generating' | 'to_confirm' | 'locked' | 'stale' | 'failed' | 'skipped'

export interface DramaVisualBible {
  id: string
  version_no: number
  title: string
  style_type: string
  style_id?: string
  style_version?: number
  render_medium?: string
  color_palette: string[]
  lighting: string
  materials: string
  character_style: string
  costume_material_style?: string
  environment_render_style?: string
  camera_language: string
  runtime_style_prefix?: string
  forbidden_elements: string[]
  reference_asset_ids: string[]
  source_script_version: string
  status: string
}

export interface DramaAssetVersion {
  id: string
  image_url: string
  status: string
  created_at: string
  meta: Record<string, unknown>
}

export interface DramaAssetConsistencyReport {
  id: string
  status: string
  overall_score: number
  dimensions: Record<string, number>
  issues: Array<Record<string, unknown>>
  suggestions: string[]
  billing_status: string
  model_code: string
  error_message: string
  previous_score: number | null
  score_delta: number | null
  created_at: string
  qualification_status: 'pending' | 'passed' | 'minor_deviation' | 'hard_failed' | 'service_failed' | string
  responsibility: 'system' | 'user_or_reference' | 'uploaded_asset' | 'unknown' | string
  root_cause: string
  hard_fail: boolean
  confidence: number
  prompt_audit: Record<string, unknown>
  diagnosis: Record<string, any>
  repair_strategy: Record<string, any>
  system_repair_available: boolean
  system_repair_used: boolean
  compensation_status: string
}

export interface DramaAssetConsistencyEstimate {
  required_credits: number
  cost_items: Array<{ type: string; label: string; credits: number; model_code?: string }>
  current_balance: number
  sufficient: boolean
  billing_status: string
  free_retry: boolean
}

export interface DramaAssetRoleVoice {
  mode: 'none' | 'preset' | 'custom_audio'
  voice_ref: string
  preset_key: string
  audio_asset: null | {
    id: string
    audio_url: string
    file_name: string
    mime_type: string
    size_bytes: number
    duration_sec: number | null
    created_at: string
  }
  recommendation: {
    voice_type: string
    tone: string
    pitch: string
    pace: string
  }
  capabilities: {
    wan_2_7: boolean
    wan_2_6: boolean
    seedance: boolean
    preset_is_real_audio: boolean
  }
}

export interface DramaAssetConsistencyRun {
  report_id: string
  run_id: string
  status: string
  required_credits: number
  current_balance: number
  billing_status: string
}

/** 用户可审阅的图片画面稿；与角色/场景原始剧情档案分开保存。 */
export interface DramaAssetVisualPromptDraft {
  original_prompt: string
  suggested_prompt: string
  base_hash: string
  risk_notices: string[]
}

export interface DramaAssetProfile {
  id: string
  asset_type: DramaWorkspaceAssetType
  asset_key: string
  name: string
  source_script_version: string
  production_version_id?: string
  reused_from_profile_id?: string
  visual_bible_version_id: string
  selected_asset_id: string
  production_status: DramaWorkspaceAssetStatus
  is_required: boolean
  data: Record<string, any>
  source_refs: Array<Record<string, any>>
  stale_reason: string
  generation_error_message: string
  locked_at: string
  versions: DramaAssetVersion[]
  consistency: DramaAssetConsistencyReport
  /** 仅角色返回；继续绑定 analysis.roles[].voice_ref，分镜侧无需修改。 */
  voice?: DramaAssetRoleVoice | null
}

export interface DramaAssetWorkspace {
  project_id: string
  source_script_version: string
  production_version_id?: string
  production_sync_status?: string
  confirmed_snapshot_id: string
  confirmed_content_hash: string
  asset_compiler_version: number
  preparation_status: 'local_ready' | 'preparing' | 'ready' | 'failed'
  preparation_run_id: string
  preparation_model_code: string
  preparation_error_message: string
  /** Worker 持久化的真实业务检查点；刷新页面后仍能继续展示当前阶段。 */
  preparation_stage: string
  preparation_stage_label: string
  preparation_progress: number
  preparation_message: string
  preparation_updated_at: string
  visual_bible: DramaVisualBible
  assets: DramaAssetProfile[]
  readiness: {
    ready: boolean
    required_total: number
    locked_total: number
    blockers: string[]
  }
}

export interface DramaProductionVersion {
  id: string
  version_no: number
  source_script_version: string
  source_content_hash: string
  visual_bible_version_id: string
  based_on_version_id: string
  status: string
  accepted_for_script_version: string
  sync_status: string
  aspect_ratio: string
  resolution: string
  style_id: string
  style_version: number
  created_at: string
}

export interface DramaProductionStatus {
  project_id: string
  formal_script_version: string
  active_production_version: DramaProductionVersion | null
  has_version_gap: boolean
  impact_report: Record<string, any> | null
  available_versions: DramaProductionVersion[]
}

export interface DramaProductionVersionContent {
  version: DramaProductionVersion
  assets: Array<{
    id: string
    asset_type: string
    asset_key: string
    name: string
    production_status: string
    selected_asset_id: string
    image_url: string
  }>
  storyboard_plans: Array<{
    id: string
    episode_no: number
    version_no: number
    version_label: string
    status: string
    row_count: number
  }>
}

export interface DramaProductionImpact {
  id: string
  source_script_version: string
  target_script_version: string
  source_content_hash: string
  target_content_hash: string
  cached: boolean
  result: DramaProductionImpactResult
}

export interface DramaProductionImpactAsset {
  profile_id: string
  asset_type: string
  asset_key: string
  name: string
  reason: string
}

export interface DramaProductionImpactPlan {
  plan_id: string
  episode_no: number
  reason: string
}

export interface DramaProductionImpactResult {
  message?: string
  added_blocks?: string[]
  deleted_blocks?: string[]
  modified_blocks?: string[]
  affected_assets?: DramaProductionImpactAsset[]
  reusable_assets?: DramaProductionImpactAsset[]
  affected_storyboard_plans?: DramaProductionImpactPlan[]
  affected_episodes?: number[]
  style_changed?: boolean
  needs_manual_confirmation?: DramaProductionImpactPlan[]
}

export type DramaProductionSyncAction =
  | 'accept_existing'
  | 'rescan'
  | 'refine_affected_profiles'
  | 'regenerate_affected_images'
  | 'recheck_affected_storyboards'
  | 'update_all_affected'

export interface DramaProductionSyncQuote {
  action: DramaProductionSyncAction
  free: boolean
  target_counts: Record<string, number>
  dependencies: string[]
  required_credits: number | null
  executable: boolean
  summary: string
}

export interface DramaProductionSyncExecution {
  action: DramaProductionSyncAction
  status: 'completed' | 'queued' | 'preparing' | 'blocked'
  production_version_id: string
  run_id: string
  target_count: number
  required_credits: number
  summary: string
  next_actions: string[]
}

export interface StoryboardMicroEditPayload {
  mode: StoryboardMicroEditMode
  trimInMs: number
  trimOutMs: number
  region?: { x?: number; y?: number; width?: number; height?: number }
  prompt?: string
  preserveContent?: string
  referenceAssets?: StoryboardMicroEditReference[]
  model?: string
  idempotencyKey?: string
}

export interface StoryboardMicroEditCreateResult {
  edit: StoryboardMicroEdit
  outputTake: StoryboardTake
  pricing: StoryboardMicroEditEstimate
}

/** 资产专用提炼只在用户确认本报价后调用模型；确认剧本和加载工作台均不扣点。 */
export interface DramaAssetPreparationEstimate {
  status: 'local_ready' | 'preparing' | 'ready' | 'failed'
  asset_count: number
  requires_model_call: boolean
  cached: boolean
  required_credits: number
  current_balance: number
  sufficient: boolean
  model_code: string
  confirmed_content_hash: string
  summary: string
  cost_items: Array<{
    label: string
    quantity: number
    unit: string
    credits: number
    estimated_tokens?: number
  }>
}

export interface DramaAssetPreparationRun {
  run_id: string
  status: 'preparing' | 'ready'
  asset_count: number
  required_credits: number
  cached: boolean
}

export interface DramaAssetGenerationEstimate {
  target_count: number
  required_credits: number
  current_balance: number
  sufficient: boolean
  warnings: string[]
  target_audits: Array<{
    target: string
    status: string
    compile_hash: string
    missing_requirements: string[]
    conflicts: Array<Record<string, unknown>>
    warnings: string[]
    blocked: boolean
  }>
  blocked_targets: string[]
  compile_hashes: Record<string, string>
}

export interface DramaAssetRepairEstimate {
  report_id: string
  mode: 'system_repair' | 'creative_variant'
  required_credits: number
  current_balance: number
  sufficient: boolean
  system_repair_available: boolean
  reason: string
}

export interface DramaAssetRepairRequest {
  report_id: string
  mode: 'system_repair' | 'creative_variant'
  user_instruction?: string
}

export interface DramaAssetGenerationRun {
  run_id: string
  status: string
  target_count: number
}

export interface ApiAdapter {
  /** 读取功能级模型能力和默认参数，页面不得自行猜测供应商规格。 */
  getGenerationProfile(useCaseKey: string): Promise<ApiResponse<GenerationProfile>>
  getLandingProjects(category?: string): Promise<ApiResponse<Project[]>>
  createProject(payload: { title?: string; category?: string }): Promise<ApiResponse<Project>>
  getWechatLoginTicket(): Promise<ApiResponse<WechatLoginTicket>>
  checkWechatLogin(ticketId: string): Promise<ApiResponse<AuthSession>>
  accountLogin?(account: string, password: string, acceptedDocumentCodes?: string[]): Promise<ApiResponse<AuthSession>>
  accountRegister?(payload: { account: string; password: string; code: string; nickname?: string; acceptedDocumentCodes?: string[] }): Promise<ApiResponse<AuthSession>>
  // 短信验证码永不回传给客户端，只返回服务端建议的重试等待时间。
  sendSmsCode?(phone: string, purpose?: 'login' | 'register'): Promise<ApiResponse<{ status: string; message: string; retryAfterSeconds?: number }>>
  phoneLogin?(phone: string, code: string, acceptedDocumentCodes?: string[]): Promise<ApiResponse<AuthSession>>
  getAccountProfile(): Promise<ApiResponse<AccountProfile>>
  updateAccountProfile?(payload: { nickname: string }): Promise<ApiResponse<AccountProfile>>
  uploadAccountAvatar?(file: File): Promise<ApiResponse<AccountProfile>>
  getAccountSecurity?(): Promise<ApiResponse<AccountSecuritySummary>>
  sendAccountSecurityCode?(payload: { target: 'old_phone' | 'new_phone' | 'password'; newPhone?: string }): Promise<ApiResponse<{ status: string; retryAfterSeconds: number }>>
  rebindAccountPhone?(payload: { newPhone: string; oldPhoneCode: string; newPhoneCode: string }): Promise<ApiResponse<AccountSecuritySummary>>
  changeAccountPassword?(payload: { newPassword: string; newPasswordConfirmation: string; verificationCode: string }): Promise<ApiResponse<{ status: string }>>
  getAccountCreditPackages(): Promise<ApiResponse<CreditPackage[]>>
  getAccountCreditLedgers(page?: number, pageSize?: number): Promise<ApiResponse<CreditLedgerPage>>
  getPaymentChannels?(): Promise<ApiResponse<Array<{ channel: 'wechat' | 'alipay'; ready: boolean }>>>
  createPaymentOrder?(payload: { packageId: string; channel: 'wechat' | 'alipay'; idempotencyKey: string }): Promise<ApiResponse<PaymentOrder>>
  retryPaymentCheckout?(orderNo: string): Promise<ApiResponse<PaymentOrder>>
  getPaymentOrders?(page?: number, pageSize?: number): Promise<ApiResponse<PaymentOrderPage>>
  redeemCode(code: string): Promise<ApiResponse<RedeemCodeResult>>
  getSupportCenter(): Promise<ApiResponse<SupportCenter>>
  getLoginAppearance(): Promise<ApiResponse<WebsiteInfo>>
  getLegalDocuments?(): Promise<ApiResponse<import('~/entities/support/types').LegalDocument[]>>
  getLegalAcceptanceStatus?(): Promise<ApiResponse<Record<string, boolean>>>
  acceptFeatureLegalDocument?(documentCode: string, documentVersionId: string): Promise<ApiResponse<boolean>>
  acceptFeatureLegalDocuments?(documents: Array<{ documentCode: string; documentVersionId: string }>): Promise<ApiResponse<boolean>>
  submitFeedback(payload: FeedbackSubmitPayload): Promise<ApiResponse<UserFeedback>>
  getMyFeedback(page?: number, pageSize?: number): Promise<ApiResponse<FeedbackPage>>
  getActiveAnnouncements(placement?: string): Promise<ApiResponse<SystemAnnouncement[]>>
  getRuntimeConfig(): Promise<ApiResponse<DramaRuntimeConfig>>
  getPublicVideoCapabilities(): Promise<ApiResponse<PublicVideoCapabilities>>
  getCanvasGraph(projectId: string): Promise<ApiResponse<CanvasGraph>>
  saveCanvasGraph(projectId: string, graph: CanvasGraph): Promise<ApiResponse<boolean>>
  getStoryboardRows(projectId: string): Promise<ApiResponse<StoryboardRow[]>>
  generateStoryboard(payload: StoryboardGeneratePayload): Promise<ApiResponse<StoryboardRow[]>>
  createWorkflowRun(payload: WorkflowRunCreatePayload): Promise<ApiResponse<WorkflowRunInfo>>
  getWorkflowRun(runId: string): Promise<ApiResponse<WorkflowRunInfo>>
  createDramaProject(payload: DramaProjectCreatePayload): Promise<ApiResponse<DramaProjectDetail>>
  getDramaVisualStyles?(): Promise<ApiResponse<DramaVisualStyleContract[]>>
  getDramaProductionStatus?(projectId: string): Promise<ApiResponse<DramaProductionStatus>>
  getDramaProductionVersionContent?(projectId: string, productionVersionId: string): Promise<ApiResponse<DramaProductionVersionContent>>
  scanDramaProductionImpact?(projectId: string): Promise<ApiResponse<DramaProductionImpact>>
  quoteDramaProductionSync?(projectId: string, action: DramaProductionSyncAction): Promise<ApiResponse<DramaProductionSyncQuote>>
  executeDramaProductionSync?(projectId: string, action: DramaProductionSyncAction, impactReportId: string): Promise<ApiResponse<DramaProductionSyncExecution>>
  acceptExistingDramaProduction?(projectId: string, targetScriptVersion?: string): Promise<ApiResponse<DramaProductionStatus>>
  getDramaProjects(page?: number, pageSize?: number): Promise<ApiResponse<DramaProjectPage>>
  deleteDramaProject(projectId: string): Promise<ApiResponse<DramaDeleteResult>>
  batchDeleteDramaProjects(ids: string[]): Promise<ApiResponse<DramaDeleteResult>>
  getDramaProject(projectId: string): Promise<ApiResponse<DramaProjectDetail>>
  // Mock 适配器仍可运行旧页面，因此新资产接口先声明为可选；真实 HTTP 适配器已完整实现。
  getDramaAssetWorkspace?(projectId: string): Promise<ApiResponse<DramaAssetWorkspace>>
  estimateDramaAssetPreparation?(projectId: string): Promise<ApiResponse<DramaAssetPreparationEstimate>>
  prepareDramaAssetWorkspace?(projectId: string, force?: boolean): Promise<ApiResponse<DramaAssetPreparationRun>>
  updateDramaVisualBible?(projectId: string, payload: Omit<DramaVisualBible, 'id' | 'version_no' | 'source_script_version' | 'status'>): Promise<ApiResponse<DramaAssetWorkspace>>
  createDramaAssetProfile?(projectId: string, payload: { asset_type: DramaWorkspaceAssetType; name: string; is_required?: boolean; data?: Record<string, unknown> }): Promise<ApiResponse<DramaAssetWorkspace>>
  updateDramaAssetProfile?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: { name?: string; is_required?: boolean; production_status?: DramaWorkspaceAssetStatus; selected_asset_id?: string; data?: Record<string, unknown> }): Promise<ApiResponse<DramaAssetWorkspace>>
  previewDramaAssetVisualPrompt?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string): Promise<ApiResponse<DramaAssetVisualPromptDraft>>
  confirmDramaAssetVisualPrompt?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: { prompt: string; base_hash: string }): Promise<ApiResponse<DramaAssetVisualPromptDraft>>
  deleteDramaAssetProfile?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string): Promise<ApiResponse<DramaAssetWorkspace>>
  uploadDramaAssetReference?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, file: File): Promise<ApiResponse<DramaAssetWorkspace>>
  estimateDramaAssetGeneration?(projectId: string, targets: string[]): Promise<ApiResponse<DramaAssetGenerationEstimate>>
  generateDramaWorkspaceAssets?(projectId: string, targets: string[], overwrite?: boolean, compileHashes?: Record<string, string>, retryFailed?: boolean): Promise<ApiResponse<DramaAssetGenerationRun>>
  lockDramaWorkspaceAsset?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, locked: boolean): Promise<ApiResponse<DramaAssetWorkspace>>
  batchLockDramaWorkspaceAssets?(projectId: string, targets: string[], locked: boolean): Promise<ApiResponse<DramaAssetWorkspace>>
  estimateDramaAssetConsistency?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string): Promise<ApiResponse<DramaAssetConsistencyEstimate>>
  checkDramaAssetConsistency?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, manual?: boolean, force?: boolean): Promise<ApiResponse<DramaAssetConsistencyRun>>
  estimateDramaAssetConsistencyRepair?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: DramaAssetRepairRequest): Promise<ApiResponse<DramaAssetRepairEstimate>>
  repairDramaAssetConsistency?(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: DramaAssetRepairRequest): Promise<ApiResponse<DramaAssetGenerationRun>>
  ingestDramaScript(projectId: string, payload: DramaScriptIngestPayload): Promise<ApiResponse<DramaProjectDetail>>
  ingestDramaScriptFile(projectId: string, file: File): Promise<ApiResponse<DramaProjectDetail>>
  previewDramaEntryCredits(payload: DramaEntryCreditPreviewPayload): Promise<ApiResponse<DramaCreditPreview>>
  previewDramaEntryFileCredits(file: File, payload?: { model?: string }): Promise<ApiResponse<DramaCreditPreview>>
  updateDramaIntentRouter(projectId: string, payload: DramaIntentRouterUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  createDramaScriptOptimization(projectId: string, payload: DramaScriptOptimizationPayload): Promise<ApiResponse<DramaProjectDetail>>
  applyDramaScriptVersion(projectId: string, versionId: string): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaScriptSuggestionStatus(projectId: string, suggestionId: string, payload: { status: 'open' | 'pending' | 'ignored'; scriptVersionId?: string }): Promise<ApiResponse<DramaProjectDetail>>
  resolveDramaScriptSuggestionSource(projectId: string, suggestionId: string): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaScriptSuggestionSourceRange(projectId: string, suggestionId: string, payload: DramaSuggestionSourceRangePayload): Promise<ApiResponse<DramaProjectDetail>>
  confirmDramaScriptVersion(projectId: string): Promise<ApiResponse<DramaProjectDetail>>
  skipDramaScriptReviews(projectId: string): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaScriptScene(projectId: string, payload: DramaScriptSceneUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  previewDramaCredits(projectId: string, payload: DramaCreditPreviewPayload): Promise<ApiResponse<DramaCreditPreview>>
  analyzeDrama(projectId: string, payload?: DramaAnalyzePayload): Promise<ApiResponse<DramaProjectDetail>>
  retryDramaAnalysisNode(projectId: string, nodeKey: string): Promise<ApiResponse<DramaProjectDetail>>
  retryDramaSuggestionDraft(projectId: string, suggestionId: string): Promise<ApiResponse<DramaProjectDetail>>
  quoteDramaSuggestionDrafts(projectId: string, suggestionIds: string[]): Promise<ApiResponse<DramaSuggestionDraftQuote>>
  generateDramaSuggestionDrafts(projectId: string, suggestionIds: string[]): Promise<ApiResponse<DramaSuggestionDraftRun>>
  getDramaSuggestionDraftRun(projectId: string, runId: string): Promise<ApiResponse<DramaSuggestionDraftRun>>
  regenerateDramaCover(projectId: string, payload?: DramaCoverRegeneratePayload): Promise<ApiResponse<DramaProjectDetail>>
  createDramaRole(projectId: string, payload: DramaRoleCreatePayload): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaRole(projectId: string, roleKey: string, payload: DramaRoleUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  uploadDramaRoleVoice(projectId: string, roleKey: string, file: File): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaRoleVoice(projectId: string, roleKey: string, payload: DramaRoleVoiceUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  deleteDramaRoleVoice(projectId: string, roleKey: string): Promise<ApiResponse<DramaProjectDetail>>
  generateDramaRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaScene(projectId: string, sceneKey: string, payload: DramaSceneUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  generateDramaSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaProp(projectId: string, propKey: string, payload: DramaPropUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  generateDramaPropAssets(projectId: string, payload?: DramaAssetGeneratePayload): Promise<ApiResponse<DramaProjectDetail>>
  generateDramaStoryboards(projectId: string, payload?: DramaStoryboardGeneratePayload): Promise<ApiResponse<DramaProjectDetail>>
  listDramaStoryboards(projectId: string, episodeNo?: number): Promise<ApiResponse<{ rows: StoryboardRow[]; run: DramaProjectDetail['storyboardRun'] }>>
  getStoryboardWorkspace(projectId: string, episodeNo?: number): Promise<ApiResponse<StoryboardWorkspace>>
  /** 查询方案版本清单；传版本 ID 时读取只读历史镜头预览。 */
  getStoryboardPlanHistory(projectId: string, episodeNo?: number, planVersionId?: string): Promise<ApiResponse<StoryboardPlanHistory>>
  updateStoryboardDirectorSegments(projectId: string, rowId: string, payload: StoryboardDirectorSegmentsPayload): Promise<ApiResponse<StoryboardWorkspace>>
  tuneStoryboardShot(projectId: string, rowId: string, payload: StoryboardShotTuningPayload): Promise<ApiResponse<StoryboardWorkspace>>
  generateStoryboardPrevisualization(projectId: string, rowId: string): Promise<ApiResponse<StoryboardWorkspace>>
  /** 上传/替换分镜的首帧或尾帧参考图，返回刷新后的完整工作区。 */
  uploadStoryboardFrameReference(projectId: string, rowId: string, slot: 'first' | 'last', file: File): Promise<ApiResponse<StoryboardWorkspace>>
  /** 仅解除当前槽位绑定，历史素材仍由后端保留用于审计。 */
  clearStoryboardFrameReference(projectId: string, rowId: string, slot: 'first' | 'last'): Promise<ApiResponse<StoryboardWorkspace>>
  /** 从相邻镜头承接边界帧：首帧取上镜尾帧，尾帧取下镜首帧。 */
  inheritStoryboardFrameReference(projectId: string, rowId: string, slot: 'first' | 'last'): Promise<ApiResponse<StoryboardWorkspace>>
  reviewStoryboards(projectId: string, payload: StoryboardReviewBatchPayload): Promise<ApiResponse<StoryboardWorkspace>>
  previewStoryboardTuning(projectId: string, payload: StoryboardTuningPayload): Promise<ApiResponse<StoryboardTuningPreview>>
  applyStoryboardTuning(projectId: string, payload: StoryboardTuningPayload): Promise<ApiResponse<StoryboardWorkspace>>
  estimateStoryboardVideoBatch(projectId: string, payload: StoryboardVideoBatchPayload): Promise<ApiResponse<StoryboardBatchEstimate>>
  createStoryboardVideoBatch(projectId: string, payload: StoryboardVideoBatchPayload): Promise<ApiResponse<StoryboardVideoBatchResult>>
  retryFailedStoryboardVideoBatch(projectId: string, batchId: string): Promise<ApiResponse<StoryboardVideoBatchResult>>
  selectStoryboardTake(projectId: string, rowId: string, takeId: string, payload?: { reviewStatus?: 'unreviewed' | 'passed' | 'needs_revision' }): Promise<ApiResponse<StoryboardWorkspace>>
  uploadStoryboardMicroEditReference(projectId: string, rowId: string, takeId: string, file: File): Promise<ApiResponse<StoryboardMicroEditReference[]>>
  estimateStoryboardMicroEdit(projectId: string, rowId: string, takeId: string, payload: StoryboardMicroEditPayload): Promise<ApiResponse<StoryboardMicroEditEstimate>>
  createStoryboardMicroEdit(projectId: string, rowId: string, takeId: string, payload: StoryboardMicroEditPayload): Promise<ApiResponse<StoryboardMicroEditCreateResult>>
  getStoryboardMicroEdit(projectId: string, rowId: string, editId: string): Promise<ApiResponse<StoryboardMicroEdit>>
  retryStoryboardMicroEdit(projectId: string, rowId: string, editId: string): Promise<ApiResponse<StoryboardMicroEditCreateResult>>
  createDramaStoryboard(projectId: string, payload: StoryboardCreatePayload): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaStoryboard(projectId: string, rowId: string, payload: StoryboardUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  copyDramaStoryboard(projectId: string, rowId: string): Promise<ApiResponse<DramaProjectDetail>>
  deleteDramaStoryboard(projectId: string, rowId: string): Promise<ApiResponse<DramaProjectDetail>>
  generateStoryboardVideoPrompt(projectId: string, rowId: string, payload?: StoryboardVideoPromptGeneratePayload): Promise<ApiResponse<StoryboardVideoPromptInfo>>
  generateStoryboardVideo(projectId: string, rowId: string, payload?: StoryboardVideoGeneratePayload): Promise<ApiResponse<StoryboardVideoRunInfo>>
  batchGenerateStoryboardVideos(projectId: string, payload: StoryboardVideoBatchPayload): Promise<ApiResponse<StoryboardVideoBatchResult>>
  getEpisodeCut(projectId: string, episodeNo: number): Promise<ApiResponse<EpisodeCutDraft>>
  saveEpisodeCut(projectId: string, episodeNo: number, payload: EpisodeCutSavePayload): Promise<ApiResponse<EpisodeCutDraft>>
  uploadEpisodeBgm(projectId: string, episodeNo: number, file: File): Promise<ApiResponse<EpisodeCutDraft>>
  generateEpisodeCaptions(projectId: string, episodeNo: number): Promise<ApiResponse<EpisodeCutTask>>
  renderEpisodeCut(projectId: string, episodeNo: number, renderMode?: 'fast' | 'standard'): Promise<ApiResponse<EpisodeCutTask>>
  exportEpisodeEditorPackage(projectId: string, episodeNo: number): Promise<ApiResponse<EpisodeCutTask>>
  getEpisodeCutTask(projectId: string, episodeNo: number, taskId: string): Promise<ApiResponse<EpisodeCutTask>>
  listEpisodeExports(params?: { status?: string; page?: number; pageSize?: number }): Promise<ApiResponse<EpisodeCutTaskList>>
  listProductImageTemplates(params?: { category?: string; featured?: boolean }): Promise<ApiResponse<ProductImageTemplate[]>>
  previewProductImageCredits(payload: Pick<ProductImageGeneratePayload, 'count' | 'model' | 'prompt' | 'splitSellingPoints' | 'templateId' | 'resolution' | 'quality' | 'background' | 'outputFormat' | 'outputCompression'> & Partial<ProductImageGeneratePayload>): Promise<ApiResponse<ProductImageCreditPreview>>
  splitProductSellingPoints(payload: { batchId?: string; prompt: string; count: number; style?: string; aspectRatio?: string }): Promise<ApiResponse<ProductSellingPoint[]>>
  optimizeProductImagePrompt(payload: { prompt: string; mode: 'single' | 'marketing' | 'free' }): Promise<ApiResponse<{ optimizedPrompt: string }>>
  generateProductImages(payload: ProductImageGeneratePayload, onProgress?: (progress: number, step: string) => void): Promise<ApiResponse<ProductImageGenerateResult>>
  getProductImageTask(batchId: string): Promise<ApiResponse<import('~/entities/product-image/types').ProductImageTaskStatus>>
  listProductImageHistory(params?: { favoritesOnly?: boolean; limit?: number }): Promise<ApiResponse<ProductImageHistoryBatch[]>>
  getProductImageHistory(batchId: string): Promise<ApiResponse<ProductImageHistoryBatch>>
  setProductImageFavorite(batchId: string, resultId: string, isFavorite: boolean): Promise<ApiResponse<ProductImageResult>>
  deleteProductImageHistory(batchId: string): Promise<ApiResponse<{ batchId: string; deleted: boolean }>>
  /** 商品视频前台与模板中心共用的运营快照。 */
  getProductVideoHome(): Promise<ApiResponse<ProductVideoHome>>
  analyzeProductVideoReference(file: File): Promise<ApiResponse<ProductVideoReferenceAnalysis>>
  analyzeProductVideoReferenceLink(url: string): Promise<ApiResponse<ProductVideoReferenceAnalysis>>
  inspectProductVideoReferenceLink(text: string): Promise<ApiResponse<ProductVideoReferenceLinkInspection>>
  optimizeProductVideoScript(payload: { script: string; productDetails: string; durationSec: number }): Promise<ApiResponse<ProductVideoScriptOptimization>>
  getDigitalHumanAvailability(): Promise<ApiResponse<DigitalHumanAvailability>>
  quoteDigitalHuman(script: string): Promise<ApiResponse<DigitalHumanQuote>>
  createDigitalHumanTask(payload: { script: string; resolution: string }): Promise<ApiResponse<ProductVideoTask>>
  listDigitalHumanTasks(): Promise<ApiResponse<ProductVideoTask[]>>
  listProductVideoTemplates(params?: { category?: string; featured?: boolean }): Promise<ApiResponse<ProductVideoTemplate[]>>
  previewProductVideoCredits(payload: Pick<ProductVideoCreatePayload, 'templateId' | 'durationSec' | 'resultCount' | 'model' | 'resolution' | 'referenceVideoToken'> & Partial<ProductVideoCreatePayload>): Promise<ApiResponse<ProductVideoCreditPreview>>
  createProductVideoTask(payload: ProductVideoCreatePayload): Promise<ApiResponse<ProductVideoTask>>
  getProductVideoTask(taskId: string): Promise<ApiResponse<ProductVideoTask>>
  listProductVideoTasks(): Promise<ApiResponse<ProductVideoTask[]>>
  selectProductVideoResult(taskId: string, resultId: string): Promise<ApiResponse<ProductVideoTask>>
}
