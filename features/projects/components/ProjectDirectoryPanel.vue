<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Plus,
  Search,
  Trash2
} from '@lucide/vue'
import type { DramaProjectCard } from '~/entities/drama/types'
import UiFluidImage from '~/components/ui/FluidImage.vue'

interface Props {
  currentProjectPage: number
  isAllCurrentPageSelected: boolean
  isBatchSelectingProjects: boolean
  isCreatingWorkspaceProject: boolean
  isDeletingProjects: boolean
  pageNumberList: number[]
  projectOverviewLabel: string
  selectedProjectCount: number
  selectedProjectIds: string[]
  totalProjectPages: number
  workspaceProjectCards: DramaProjectCard[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'create-project'): void
  (event: 'go-to-page', page: number): void
  (event: 'open-project', projectId: string): void
  (event: 'request-delete-batch'): void
  (event: 'request-delete-project', project: DramaProjectCard): void
  (event: 'toggle-batch-mode'): void
  (event: 'toggle-project-selection', projectId: string): void
  (event: 'toggle-select-all'): void
}>()

type ProjectViewMode = 'grid' | 'list'
type ProjectStatusFilter = 'all' | 'active' | 'completed' | 'archived'
type ProjectSortMode = 'updated-desc' | 'created-desc' | 'title-asc'

const searchKeyword = ref('')
const statusFilter = ref<ProjectStatusFilter>('all')
const sortMode = ref<ProjectSortMode>('updated-desc')
const viewMode = ref<ProjectViewMode>('grid')

const visibleProjects = computed(() => {
  const keyword = searchKeyword.value.trim().toLocaleLowerCase('zh-CN')
  const items = props.workspaceProjectCards.filter((project) => {
    const matchesKeyword = !keyword || [project.title, project.genre, project.style, ...project.tags]
      .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword))
    const group = projectStatusGroup(project)
    return matchesKeyword && (statusFilter.value === 'all' || group === statusFilter.value)
  })

  // 当前后端已按更新时间分页；这里的排序只作用于当前页，避免前端伪装成全量跨页排序。
  return [...items].sort((left, right) => {
    if (sortMode.value === 'title-asc') return left.title.localeCompare(right.title, 'zh-CN')
    const leftTime = new Date(sortMode.value === 'created-desc' ? left.createdAt : left.updatedAt).getTime() || 0
    const rightTime = new Date(sortMode.value === 'created-desc' ? right.createdAt : right.updatedAt).getTime() || 0
    return rightTime - leftTime
  })
})

function isProjectSelected(projectId: string): boolean {
  return props.selectedProjectIds.includes(projectId)
}

function projectProgress(project: DramaProjectCard): number {
  // 项目列表展示四阶段总进度：剧本 25%、资产 50%、分镜 75%、成片 100%。
  // 后端资产阶段沿用 roles/scenes/props 三个历史枚举，必须统一折叠成“资产”，
  // 否则已经进入第二阶段的项目会因为没有分镜数据而错误显示为 0%。
  const stage = String(project.currentStage || '').toLowerCase()
  if (project.status === 'published') return 100
  if (project.status === 'analyzing') return 12
  if (['video', 'videos', 'completed'].includes(stage)) return 100
  if (['storyboard', 'storyboards'].includes(stage)) {
    const shotProgress = project.totalStoryboards > 0
      ? project.completedStoryboards / project.totalStoryboards
      : 0
    return Math.min(75, Math.round(50 + shotProgress * 25))
  }
  if (['assets', 'setting', 'roles', 'scenes', 'props'].includes(stage)) return 50
  if (['analysis', 'script'].includes(stage)) return 25
  return 0
}

function projectStatusGroup(project: DramaProjectCard): ProjectStatusFilter {
  if (project.status === 'archived') return 'archived'
  if (project.status === 'published' || projectProgress(project) === 100) return 'completed'
  return 'active'
}

function projectStatusLabel(project: DramaProjectCard): string {
  if (project.status === 'archived') return '已归档'
  if (project.status === 'published' || projectProgress(project) === 100) return '已完成'
  if (project.status === 'analyzing') return '解析中'
  if (project.status === 'generating') return '创作中'
  return '草稿'
}

