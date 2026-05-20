import { callApi } from '~/shared/api/client'

export const projectService = {
  async getLandingProjects(category?: string) {
    return callApi('project/getLandingProjects', (adapter) => adapter.getLandingProjects(category))
  }
}
