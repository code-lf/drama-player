<script setup lang="ts">
import { useLandingProjects } from '~/composables/queries/useLandingProjects'
import { projectService } from '~/shared/api/services/projectService'

type ProjectPageOption = {
  label: string
  value: string
  description?: string
}

const category = ref('全部')
const createCategory = ref('AI漫剧')
const createTitle = ref('')
const createErrorMessage = ref('')
const isCreating = ref(false)

const router = useRouter()
const { data: projects, isLoading, refetch } = useLandingProjects(category)

const categoryOptions = computed<ProjectPageOption[]>(() => {
  // 这里先沉淀一套稳定的项目分类选项，避免页面初次加载时因接口数据为空导致筛选器无内容。
  return [
    { label: '全部项目', value: '全部', description: '查看当前账号下的全部项目' },
    { label: 'AI漫剧', value: 'AI漫剧', description: '适合分镜、角色与剧情工作流' },
    { label: 'AI短剧', value: 'AI短剧', description: '适合快节奏短剧内容创作' },
    { label: '商品营销', value: '商品营销', description: '适合商品图、广告素材与种草视频' }
  ]
})

const createCategoryOptions = computed<ProjectPageOption[]>(() => {
  return categoryOptions.value.filter((option) => option.value !== '全部')
})

const totalProjectLabel = computed(() => {
  const count = projects.value?.length || 0
  return count === 0 ? '当前还没有项目' : `当前共 ${count} 个项目`
})

function formatDate(value: string): string {
  return value.slice(0, 10)
}

function resolveStatusLabel(status: string): string {
  if (status === 'published') return '已发布'
  if (status === 'generating') return '生成中'
  return '草稿中'
}

function openDashboard(): void {
  router.push('/dashboard')
}

