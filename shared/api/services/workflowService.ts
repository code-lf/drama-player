import { callApi } from '~/shared/api/client'
import type { WorkflowRunCreatePayload } from '~/shared/api/types'

export const workflowService = {
  async createRun(payload: WorkflowRunCreatePayload) {
    return callApi('workflow/createRun', (adapter) => adapter.createWorkflowRun(payload))
  },

  async getRun(runId: string) {
    return callApi('workflow/getRun', (adapter) => adapter.getWorkflowRun(runId))
  }
}
