import { callApi } from '~/shared/api/client'
import type {
  DramaAnalyzePayload,
  DramaAssetGeneratePayload,
  DramaCoverRegeneratePayload,
  DramaDeleteResult,
  DramaProjectCreatePayload,
  DramaPropUpdatePayload,
  DramaRoleCreatePayload,
  DramaRoleUpdatePayload,
  DramaSceneUpdatePayload,
  DramaScriptIngestPayload,
  DramaStoryboardGeneratePayload,
  StoryboardCreatePayload,
  StoryboardUpdatePayload,
  StoryboardVideoBatchPayload,
  StoryboardVideoGeneratePayload,
  StoryboardVideoPromptGeneratePayload,
} from '~/shared/api/types'

export const dramaService = {
  async getRuntimeConfig() {
    return callApi('config/runtime', (adapter) => adapter.getRuntimeConfig())
  },

  async createProject(payload?: DramaProjectCreatePayload) {
    return callApi('drama/createProject', (adapter) => adapter.createDramaProject(payload ?? {}))
  },

  async getProjects(page = 1, pageSize = 10) {
    return callApi('drama/getProjects', (adapter) => adapter.getDramaProjects(page, pageSize))
  },

  async deleteProject(projectId: string): Promise<DramaDeleteResult> {
    return callApi('drama/deleteProject', (adapter) => adapter.deleteDramaProject(projectId))
  },

  async batchDeleteProjects(ids: string[]): Promise<DramaDeleteResult> {
    return callApi('drama/batchDeleteProjects', (adapter) => adapter.batchDeleteDramaProjects(ids))
  },

  async getProject(projectId: string) {
    return callApi('drama/getProject', (adapter) => adapter.getDramaProject(projectId))
  },

  async ingestScript(projectId: string, payload: DramaScriptIngestPayload) {
    return callApi('drama/ingestScript', (adapter) => adapter.ingestDramaScript(projectId, payload))
  },

  async analyze(projectId: string, payload?: DramaAnalyzePayload) {
    return callApi('drama/analyze', (adapter) => adapter.analyzeDrama(projectId, payload))
  },

  async regenerateCover(projectId: string, payload?: DramaCoverRegeneratePayload) {
    return callApi('drama/regenerateCover', (adapter) => adapter.regenerateDramaCover(projectId, payload))
  },

  async createRole(projectId: string, payload: DramaRoleCreatePayload) {
    return callApi('drama/createRole', (adapter) => adapter.createDramaRole(projectId, payload))
  },

  async updateRole(projectId: string, roleKey: string, payload: DramaRoleUpdatePayload) {
    return callApi('drama/updateRole', (adapter) => adapter.updateDramaRole(projectId, roleKey, payload))
  },

  async generateRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    return callApi('drama/generateRoles', (adapter) => adapter.generateDramaRoleAssets(projectId, payload))
  },

  async updateScene(projectId: string, sceneKey: string, payload: DramaSceneUpdatePayload) {
    return callApi('drama/updateScene', (adapter) => adapter.updateDramaScene(projectId, sceneKey, payload))
  },

  async generateSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    return callApi('drama/generateScenes', (adapter) => adapter.generateDramaSceneAssets(projectId, payload))
  },

  async updateProp(projectId: string, propKey: string, payload: DramaPropUpdatePayload) {
    return callApi('drama/updateProp', (adapter) => adapter.updateDramaProp(projectId, propKey, payload))
  },

  async generatePropAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    return callApi('drama/generateProps', (adapter) => adapter.generateDramaPropAssets(projectId, payload))
  },

  async generateStoryboards(projectId: string, payload?: DramaStoryboardGeneratePayload) {
    return callApi('drama/generateStoryboards', (adapter) => adapter.generateDramaStoryboards(projectId, payload))
  },

  async listStoryboards(projectId: string, episodeNo?: number) {
    return callApi('drama/listStoryboards', (adapter) => adapter.listDramaStoryboards(projectId, episodeNo))
  },

  async createStoryboard(projectId: string, payload: StoryboardCreatePayload) {
    return callApi('drama/createStoryboard', (adapter) => adapter.createDramaStoryboard(projectId, payload))
  },

  async updateStoryboard(projectId: string, rowId: string, payload: StoryboardUpdatePayload) {
    return callApi('drama/updateStoryboard', (adapter) => adapter.updateDramaStoryboard(projectId, rowId, payload))
  },

  async copyStoryboard(projectId: string, rowId: string) {
    return callApi('drama/copyStoryboard', (adapter) => adapter.copyDramaStoryboard(projectId, rowId))
  },

  async deleteStoryboard(projectId: string, rowId: string) {
    return callApi('drama/deleteStoryboard', (adapter) => adapter.deleteDramaStoryboard(projectId, rowId))
  },

  async generateStoryboardVideoPrompt(projectId: string, rowId: string, payload?: StoryboardVideoPromptGeneratePayload) {
    return callApi('drama/generateStoryboardVideoPrompt', (adapter) => adapter.generateStoryboardVideoPrompt(projectId, rowId, payload))
  },

  async generateStoryboardVideo(projectId: string, rowId: string, payload?: StoryboardVideoGeneratePayload) {
    return callApi('drama/generateStoryboardVideo', (adapter) => adapter.generateStoryboardVideo(projectId, rowId, payload))
  },

  async batchGenerateStoryboardVideos(projectId: string, payload: StoryboardVideoBatchPayload) {
    return callApi('drama/batchGenerateStoryboardVideos', (adapter) => adapter.batchGenerateStoryboardVideos(projectId, payload))
  }
}