function projectStatusClass(project: DramaProjectCard): string {
  const group = projectStatusGroup(project)
  if (group === 'completed') return 'project-status--completed'
  if (group === 'archived') return 'project-status--archived'
  return 'project-status--active'
}

function projectProgressLabel(project: DramaProjectCard): string {
  const stage = String(project.currentStage || '').toLowerCase()
  if (project.status === 'analyzing') return '剧本解析中'
  if (['analysis', 'script'].includes(stage)) return '剧本解析与确认中'
  if (['assets', 'setting', 'roles', 'scenes', 'props'].includes(stage)) return '资产制作中'
  if (['storyboard', 'storyboards'].includes(stage)) {
    return project.totalStoryboards > 0
      ? `${project.completedStoryboards}/${project.totalStoryboards} 分镜完成`
      : '分镜制作中'
  }
  if (['video', 'videos', 'completed'].includes(stage)) return '成片制作完成'
  return '等待开始创作'
}

function formatProjectDate(value?: string): string {
  if (!value) return '最近更新'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16).replace('T', ' ')

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(parsed)
}

function openProject(project: DramaProjectCard): void {
  if (props.isBatchSelectingProjects) {
    emit('toggle-project-selection', project.id)
    return
  }
  emit('open-project', project.id)
}
</script>

