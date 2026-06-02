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

export interface DramaAnalysis {
  title: string
  genre: string
  logline: string
  synopsis: string
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
  storyboards: StoryboardRow[]
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
