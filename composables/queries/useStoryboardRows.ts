import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { storyboardService } from '~/shared/api/services/storyboardService'

export function useStoryboardRows(projectId: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ['storyboard-rows', projectId.value]),
    queryFn: () => storyboardService.getStoryboardRows(projectId.value)
  })
}
