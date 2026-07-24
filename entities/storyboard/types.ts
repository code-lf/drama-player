export type StoryboardRetryReason = 'identity' | 'motion' | 'camera' | 'scene' | 'prop' | 'rhythm' | 'quality'
export type StoryboardPromptLoad = 'low' | 'medium' | 'high'
export type StoryboardReferenceRole = 'identity' | 'scene' | 'prop' | 'motion' | 'endpoint'
export type StoryboardContinuationPolicy = 'auto' | 'manual' | 'none'
export type StoryboardStoryFunction = 'hook' | 'conflict' | 'reveal' | 'transition' | 'payoff' | 'cta'
export type StoryboardVideoPromptSource = 'system' | 'user' | 'adapted'
export type StoryboardQualityPolicy = 'smart' | 'economy' | 'quality'
export type StoryboardPlanStatus = 'draft' | 'preflight_running' | 'review_required' | 'confirmed' | 'stale'
export type StoryboardReviewStatus = 'unreviewed' | 'passed' | 'needs_revision'

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
  tuning: Record<string, unknown>
  validation: Record<string, unknown>
  createdAt: string
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

export interface StoryboardRuntimeExtra {
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
    generatedCounts: Record<string, number>
    expectedCounts: Record<string, number>
    style: string
    errorMessage: string
    updatedAt: string
  }
}
