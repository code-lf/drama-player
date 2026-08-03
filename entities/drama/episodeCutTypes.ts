export interface EpisodeCutClip {
  storyboardRowId: string
  takeId: string
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
  taskType: 'captions' | 'render' | 'editor_package'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | string
  progress: number
  outputUrl: string
  errorMessage: string
}
