<script setup lang="ts">
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

function isProjectSelected(projectId: string): boolean {
  return props.selectedProjectIds.includes(projectId)
}

function projectStatusLabel(status: string): string {
  if (status === 'published') return '已发布'
  if (status === 'generating') return '生成中'
  if (status === 'analyzing') return '解析中'
  return '草稿'
}

function formatProjectDate(value?: string): string {
  if (!value) return '最近更新'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16).replace('T', ' ')

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(parsed)
}
</script>

<template>
  <div class="space-y-6">
    <section class="w-full">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-[28px] font-bold tracking-tight text-textMain">项目列表</h2>
          <p class="mt-2 text-[15px] text-textMuted">{{ projectOverviewLabel }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            class="rounded-full bg-panel px-5 py-2.5 text-[14px] font-semibold text-textMain shadow-sm ring-1 ring-borderSoft transition hover:bg-panelSoft hover:text-neon"
            @click="emit('toggle-batch-mode')"
          >
            {{ isBatchSelectingProjects ? '取消批量操作' : '批量操作' }}
          </button>
          <button
            v-if="isBatchSelectingProjects"
            class="rounded-full bg-panel px-5 py-2.5 text-[14px] font-semibold text-textMain shadow-sm ring-1 ring-borderSoft transition hover:bg-panelSoft hover:text-neon"
            @click="emit('toggle-select-all')"
          >
            {{ isAllCurrentPageSelected ? '取消全选' : '全选当前页' }}
          </button>
          <button
            v-if="isBatchSelectingProjects"
            class="rounded-full bg-red-500/90 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-500/50 disabled:text-white/70 disabled:shadow-none"
            :disabled="selectedProjectCount === 0 || isDeletingProjects"
            @click="emit('request-delete-batch')"
          >
            批量删除<span v-if="selectedProjectCount > 0">（{{ selectedProjectCount }}）</span>
          </button>
          <button
            class="flex items-center gap-2 rounded-full bg-neon px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isCreatingWorkspaceProject"
            @click="emit('create-project')"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14m-7-7h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ isCreatingWorkspaceProject ? '创建中...' : '新建项目' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
        <button
          class="group flex h-[280px] flex-col items-center justify-center overflow-hidden rounded-[24px] bg-panelSoft ring-1 ring-borderSoft transition-all hover:bg-neonSoft/10 hover:ring-neon/30 hover:shadow-neon"
          type="button"
          :disabled="isCreatingWorkspaceProject"
          @click="emit('create-project')"
        >
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-panel shadow-sm ring-1 ring-borderSoft transition-transform group-hover:scale-110 group-hover:text-neon">
            <svg viewBox="0 0 24 24" class="h-8 w-8 text-textMuted group-hover:text-neon" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <h4 class="text-[16px] font-bold text-textMain">创建新项目</h4>
          <p class="mt-2 text-[13px] text-textMuted">进入创作工作流界面</p>
        </button>

        <div
          v-for="project in workspaceProjectCards"
          :key="project.id"
          class="group relative h-[280px] overflow-hidden rounded-[24px] bg-panel ring-1 ring-borderSoft transition-all hover:-translate-y-1 hover:shadow-panel hover:ring-neon/30"
          role="button"
          tabindex="0"
          @click="emit('open-project', project.id)"
          @keydown.enter.prevent="emit('open-project', project.id)"
          @keydown.space.prevent="emit('open-project', project.id)"
        >
          <button
            v-if="isBatchSelectingProjects"
            class="absolute left-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-borderSoft bg-panel shadow-sm transition"
            :class="isProjectSelected(project.id)
              ? 'border-neon bg-neon text-slate-900 shadow-[0_10px_24px_rgba(69,215,255,0.28)]'
              : 'text-transparent hover:border-neon'"
            type="button"
            @click.stop="emit('toggle-project-selection', project.id)"
          >
            <svg viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.26a1 1 0 0 1-1.42 0l-3.8-3.83a1 1 0 1 1 1.42-1.408l3.09 3.116 6.49-6.544a1 1 0 0 1 1.414-.008Z" clip-rule="evenodd" />
            </svg>
          </button>
          <button
            v-else
            class="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-panelSoft/90 text-textMuted opacity-0 shadow-sm ring-1 ring-borderSoft backdrop-blur transition hover:bg-rose-500/20 hover:text-rose-400 hover:ring-rose-500/40 group-hover:opacity-100"
            type="button"
            @click.stop="emit('request-delete-project', project)"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7h16M10 11v6M14 11v6M7 7l1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div class="relative h-[160px] w-full overflow-hidden bg-panelSoft">
            <UiFluidImage
              :src="project.coverImageUrl"
              :alt="project.title"
              wrapper-class="h-full w-full"
              img-class="object-cover transition-transform duration-500 group-hover:scale-105"
              fallback-text=""
              loading-label=""
            />
            <div class="absolute inset-0 bg-gradient-to-t from-bg/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          </div>

          <div class="flex h-[120px] flex-col justify-between p-5">
            <div>
              <div class="flex items-center justify-between gap-3">
                <h4 class="min-w-0 flex-1 truncate text-[16px] font-bold text-textMain">{{ project.title }}</h4>
                <span class="flex h-5 items-center rounded-md bg-neonSoft/20 px-2 text-[11px] font-semibold text-neon ring-1 ring-neon/20">
                  {{ projectStatusLabel(project.status) }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span class="rounded-md bg-panelSoft px-2 py-0.5 text-[11px] font-medium text-textMuted">
                  {{ project.genre || '短剧' }}
                </span>
                <span
                  v-for="tag in project.tags.slice(0, 2)"
                  :key="`${project.id}-${tag}`"
                  class="rounded-md bg-panelSoft/50 px-2 py-0.5 text-[11px] font-medium text-textMuted ring-1 ring-borderSoft"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <p class="text-[12px] font-medium text-textMuted/70">{{ formatProjectDate(project.createdAt) }}</p>
          </div>
        </div>
      </div>

      <div v-if="workspaceProjectCards.length === 0" class="mt-8 flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-borderSoft bg-panelSoft/50 py-20 text-center">
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-panel shadow-sm ring-1 ring-borderSoft">
          <svg viewBox="0 0 24 24" class="h-8 w-8 text-textMuted/50" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h3 class="text-[18px] font-bold text-textMain">还没有项目</h3>
        <p class="mt-2 text-[14px] text-textMuted">点击上方按钮创建你的第一个短剧项目吧</p>
      </div>

      <div
        v-if="totalProjectPages > 1"
        class="mt-10 flex items-center justify-between border-t border-borderSoft pt-6"
      >
        <p class="text-[14px] font-medium text-textMuted">
          第 {{ currentProjectPage }} / {{ totalProjectPages }} 页
        </p>

        <div class="flex items-center gap-2">
          <button
            class="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-textMuted shadow-sm ring-1 ring-borderSoft transition hover:bg-panelSoft hover:text-textMain disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentProjectPage === 1"
            @click="emit('go-to-page', currentProjectPage - 1)"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <div class="flex items-center gap-1 px-2">
            <button
              v-for="pageNo in pageNumberList"
              :key="`project-page-${pageNo}`"
              class="flex h-9 min-w-9 items-center justify-center rounded-lg text-[14px] font-semibold transition"
              :class="pageNo === currentProjectPage
                ? 'bg-textMain text-bg'
                : 'text-textMuted hover:bg-panelSoft hover:text-textMain'"
              @click="emit('go-to-page', pageNo)"
            >
              {{ pageNo }}
            </button>
          </div>

          <button
            class="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-textMuted shadow-sm ring-1 ring-borderSoft transition hover:bg-panelSoft hover:text-textMain disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentProjectPage === totalProjectPages"
            @click="emit('go-to-page', currentProjectPage + 1)"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
