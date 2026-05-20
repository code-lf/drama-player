export type ProjectStatus = 'draft' | 'generating' | 'published'

export interface Project {
  id: string
  title: string
  coverUrl: string
  status: ProjectStatus
  category: string
  author: string
  updatedAt: string
}
