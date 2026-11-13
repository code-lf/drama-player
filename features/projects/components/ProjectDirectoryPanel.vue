<script setup lang="ts">
import {computed,ref} from 'vue'
import {UButton,UInput,USelect,UCheckbox,UProgress,UBadge,UTooltip,UIcon,UPopover,NuxtLink} from '#components'
import type { DramaProjectCard } from '~/entities/drama/types'
import type {CreationProjectCard,CreationProjectKind} from '../types'
import ProjectDirectoryToolbar from './ProjectDirectoryToolbar.vue'
import ProjectCardMenu from './ProjectCardMenu.vue'

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
  workspaceProjectCards: CreationProjectCard[]
  kindFilter: CreationProjectKind
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
  (event: 'update-kind', value:CreationProjectKind): void
}>()

type ProjectViewMode = 'grid' | 'list'
type ProjectStatusFilter = 'all' | 'active' | 'completed' | 'archived'
type ProjectSortMode = 'updated-desc' | 'created-desc' | 'title-asc'

const statusItems=[{label:'全部状态',value:'all'},{label:'创作中',value:'active'},{label:'已完成',value:'completed'},{label:'已归档',value:'archived'}]
const sortItems=[{label:'最近更新时间',value:'updated-desc'},{label:'最近创建时间',value:'created-desc'},{label:'项目名称',value:'title-asc'}]
// 分类由服务端在分页前执行，避免当前页恰好没有此类型造成假空列表。
const kindItems=[{label:'全部',value:'all' as const},{label:'剧本',value:'drama' as const}]
const searchKeyword = ref('')
const statusFilter = ref<ProjectStatusFilter>('all')
const sortMode = ref<ProjectSortMode>('updated-desc')
const viewMode = ref<ProjectViewMode>('grid')
const favoritesOnly=ref(false)
/** 筛选弹层确认后才修改当前页投影，关闭浮层不产生隐式变更。 */
function applyDirectoryFilter(value:{status:string;sort:string}){statusFilter.value=value.status as ProjectStatusFilter;sortMode.value=value.sort as ProjectSortMode}
/** 清除所有过滤条件，包括收藏；否则没有收藏的当前页会一直保持假空态。 */
function clearDirectoryFilters(){searchKeyword.value='';statusFilter.value='all';favoritesOnly.value=false}
// 封面失败只影响本地展示，不改写真实项目封面或使用其他项目素材冒充。
const failedCovers=ref<Record<string,string>>({})
function hasProjectCover(project:CreationProjectCard){return !!project.coverImageUrl&&failedCovers.value[project.id]!==project.coverImageUrl}
function markCoverFailed(project:CreationProjectCard){failedCovers.value[project.id]=project.coverImageUrl||''}

