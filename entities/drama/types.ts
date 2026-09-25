import type { StoryboardPromptLoad, StoryboardRow } from '~/entities/storyboard/types'

export interface DramaAssetItem {
  id: string
  imageUrl: string
  prompt: string
  status: string
  meta: Record<string, unknown>
}

export interface DramaVoiceAssetItem {
  id: string
  audioUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  durationSec: number | null
  meta: Record<string, unknown>
  createdAt: string
}

export interface DramaRoleProfile {
  key: string
  name: string
  ageIdentity: string
  personality: string
  appearance: string
  voiceRef: string
  prompt: string
  generationStatus: string
  generationProgress: number
  generationErrorMessage: string
  assets: DramaAssetItem[]
  voiceAsset: DramaVoiceAssetItem | null
}

export interface DramaSceneProfile {
  key: string
  name: string
  description: string
  prompt: string
  asset: DramaAssetItem | null
}

export interface DramaPropProfile {
  key: string
  name: string
  description: string
  prompt: string
  asset: DramaAssetItem | null
}

export interface DramaDisplayMeta {
  aspectRatio: string
  resolution: string
  style: string
}

export interface DramaCharacterBio {
  key: string
  name: string
  identity: string
  summary: string
  traits: string[]
  ageLabel?: string
  roleLabel?: string
  gender?: string
  appearance?: string
  personality?: string
  goal?: string
  motivation?: string
  conflict?: string
  arcSteps?: Array<Record<string, string>>
}

export interface DramaEpisodeSummary {
  episodeNo: number
  title: string
  summary: string
  coreEvent: string
  characterChange: string
  endingHook: string
}

export interface DramaEpisodeDetail {
  episodeNo: number
  title: string
  content: string
}

export interface DramaAnalysisRunState {
  runId: string
  status: string
  currentStage: string
  stageStatuses: Record<string, string>
  stageProgresses: Record<string, number>
  overallProgress: number
  coverStatus: string
  coverErrorMessage: string
  startedAt: string
  updatedAt: string
  finishedAt: string
  errorMessage: string
  structureReady: boolean
  assetCandidatesReady: boolean
  reviewsReady: boolean
  productionReady: boolean
  pipelineVersion: string
  globalReviewStatus: string
  fulltextBatches: Array<{
    batchId: string
    status: string
    charCount: number
    startBlockId: string
    endBlockId: string
    errorCode: string
    errorMessage: string
  }>
  nodes: Record<string, DramaAnalysisNodeState>
}

export interface DramaAnalysisNodeState {
  key: string
  status: 'queued' | 'running' | 'succeeded' | 'retryable_failed' | 'failed' | 'stale' | 'canceled' | string
  attempt: number
  progress: number
  /** 综合体检格式不完整后，系统正在免费补全当前维度。 */
  autoBackfill?: boolean
  errorCode: string
  errorMessage: string
  startedAt: string
  finishedAt: string
}

export type DramaIntentMode = 'drama' | 'ad' | 'general'

export interface DramaIntentRouter {
  entryIntent: DramaIntentMode
  detectedMode: DramaIntentMode
  confidence: number
  signals: string[]
  userOverrideMode: DramaIntentMode | ''
  effectiveMode: DramaIntentMode
}

export interface DramaRelationshipNode {
  key: string
  name: string
  role: string
  tone: string
  x: number
  y: number
}

export interface DramaRelationshipLink {
  source: string
  target: string
  label: string
  color: string
  strength: number
  summary: string
  direction: 'forward' | 'both' | 'none'
}

export interface DramaCharacterRelationships {
  nodes: DramaRelationshipNode[]
  links: DramaRelationshipLink[]
  summaries: string[]
  arcSteps: Array<Record<string, string>>
}

export interface DramaEpisodeBeat {
  key: string
  label: string
  timeRange: string
  summary: string
  sceneRefs: string[]
  status: string
}

export interface DramaEpisodeJudgement {
  title: string
  detail: string
  status: string
  /** 对应建议中心的唯一 ID，禁止再通过数组顺序猜测建议。 */
  suggestionId?: string
  /** 判断所属维度，用于在本集问题列表中标识故事、人物、节奏或文本。 */
  dimension?: string
  /** 该判断明确影响的集数，新数据由后端直接返回。 */
  affectedEpisodeNos?: number[]
}

export interface DramaEpisodeStructure {
  episodeNo: number
  title: string
  status: string
  estimatedDuration: string
  sceneCount: number
  mainCharacters: string[]
  beats: DramaEpisodeBeat[]
  aiJudgements: DramaEpisodeJudgement[]
}

