import type { CanvasGraph } from '~/entities/canvas/types'
import { callApi } from '~/shared/api/client'

export const canvasService = {
  async getCanvasGraph(projectId: string) {
    return callApi('canvas/getCanvasGraph', (adapter) => adapter.getCanvasGraph(projectId))
  },

  async saveCanvasGraph(projectId: string, graph: CanvasGraph) {
    return callApi('canvas/saveCanvasGraph', (adapter) => adapter.saveCanvasGraph(projectId, graph))
  }
}
