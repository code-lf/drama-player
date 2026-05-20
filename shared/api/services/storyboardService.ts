import { callApi } from '~/shared/api/client'

export const storyboardService = {
  async getStoryboardRows(projectId: string) {
    return callApi('storyboard/getRows', (adapter) => adapter.getStoryboardRows(projectId))
  }
}
