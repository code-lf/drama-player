import { callApi } from '~/shared/api/client'
import type {
  DramaAnalyzePayload,
  DramaAssetGeneratePayload,
  DramaCoverRegeneratePayload,
  DramaDeleteResult,
  DramaProjectCreatePayload,
  DramaRoleCreatePayload,
  DramaScriptIngestPayload,
  DramaStoryboardGeneratePayload,
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

  async generateRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    return callApi('drama/generateRoles', (adapter) => adapter.generateDramaRoleAssets(projectId, payload))
  },

  async generateSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    return callApi('drama/generateScenes', (adapter) => adapter.generateDramaSceneAssets(projectId, payload))
  },

  async generatePropAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    return callApi('drama/generateProps', (adapter) => adapter.generateDramaPropAssets(projectId, payload))
  },

  async generateStoryboards(projectId: string, payload?: DramaStoryboardGeneratePayload) {
    return callApi('drama/generateStoryboards', (adapter) => adapter.generateDramaStoryboards(projectId, payload))
  }
}