<template>
  <section class="project-directory">
    <header class="project-directory__header">
      <div>
        <h2 class="text-[28px] font-black text-textMain">项目列表</h2>
        <p class="mt-1 text-[14px] text-textMuted">{{ projectOverviewLabel }}</p>
      </div>
      <button
        class="project-create-button"
        type="button"
        :disabled="isCreatingWorkspaceProject"
        @click="emit('create-project')"
      >
        <Plus class="h-4 w-4" />
        {{ isCreatingWorkspaceProject ? '创建中...' : '新建项目' }}
      </button>
    </header>

    <div class="project-toolbar">
      <label class="project-search">
        <Search class="h-[18px] w-[18px]" />
        <input v-model="searchKeyword" type="search" placeholder="搜索项目名称" />
      </label>

      <select v-model="statusFilter" class="project-select" aria-label="项目状态筛选">
        <option value="all">全部状态</option>
        <option value="active">创作中</option>
        <option value="completed">已完成</option>
        <option value="archived">已归档</option>
      </select>

      <select v-model="sortMode" class="project-select project-select--sort" aria-label="项目排序">
        <option value="updated-desc">排序：最近更新时间</option>
        <option value="created-desc">排序：最近创建时间</option>
        <option value="title-asc">排序：项目名称</option>
      </select>

      <div v-if="workspaceProjectCards.length > 0" class="project-toolbar__actions">
        <button class="project-secondary-button" type="button" @click="emit('toggle-batch-mode')">
          {{ isBatchSelectingProjects ? '取消批量' : '批量操作' }}
        </button>
        <button
          v-if="isBatchSelectingProjects"
          class="project-secondary-button"
          type="button"
          @click="emit('toggle-select-all')"
        >
          {{ isAllCurrentPageSelected ? '取消全选' : '全选' }}
        </button>
        <button
          v-if="isBatchSelectingProjects"
          class="project-delete-button"
          type="button"
          :disabled="selectedProjectCount === 0 || isDeletingProjects"
          @click="emit('request-delete-batch')"
        >
          <Trash2 class="h-4 w-4" />
          删除<span v-if="selectedProjectCount"> {{ selectedProjectCount }}</span>
        </button>
        <div class="project-view-toggle" aria-label="项目视图切换">
          <button
            type="button"
            title="网格视图"
            :class="{ active: viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <Grid2X2 class="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            title="列表视图"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            <List class="h-[19px] w-[19px]" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="workspaceProjectCards.length === 0" class="project-empty-state">
      <img src="/dashboard/project-empty.png" alt="暂无项目" />
      <h3>还没有项目</h3>
      <p>你还没有创建任何项目，点击右上角“新建项目”开始你的创作之旅吧</p>
    </div>

    <div v-else-if="visibleProjects.length === 0" class="project-filter-empty">
      <Search class="h-8 w-8" />
      <h3>没有找到匹配项目</h3>
      <p>换一个关键词或筛选条件试试</p>
    </div>

    <div v-else-if="viewMode === 'grid'" class="project-card-grid">
      <article
        v-for="project in visibleProjects"
        :key="project.id"
        class="project-card"
        role="button"
        tabindex="0"
        @click="openProject(project)"
        @keydown.enter.prevent="openProject(project)"
        @keydown.space.prevent="openProject(project)"
      >
        <button
          v-if="isBatchSelectingProjects"
          class="project-select-check"
          :class="{ active: isProjectSelected(project.id) }"
          type="button"
          title="选择项目"
          @click.stop="emit('toggle-project-selection', project.id)"
        >
          <Check class="h-4 w-4" />
        </button>
        <button
          v-else
          class="project-card-delete"
          type="button"
          title="删除项目"
          @click.stop="emit('request-delete-project', project)"
        >
          <Trash2 class="h-4 w-4" />
        </button>

        <div class="project-card__cover">
          <UiFluidImage
            v-if="project.coverImageUrl"
            :src="project.coverImageUrl"
            :alt="project.title"
            wrapper-class="h-full w-full"
            img-class="object-cover transition-transform duration-500 group-hover:scale-105"
            fallback-text=""
            loading-label=""
          />
          <div v-else class="project-cover-fallback">
            <span>{{ project.title.slice(0, 1) || '剧' }}</span>
          </div>
          <span class="project-status" :class="projectStatusClass(project)">
            {{ projectStatusLabel(project) }}
          </span>
        </div>

        <div class="project-card__body">
          <h3>{{ project.title }}</h3>
          <p>更新于 {{ formatProjectDate(project.updatedAt || project.createdAt) }}</p>
          <div class="project-progress-meta">
            <span>{{ projectProgressLabel(project) }}</span>
            <strong>{{ projectProgress(project) }}%</strong>
          </div>
          <div class="project-progress-track">
            <span :style="{ width: `${projectProgress(project)}%` }" />
          </div>
        </div>
      </article>
    </div>

    <div v-else class="project-list-view">
      <article
        v-for="project in visibleProjects"
        :key="project.id"
        class="project-list-row"
        role="button"
        tabindex="0"
        @click="openProject(project)"
        @keydown.enter.prevent="openProject(project)"
      >
        <div class="project-list-row__cover">
          <UiFluidImage
            v-if="project.coverImageUrl"
            :src="project.coverImageUrl"
            :alt="project.title"
            wrapper-class="h-full w-full"
            img-class="object-cover"
            fallback-text=""
            loading-label=""
          />
          <div v-else class="project-cover-fallback"><span>{{ project.title.slice(0, 1) || '剧' }}</span></div>
        </div>
        <div class="project-list-row__main">
          <h3>{{ project.title }}</h3>
          <p>{{ project.genre || project.style || '短剧项目' }}</p>
        </div>
        <span class="project-status project-list-row__status" :class="projectStatusClass(project)">
          {{ projectStatusLabel(project) }}
        </span>
        <div class="project-list-row__progress">
          <span>{{ projectProgressLabel(project) }}</span>
          <div class="project-progress-track"><span :style="{ width: `${projectProgress(project)}%` }" /></div>
        </div>
        <time>{{ formatProjectDate(project.updatedAt || project.createdAt) }}</time>
        <button type="button" title="删除项目" @click.stop="emit('request-delete-project', project)">
          <Trash2 class="h-[18px] w-[18px]" />
        </button>
      </article>
    </div>

    <footer v-if="totalProjectPages > 1" class="project-pagination">
      <p>第 {{ currentProjectPage }} / {{ totalProjectPages }} 页</p>
      <div>
        <button
          type="button"
          title="上一页"
          :disabled="currentProjectPage === 1"
          @click="emit('go-to-page', currentProjectPage - 1)"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        <button
          v-for="pageNo in pageNumberList"
          :key="`project-page-${pageNo}`"
          type="button"
          :class="{ active: pageNo === currentProjectPage }"
          @click="emit('go-to-page', pageNo)"
        >
          {{ pageNo }}
        </button>
        <button
          type="button"
          title="下一页"
          :disabled="currentProjectPage === totalProjectPages"
          @click="emit('go-to-page', currentProjectPage + 1)"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.project-directory {
  width: 100%;
}

