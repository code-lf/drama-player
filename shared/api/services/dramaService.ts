import { callApi } from '~/shared/api/client'
import type {
  DramaAnalyzePayload,
  DramaAssetGeneratePayload,
  DramaAssetProfile,
  DramaAssetRepairRequest,
  DramaVisualBible,
  DramaWorkspaceAssetStatus,
  DramaWorkspaceAssetType,
  DramaCreditPreviewPayload,
  DramaEntryCreditPreviewPayload,
  DramaCoverRegeneratePayload,
  DramaDeleteResult,
  DramaProjectCreatePayload,
  DramaPropUpdatePayload,
  DramaRoleCreatePayload,
  DramaRoleUpdatePayload,
  DramaRoleVoiceUpdatePayload,
  DramaSceneUpdatePayload,
  DramaScriptIngestPayload,
  DramaScriptSceneUpdatePayload,
  DramaScriptOptimizationPayload,
  DramaSuggestionSourceRangePayload,
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

  async getAssetWorkspace(projectId: string) {
    return callApi('drama/getAssetWorkspace', (adapter) => adapter.getDramaAssetWorkspace!(projectId))
  },

  async updateVisualBible(projectId: string, payload: Omit<DramaVisualBible, 'id' | 'version_no' | 'source_script_version' | 'status'>) {
    return callApi('drama/updateVisualBible', (adapter) => adapter.updateDramaVisualBible!(projectId, payload))
  },

  async updateAssetProfile(projectId: string, profile: Pick<DramaAssetProfile, 'asset_type' | 'asset_key'>, payload: { name?: string; is_required?: boolean; production_status?: DramaWorkspaceAssetStatus; selected_asset_id?: string; data?: Record<string, unknown> }) {
    return callApi('drama/updateAssetProfile', (adapter) => adapter.updateDramaAssetProfile!(projectId, profile.asset_type, profile.asset_key, payload))
  },

  async deleteAssetProfile(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string) {
    return callApi('drama/deleteAssetProfile', (adapter) => adapter.deleteDramaAssetProfile!(projectId, assetType, assetKey))
  },

  async uploadAssetReference(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, file: File) {
    return callApi('drama/uploadAssetReference', (adapter) => adapter.uploadDramaAssetReference!(projectId, assetType, assetKey, file))
  },

  async estimateAssetGeneration(projectId: string, targets: string[]) {
    return callApi('drama/estimateAssetGeneration', (adapter) => adapter.estimateDramaAssetGeneration!(projectId, targets))
  },

  async generateWorkspaceAssets(projectId: string, targets: string[], overwrite = false, compileHashes: Record<string, string> = {}) {
    return callApi('drama/generateWorkspaceAssets', (adapter) => adapter.generateDramaWorkspaceAssets!(projectId, targets, overwrite, compileHashes))
  },

  async lockWorkspaceAsset(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, locked: boolean) {
    return callApi('drama/lockWorkspaceAsset', (adapter) => adapter.lockDramaWorkspaceAsset!(projectId, assetType, assetKey, locked))
  },

  async estimateAssetConsistency(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string) {
    return callApi('drama/estimateAssetConsistency', (adapter) => adapter.estimateDramaAssetConsistency!(projectId, assetType, assetKey))
  },

  async checkAssetConsistency(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, manual = true, force = false) {
    return callApi('drama/checkAssetConsistency', (adapter) => adapter.checkDramaAssetConsistency!(projectId, assetType, assetKey, manual, force))
  },

  async estimateAssetConsistencyRepair(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: DramaAssetRepairRequest) {
    return callApi('drama/estimateAssetConsistencyRepair', (adapter) => adapter.estimateDramaAssetConsistencyRepair!(projectId, assetType, assetKey, payload))
  },

  async repairAssetConsistency(projectId: string, assetType: DramaWorkspaceAssetType, assetKey: string, payload: DramaAssetRepairRequest) {
    return callApi('drama/repairAssetConsistency', (adapter) => adapter.repairDramaAssetConsistency!(projectId, assetType, assetKey, payload))
  },

  async ingestScript(projectId: string, payload: DramaScriptIngestPayload) {
    return callApi('drama/ingestScript', (adapter) => adapter.ingestDramaScript(projectId, payload))
  },

  async ingestScriptFile(projectId: string, file: File) {
    return callApi('drama/ingestScriptFile', (adapter) => adapter.ingestDramaScriptFile(projectId, file))
  },

  async previewEntryCredits(payload: DramaEntryCreditPreviewPayload) {
    return callApi('drama/previewEntryCredits', (adapter) => adapter.previewDramaEntryCredits(payload))
  },

  async previewEntryFileCredits(file: File, payload?: { model?: string }) {
    return callApi('drama/previewEntryFileCredits', (adapter) => adapter.previewDramaEntryFileCredits(file, payload))
  },

  async updateIntentRouter(projectId: string, payload: { mode: 'drama' | 'ad' | 'general' }) {
    return callApi('drama/updateIntentRouter', (adapter) => adapter.updateDramaIntentRouter(projectId, payload))
  },

  async createScriptOptimization(projectId: string, payload: DramaScriptOptimizationPayload) {
    return callApi('drama/createScriptOptimization', (adapter) => adapter.createDramaScriptOptimization(projectId, payload))
  },

  async applyScriptVersion(projectId: string, versionId: string) {
    return callApi('drama/applyScriptVersion', (adapter) => adapter.applyDramaScriptVersion(projectId, versionId))
  },

  async updateScriptSuggestionStatus(projectId: string, suggestionId: string, payload: { status: 'open' | 'pending' | 'ignored'; scriptVersionId?: string }) {
    return callApi('drama/updateScriptSuggestionStatus', (adapter) => adapter.updateDramaScriptSuggestionStatus(projectId, suggestionId, payload))
  },

  async resolveScriptSuggestionSource(projectId: string, suggestionId: string) {
    return callApi('drama/resolveScriptSuggestionSource', (adapter) => adapter.resolveDramaScriptSuggestionSource(projectId, suggestionId))
  },

  async updateScriptSuggestionSourceRange(projectId: string, suggestionId: string, payload: DramaSuggestionSourceRangePayload) {
    return callApi('drama/updateScriptSuggestionSourceRange', (adapter) => adapter.updateDramaScriptSuggestionSourceRange(projectId, suggestionId, payload))
  },

  async confirmScriptVersion(projectId: string) {
    return callApi('drama/confirmScriptVersion', (adapter) => adapter.confirmDramaScriptVersion(projectId))
  },

  async updateScriptScene(projectId: string, payload: DramaScriptSceneUpdatePayload) {
    return callApi('drama/updateScriptScene', (adapter) => adapter.updateDramaScriptScene(projectId, payload))
  },

  async previewCredits(projectId: string, payload: DramaCreditPreviewPayload) {
    return callApi('drama/previewCredits', (adapter) => adapter.previewDramaCredits(projectId, payload))
  },

  async analyze(projectId: string, payload?: DramaAnalyzePayload) {
    return callApi('drama/analyze', (adapter) => adapter.analyzeDrama(projectId, payload))
  },

  async retryAnalysisNode(projectId: string, nodeKey: string) {
    return callApi('drama/retryAnalysisNode', (adapter) => adapter.retryDramaAnalysisNode(projectId, nodeKey))
  },

  async retrySuggestionDraft(projectId: string, suggestionId: string) {
    return callApi('drama/retrySuggestionDraft', (adapter) => adapter.retryDramaSuggestionDraft(projectId, suggestionId))
  },

  async quoteSuggestionDrafts(projectId: string, suggestionIds: string[]) {
    return callApi('drama/quoteSuggestionDrafts', (adapter) => adapter.quoteDramaSuggestionDrafts(projectId, suggestionIds))
  },

  async generateSuggestionDrafts(projectId: string, suggestionIds: string[]) {
    return callApi('drama/generateSuggestionDrafts', (adapter) => adapter.generateDramaSuggestionDrafts(projectId, suggestionIds))
  },

  async getSuggestionDraftRun(projectId: string, runId: string) {
    return callApi('drama/getSuggestionDraftRun', (adapter) => adapter.getDramaSuggestionDraftRun(projectId, runId))
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

  async uploadRoleVoice(projectId: string, roleKey: string, file: File) {
    return callApi('drama/uploadRoleVoice', (adapter) => adapter.uploadDramaRoleVoice(projectId, roleKey, file))
  },

  async updateRoleVoice(projectId: string, roleKey: string, payload: DramaRoleVoiceUpdatePayload) {
    return callApi('drama/updateRoleVoice', (adapter) => adapter.updateDramaRoleVoice(projectId, roleKey, payload))
  },

  async deleteRoleVoice(projectId: string, roleKey: string) {
    return callApi('drama/deleteRoleVoice', (adapter) => adapter.deleteDramaRoleVoice(projectId, roleKey))
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
