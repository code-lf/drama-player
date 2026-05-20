<script setup lang="ts">
import { useCanvasStore } from '~/features/canvas/store/useCanvasStore'
import { useStoryboardStudioStore } from '~/features/storyboard/store/useStoryboardStudioStore'
import { aspectRatioPresets, cameraPresets, modelPresets, resolutionPresets, stylePresets } from '~/shared/constants/storyboard-presets'

const canvasStore = useCanvasStore()
const storyboardStore = useStoryboardStudioStore()

const selectedNode = computed(() => canvasStore.nodes.find((node) => node.id === canvasStore.selectedNodeId))
const isScriptNode = computed(() => selectedNode.value?.type === 'script')
const isGeneratedScriptNode = computed(() => Boolean(isScriptNode.value && selectedNode.value?.nodeConfig.scriptGenerated))
const isTextNode = computed(() => selectedNode.value?.type === 'text')
const selectedDisplayCount = computed(() => storyboardStore.selectedShotCount)
const totalDisplayCount = computed(() => storyboardStore.totalShotCount || storyboardStore.selectedShotCount || 10)
const panelWidthClass = computed(() => (isScriptNode.value ? 'w-[860px]' : 'w-[560px]'))
const showPanelHeader = computed(() => Boolean(isScriptNode.value))

const promptDraft = ref('')
const showStyleLibrary = ref(false)
const showModelPanel = ref(false)
const showResolutionPanel = ref(false)
const showCameraPanel = ref(false)

watch(
  selectedNode,
  (node) => {
    promptDraft.value = node?.nodeConfig.prompt ?? ''
  },
  { immediate: true }
)

const linkedVideoNodes = computed(() => {
  if (!selectedNode.value) return []

  const relatedNodeIds = canvasStore.edges
    .filter((edge) => edge.source === selectedNode.value?.id || edge.target === selectedNode.value?.id)
    .map((edge) => (edge.source === selectedNode.value?.id ? edge.target : edge.source))

  return canvasStore.nodes.filter((node) => relatedNodeIds.includes(node.id) && node.type === 'video')
})

const linkedRoleNodes = computed(() => {
  if (!selectedNode.value) return []

  const relatedNodeIds = canvasStore.edges
    .filter((edge) => edge.source === selectedNode.value?.id || edge.target === selectedNode.value?.id)
    .map((edge) => (edge.source === selectedNode.value?.id ? edge.target : edge.source))

  return canvasStore.nodes.filter((node) => relatedNodeIds.includes(node.id) && node.type === 'image')
})

function removeReferenceNode(referenceNodeId: string): void {
  if (!selectedNode.value) return

  const targetEdges = canvasStore.edges.filter(
    (edge) =>
      (edge.source === selectedNode.value?.id && edge.target === referenceNodeId) ||
      (edge.target === selectedNode.value?.id && edge.source === referenceNodeId)
  )

  targetEdges.forEach((edge) => {
    canvasStore.removeEdgeById(edge.id)
  })
}

function savePrompt(): void {
  if (!selectedNode.value) return

  canvasStore.updateNodePrompt(selectedNode.value.id, promptDraft.value)
}

function regenerateScript(): void {
  if (!selectedNode.value) return

  storyboardStore.switchWorkMode('rewrite')
  storyboardStore.setRewritePrompt(promptDraft.value)
  canvasStore.updateNodePrompt(selectedNode.value.id, promptDraft.value)

  const generatedTitle = promptDraft.value.trim().split('\n')[0] || '我在盛唐写天下'
  canvasStore.updateNodeTitle(selectedNode.value.id, generatedTitle.slice(0, 18))
  canvasStore.setScriptGenerated(selectedNode.value.id, true)

  // eslint-disable-next-line no-console
  console.info('[livliv] 重新生成脚本（前端占位）', {
    prompt: storyboardStore.rewritePrompt,
    model: storyboardStore.modelName
  })
}

function submitStoryboardGenerate(): void {
  if (!selectedNode.value) return

  storyboardStore.markStoryboardGenerated()
  canvasStore.setScriptGenerated(selectedNode.value.id, true)

  // eslint-disable-next-line no-console
  console.info('[livliv] 生成分镜（前端占位）', {
    style: storyboardStore.styleName,
    model: storyboardStore.modelName,
    resolution: storyboardStore.resolution,
    camera: storyboardStore.cameraPreset,
    selectedShots: storyboardStore.selectedShotCount
  })
}

