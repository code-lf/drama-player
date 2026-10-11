export type StoryboardRetryReason = 'identity' | 'motion' | 'camera' | 'scene' | 'prop' | 'rhythm' | 'quality'
export type StoryboardPromptLoad = 'low' | 'medium' | 'high'
export type StoryboardReferenceRole = 'identity' | 'scene' | 'prop' | 'motion' | 'endpoint'
export type StoryboardContinuationPolicy = 'auto' | 'manual' | 'none'
export type StoryboardStoryFunction = 'hook' | 'conflict' | 'reveal' | 'transition' | 'payoff' | 'cta'
export type StoryboardVideoPromptSource = 'system' | 'user' | 'adapted'
export type StoryboardQualityPolicy = 'smart' | 'economy' | 'quality'
export type StoryboardPlanStatus = 'draft' | 'preflight_running' | 'review_required' | 'confirmed' | 'stale'
export type StoryboardReviewStatus = 'unreviewed' | 'passed' | 'needs_revision'
export type StoryboardMicroEditMode = 'local_trim' | 'ai_edit'
/** 视频生成的参考输入模式：资产参考与首尾帧是供应商互斥的两种协议。 */
export type StoryboardVideoInputMode = 'universal_reference' | 'first_last_frame'

export interface StoryboardMicroEditReference {
  url: string
  label: string
  mimeType: string
}

export interface StoryboardMicroEditEstimate {
  mode: StoryboardMicroEditMode
  provider: string
  modelCode: string
  modelName: string
  estimatedCredits: number
  currentBalance: number
  sufficient: boolean
  expiresAt: string
  pricingSnapshot: Record<string, unknown>
}

export interface StoryboardMicroEdit {
  id: string
  projectId: string
  storyboardRowId: string
  sourceTakeId: string
  outputTakeId: string
  mode: StoryboardMicroEditMode
  trimInMs: number
  trimOutMs: number
  region: { x?: number; y?: number; width?: number; height?: number }
  prompt: string
  preserveContent: string
  referenceAssets: StoryboardMicroEditReference[]
  provider: string
  modelCode: string
  providerTaskId: string
  status: string
  progress: number
  chargedCredits: number
  estimatedCredits: number
  errorMessage: string
  createdAt: string
  updatedAt: string
}

export interface StoryboardDirectorSegment {
  id: string
  sortIndex: number
  startMs: number
  endMs: number
  shotSize: string
  cameraMotion: string
  visualFocus: string
  actionDesc: string
  emotionDesc: string
  audioCue: string
  extra: Record<string, unknown>
}

export interface StoryboardAudioIntent {
  speakers: string[]
  dialogueLines: Array<{ speaker: string; text: string }>
  ambience: string
  foley: string
  voiceRequired: boolean
  voiceReferenceStatus: 'not_required' | 'ready' | 'missing' | 'stale'
}

export interface StoryboardTake {
  id: string
  versionNo: number
  status: string
  qualityPolicy: StoryboardQualityPolicy | 'legacy'
  videoUrl: string
  posterUrl: string
  qc: Record<string, unknown>
  isSelected: boolean
  createdAt: string
}

export interface StoryboardPlanVersion {
  id: string
  episodeNo: number
  versionNo: number
  versionLabel: string
  status: string
  isCurrent: boolean
  sourceScriptVersion: string
  productionVersionId: string
  visualBibleVersionId: string
  tuning: Record<string, unknown>
  validation: Record<string, unknown>
  createdAt: string
}

/** 分镜历史卡片只返回预览所需的导演字段，前端没有历史方案的制作操作入口。 */
export interface StoryboardPlanHistoryRow {
  shotNo: number
  durationSec: number
  sceneDescription: string
  roleName: string
  shotType: string
  actionDesc: string
  dialogue: string
  directorSegments: StoryboardDirectorSegment[]
}

export interface StoryboardPlanHistoryVersion {
  plan: StoryboardPlanVersion
  shotCount: number
  estimatedDurationSec: number
  rows: StoryboardPlanHistoryRow[]
}

export interface StoryboardPlanHistory {
  episodeNo: number
  versions: StoryboardPlanHistoryVersion[]
}

export interface StoryboardReferenceBinding {
  url: string
  type: 'image' | 'video'
  role: StoryboardReferenceRole
  priority: number
  label: string
  source: string
}