async function createProjectAndOpen(): Promise<void> {
  isCreating.value = true
  createErrorMessage.value = ''

  try {
    // 创建入口默认直达画布，保证“项目中心 -> 新建 -> 开始编辑”的路径足够顺手。
    const project = await projectService.createProject({
      title: createTitle.value.trim() || '未命名项目',
      category: createCategory.value
    })

    createTitle.value = ''
    await refetch()
    await router.push(`/studio?projectId=${encodeURIComponent(project.id)}`)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 项目中心创建项目失败', error)
    createErrorMessage.value = error instanceof Error ? error.message : '创建项目失败，请稍后重试'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-app text-textMain">
    <section class="mx-auto w-full max-w-[1480px] px-6 py-12 lg:px-10">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 text-sm text-textMuted">
            <NuxtLink to="/dashboard" class="transition hover:text-neon">控制台</NuxtLink>
            <span>/</span>
            <span>我的项目</span>
          </div>
          <h1 class="mt-3 text-4xl font-semibold">项目列表</h1>
          <p class="mt-2 text-sm text-textMuted">在这里统一查看、筛选和创建项目，后续我们也可以把更多项目设置入口集中到这一页。</p>
        </div>

        <button
          class="rounded-full border border-borderSoft bg-panelSoft px-5 py-3 text-sm font-semibold transition hover:border-neon/55 hover:text-neon"
          type="button"
          @click="openDashboard"
        >
          返回创作控制台
        </button>
      </div>

      <div class="grid gap-6 xl:grid-cols-[440px_1fr]">
        <section class="rounded-[30px] border border-borderSoft bg-panel p-6 shadow-panel">
          <p class="text-[11px] uppercase tracking-[0.32em] text-textMuted">Create Project</p>
          <h2 class="mt-4 text-2xl font-semibold">创建新项目</h2>
          <p class="mt-3 text-sm leading-7 text-textMuted">
            这里不再使用原生下拉和裸输入框，后续新增表单组件也建议继续复用 `shared/ui` 里的统一组件。
          </p>

          <div class="mt-6 space-y-4">
            <UiBaseInput
              v-model="createTitle"
              label="项目名称"
              placeholder="例如：赛博都市爱情短剧"
              tone="panel"
              full
            />
            <UiBaseSelect
              v-model="createCategory"
              label="项目分类"
              :options="createCategoryOptions"
              placeholder="选择项目分类"
              tone="panel"
              full
            />
          </div>

          <div v-if="createErrorMessage" class="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {{ createErrorMessage }}
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              class="min-w-[180px] rounded-full bg-gradient-to-r from-[#8dc2ff] to-[#8b7dff] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              :disabled="isCreating"
              @click="createProjectAndOpen"
            >
              {{ isCreating ? '创建中...' : '创建并进入画布' }}
            </button>
            <button
              class="rounded-full border border-borderSoft bg-panelSoft px-5 py-3 text-sm font-semibold transition hover:border-neon/55 hover:text-neon"
              type="button"
              @click="openDashboard"
            >
              去短剧控制台
            </button>
          </div>
        </section>

        <section class="rounded-[30px] border border-borderSoft bg-panel p-6 shadow-panel">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-[11px] uppercase tracking-[0.32em] text-textMuted">My Workspace</p>
              <h2 class="mt-4 text-2xl font-semibold">项目概览</h2>
              <p class="mt-2 text-sm text-textMuted">{{ totalProjectLabel }}</p>
            </div>

            <div class="min-w-[240px]">
              <UiBaseSelect
                v-model="category"
                label="筛选分类"
                :options="categoryOptions"
                placeholder="选择分类"
                tone="panel"
                full
              />
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article class="rounded-3xl border border-borderSoft bg-panelSoft/75 p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-textMuted">当前筛选</p>
              <p class="mt-3 text-xl font-semibold">{{ category === '全部' ? '全部项目' : category }}</p>
            </article>
            <article class="rounded-3xl border border-borderSoft bg-panelSoft/75 p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-textMuted">创作建议</p>
              <p class="mt-3 text-sm leading-7 text-textMuted">先在这里建项目，再进入画布编辑，比把项目入口塞在侧边栏里更清晰。</p>
            </article>
            <article class="rounded-3xl border border-borderSoft bg-panelSoft/75 p-5">
              <p class="text-xs uppercase tracking-[0.24em] text-textMuted">组件约束</p>
              <p class="mt-3 text-sm leading-7 text-textMuted">后续表单建议继续使用统一 UI 组件，不再直接铺原生 select。</p>
            </article>
          </div>
        </section>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <template v-if="!isLoading">
          <NuxtLink
            v-for="project in projects ?? []"
            :key="project.id"
            :to="`/studio?projectId=${encodeURIComponent(project.id)}`"
            class="group overflow-hidden rounded-[28px] border border-borderSoft bg-panel transition-all duration-200 hover:-translate-y-1 hover:border-neon/55 hover:shadow-[0_28px_60px_rgba(69,215,255,0.12)]"
          >
            <div class="relative h-[220px] w-full overflow-hidden" :style="{ background: project.coverUrl }">
              <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <div class="absolute left-4 top-4 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs text-white/85 backdrop-blur-sm">
                {{ project.category }}
              </div>
              <div class="absolute right-4 top-4 rounded-full border border-neon/25 bg-neon/10 px-3 py-1 text-xs text-neon">
                {{ resolveStatusLabel(project.status) }}
              </div>
            </div>

            <div class="p-5">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="line-clamp-1 text-xl font-semibold">{{ project.title }}</h3>
                  <p class="mt-2 text-sm text-textMuted">更新于 {{ formatDate(project.updatedAt) }}</p>
                </div>
                <span class="rounded-full border border-borderSoft bg-white/5 px-3 py-1 text-xs text-textMuted transition group-hover:border-neon/35 group-hover:text-neon">
                  进入
                </span>
              </div>
            </div>
          </NuxtLink>

          <article
            v-if="(projects ?? []).length === 0"
            class="col-span-full rounded-[28px] border border-dashed border-borderSoft bg-panelSoft/55 px-6 py-14 text-center"
          >
            <p class="text-lg font-semibold">还没有符合条件的项目</p>
            <p class="mt-2 text-sm text-textMuted">你可以直接在上面的创建卡片里新建一个项目。</p>
          </article>
        </template>

        <template v-else>
          <div v-for="idx in 6" :key="idx" class="h-[320px] animate-pulse rounded-[28px] bg-panelSoft" />
        </template>
      </div>
    </section>
  </main>
</template>