export interface DramaScriptScene {
  episodeId: string
  sceneId: string
  episodeNo: number
  index: number
  title: string
  place: string
  timeOfDay: string
  characters: string[]
  props: string[]
  emotion: string
  startOffset: number
  endOffset: number
  content: string
  dialogues: string[]
  suggestions: string[]
  /** 人工编辑尚未发布时用于场次着色和一键还原，不会触碰当前生产资产。 */
  hasUnpublishedChanges: boolean
  unpublishedOriginalContent: string
  unpublishedChangedAt: string
}

export interface DramaReviewDimension {
  key: string
  label: string
  value: number
  weight: number
  grade: string
  evidence: string[]
  suggestions: string[]
}

export interface DramaReviewIssue {
  title: string
  status: string
  detail: string
  suggestionId: string
}

export interface DramaScriptReview {
  title: string
  score: number
  tone: string
  dimensions: DramaReviewDimension[]
  strengths: DramaReviewIssue[]
  warnings: DramaReviewIssue[]
  confidence: number
  updatedAt: string
}

export interface DramaScriptReviews {
  overview: DramaScriptReview
  characters: DramaScriptReview
  episodes: DramaScriptReview
  fullText: DramaScriptReview
}

export interface DramaProductionEstimate {
  roles: number
  scenes: number
  sceneAssets: number
  sceneOccurrences: number
  props: number
  shots: number
  credits: number
  episodeDuration: string
  totalDuration: string
  keyEpisodeCount: number
}

export interface DramaOptimizationSuggestion {
  id: string
  scope: string
  priority: string
  title: string
  problem: string
  advice: string
  affected: string
  boost: string
  detail: string
  evidence: string[]
  impact: string
  affectedEpisodeNos: number[]
  affectedLocations: string[]
  confidence: number
  sourceVersion: string
  /** 建议最初来自哪次体检；应用新版后仍保留用于历史说明。 */
  reviewSourceVersion?: string
  /** 发布新版本后，旧建议冻结为只读历史记录。 */
  historyReadonly?: boolean
  /** 该建议在哪个正式版本发布时被归档。 */
  archivedInVersion?: string
  originalText: string
  suggestedText: string
  problemIdentification: string
  modificationStrategy: string
  expectedEffect: string
  riskControl: string
  characterImpact: string
  episodeImpact: string
  assetImpact: string
  storyboardImpact: string
  status: string
  /** AI 诊断建议自身状态，与具体优化稿生成状态分开维护。 */
  suggestionStatus?: string
  /** 具体优化稿状态：未生成、生成中、已生成、生成失败或已过期。 */
  draftStatus?: string
  /** 是否由用户确认费用后实际投递过优化稿任务。 */
  draftRequested?: boolean
  draftErrorCode?: string
  draftErrorMessage?: string
  draftRetryCount?: number
  draftSourceVersion?: string
  /** 后端用于稳定定位原文的块 ID，界面不直接展示。 */
  sourceBlockIds?: string[]
  evidenceBlockIds?: string[]
  draftScopeBlockIds?: string[]
  sourceScopeType?: string
  sourceSegments?: Array<{
    episodeNo: number | null
    sceneId: string
    sceneNo: number | null
    blockIds: string[]
    startOffset: number
    endOffset: number
    text: string
  }>
  sceneNo?: number | null
  draftRevision?: number
  chargedCredits?: number
  /** 已通过后端校验的文本补丁，用于生成完整 Diff 和写入工作草稿。 */
  patches?: Array<Record<string, unknown>>
  /** 建议绑定的正式剧本原文范围；候选不唯一时由用户在详情页确认。 */
  sourceLocator: DramaSuggestionSourceLocator
  actionable: boolean
  storyboardReference: string
}

export interface DramaSuggestionSourceCandidate {
  episodeNo: number | null
  sceneId: string
  sceneIndex: number | null
  startOffset: number
  endOffset: number
  excerpt: string
  confidence: number
}

export interface DramaSuggestionSourceLocator {
  scopeType: string
  episodeNo: number | null
  sceneId: string
  sceneIndex: number | null
  startOffset: number
  endOffset: number
  sourceTextSnapshot: string
  sourceVersion: string
  status: 'resolved' | 'ambiguous' | 'missing' | 'stale'
  confidence: number
  candidates: DramaSuggestionSourceCandidate[]
}

export interface DramaScriptVersion {
  version: string
  status: string
  current: boolean
  optimized: boolean
  createdAt: string
  appliedAt: string
  summary: string
  score: number
}

export interface DramaStoryboardRunState {
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
  }>
  generatedCounts: Record<string, number>
  expectedCounts: Record<string, number>
  model: string
  style: string
  errorMessage: string
  errorCode: string
  userMessage: string
  retryable: boolean
  retryAction: string
  preservedRows: number
  updatedAt: string
}