function submitScriptMethod(): void {
  if (!selectedNode.value) return

  canvasStore.updateNodePrompt(selectedNode.value.id, promptDraft.value)
  canvasStore.setScriptGenerated(selectedNode.value.id, true)
  const generatedTitle = promptDraft.value.trim().split('\n')[0] || '我在盛唐写天下'
  canvasStore.updateNodeTitle(selectedNode.value.id, generatedTitle.slice(0, 18))

  // eslint-disable-next-line no-console
  console.info('[livliv] 脚本节点分镜脚本生成（前端占位）', {
    mode: storyboardStore.scriptInputMode,
    prompt: promptDraft.value,
    linkedVideos: linkedVideoNodes.value.map((node) => node.id),
    linkedRoles: linkedRoleNodes.value.map((node) => node.id)
  })
}

function applyStyle(style: string): void {
  storyboardStore.setStyleName(style)
  showStyleLibrary.value = false
}

function applyModel(model: string): void {
  storyboardStore.setModelName(model)
  showModelPanel.value = false
}

function applyResolution(resolution: string, ratio: string): void {
  storyboardStore.setResolution(`${ratio} · ${resolution}`)
  showResolutionPanel.value = false
}

function applyCameraPreset(preset: string): void {
  storyboardStore.setCameraPreset(preset)
  showCameraPanel.value = false
}

function switchScriptInputMode(mode: 'plot' | 'videoRef' | 'roleRef'): void {
  storyboardStore.switchScriptInputMode(mode)
}

const nonScriptPlaceholder = computed(() => {
  if (isTextNode.value) {
    return '写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。'
  }

  return '根据当前节点输入配置内容'
})
</script>

