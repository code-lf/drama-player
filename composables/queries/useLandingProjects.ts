import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'
import { projectService } from '~/shared/api/services/projectService'

export function useLandingProjects(category: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ['landing-projects', category.value]),
    queryFn: () => projectService.getLandingProjects(category.value)
  })
}
