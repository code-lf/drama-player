import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { canvasService } from '~/shared/api/services/canvasService'

export function useCanvasGraph(projectId: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ['canvas-graph', projectId.value]),
    queryFn: () => canvasService.getCanvasGraph(projectId.value),
    enabled: computed(() => Boolean(projectId.value))
  })
}