export interface StoryboardClipContract {
  intent: string
  subject: string
  sceneAnchor: string
  actionAnchor: string
  endpoint: string
  mode: 'drama' | 'ad' | 'general'
  storyFunction: StoryboardStoryFunction
  cameraGoal: string
  performanceFocus: string
  mustKeep: string[]
  forbiddenDrift: string[]
  shotBudget: string
}

export interface StoryboardContinuityState {
  acceptedTakeId: string
  lastFrameSummary: string
  screenDirection: string
  cameraPhase: string
  lockedAppearance: string[]
  lockedProps: string[]
  nextBeat: string
}

/**
 * AI 在导演方案不应被降级、但现有场景资产又无法承载该镜头时给出的补充建议。
 * 这里保存的是“建议制作什么资产”，不是让前端或服务端根据关键词自行猜选资产。
 */
export interface StoryboardAssetGapSuggestedContent {
  description: string
  spatialLayout: string
  requiredVisibleElements: string[]
  continuityAnchors: string[]
}

/**
 * 单镜头资产缺口。manual_required 只暂停当前镜头，其他已确认镜头仍可继续生成；
 * retryPolicy=manual_only 表示必须由用户补充/调整资产后再复核，禁止自动循环重试。
 */
export interface StoryboardAssetGap {
  status: 'none' | 'manual_required'
  assetType: string
  category: string
  canonicalSceneKey: string
  suggestedName: string
  viewDimension: string
  reason: string
  suggestedContent: StoryboardAssetGapSuggestedContent
  sourceSceneIds: string[]
  sourceBlockIds: string[]
  validationIssues: string[]
  blocksCurrentShot: boolean
  blocksWholePlan: boolean
  retryPolicy: string
  recommendedAction: string
}

/** 镜头动作结束方式；用于区分完整落点、跨镜承接和遮罩转场。 */
export type StoryboardCompletionPolicy = 'resolved' | 'continue_next' | 'transition_mask'

/** 服务端关键路径估时中的单个可见事件。 */
export interface StoryboardTimingEvent {
  index: number
  type: string
  description: string
  estimatedMs: number
  dependsOn: number[]
}

/**
 * 分镜动作时长合同。该数据由服务端根据顺序事件和结果保持时间计算，
 * 前端只展示和执行门禁，不能自行缩短或覆盖推荐时长。
 */
export interface StoryboardTimingContract {
  contractVersion: string
  completionPolicy: StoryboardCompletionPolicy
  headReadMs: number
  tailHoldMs: number
  criticalPathMs: number
  minimumDurationMs: number
  recommendedDurationSec: number
  originalDurationSec: number
  splitRequired: boolean
  endpointIncomplete: boolean
  events: StoryboardTimingEvent[]
  reason: string
}

export interface StoryboardRuntimeExtra {
  /** 失败镜头的实际扣点与退点流水，由服务端核对后返回，不能根据状态自行推断。 */
  video_billing?: {
    take_id: string
    charged_credits: number
    refunded_credits: number
    refund_status: 'refunded' | 'pending' | 'not_charged'
  }
  /** 当前镜头生成时采用的参考输入模式，刷新工作区后仍保留用户选择。 */
  videoInputMode?: StoryboardVideoInputMode
  video_input_mode?: StoryboardVideoInputMode
  /** 分层导演管线使用的稳定镜头标识；镜头编号变化时仍用于合并质检补丁。 */
  shotKey?: string
  shot_key?: string
  /** 独立镜头标题，禁止再从场景描述第一行推导。 */
  shotTitle?: string
  shot_title?: string
  /** 导演层识别出的动作、情绪、信息、焦点或声音变化节点。 */
  visibleChangePoints?: Array<Record<string, unknown> | string>
  visible_change_points?: Array<Record<string, unknown> | string>
  /** 本镜头动作完成方式和服务端关键路径估时结果。 */
  completionPolicy?: StoryboardCompletionPolicy
  timingContract?: StoryboardTimingContract
  completion_policy?: StoryboardCompletionPolicy
  timing_contract?: Record<string, unknown>
  /** 用户编辑后递增；后台质检只能自动覆盖同一修订号。 */
  revision?: number
  userEdited?: boolean
  user_edited?: boolean
  qaStatus?: string
  qa_status?: string
  qaIssues?: Array<Record<string, unknown> | string>
  qa_issues?: Array<Record<string, unknown> | string>
  clipContract?: StoryboardClipContract
  referenceBindings?: StoryboardReferenceBinding[]
  continuityState?: StoryboardContinuityState
  retryReason?: StoryboardRetryReason | ''
  warnings?: string[]
  promptLoad?: StoryboardPromptLoad
  continuationPolicy?: StoryboardContinuationPolicy
  continuationFromRowId?: string
  resolvedContinuationFromRowId?: string
  autoContinuityReason?: string
  acceptedTakeId?: string
  acceptedSummary?: string
  repairPatchSummary?: string
  repairRevision?: number
  lastRetryReason?: StoryboardRetryReason | ''
  videoPromptSource?: StoryboardVideoPromptSource
  /** 当前镜头缺少合适资产时的结构化人工处理建议。 */
  assetGap?: StoryboardAssetGap
  /** 兼容后端和历史缓存中的 snake_case 原始字段。 */
  asset_gap?: Record<string, unknown>
  [key: string]: unknown
}

