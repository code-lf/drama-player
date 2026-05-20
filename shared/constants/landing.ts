import type { Project } from '~/entities/project/types'

export const landingCategories = ['全部', 'AI漫剧', '商业广告', '动漫游戏', '教育生活', '工具箱']

export const heroSlides = [
  {
    id: 'slide-1',
    title: '节点化创作引擎',
    subtitle: '脚本 -> 分镜 -> 视频一站式工作流',
    cover: 'linear-gradient(130deg, rgba(19,63,173,0.92), rgba(16,173,203,0.74))'
  },
  {
    id: 'slide-2',
    title: '角色一致性维护',
    subtitle: '同角色跨镜头保持风格连贯',
    cover: 'linear-gradient(130deg, rgba(116,34,173,0.9), rgba(45,114,220,0.75))'
  },
  {
    id: 'slide-3',
    title: '高效分镜工作区',
    subtitle: '表格与创意视图自由切换',
    cover: 'linear-gradient(130deg, rgba(11,109,114,0.92), rgba(40,56,174,0.78))'
  }
]

export const mockProjects: Project[] = [
  {
    id: 'p-1',
    title: '镜外之徒',
    coverUrl: 'linear-gradient(140deg, #191f30, #655b55)',
    status: 'published',
    category: 'AI漫剧',
    author: '动不动就饿',
    updatedAt: '2026-05-18T09:40:00+08:00'
  },
  {
    id: 'p-2',
    title: 'Panda 香氛广告',
    coverUrl: 'linear-gradient(140deg, #1f2b3f, #c27f86)',
    status: 'published',
    category: '商业广告',
    author: 'Panda',
    updatedAt: '2026-05-19T08:20:00+08:00'
  },
  {
    id: 'p-3',
    title: 'The Hole',
    coverUrl: 'linear-gradient(140deg, #1f1f1f, #90836b)',
    status: 'draft',
    category: 'AI漫剧',
    author: '星星',
    updatedAt: '2026-05-17T14:32:00+08:00'
  },
  {
    id: 'p-4',
    title: '白日梦',
    coverUrl: 'linear-gradient(140deg, #26314f, #7eb0ef)',
    status: 'generating',
    category: '教育生活',
    author: '野生biubiu',
    updatedAt: '2026-05-19T11:02:00+08:00'
  }
]
