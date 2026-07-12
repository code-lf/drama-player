import type { AuthSession } from '~/entities/auth/types'
import type { SystemAnnouncement } from '~/entities/announcement/types'
import type { AccountProfile, CreditLedgerPage, CreditPackage } from '~/entities/account/types'
import type { CanvasGraph } from '~/entities/canvas/types'
import type {
  DramaCreditPreview,
  DramaIntentMode,
  DramaProjectCard,
  DramaProjectDetail,
  DramaProjectPage,
  DramaRuntimeConfig
} from '~/entities/drama/types'
import type { Project } from '~/entities/project/types'
import type {
  ProductImageCreditPreview,
  ProductImageGeneratePayload,
  ProductImageGenerateResult,
  ProductSellingPoint
} from '~/entities/product-image/types'
import type {
  StoryboardClipContract,
  StoryboardContinuationPolicy,
  StoryboardContinuityState,
  StoryboardPromptLoad,
  StoryboardReferenceBinding,
  StoryboardRetryReason,
  StoryboardRow
} from '~/entities/storyboard/types'

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
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
  aspectRatio?: string
  resolution?: string
  episodeCount?: number
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
  style?: string
  provider?: 'bytedance' | 'alibaba'
  resolution?: string
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
  durationSec?: number
  resolution?: string
  audio?: boolean
  overwrite?: boolean
  shotCount?: number
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

export interface DramaIntentRouterUpdatePayload {
  mode: DramaIntentMode
}

export interface DramaScriptOptimizationPayload {
  kind?: 'global' | 'suggestion' | 'character' | 'episode' | 'scene' | 'text'
  suggestionIds?: string[]
  scope?: string
  intensity?: 'conservative' | 'balanced' | 'deep'
  episodeNo?: number | null
  sceneIndex?: number | null
  instruction?: string
  sourceVersion?: string
  adjustmentInstruction?: string
  selectedActions?: string[]
}

export interface DramaScriptSceneUpdatePayload {
  episodeNo: number
  sceneIndex: number
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
  extra?: Record<string, unknown>
}

export interface StoryboardVideoGeneratePayload {
  model?: string
  durationSec?: number
  resolution?: string
  referenceUrls?: string[]
  referenceBindings?: StoryboardReferenceBinding[]
  continuationFromRowId?: string
  continuationPolicy?: StoryboardContinuationPolicy
  retryReason?: StoryboardRetryReason
  audioMode?: 'sound' | 'silent'
}

export interface StoryboardVideoPromptGeneratePayload {
  model?: string
  durationSec?: number
  resolution?: string
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
  audioMode?: 'sound' | 'silent'
}

export interface DramaDeleteResult {
  deletedIds: string[]
}

export interface ApiAdapter {
  getLandingProjects(category?: string): Promise<ApiResponse<Project[]>>
  createProject(payload: { title?: string; category?: string }): Promise<ApiResponse<Project>>
  getWechatLoginTicket(): Promise<ApiResponse<WechatLoginTicket>>
  checkWechatLogin(ticketId: string): Promise<ApiResponse<AuthSession>>
  phoneLogin?(phone: string, code: string): Promise<ApiResponse<AuthSession>>
  sendSmsCode?(phone: string): Promise<ApiResponse<Record<string, unknown>>>
  getAccountProfile(): Promise<ApiResponse<AccountProfile>>
  getAccountCreditPackages(): Promise<ApiResponse<CreditPackage[]>>
  getAccountCreditLedgers(page?: number, pageSize?: number): Promise<ApiResponse<CreditLedgerPage>>
  getActiveAnnouncements(placement?: string): Promise<ApiResponse<SystemAnnouncement[]>>
  getRuntimeConfig(): Promise<ApiResponse<DramaRuntimeConfig>>
  getCanvasGraph(projectId: string): Promise<ApiResponse<CanvasGraph>>
  saveCanvasGraph(projectId: string, graph: CanvasGraph): Promise<ApiResponse<boolean>>
  getStoryboardRows(projectId: string): Promise<ApiResponse<StoryboardRow[]>>
  generateStoryboard(payload: StoryboardGeneratePayload): Promise<ApiResponse<StoryboardRow[]>>
  createWorkflowRun(payload: WorkflowRunCreatePayload): Promise<ApiResponse<WorkflowRunInfo>>
  getWorkflowRun(runId: string): Promise<ApiResponse<WorkflowRunInfo>>
  createDramaProject(payload: DramaProjectCreatePayload): Promise<ApiResponse<DramaProjectDetail>>
  getDramaProjects(page?: number, pageSize?: number): Promise<ApiResponse<DramaProjectPage>>
  deleteDramaProject(projectId: string): Promise<ApiResponse<DramaDeleteResult>>
  batchDeleteDramaProjects(ids: string[]): Promise<ApiResponse<DramaDeleteResult>>
  getDramaProject(projectId: string): Promise<ApiResponse<DramaProjectDetail>>
  ingestDramaScript(projectId: string, payload: DramaScriptIngestPayload): Promise<ApiResponse<DramaProjectDetail>>
  ingestDramaScriptFile(projectId: string, file: File): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaIntentRouter(projectId: string, payload: DramaIntentRouterUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  createDramaScriptOptimization(projectId: string, payload: DramaScriptOptimizationPayload): Promise<ApiResponse<DramaProjectDetail>>
  applyDramaScriptVersion(projectId: string, versionId: string): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaScriptScene(projectId: string, payload: DramaScriptSceneUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  previewDramaCredits(projectId: string, payload: DramaCreditPreviewPayload): Promise<ApiResponse<DramaCreditPreview>>
  analyzeDrama(projectId: string, payload?: DramaAnalyzePayload): Promise<ApiResponse<DramaProjectDetail>>
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
  createDramaStoryboard(projectId: string, payload: StoryboardCreatePayload): Promise<ApiResponse<DramaProjectDetail>>
  updateDramaStoryboard(projectId: string, rowId: string, payload: StoryboardUpdatePayload): Promise<ApiResponse<DramaProjectDetail>>
  copyDramaStoryboard(projectId: string, rowId: string): Promise<ApiResponse<DramaProjectDetail>>
  deleteDramaStoryboard(projectId: string, rowId: string): Promise<ApiResponse<DramaProjectDetail>>
  generateStoryboardVideoPrompt(projectId: string, rowId: string, payload?: StoryboardVideoPromptGeneratePayload): Promise<ApiResponse<StoryboardVideoPromptInfo>>
  generateStoryboardVideo(projectId: string, rowId: string, payload?: StoryboardVideoGeneratePayload): Promise<ApiResponse<StoryboardVideoRunInfo>>
  batchGenerateStoryboardVideos(projectId: string, payload: StoryboardVideoBatchPayload): Promise<ApiResponse<StoryboardVideoRunInfo[]>>
  previewProductImageCredits(payload: Pick<ProductImageGeneratePayload, 'count' | 'model' | 'prompt' | 'splitSellingPoints'>): Promise<ApiResponse<ProductImageCreditPreview>>
  splitProductSellingPoints(payload: { prompt: string; count: number }): Promise<ApiResponse<ProductSellingPoint[]>>
  generateProductImages(payload: ProductImageGeneratePayload): Promise<ApiResponse<ProductImageGenerateResult>>
}