.project-directory__header,
.project-toolbar,
.project-toolbar__actions,
.project-progress-meta,
.project-pagination,
.project-pagination > div {
  display: flex;
  align-items: center;
}

.project-directory__header {
  justify-content: space-between;
  gap: 24px;
}

.project-create-button {
  display: inline-flex;
  height: 42px;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  background: #0868f7;
  padding: 0 20px;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 10px 24px rgba(8, 104, 247, 0.2);
}

.project-create-button:disabled,
.project-delete-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.project-toolbar {
  gap: 12px;
  margin-top: 28px;
}

.project-search {
  display: flex;
  width: 216px;
  height: 42px;
  align-items: center;
  gap: 10px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: var(--panel, #fff);
  padding: 0 14px;
  color: #8493aa;
}

.project-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
}

.project-select {
  height: 42px;
  min-width: 130px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  outline: none;
  background: var(--panel, #fff);
  padding: 0 34px 0 14px;
  color: #273650;
  font-size: 13px;
  font-weight: 700;
}

.project-select--sort {
  min-width: 170px;
}

.project-toolbar__actions {
  gap: 8px;
  margin-left: auto;
}

.project-secondary-button,
.project-delete-button {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 6px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: var(--panel, #fff);
  padding: 0 13px;
  color: #53627a;
  font-size: 13px;
  font-weight: 700;
}

.project-delete-button {
  border-color: rgba(239, 68, 68, 0.25);
  color: #dc2626;
}

.project-view-toggle {
  display: grid;
  grid-template-columns: repeat(2, 38px);
  overflow: hidden;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: var(--panel, #fff);
}

.project-view-toggle button {
  display: grid;
  height: 38px;
  place-items: center;
  color: #74839a;
}

.project-view-toggle button.active {
  background: #edf5ff;
  color: #0868f7;
}

.project-empty-state,
.project-filter-empty {
  display: flex;
  min-height: 268px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
  border: 1px solid #e1e8f2;
  border-radius: 8px;
  background: var(--panel, #fff);
  text-align: center;
  box-shadow: 0 14px 40px rgba(41, 72, 117, 0.05);
}

.project-empty-state img {
  width: min(330px, 72vw);
  height: 132px;
  object-fit: contain;
  object-position: center;
  /* 原素材底部带有较多透明空白，裁切后才能和设计稿保持紧凑。 */
  clip-path: inset(2% 3% 8%);
}

.project-empty-state h3,
.project-filter-empty h3 {
  margin-top: 2px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 900;
}

.project-empty-state p,
.project-filter-empty p {
  margin-top: 8px;
  color: #71809a;
  font-size: 14px;
}

.project-filter-empty {
  color: #9aa8bc;
}

.project-card-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px;
  margin-top: 24px;
}

.project-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  background: var(--panel, #fff);
  box-shadow: 0 12px 28px rgba(38, 69, 110, 0.06);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.project-card:hover {
  border-color: rgba(8, 104, 247, 0.35);
  box-shadow: 0 18px 36px rgba(30, 85, 158, 0.12);
  transform: translateY(-2px);
}

.project-card__cover {
  position: relative;
  height: 128px;
  overflow: hidden;
  background: #edf4ff;
}

.project-cover-fallback {
  display: grid;
  height: 100%;
  width: 100%;
  place-items: center;
  background: linear-gradient(135deg, #dcecff, #edf4ff 52%, #dce8fb);
}

.project-cover-fallback span {
  color: rgba(8, 104, 247, 0.48);
  font-size: 44px;
  font-weight: 900;
}

.project-status {
  display: inline-flex;
  height: 24px;
  align-items: center;
  border-radius: 6px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 800;
}

.project-card__cover > .project-status {
  position: absolute;
  right: 10px;
  top: 10px;
}

.project-status--active {
  background: #0868f7;
  color: #fff;
}

.project-status--completed {
  background: #10b981;
  color: #fff;
}

.project-status--archived {
  background: rgba(71, 85, 105, 0.82);
  color: #fff;
}

.project-card__body {
  padding: 14px 14px 15px;
}

.project-card__body h3 {
  overflow: hidden;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__body > p {
  margin-top: 6px;
  color: #8492a7;
  font-size: 11px;
}

.project-progress-meta {
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
  color: #65748b;
  font-size: 11px;
}

.project-progress-meta strong {
  color: #0868f7;
  font-weight: 900;
}

.project-progress-track {
  height: 5px;
  overflow: hidden;
  margin-top: 7px;
  border-radius: 999px;
  background: #e7eef7;
}

.project-progress-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #0868f7;
  transition: width 0.25s ease;
}

.project-card-delete,
.project-select-check {
  position: absolute;
  z-index: 4;
  display: grid;
  height: 30px;
  width: 30px;
  place-items: center;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
  color: #64748b;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
}

.project-card-delete {
  right: 10px;
  bottom: 10px;
  opacity: 0;
}

.project-card:hover .project-card-delete {
  opacity: 1;
}

.project-select-check {
  left: 10px;
  top: 10px;
  color: transparent;
}

.project-select-check.active {
  background: #0868f7;
  color: #fff;
}

.project-list-view {
  display: grid;
  gap: 10px;
  margin-top: 24px;
}

.project-list-row {
  display: grid;
  min-height: 82px;
  grid-template-columns: 112px minmax(180px, 1fr) 86px 220px 150px 36px;
  gap: 16px;
  align-items: center;
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  background: var(--panel, #fff);
  padding: 10px;
  cursor: pointer;
}

.project-list-row__cover {
  height: 62px;
  overflow: hidden;
  border-radius: 6px;
  background: #edf4ff;
}

.project-list-row__main h3 {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.project-list-row__main p,
.project-list-row time,
.project-list-row__progress > span {
  margin-top: 5px;
  color: #7b899e;
  font-size: 11px;
}

.project-list-row__status {
  justify-self: start;
}

.project-list-row > button {
  display: grid;
  height: 34px;
  width: 34px;
  place-items: center;
  color: #7b899e;
}

.project-pagination {
  justify-content: space-between;
  margin-top: 28px;
  border-top: 1px solid #dfe7f2;
  padding-top: 20px;
  color: #71809a;
  font-size: 13px;
}

.project-pagination > div {
  gap: 6px;
}

.project-pagination button {
  display: grid;
  height: 34px;
  min-width: 34px;
  place-items: center;
  border-radius: 7px;
  color: #65748b;
  font-weight: 800;
}

.project-pagination button.active {
  background: #0868f7;
  color: #fff;
}

.project-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (max-width: 1520px) {
  .project-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1240px) {
  .project-toolbar {
    flex-wrap: wrap;
  }

  .project-toolbar__actions {
    width: 100%;
    margin-left: 0;
  }

  .project-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .project-list-row {
    grid-template-columns: 96px minmax(180px, 1fr) 86px 180px 36px;
  }

  .project-list-row time {
    display: none;
  }
}

@media (max-width: 860px) {
  .project-directory__header {
    align-items: flex-start;
  }

  .project-search,
  .project-select,
  .project-select--sort {
    width: 100%;
  }

  .project-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-list-row {
    grid-template-columns: 86px minmax(0, 1fr) 36px;
  }

  .project-list-row__status,
  .project-list-row__progress {
    display: none;
  }
}

@media (max-width: 560px) {
  .project-directory__header {
    flex-direction: column;
  }

  .project-create-button {
    width: 100%;
    justify-content: center;
  }

  .project-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
