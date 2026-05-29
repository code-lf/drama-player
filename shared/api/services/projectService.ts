import { callApi } from '~/shared/api/client'

export const projectService = {
  async getLandingProjects(category?: string) {
    return callApi('project/getLandingProjects', (adapter) => adapter.getLandingProjects(category))
  },

  async createProject(payload?: { title?: string; category?: string }) {
    return callApi('project/createProject', (adapter) => adapter.createProject(payload ?? {}))
  }
}