const visibleProjects = computed(() => {
  const keyword = searchKeyword.value.trim().toLocaleLowerCase('zh-CN')
  const items = props.workspaceProjectCards.filter((project) => {
    const matchesKeyword = !keyword || [project.title, project.genre, project.style, ...project.tags]
      .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword))
    const group = projectStatusGroup(project)
    return matchesKeyword && (!favoritesOnly.value||!!project.isFavorite) && (statusFilter.value === 'all' || group === statusFilter.value)
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
  if (project.workflowSummary) return project.workflowSummary.progressPercent
  // 项目列表展示四阶段总进度：剧本 25%、资产 50%、分镜 75%、成片 100%。
  // 后端资产阶段沿用 roles/scenes/props 三个历史枚举，必须统一折叠成“资产”，
  // 否则已经进入第二阶段的项目会因为没有分镜数据而错误显示为 0%。
  const stage = String(project.currentStage || '').toLowerCase()
  if (project.status === 'published') return 100
  // 解析中不再使用写死的 12%，与详情页共同展示后端统一计算的真实进度。
  if (project.status === 'analyzing') return Math.max(0, Math.min(100, Number(project.analysisProgress || 0)))
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
  if(project.status==='conversation')return '自由创作'
  if (project.status === 'archived') return '已归档'
  if (project.workflowSummary?.state === 'completed') return '已完成'
  if (project.workflowSummary?.state === 'failed') return '需要处理'
  if (project.workflowSummary?.state === 'running') return '进行中'
  if (project.workflowSummary?.state === 'needs_action') return '需要处理'
  if (project.status === 'published' || projectProgress(project) === 100) return '已完成'
  if (project.status === 'analyzing') return '解析中'
  if (project.status === 'generating') return '创作中'
  return '草稿'
}

/** 仅调整视觉语义，不修改状态分组、原进度数值或完成判断。 */
function projectStatusTone(project:DramaProjectCard){
  if(project.status==='conversation')return 'neutral' as const
  if(project.status==='archived')return 'neutral' as const
  if(['failed','needs_action'].includes(project.workflowSummary?.state||''))return 'warning' as const
  if(projectStatusGroup(project)==='completed')return 'success' as const
  return 'primary' as const
}

function projectProgressLabel(project: DramaProjectCard): string {
  if (project.workflowSummary) return project.workflowSummary.progressLabel
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
  // 卡片使用相对更新时间；完整时间通过title保留，不改写服务端时间或排序依据。
  const elapsed=Date.now()-parsed.getTime()
  if(elapsed>=0&&elapsed<60000)return '刚刚'
  if(elapsed>=60000&&elapsed<3600000)return `${Math.floor(elapsed/60000)}分钟前`
  if(elapsed>=3600000&&elapsed<86400000)return `${Math.floor(elapsed/3600000)}小时前`
  if(elapsed>=86400000&&elapsed<30*86400000)return `${Math.floor(elapsed/86400000)}天前`

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(parsed)
}

function openProject(project: CreationProjectCard): void {
  if (props.isBatchSelectingProjects) {
    emit('toggle-project-selection', project.id)
    return
  }
  emit('open-project', project.id)
}
</script>

<template>
  <section class="project-directory" aria-label="我的项目">
    <header class="project-directory__header">
      <div><h1>我的项目</h1></div>
    </header>
    <div class="project-directory-controls">
    <nav class="project-kind-tabs" aria-label="项目分类"><UButton v-for="item in kindItems" :key="item.value" color="neutral" variant="ghost" :aria-pressed="kindFilter===item.value" @click="emit('update-kind',item.value)">{{item.label}}</UButton><NuxtLink to="/dashboard-projects?view=trash">回收站</NuxtLink></nav>
    <!-- 本页仅消费父级当前页结果；不以 UI 筛选冒充全量检索或另发查询。 -->
    <div class="project-toolbar">
      <ProjectDirectoryToolbar v-model:keyword="searchKeyword" v-model:favorites="favoritesOnly" :status="statusFilter" :sort="sortMode" :compact-search="isBatchSelectingProjects" @filter="applyDirectoryFilter">
      <template #actions>
        <!-- 批量模式就地进入顶栏；操作菜单只改变选择或发起原删除确认。 -->
        <div v-if="isBatchSelectingProjects" class="project-batch-actions">
          <UButton icon="i-lucide-x" color="neutral" variant="soft" @click="emit('toggle-batch-mode')">取消批量管理</UButton>
          <UPopover :content="{side:'bottom',align:'end',sideOffset:8}" :ui="{content:'project-directory-filter-surface'}">
            <UButton icon="i-lucide-list-checks" color="neutral" variant="soft">批量管理</UButton>
            <template #content><div class="project-batch-menu">
              <p>已选 {{selectedProjectCount}} 项</p>
              <UButton color="neutral" variant="ghost" @click="emit('toggle-select-all')">{{isAllCurrentPageSelected?'取消全选':'全选'}}</UButton>
              <UButton class="project-delete-button" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="!selectedProjectCount||isDeletingProjects" :loading="isDeletingProjects" @click="emit('request-delete-batch')">删除{{selectedProjectCount?' '+selectedProjectCount:''}}</UButton>
            </div></template>
          </UPopover>
        </div>
      </template>
      <template #advanced>
      <div v-if="workspaceProjectCards.length" class="project-toolbar__actions">
        <UButton color="neutral" variant="ghost" :aria-pressed="kindFilter==='creation'" @click="emit('update-kind',kindFilter==='creation'?'all':'creation')">自由创作项目</UButton>
        <UButton v-if="!isBatchSelectingProjects" class="project-secondary-button" color="neutral" variant="outline" @click="emit('toggle-batch-mode')">批量管理</UButton>
        <div class="project-view-toggle" role="group" aria-label="项目视图切换">
          <UTooltip text="网格视图"><UButton icon="i-lucide-grid-2x2" square aria-label="网格视图" :aria-pressed="viewMode==='grid'" :color="viewMode==='grid'?'primary':'neutral'" :variant="viewMode==='grid'?'soft':'ghost'" @click="viewMode='grid'"/></UTooltip>
          <UTooltip text="列表视图"><UButton icon="i-lucide-list" square aria-label="列表视图" :aria-pressed="viewMode==='list'" :color="viewMode==='list'?'primary':'neutral'" :variant="viewMode==='list'?'soft':'ghost'" @click="viewMode='list'"/></UTooltip>
        </div>
      </div>
      </template></ProjectDirectoryToolbar>
    </div>
    </div>

    <div v-if="!workspaceProjectCards.length" class="project-empty-state">
      <UIcon name="i-lucide-inbox" aria-hidden="true"/><p>暂无项目</p>
      <UButton color="neutral" variant="link" @click="emit('create-project')">新建项目</UButton>
    </div>
    <div v-else-if="!visibleProjects.length" class="project-filter-empty">
      <UIcon name="i-lucide-inbox" aria-hidden="true"/><p>{{favoritesOnly?'本页暂无收藏项目':'本页没有匹配项目'}}</p>
      <UButton color="neutral" variant="link" @click="clearDirectoryFilters">清除筛选</UButton>
    </div>

    <div v-else-if="viewMode==='grid'" class="project-card-grid">
      <!-- 首位新建卡与项目同尺寸；只打开既有创建选择，不预建项目。 -->
      <div class="project-new-card"><UButton icon="i-lucide-plus" color="neutral" variant="soft" :loading="isCreatingWorkspaceProject" :disabled="isCreatingWorkspaceProject" @click="emit('create-project')">新建项目</UButton></div>
      <article v-for="project in visibleProjects" :key="project.id" class="project-card" :data-selected="isBatchSelectingProjects&&isProjectSelected(project.id)" :data-batch-selecting="isBatchSelectingProjects" role="button" tabindex="0" :aria-label="`打开项目：${project.title}`" @click="openProject(project)" @keydown.enter.self.prevent="openProject(project)" @keydown.space.self.prevent="openProject(project)">
        <div class="project-card__cover">
          <img v-if="hasProjectCover(project)" class="project-cover-image" :src="project.coverImageUrl" :alt="project.title" loading="lazy" @error="markCoverFailed(project)">
          <div v-else class="project-cover-fallback" aria-label="暂无项目封面"><span aria-hidden="true">Livliv</span></div>
          <UBadge v-if="project.kind==='drama'" class="project-status" :color="projectStatusTone(project)" variant="soft">{{projectStatusLabel(project)}}</UBadge>
          <div v-if="isBatchSelectingProjects" class="project-selection" @click.stop @keydown.stop><UCheckbox :model-value="isProjectSelected(project.id)" :aria-label="`选择项目：${project.title}`" @update:model-value="emit('toggle-project-selection',project.id)"/></div>
        </div>
        <div class="project-card__body">
          <h2 :title="project.title">{{project.title}}</h2><p :title="project.updatedAt||project.createdAt">{{formatProjectDate(project.updatedAt||project.createdAt)}}</p>
          <template v-if="project.kind==='drama'"><div class="project-progress-meta"><span :title="projectProgressLabel(project)">{{projectProgressLabel(project)}}</span><strong>{{projectProgress(project)}}%</strong></div><UProgress :model-value="projectProgress(project)" :color="projectStatusTone(project)" :aria-label="`${project.title} 项目进度`" size="xs"/></template>
          <!-- 整卡已进入最近对话／独立短剧；只给不同目的地保留快捷入口，不再重复一行继续文案。 -->
          <nav v-if="!isBatchSelectingProjects&&(project.sessions.length>1||(project.kind==='drama'&&project.sessions.length))" class="project-card-links" aria-label="项目快捷操作" @click.stop @keydown.stop><NuxtLink v-if="project.kind==='drama'" :to="`/drama/${encodeURIComponent(project.projectId)}?from=dashboard-projects`">进入短剧制作</NuxtLink><NuxtLink v-for="(item,index) in project.sessions.slice(1)" :key="item.id" :to="`/dashboard?session=${encodeURIComponent(item.id)}`" :title="item.title">对话 {{index+2}}</NuxtLink></nav>
        </div>
        <ProjectCardMenu v-if="!isBatchSelectingProjects" :project="project" @batch="emit('toggle-batch-mode')"/>
      </article>
    </div>

    <div v-else class="project-list-view">
      <article v-for="project in visibleProjects" :key="project.id" class="project-list-row" role="button" tabindex="0" :aria-label="`打开项目：${project.title}`" @click="openProject(project)" @keydown.enter.self.prevent="openProject(project)" @keydown.space.self.prevent="openProject(project)">
        <div class="project-list-row__cover">
          <img v-if="hasProjectCover(project)" class="project-cover-image" :src="project.coverImageUrl" :alt="project.title" loading="lazy" @error="markCoverFailed(project)">
          <div v-else class="project-cover-fallback" aria-label="暂无项目封面"><span aria-hidden="true">Livliv</span></div>
          <div v-if="isBatchSelectingProjects" class="project-selection" @click.stop @keydown.stop><UCheckbox :model-value="isProjectSelected(project.id)" :aria-label="`选择项目：${project.title}`" @update:model-value="emit('toggle-project-selection',project.id)"/></div>
        </div>
        <div class="project-list-row__main"><h2 :title="project.title">{{project.title}}</h2><p v-if="project.kind==='drama'">{{project.genre||project.style||'短剧项目'}}</p><nav v-if="!isBatchSelectingProjects&&(project.sessions.length>1||(project.kind==='drama'&&project.sessions.length))" class="project-card-links" aria-label="项目快捷操作" @click.stop @keydown.stop><NuxtLink v-if="project.kind==='drama'" :to="`/drama/${encodeURIComponent(project.projectId)}?from=dashboard-projects`">进入短剧制作</NuxtLink><NuxtLink v-for="(item,index) in project.sessions.slice(1)" :key="item.id" :to="`/dashboard?session=${encodeURIComponent(item.id)}`" :title="item.title">对话 {{index+2}}</NuxtLink></nav></div>
        <UBadge class="project-list-row__status" :color="projectStatusTone(project)" variant="soft">{{projectStatusLabel(project)}}</UBadge>
        <div class="project-list-row__progress"><template v-if="project.kind==='drama'"><div class="project-progress-meta"><span :title="projectProgressLabel(project)">{{projectProgressLabel(project)}}</span><strong>{{projectProgress(project)}}%</strong></div><UProgress :model-value="projectProgress(project)" :color="projectStatusTone(project)" :aria-label="`${project.title} 项目进度`" size="xs"/></template></div>
        <time>{{formatProjectDate(project.updatedAt||project.createdAt)}}</time>
        <UTooltip v-if="!isBatchSelectingProjects&&project.kind==='drama'" text="删除短剧制作"><UButton class="project-list-delete" icon="i-lucide-trash-2" color="neutral" variant="ghost" square :aria-label="`删除项目：${project.title}`" :disabled="isDeletingProjects" @click.stop="emit('request-delete-project',project)" @keydown.stop/></UTooltip>
      </article>
    </div>

    <footer v-if="totalProjectPages>1" class="project-pagination">
      <p>第 {{currentProjectPage}} / {{totalProjectPages}} 页</p>
      <nav aria-label="项目分页">
        <UTooltip text="上一页"><UButton icon="i-lucide-chevron-left" square color="neutral" variant="ghost" aria-label="上一页" :disabled="currentProjectPage===1" @click="emit('go-to-page',currentProjectPage-1)"/></UTooltip>
        <UButton v-for="pageNo in pageNumberList" :key="pageNo" :color="pageNo===currentProjectPage?'primary':'neutral'" :variant="pageNo===currentProjectPage?'solid':'ghost'" :aria-label="`第 ${pageNo} 页`" :aria-current="pageNo===currentProjectPage?'page':undefined" @click="emit('go-to-page',pageNo)">{{pageNo}}</UButton>
        <UTooltip text="下一页"><UButton icon="i-lucide-chevron-right" square color="neutral" variant="ghost" aria-label="下一页" :disabled="currentProjectPage===totalProjectPages" @click="emit('go-to-page',currentProjectPage+1)"/></UTooltip>
      </nav>
    </footer>
  </section>
</template>

<style scoped>
/* 页面只消费现有语义色与项目规格令牌，不再维护旧蓝色和 11px 正文。 */
.project-directory{container:project-directory / inline-size;width:100%;min-width:0;padding:0;box-sizing:border-box;color:var(--liv-project-text);font-family:"PingFang SC",sans-serif;font-size:14px}
.project-batch-actions{display:flex;align-items:center;gap:12px;flex:none;font-size:13px;color:var(--liv-project-muted)}.project-batch-actions :deep(button){display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;min-height:36px;padding:0 12px!important;border:0!important;border-radius:10px!important;background:var(--liv-project-control-bg)!important;color:var(--liv-project-text)!important;font-size:12px!important;font-weight:400;white-space:nowrap}.project-batch-actions :deep(button:hover){background:var(--liv-project-hover)!important}.project-batch-actions :deep(.iconify){width:16px;height:16px;color:inherit}
.project-batch-menu{display:grid;gap:4px;min-width:176px;padding:8px;border:1px solid var(--liv-project-control-border);border-radius:14px;background:var(--liv-project-control-bg);color:var(--liv-project-text)}.project-batch-menu p{margin:4px 10px;font-size:12px;color:var(--liv-project-muted)}.project-batch-menu button{height:36px;justify-content:flex-start;padding:0 10px;border-radius:8px;font-size:13px}.project-batch-menu button:hover{background:var(--liv-project-hover)!important}.project-batch-menu .project-delete-button{color:var(--color-state-danger)!important}
.project-card[data-selected=true]{border-color:var(--liv-ui-primary);box-shadow:0 0 0 1px var(--liv-ui-primary)}
/* 多选时增强未选卡片的中性描边，选中卡片仍保留主题紫色。 */
.project-card[data-batch-selecting=true][data-selected=false]{border-color:rgba(255,255,255,.24)}
.project-card[data-batch-selecting=true][data-selected=false]:hover,.project-card[data-batch-selecting=true][data-selected=false]:focus-visible{border-color:rgba(255,255,255,.38)}
.project-directory .project-selection{left:auto;right:12px;top:12px;padding:0;background:transparent}
/* 复用Nuxt复选框，仅覆盖本目录的视觉；未选白框、选中白底深勾，保留原键盘和事件。 */
.project-selection :deep([role=checkbox]){border-radius:5px;border:1px solid var(--liv-project-selection-color)!important;background:transparent!important;box-shadow:none!important}
.project-selection :deep([role=checkbox][data-state=checked]),.project-selection :deep([role=checkbox][data-state=indeterminate]){background:var(--liv-project-selection-color)!important;color:var(--liv-project-selection-check)!important}
.project-selection :deep([data-slot=indicator]),.project-selection :deep([data-slot=icon]){color:var(--liv-project-selection-check)!important}
/* Nuxt将选中底色画在indicator层，必须一起覆盖，避免白框里仍残留紫底深色勾。 */
.project-selection :deep([data-slot=indicator]){background:var(--liv-project-selection-color)!important}
.project-selection :deep([role=checkbox]:focus-visible){outline:2px solid var(--liv-project-selection-color);outline-offset:3px}
.project-directory-controls{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:34px;margin-bottom:22px}.project-kind-tabs{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.project-kind-tabs button,.project-kind-tabs a{height:36px;font-size:18px!important;font-weight:600;padding:0;color:var(--liv-project-muted);display:inline-flex;align-items:center;border-radius:0;background:transparent!important}.project-kind-tabs button[aria-pressed=true]{color:var(--liv-project-text);box-shadow:none}
.project-card-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:var(--liv-font-caption)}.project-card-links a{color:var(--liv-ui-primary-foreground);padding:4px 0}.project-card-links a:hover{text-decoration:underline}
.project-directory__header{display:flex;align-items:center;justify-content:space-between;gap:24px}
.project-directory__header h1{margin:0;font-size:24px;line-height:36px;font-weight:700}
.project-directory__header p{margin:4px 0 0;font-size:var(--liv-font-body);line-height:1.7;color:var(--color-text-muted)}
.project-create-button,.project-secondary-button,.project-delete-button{height:var(--liv-control-lg);flex:none;font-size:var(--liv-font-body);font-weight:500;white-space:nowrap;justify-content:center}
.project-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;margin-left:auto}.project-filter-popover{display:grid;gap:16px;padding:16px;width:260px;background:var(--color-panel)}.project-filter-popover label{display:grid;gap:8px;font-size:14px;color:var(--color-text-muted)}
.project-search{flex:0 1 var(--liv-project-search-width);width:var(--liv-project-search-width);min-width:180px;max-width:100%}
.project-search :deep(input){height:var(--liv-control-lg);font-size:var(--liv-font-body)}
/* 定宽作用于实际 USelect 触发器，不改通用下拉组件和别的页面。 */
.project-toolbar .project-select{height:var(--liv-control-lg);min-height:var(--liv-control-lg);flex:0 0 auto;max-width:100%;font-size:var(--liv-font-body);font-weight:400}
.project-toolbar .project-select--status{width:var(--liv-project-status-width)}
.project-toolbar .project-select--sort{width:var(--liv-project-sort-width)}
.project-toolbar__actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-left:auto;min-width:0}
.project-view-toggle{display:flex;align-items:center;gap:4px;flex:none;padding:0;border:1px solid var(--color-border-soft);border-radius:var(--liv-radius-lg)}
.project-view-toggle button{width:38px;height:38px;min-height:38px;padding:0}
.project-filter-note{font-size:var(--liv-font-caption);line-height:1.7;color:var(--color-text-muted);margin:8px 0 0}
/* 容器断点跟随实际内容宽度，侧栏展开不会挤坏按视口推算的列数。 */
.project-card-grid{margin-top:0}
.project-card{position:relative;min-width:0;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-project-card-surface);cursor:pointer}
.project-new-card{display:flex;align-items:center;justify-content:center;min-height:0;border:1px dashed var(--color-border-soft);border-radius:16px;background:var(--liv-project-cover-surface)}.project-directory .project-new-card button{border-radius:999px!important;padding:10px 16px;font-size:14px;background:var(--liv-project-placeholder-mark)!important;color:var(--liv-canvas-notice-text)!important}
.project-card:hover,.project-card:focus-visible{border-color:var(--liv-ui-primary-foreground)}
.project-card__cover{position:relative;flex:none;width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--liv-project-cover-surface)}
.project-card__cover :deep(.project-cover-image),.project-list-row__cover :deep(.project-cover-image){position:absolute;inset:0;width:100%;height:100%}
.project-cover-image{object-fit:cover}.project-cover-fallback{display:grid;place-content:center;width:100%;height:100%;background:var(--liv-project-cover-surface);color:var(--liv-project-placeholder-mark)}
.project-cover-fallback>span{font-size:28px;font-weight:800;letter-spacing:-1px;user-select:none}.project-list-row__cover .project-cover-fallback>span{font-size:16px}
.project-card__cover>.project-status{position:absolute;top:12px;right:12px;font-size:var(--liv-font-caption);font-weight:500;max-width:calc(100% - 24px)}
/* 批量状态与选择框各占一侧，给右侧16px选择框及间距预留空间，不隐藏真实制作状态。 */
.project-card[data-batch-selecting=true] .project-card__cover>.project-status{left:12px;right:auto;max-width:calc(100% - 52px)}
.project-card__body{padding:10px 12px;flex:1;min-width:0;min-height:64px;box-sizing:border-box}
.project-card__body h2,.project-list-row__main h2{font-size:14px;font-weight:500;line-height:1.5;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:0}
.project-card__body>p,.project-list-row__main>p,.project-list-row time{font-size:var(--liv-font-caption);line-height:1.7;color:var(--color-text-muted);margin:4px 0 0}
.project-card__body>p{padding-right:28px;font-size:12px}.project-card__body h2{font-weight:400}
.project-progress-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:var(--liv-font-caption);line-height:1.7;margin:8px 0 4px;color:var(--color-text-muted)}
.project-progress-meta>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.project-progress-meta strong{flex:none;font-size:inherit;font-weight:500;color:var(--liv-ui-primary-foreground)}
.project-selection{position:absolute;top:12px;left:12px;padding:4px;border-radius:var(--liv-radius-sm);background:var(--color-surface-raised);z-index:1}
.project-selection :deep([role=checkbox]){width:16px;height:16px;min-height:16px;padding:0}
.project-card .project-card-delete{position:absolute;right:12px;bottom:12px;width:32px;height:32px;padding:0;opacity:0;background:var(--color-surface-raised)}
.project-card:hover .project-card-delete,.project-card:focus-within .project-card-delete{opacity:1}
.project-list-view{display:grid;gap:12px;margin-top:16px}
.project-list-row{display:grid;grid-template-columns:80px minmax(0,1fr) auto 36px;align-items:center;gap:16px;min-width:0;padding:12px;border:1px solid var(--color-border-soft);border-radius:var(--radius-lg);background:var(--color-panel);cursor:pointer}
.project-list-row__cover{position:relative;height:56px;overflow:hidden;border-radius:var(--liv-radius-lg)}
.project-list-row__main{min-width:0}
.project-list-row__status{font-size:var(--liv-font-caption);justify-self:start;white-space:nowrap}
.project-list-row__progress{grid-column:2/-1;min-width:0}
.project-list-row__progress .project-progress-meta{margin:0 0 8px}
.project-list-row time{grid-column:2/-1}
.project-list-delete{width:36px;height:36px;padding:0;grid-column:4;grid-row:1}
.project-pagination{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border-soft);font-size:var(--liv-font-caption);color:var(--color-text-muted)}
.project-pagination p{margin:0}.project-pagination nav{display:flex;flex-wrap:wrap;gap:4px}.project-pagination button{min-width:36px;height:36px;justify-content:center}
.project-pagination button[aria-current=page]{background:var(--liv-ui-primary)!important;color:var(--liv-control-on-primary)!important}
/* 空态直接位于页面，不再使用大面板、品牌色图标或粗体大标题。 */
.project-empty-state,.project-filter-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;min-height:400px;padding:32px 16px;text-align:center;margin:0;border:0;background:transparent}
.project-empty-state>.iconify,.project-filter-empty>.iconify{width:48px;height:48px;color:var(--liv-project-muted);opacity:.65}
.project-empty-state p,.project-filter-empty p{font-size:15px;font-weight:400;line-height:24px;margin:0;color:var(--liv-project-muted)}
.project-empty-state>button,.project-filter-empty>button{padding:0!important;min-height:24px;background:transparent!important;border:0!important;box-shadow:none!important;color:var(--liv-project-muted)!important;font-size:13px}
.project-directory [tabindex]:focus-visible,.project-directory a:focus-visible{outline:2px solid var(--liv-ui-primary-foreground);outline-offset:3px}
@container project-directory (min-width:1000px){.project-list-row{grid-template-columns:96px minmax(140px,1fr) auto minmax(140px,200px) 140px 36px}.project-list-row__progress,.project-list-row time{grid-column:auto}.project-list-delete{grid-column:6}.project-list-row__cover{height:64px}}
@container project-directory (max-width:900px){.project-toolbar__actions{flex:0 0 100%;margin-left:0}}
@container project-directory (max-width:544px){.project-directory__header{align-items:flex-start;flex-direction:column;gap:16px}.project-create-button{width:100%}.project-search{width:100%;flex:0 0 100%;min-width:0}.project-toolbar .project-select--status{width:calc((100% - 12px)*.42)}.project-toolbar .project-select--sort{width:calc((100% - 12px)*.58)}.project-list-row{gap:12px;grid-template-columns:64px minmax(0,1fr) 36px}.project-list-row__status{grid-column:2;grid-row:2}.project-list-row__progress{grid-column:2/-1}.project-list-row time{grid-column:2/-1}.project-list-delete{grid-column:3}.project-list-row__cover{grid-row:1/3}.project-card .project-card-delete{opacity:1}}
@media(hover:none){.project-card .project-card-delete{opacity:1}}
@media(prefers-reduced-motion:reduce){.project-directory *{scroll-behavior:auto!important}}
/* 工具区始终保持搜索在最右；窄屏换整行，不压扁控件。 */
.project-toolbar__actions{margin:18px 0 0;gap:8px}.project-toolbar__actions>button{height:32px;font-size:12px}.project-directory-controls>.project-toolbar{flex:none}.project-filter-note{margin:0 0 12px}
@container project-directory (max-width:700px){.project-directory-controls>.project-toolbar{width:100%}.project-directory-controls{gap:16px}.project-toolbar :deep(.project-directory-toolbar){width:100%}}
@media(max-width:767px){.project-directory{padding:0}.project-directory-controls{margin-top:24px}.project-card-grid{gap:12px}}
</style>
<style src="~/assets/css/project-directory-grid.css"></style>
