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
}

export interface DramaEpisodeDetail {
  episodeNo: number
  title: string
  content: string
}

export interface DramaAnalysisRunState {
  status: string
  currentStage: string
  stageStatuses: Record<string, string>
  stageProgresses: Record<string, number>
  coverStatus: string
  coverErrorMessage: string
  startedAt: string
  updatedAt: string
  finishedAt: string
  errorMessage: string
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
  episodeNo: number
  index: number
  title: string
  place: string
  timeOfDay: string
  characters: string[]
  content: string
  dialogues: string[]
  suggestions: string[]
}

export interface DramaReviewDimension {
  label: string
  value: number
}

export interface DramaReviewIssue {
  title: string
  status: string
  detail: string
}

export interface DramaScriptReview {
  title: string
  score: number
  tone: string
  dimensions: DramaReviewDimension[]
  strengths: DramaReviewIssue[]
  warnings: DramaReviewIssue[]
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
  props: number
  shots: number
  credits: number
  episodeDuration: string
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
  originalText: string
  suggestedText: string
  status: string
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
  generatedCounts: Record<string, number>
  expectedCounts: Record<string, number>
  model: string
  style: string
  errorMessage: string
  updatedAt: string
}

export interface DramaAnalysis {
  schemaVersion: string
  title: string
  genre: string
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
  productionEstimate: DramaProductionEstimate
  optimizationSuggestions: DramaOptimizationSuggestion[]
  scriptVersions: DramaScriptVersion[]
  currentScriptVersion: string
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
  provider: 'alibaba' | 'bytedance'
  model: string
  label: string
  description: string
  baseCredits: number
  billingMode: string
}

export interface DramaRuntimeConfig {
  themeModes: Array<'dark' | 'light'>
  videoResolutions: string[]
  defaults: Record<string, string>
  textModels: RuntimeModelOption[]
  imageModels: RuntimeModelOption[]
  videoModels: RuntimeModelOption[]
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
