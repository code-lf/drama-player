import type { StoryboardRow } from '~/entities/storyboard/types'

export interface DramaAssetItem {
  id: string
  imageUrl: string
  prompt: string
  status: string
  meta: Record<string, unknown>
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
}

export interface DramaRuntimeConfig {
  themeModes: Array<'dark' | 'light'>
  videoResolutions: string[]
  defaults: Record<string, string>
  textModels: RuntimeModelOption[]
  imageModels: RuntimeModelOption[]
  videoModels: RuntimeModelOption[]
}