<template>
  <section
    v-if="selectedNode"
    class="node-config-panel-root panel-glass nodrag nopan nowheel pointer-events-auto rounded-2xl p-4"
    :class="panelWidthClass"
    @pointerdown.stop
    @click.stop
  >
    <div v-if="showPanelHeader" class="mb-2 flex items-center gap-3">
      <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm">{{ selectedNode.nodeMeta.icon }}</span>
      <div>
        <p class="text-sm font-semibold">{{ selectedNode.nodeConfig.title }}</p>
        <p class="text-xs text-textMuted">{{ selectedNode.nodeMeta.description }}</p>
      </div>
    </div>

    <template v-if="isScriptNode && !isGeneratedScriptNode">
      <div class="mb-3 flex items-center gap-2">
        <button
          class="rounded-full border px-4 py-1.5 text-sm transition"
          :class="storyboardStore.scriptInputMode === 'plot' ? 'border-neon bg-neon/10 text-neon' : 'border-borderSoft text-textMuted'"
          @click="switchScriptInputMode('plot')"
        >
          剧本生成分镜脚本
        </button>
        <button
          class="rounded-full border px-4 py-1.5 text-sm transition"
          :class="storyboardStore.scriptInputMode === 'videoRef' ? 'border-neon bg-neon/10 text-neon' : 'border-borderSoft text-textMuted'"
          @click="switchScriptInputMode('videoRef')"
        >
          视频参考生成分镜脚本
        </button>
        <button
          class="rounded-full border px-4 py-1.5 text-sm transition"
          :class="storyboardStore.scriptInputMode === 'roleRef' ? 'border-neon bg-neon/10 text-neon' : 'border-borderSoft text-textMuted'"
          @click="switchScriptInputMode('roleRef')"
        >
          角色生成分镜脚本
        </button>
      </div>

      <div v-if="storyboardStore.scriptInputMode === 'plot'">
        <textarea
          v-model="promptDraft"
          class="h-40 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm outline-none focus:border-neon"
          placeholder="描述剧情主线、世界观与主要角色，生成分镜脚本"
        />
      </div>

      <div v-else-if="storyboardStore.scriptInputMode === 'videoRef'">
        <div class="mb-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-borderSoft bg-panelSoft/70 px-2 py-2">
          <template v-if="linkedVideoNodes.length > 0">
            <div v-for="node in linkedVideoNodes" :key="node.id" class="relative rounded-lg border border-white/20 bg-black/20 px-2 py-1 text-xs">
              <span>{{ node.nodeConfig.title }}</span>
              <button class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-black text-[10px]" @click="removeReferenceNode(node.id)">×</button>
            </div>
          </template>
          <p v-else class="text-xs text-textMuted">请先连接视频节点作为参考素材</p>
        </div>

        <textarea
          v-model="promptDraft"
          class="h-40 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm outline-none focus:border-neon"
          placeholder="描述剧情或补充视频参考，生成分镜脚本"
        />
      </div>

      <div v-else>
        <div class="mb-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-borderSoft bg-panelSoft/70 px-2 py-2">
          <template v-if="linkedRoleNodes.length > 0">
            <div v-for="node in linkedRoleNodes" :key="node.id" class="relative rounded-lg border border-white/20 bg-black/20 px-2 py-1 text-xs">
              <span>{{ node.nodeConfig.title }}</span>
              <button class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-black text-[10px]" @click="removeReferenceNode(node.id)">×</button>
            </div>
          </template>
          <p v-else class="text-xs text-textMuted">请先连接角色/图片节点作为角色参考</p>
        </div>

        <textarea
          v-model="promptDraft"
          class="h-40 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm outline-none focus:border-neon"
          placeholder="补充角色设定与剧情方向，生成分镜脚本"
        />
      </div>

      <div class="mt-2 flex items-center justify-between text-xs text-textMuted">
        <button class="rounded-lg border border-borderSoft px-3 py-1.5 transition hover:border-neon" @click="showModelPanel = true">
          模型：{{ storyboardStore.modelName }}
        </button>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-full bg-neon text-xl font-bold text-slate-950"
          title="提交"
          @click="submitScriptMethod"
        >
          ↑
        </button>
      </div>
    </template>

    <template v-else-if="isScriptNode">
      <template v-if="storyboardStore.scriptWorkMode === 'rewrite'">
        <textarea
          v-model="promptDraft"
          class="h-36 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm outline-none focus:border-neon"
          placeholder="输入补充需求，基于当前脚本重新生成"
        />

        <div class="mt-2 flex items-center justify-between text-xs text-textMuted">
          <button class="rounded-lg border border-borderSoft px-3 py-1.5 transition hover:border-neon" @click="showModelPanel = true">
            模型：{{ storyboardStore.modelName }}
          </button>
          <button
            class="flex h-11 w-11 items-center justify-center rounded-full bg-neon text-xl font-bold text-slate-950"
            title="提交重生"
            @click="regenerateScript"
          >
            ↑
          </button>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-5 gap-2 text-xs">
          <button class="rounded-lg border border-borderSoft bg-panelSoft px-2 py-2 text-left" @click="showStyleLibrary = true">
            <p class="text-textMuted">风格</p>
            <p class="mt-1 truncate text-sm">{{ storyboardStore.styleName }}</p>
          </button>
          <button class="rounded-lg border border-borderSoft bg-panelSoft px-2 py-2 text-left" @click="showModelPanel = true">
            <p class="text-textMuted">模型</p>
            <p class="mt-1 truncate text-sm">{{ storyboardStore.modelName }}</p>
          </button>
          <button class="rounded-lg border border-borderSoft bg-panelSoft px-2 py-2 text-left" @click="showResolutionPanel = true">
            <p class="text-textMuted">分辨率</p>
            <p class="mt-1 truncate text-sm">{{ storyboardStore.resolution }}</p>
          </button>
          <button class="rounded-lg border border-borderSoft bg-panelSoft px-2 py-2 text-left" @click="showCameraPanel = true">
            <p class="text-textMuted">摄像机</p>
            <p class="mt-1 truncate text-sm">{{ storyboardStore.cameraPreset }}</p>
          </button>
          <div class="rounded-lg border border-borderSoft bg-panelSoft px-2 py-2 text-left">
            <p class="text-textMuted">已选脚本</p>
            <p class="mt-1 truncate text-sm">{{ selectedDisplayCount }}/{{ totalDisplayCount }}</p>
          </div>
        </div>

        <div class="mt-2 flex items-center justify-between text-xs text-textMuted">
          <span>生成将按镜头卡片输出，可继续批量生成视频。</span>
          <button
            class="flex h-11 w-11 items-center justify-center rounded-full bg-neon text-xl font-bold text-slate-950"
            title="开始生成"
            @click="submitStoryboardGenerate"
          >
            ↑
          </button>
        </div>
      </template>
    </template>

    <template v-else>
      <textarea
        v-model="promptDraft"
        class="h-36 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm outline-none focus:border-neon"
        :placeholder="nonScriptPlaceholder"
      />

      <div class="mt-2 flex items-center justify-between text-xs text-textMuted">
        <span>模型：{{ selectedNode.nodeConfig.model || 'Qwen-Plus' }}</span>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-full bg-neon text-xl font-bold text-slate-950"
          title="保存配置"
          @click="savePrompt"
        >
          ↑
        </button>
      </div>
    </template>
  </section>

  <div v-if="showStyleLibrary" class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" @click.self="showStyleLibrary = false">
    <section class="panel-glass h-[82vh] w-[92vw] rounded-2xl p-4">
      <header class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button class="rounded-md bg-white/10 px-3 py-1.5 text-sm">广场</button>
          <button class="rounded-md px-3 py-1.5 text-sm text-textMuted">我的收藏</button>
          <button class="rounded-md px-3 py-1.5 text-sm text-textMuted">最近使用</button>
        </div>
        <button class="rounded-md px-2 py-1 text-lg text-textMuted" @click="showStyleLibrary = false">×</button>
      </header>

      <div class="grid grid-cols-3 gap-3 md:grid-cols-5 xl:grid-cols-8">
        <button
          v-for="style in stylePresets"
          :key="style.id"
          class="overflow-hidden rounded-xl border border-borderSoft bg-panelSoft text-left transition hover:border-neon"
          @click="applyStyle(style.name)"
        >
          <div class="h-36" :style="{ background: style.preview }" />
          <div class="p-2">
            <p class="line-clamp-1 text-sm font-semibold">{{ style.name }}</p>
            <p class="mt-1 text-xs text-textMuted">{{ style.author }} · {{ style.heat }}</p>
          </div>
        </button>
      </div>
    </section>
  </div>

  <div v-if="showModelPanel" class="fixed inset-0 z-40" @click.self="showModelPanel = false">
    <section class="panel-glass absolute bottom-28 right-32 w-[320px] rounded-xl p-2">
      <button
        v-for="model in modelPresets"
        :key="model.id"
        class="mb-1 w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
        @click="applyModel(model.name)"
      >
        <p class="text-sm font-semibold">{{ model.name }}</p>
        <p class="text-xs text-textMuted">{{ model.description }} · {{ model.sec }}s</p>
      </button>
    </section>
  </div>

  <div v-if="showResolutionPanel" class="fixed inset-0 z-40" @click.self="showResolutionPanel = false">
    <section class="panel-glass absolute bottom-28 right-20 w-[420px] rounded-xl p-4">
      <h4 class="mb-2 text-sm text-textMuted">分辨率</h4>
      <div class="mb-3 grid grid-cols-3 gap-2">
        <button
          v-for="item in resolutionPresets"
          :key="item"
          class="rounded-lg border border-borderSoft px-3 py-2 text-sm transition hover:border-neon"
          @click="applyResolution(item, storyboardStore.resolution.split(' · ')[0] || '16:9')"
        >
          {{ item }}
        </button>
      </div>

      <h4 class="mb-2 text-sm text-textMuted">比例</h4>
      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="ratio in aspectRatioPresets"
          :key="ratio"
          class="rounded-lg border border-borderSoft px-2 py-2 text-xs transition hover:border-neon"
          @click="applyResolution(storyboardStore.resolution.split(' · ')[1] || '2K', ratio)"
        >
          {{ ratio }}
        </button>
      </div>
    </section>
  </div>

  <div v-if="showCameraPanel" class="fixed inset-0 z-40 flex items-center justify-center bg-black/40" @click.self="showCameraPanel = false">
    <section class="panel-glass w-[820px] rounded-xl p-4">
      <header class="mb-3 flex items-center justify-between border-b border-borderSoft pb-2">
        <h4 class="text-base">摄像机</h4>
        <button class="rounded-md px-2 py-1 text-lg text-textMuted" @click="showCameraPanel = false">×</button>
      </header>

      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="camera in cameraPresets"
          :key="camera.id"
          class="rounded-xl border border-borderSoft bg-panelSoft p-4 text-left transition hover:border-neon"
          @click="applyCameraPreset(camera.name)"
        >
          <p class="text-sm font-semibold">{{ camera.name }}</p>
          <p class="mt-2 text-xs text-textMuted">镜头：{{ camera.lens }}</p>
          <p class="text-xs text-textMuted">焦距：{{ camera.focal }}</p>
          <p class="text-xs text-textMuted">光圈：{{ camera.aperture }}</p>
        </button>
      </div>
    </section>
  </div>
</template>
