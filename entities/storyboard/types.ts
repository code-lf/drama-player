export type StoryboardRetryReason = 'identity' | 'motion' | 'camera' | 'scene' | 'prop' | 'rhythm' | 'quality'
export type StoryboardPromptLoad = 'low' | 'medium' | 'high'
export type StoryboardReferenceRole = 'identity' | 'scene' | 'prop' | 'motion' | 'endpoint'
export type StoryboardContinuationPolicy = 'auto' | 'manual' | 'none'
export type StoryboardStoryFunction = 'hook' | 'conflict' | 'reveal' | 'transition' | 'payoff' | 'cta'
export type StoryboardVideoPromptSource = 'system' | 'user' | 'adapted'

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
