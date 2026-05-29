import { callApi } from '~/shared/api/client'
import type { StoryboardGeneratePayload } from '~/shared/api/types'

export const storyboardService = {
  async getStoryboardRows(projectId: string) {
    return callApi('storyboard/getRows', (adapter) => adapter.getStoryboardRows(projectId))
  },

  async generateStoryboard(payload: StoryboardGeneratePayload) {
    return callApi('storyboard/generate', (adapter) => adapter.generateStoryboard(payload))
  }
}
