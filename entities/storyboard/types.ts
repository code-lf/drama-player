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
  extra: Record<string, unknown>
}