export interface DramaWorkflowSummary {
  stage: 'input' | 'analysis' | 'script' | 'assets' | 'storyboard' | 'video' | 'export'
  state: 'idle' | 'running' | 'needs_action' | 'failed' | 'completed'
  progressPercent: number
  progressLabel: string
  nextAction: string
  needsAttention: boolean
}

export interface DramaAnalysis {
  schemaVersion: string
  title: string
  genre: string
  coreTheme: string
  targetAudience: string
  storyType: string
  logline: string
  synopsis: string
  totalEpisodes: number
  currentEpisodeNo: number
  displayMeta: DramaDisplayMeta
  tags: string[]
  coverPrompt: string
  coverImageUrl: string
  outline: string
  backgroundTraits: string
  characterBios: DramaCharacterBio[]
  episodeSummaries: DramaEpisodeSummary[]
  episodeDetails: DramaEpisodeDetail[]
  roles: DramaRoleProfile[]
  scenes: DramaSceneProfile[]
  props: DramaPropProfile[]
  intentRouter: DramaIntentRouter
  characterRelationships: DramaCharacterRelationships
  episodeStructures: DramaEpisodeStructure[]
  scriptScenes: DramaScriptScene[]
  scriptReviews: DramaScriptReviews
  // 优化版本默认沿用上一版体检结论作历史参考，只有用户主动复检才刷新。
  scriptReviewsSourceVersion: string
  scriptReviewsStale: boolean
  productionEstimate: DramaProductionEstimate
  optimizationSuggestions: DramaOptimizationSuggestion[]
  scriptVersions: DramaScriptVersion[]
  currentScriptVersion: string
  confirmedScriptVersionId: string
  analysisSnapshotId: string
  /** 当前正式剧本之上的人工场次草稿；正式发布后清空，差异留在版本记录中。 */
  unpublishedSceneChanges: Record<string, Record<string, unknown>>
}

export interface DramaProjectDetail {
  id: string
  projectId: string
  title: string
  currentStage: string
  status: string
  themeMode: 'dark' | 'light'
  sourceScriptText: string
  sourceFileName: string
  analysis: DramaAnalysis
  analysisRun: DramaAnalysisRunState
  storyboardRun: DramaStoryboardRunState
  storyboards: StoryboardRow[]
}

export interface DramaProjectCard {
  id: string
  projectId: string
  title: string
  status: string
  currentStage: string
  coverImageUrl: string
  genre: string
  tags: string[]
  entryIntent: DramaIntentMode
  effectiveMode: DramaIntentMode
  style: string
  aspectRatio: string
  resolution: string
  totalEpisodes: number
  completedStoryboards: number
  totalStoryboards: number
  analysisProgress: number
  workflowSummary?: DramaWorkflowSummary
  updatedAt: string
  createdAt: string
}

export interface DramaProjectPage {
  items: DramaProjectCard[]
  total: number
  page: number
  pageSize: number
}

export interface RuntimeModelOption {
  provider: 'alibaba' | 'bytedance' | 'huoshan'
  model: string
  label: string
  description: string
  baseCredits: number
  billingMode: string
  /**
   * 视频模型的运行边界由后台模型配置维护。
   * 前端仅用它收窄下拉选项；最终仍由服务端校验，防止请求绕过页面限制。
   */
  limits: {
    minDurationSec?: number
    maxDurationSec?: number
    resolutions?: string[]
    maxReferenceCount?: number
    supportsSilent?: boolean
  }
}

export interface DramaRuntimeConfig {
  themeModes: Array<'dark' | 'light'>
  videoResolutions: string[]
  defaults: Record<string, string>
  textModels: RuntimeModelOption[]
  imageModels: RuntimeModelOption[]
  videoModels: RuntimeModelOption[]
}

/**
 * 普通用户可见的视频能力边界。
 * 这里只暴露项目创建和分镜编辑需要的参数，不泄露供应商及模型名称。
 */
export interface PublicVideoCapabilities {
  resolutions: string[]
  defaultResolution: string
  minDurationSec: number
  maxDurationSec: number
  supportsAudioUpload: boolean
  supportsAudioDrivenVideo: boolean
  audioMixModes: Array<'replace' | 'mix'>
}

export interface DramaCreditPreview {
  action: string
  taskType: string
  provider: string
  model: string
  requiredCredits: number
  currentBalance: number
  balanceAfter: number
  sufficient: boolean
  quantity: number
  quantityUnit: string
  pricingSnapshot: Record<string, unknown>
  message: string
  warnings: string[]
  promptLoad: StoryboardPromptLoad
  modeHint: DramaIntentMode
  repairPatchSummary: string
}
