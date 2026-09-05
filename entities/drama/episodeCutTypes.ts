export interface EpisodeCutClip {
  storyboardRowId: string
  takeId: string
  // 默认跟随分镜页确认版本；成片页手动换版后改为 false，避免下次读取覆盖用户选择。
  followStoryboardSelection: boolean
  sortIndex: number
  trimInMs: number
  trimOutMs: number
  nativeAudioGain: number
  nativeAudioMuted: boolean
}

export interface EpisodeCaptionCue {
  sortIndex: number
  startMs: number
  endMs: number
  text: string
}

export interface EpisodeCutDraft {
  id: string
  episodeNo: number
  versionNo: number
  status: string
  clips: EpisodeCutClip[]
  captions: EpisodeCaptionCue[]
  bgmUrl: string
  bgmGain: number
  bgmFadeInMs: number
  bgmFadeOutMs: number
  subtitleStyle: Record<string, unknown>
  exportSettings: Record<string, unknown>
}

export type EpisodeCutSavePayload = Omit<EpisodeCutDraft, 'id' | 'episodeNo' | 'versionNo' | 'status'>

export interface EpisodeCutTask {
  id: string
  projectId: string
  episodeNo: number
  taskType: 'captions' | 'render' | 'editor_package'
  renderMode: 'fast' | 'standard' | 'package' | string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | string
  stage: string
  progress: number
  outputUrl: string
  outputSizeBytes: number
  sourceDurationMs: number
  estimatedSeconds: number
  errorMessage: string
  createdAt: string
  startedAt: string
  finishedAt: string
}

export interface EpisodeCutTaskList {
  items: EpisodeCutTask[]
  total: number
  page: number
  pageSize: number
}