export interface StoryboardRow {
  id: string
  sourceNodeId: string
  episodeNo: number
  sortIndex: number
  shotNo: number
  durationSec: number
  sceneDescription: string
  roleName: string
  shotType: string
  actionDesc: string
  moodDesc: string
  soundFx: string
  dialogue: string
  storyboardPrompt: string
  cameraMotionPrompt: string
  roleKeys: string[]
  sceneKeys: string[]
  propKeys: string[]
  planVersionId: string
  sourceSceneIds: string[]
  sourceBlockIds: string[]
  beatKeys: string[]
  contextHash: string
  planStatus: StoryboardPlanStatus
  reviewStatus: StoryboardReviewStatus
  riskLevel: 'low' | 'medium' | 'high'
  riskReasons: string[]
  previsualizationStatus: string
  previsualizationUrl: string
  audioIntent: StoryboardAudioIntent
  directorSegments: StoryboardDirectorSegment[]
  selectedTakeId: string
  takes: StoryboardTake[]
  videoPrompt: string
  videoModel: string
  videoDurationSec: number
  videoStatus: string
  videoProgress: number
  videoTaskId: string
  videoUrl: string
  videoErrorMessage: string
  generationStatus: string
  generationProgress: number
  generationErrorMessage: string
  extra: StoryboardRuntimeExtra
}

export interface StoryboardWorkspaceSummary {
  total: number
  planConfirmed: number
  reviewRequired: number
  videoQueued: number
  videoRunning: number
  videoSucceeded: number
  videoFailed: number
  accepted: number
  estimatedDurationSec: number
}

export interface StoryboardVideoBatchSummary {
  batchId: string
  status: string
  qualityPolicy: StoryboardQualityPolicy
  estimatedCredits: number
  settledCredits: number
  refundedCredits: number
  counts: Record<string, number>
  errorMessage: string
  createdAt: string
}

export interface StoryboardWorkspace {
  projectId: string
  episodeNo: number
  sourceTitle: string
  sourceSummary: string
  sourceScriptVersion: string
  productionVersionId: string
  /** 当前项目锁定的视频模型是否接受尾帧图片，由服务端模型能力配置决定。 */
  supportsLastFrameInput: boolean
  visualBibleVersionId: string
  visualBible: Record<string, unknown>
  assetReadiness: { ready?: boolean; legacy?: boolean; blockers?: string[] }
  currentPlan: StoryboardPlanVersion
  summary: StoryboardWorkspaceSummary
  rows: StoryboardRow[]
  latestBatch: StoryboardVideoBatchSummary
  run: {
    status: string
    totalEpisodes: number
    currentEpisodeNo: number
    episodeStatuses: Record<string, string>
    episodeProgresses: Record<string, number>
    episodeStages: Record<string, {
      stage: string
      progress: number
      totalBatches: number
      completedBatches: number
      totalScenes?: number
      completedScenes?: number
      currentNodeLabel?: string
      errorCode?: string
      validationIssues?: Array<Record<string, unknown>>
      retryableNodes: string[]
      errorMessage?: string
      workspaceReady?: boolean
      publishedRows?: number
      baseGenerationStatus?: string
      qualityStatus?: string
      qaTotal?: number
      qaCompleted?: number
      qaWarning?: number
      qaFailed?: number
    }>
    generatedCounts: Record<string, number>
    expectedCounts: Record<string, number>
    style: string
    errorMessage: string
    updatedAt: string
  }
}
