<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import type { LibraryConfiguration, LibraryItem, LibraryReference } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import LibrarySelect, { type SelectOption } from './LibrarySelect.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import { useActionDialog } from '~/composables/useActionDialog'
import {
  FolderArchive,
  Upload,
  Search,
  RotateCw,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  Layers,
  Edit3,
  Plus,
  Archive,
  RotateCcw,
  Eye,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Sparkles,
  AlertCircle
} from '@lucide/vue'

const { prompt: promptAction } = useActionDialog()

const enabled = ref(false)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const config = ref<LibraryConfiguration | null>(null)
const items = ref<LibraryItem[]>([])
const scope = ref<'personal' | 'public'>('personal')
const archived = ref(false)
const versionSelections = reactive<Record<string, string>>({})

// 弹窗状态
const pendingVersion = ref<{ item: LibraryItem; file: File } | null>(null)
const pendingArchive = ref<LibraryItem | null>(null)
const confirming = ref(false)

// 大图预览弹窗
const previewImageItem = ref<LibraryItem | null>(null)

// 文本查看弹窗
const selectedDocument = ref<LibraryItem | null>(null)
const documentContent = ref('')
const documentOffset = ref(0)
const documentTotal = ref(0)
const documentLoading = ref(false)
const copied = ref(false)

// 筛选字段
const category = ref('')
const uploadCategory = ref('')
const mediaType = ref('')
const query = ref('')
const page = ref(1)
const total = ref(0)
let listRevision = 0

function cancelLibraryChange() {
  if (confirming.value) return
  pendingVersion.value = null
  pendingArchive.value = null
}

function currentVersion(item: LibraryItem) {
  return item.versions.find(value => value.id === versionSelections[item.id]) || item.versions[0]!
}

async function changeCategory(item: LibraryItem, newCategory: string) {
  try {
    await libraryService.edit(item.id, { name: item.name, category: newCategory })
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  }
}

async function rename(item: LibraryItem) {
  const entered = await promptAction('输入容易辨认的素材名称。更名不会改变已绑定的固定版本。', item.name, '重命名素材')
  if (entered === null) return
  const name = entered.trim()
  if (!name || name.length > 160) {
    error.value = '素材名称应为 1–160 个字符。'
    return
  }
  try {
    await libraryService.edit(item.id, { name, category: item.category })
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  }
}

async function restore(item: LibraryItem) {
  try {
    await libraryService.restore(item.id)
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  }
}

function addVersion(item: LibraryItem, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  pendingVersion.value = { item, file }
}

function messageFor(exception: unknown): string {
  const value = exception as { data?: { detail?: string | { message?: string } }; message?: string }
  const detail = value.data?.detail
  return typeof detail === 'string' ? detail : detail?.message || '操作失败，请稍后重试。'
}

function reference(item: LibraryItem): LibraryReference {
  return { item_id: item.id, version_id: currentVersion(item).id, purpose: 'document' }
}

async function refresh() {
  const revision = ++listRevision
  loading.value = true
  error.value = ''
  try {
    const result = await libraryService.list({
      scope: scope.value,
      category: category.value,
      media_type: mediaType.value,
      query: query.value,
      page: page.value,
      archived: archived.value
    })
    if (revision === listRevision) {
      items.value = result.items || []
      total.value = result.total || 0
      for (const item of items.value) {
        if (!item.versions.some(version => version.id === versionSelections[item.id])) {
          versionSelections[item.id] = item.versions[0]?.id || ''
        }
      }
    }
  } catch (exception) {
    if (revision === listRevision) error.value = messageFor(exception)
  } finally {
    if (revision === listRevision) loading.value = false
  }
}

async function initialize() {
  try {
    enabled.value = (await libraryService.capabilities()).enabled
    if (!enabled.value) return
    config.value = await libraryService.configuration()
    uploadCategory.value = config.value?.categories[0]?.code || 'character'
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  } finally {
    loading.value = false
  }
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !config.value || uploading.value) return
  if (file.size > config.value.max_upload_bytes) {
    error.value = '文件超过后台配置的上传大小上限。'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    await libraryService.upload(file, uploadCategory.value)
    scope.value = 'personal'
    page.value = 1
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  } finally {
    uploading.value = false
  }
}

function archive(item: LibraryItem) {
  pendingArchive.value = item
}

async function confirmLibraryChange() {
  if (confirming.value) return
  confirming.value = true
  try {
    if (pendingVersion.value) await libraryService.addVersion(pendingVersion.value.item.id, pendingVersion.value.file)
    else if (pendingArchive.value) await libraryService.archive(pendingArchive.value.id)
    pendingVersion.value = null
    pendingArchive.value = null
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  } finally {
    confirming.value = false
  }
}

async function readDocument(item: LibraryItem, offset = 0) {
  documentLoading.value = true
  selectedDocument.value = item
  try {
    const result = await libraryService.readDocument(reference(item), offset)
    documentContent.value = result.parse_status === 'ready' ? result.text : result.parse_error || '文档正在后台提取文字，请稍后刷新。'
    documentOffset.value = result.offset
    documentTotal.value = result.total_chars
  } catch (exception) {
    documentContent.value = messageFor(exception)
  } finally {
    documentLoading.value = false
  }
}

async function retry(item: LibraryItem) {
  try {
    await libraryService.retryDocument(reference(item))
    await refresh()
  } catch (exception) {
    error.value = messageFor(exception)
  }
}

function copyDocumentText() {
  if (navigator.clipboard && documentContent.value) {
    navigator.clipboard.writeText(documentContent.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

// 格式化下拉选项
const mediaTypeOptions: SelectOption[] = [
  { label: '全部类型', value: '' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '文档', value: 'document' }
]

const categoryOptions = computed<SelectOption[]>(() => {
  const list: SelectOption[] = [{ label: '全部用途', value: '' }]
  if (config.value?.categories) {
    config.value.categories.forEach(cat => {
      list.push({ label: cat.name, value: cat.code })
    })
  }
  return list
})

const uploadCategoryOptions = computed<SelectOption[]>(() => {
  if (!config.value?.categories) return []
  return config.value.categories.map(cat => ({ label: cat.name, value: cat.code }))
})

function getCategoryName(code: string): string {
  return config.value?.categories.find(c => c.code === code)?.name || code || '未分类'
}

function getItemVersionOptions(item: LibraryItem): SelectOption[] {
  return item.versions.map((v, idx) => ({
    label: `版本 ${v.version_no}`,
    value: v.id,
    badge: idx === 0 ? '最新' : undefined
  }))
}

function getItemCategoryOptions(): SelectOption[] {
  if (!config.value?.categories) return []
  return config.value.categories.map(c => ({ label: c.name, value: c.code }))
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const mb = bytes / 1048576
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

watch([scope, category, mediaType, archived], () => {
  page.value = 1
  if (enabled.value) void refresh()
})

onMounted(initialize)
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] px-6 py-8 text-slate-800 space-y-6">
    <!-- 顶部标题与功能定位 -->
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-xs">
            <FolderArchive class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">资料库</h1>
            <p class="text-xs font-medium text-slate-500">
              集中管理短剧创作角色设定、分镜资产、剧本原稿及公共素材库
            </p>
          </div>
        </div>
      </div>

      <!-- 快捷统计与容量概览 -->
      <div class="flex items-center gap-2 text-xs">
        <div class="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-xs">
          <HardDrive class="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <span class="text-slate-400">单文件上限: </span>
            <span class="font-bold text-slate-800 tabular-nums">
              {{ config ? Math.floor(config.max_upload_bytes / 1048576) : 50 }} MB
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-xs">
          <Sparkles class="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <span class="text-slate-400">文本解析: </span>
            <span class="font-bold text-slate-800">已就绪</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 错误横幅提示 -->
    <div
      v-if="error"
      role="alert"
      class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 shadow-xs"
    >
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4 shrink-0 text-red-600" />
        <span>{{ error }}</span>
      </div>
      <button class="text-xs font-semibold text-red-600 hover:text-red-800" @click="error = ''">关闭</button>
    </div>

    <!-- 资料库未开启提示 -->
    <div
      v-if="!loading && !enabled"
      class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs"
    >
      <FolderArchive class="mx-auto h-12 w-12 text-slate-300" />
      <h3 class="mt-4 text-base font-bold text-slate-800">资料库尚未开启</h3>
      <p class="mt-1 text-sm text-slate-500">现有上传与生成历史仍可正常使用，后台配置完成后将自动同步。</p>
    </div>

    <template v-if="enabled && config">
      <!-- 统一操控工作台工具栏 -->
      <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3.5">
        <!-- 第一行：库范围切换、类型/用途筛选、搜索与刷新 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- 库范围切换 -->
          <div class="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all"
              :class="scope === 'personal' && !archived ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              @click="scope = 'personal'; archived = false"
            >
              <span>个人资料</span>
              <span v-if="scope === 'personal' && !archived" class="rounded-full bg-blue-50 px-1.5 py-0.2 text-[10px] text-blue-600 tabular-nums">
                {{ total }}
              </span>
            </button>
            <button
              class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all"
              :class="scope === 'public' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              @click="scope = 'public'; archived = false"
            >
              <span>平台公共素材</span>
              <span v-if="scope === 'public'" class="rounded-full bg-blue-50 px-1.5 py-0.2 text-[10px] text-blue-600 tabular-nums">
                {{ total }}
              </span>
            </button>
            <button
              v-if="scope === 'personal'"
              class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              :class="archived ? 'bg-amber-100 text-amber-800 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'"
              @click="archived = !archived"
            >
              <Archive class="h-3.5 w-3.5" />
              <span>已归档</span>
            </button>
          </div>

          <!-- 右侧筛选组与搜索框 -->
          <div class="flex flex-wrap items-center gap-2.5">
            <!-- 文件类型自定义下拉框 -->
            <LibrarySelect
              v-model="mediaType"
              :options="mediaTypeOptions"
              placeholder="全部类型"
              size="sm"
            />

            <!-- 用途分类自定义下拉框 -->
            <LibrarySelect
              v-model="category"
              :options="categoryOptions"
              placeholder="全部用途"
              size="sm"
            />

            <!-- 搜索框 -->
            <form class="relative flex items-center" @submit.prevent="page = 1; refresh()">
              <Search class="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <input
                v-model="query"
                maxlength="120"
                placeholder="搜索名称或正文…"
                aria-label="资料搜索"
                class="h-9 w-44 sm:w-56 rounded-xl border border-slate-200/90 bg-white pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-xs transition-colors focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                v-if="query"
                type="button"
                class="absolute right-2 text-slate-400 hover:text-slate-600"
                @click="query = ''; page = 1; refresh()"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </form>

            <!-- 刷新按钮 -->
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
              :disabled="loading"
              title="刷新列表"
              @click="refresh"
            >
              <RotateCw class="h-4 w-4" :class="{ 'animate-spin text-blue-600': loading }" />
            </button>
          </div>
        </div>

        <!-- 第二行：上传面板（仅在个人资料视图展示） -->
        <div
          v-if="scope === 'personal' && !archived"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs"
        >
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-bold text-slate-600">上传新资料:</span>
            <!-- 上传用途自定义下拉框 -->
            <LibrarySelect
              v-model="uploadCategory"
              :options="uploadCategoryOptions"
              prefix="分类:"
              size="sm"
            />

            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-98"
              :class="{ 'pointer-events-none opacity-60': uploading }"
            >
              <Upload class="h-3.5 w-3.5 shrink-0" />
              <span>{{ uploading ? '正在保存…' : '选择文件上传' }}</span>
              <input
                class="sr-only"
                type="file"
                :disabled="uploading"
                accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mp3,.wav,.m4a,.ogg,.txt,.docx,.pdf"
                @change="upload"
              />
            </label>
          </div>

          <div class="text-[11px] text-slate-400">
            支持图片、音视频、剧本文档（TXT / DOCX / PDF）· 单文件不超过 {{ Math.floor(config.max_upload_bytes / 1048576) }} MB
          </div>
        </div>
      </div>

      <!-- 加载中骨架屏 -->
      <div v-if="loading" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="i in 4"
          :key="i"
          class="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3"
        >
          <div class="h-44 rounded-xl bg-slate-100" />
          <div class="h-4 w-3/4 rounded bg-slate-100" />
          <div class="h-3 w-1/2 rounded bg-slate-100" />
          <div class="h-8 rounded-lg bg-slate-100" />
        </div>
      </div>

      <!-- 空数据状态 -->
      <div
        v-else-if="!items.length"
        class="rounded-2xl border border-slate-200/90 bg-white py-16 text-center shadow-xs"
      >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FolderArchive class="h-7 w-7" />
        </div>
        <h3 class="mt-4 text-base font-bold text-slate-800">
          {{ query ? '未找到符合条件的资料' : archived ? '暂无归档资料' : '资料库暂无素材' }}
        </h3>
        <p class="mt-1 text-xs text-slate-500">
          {{ query ? '尝试缩短搜索词或清除筛选条件' : '上传角色形象、剧本大纲或场景参考图，开始创作' }}
        </p>
        <button
          v-if="query || category || mediaType"
          class="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          @click="query = ''; category = ''; mediaType = ''; refresh()"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          <span>清除筛选</span>
        </button>
      </div>

      <!-- 资料卡片矩阵网格 -->
      <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article
          v-for="item in items"
          :key="item.id"
          class="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl overflow-hidden"
        >
          <!-- 媒体预览展示区 -->
          <div class="relative h-44 w-full bg-slate-50/80 flex items-center justify-center overflow-hidden border-b border-slate-100 select-none">
            <!-- 图片类型预览 -->
            <template v-if="item.media_type === 'image'">
              <img
                :src="libraryService.previewUrl(currentVersion(item).preview_url)"
                :alt="item.name"
                class="h-full w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <button
                type="button"
                class="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100 text-white"
                title="查看原图"
                @click="previewImageItem = item"
              >
                <span class="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md">
                  <Eye class="h-3.5 w-3.5" />
                  <span>查看预览</span>
                </span>
              </button>
            </template>

            <!-- 视频类型预览 -->
            <template v-else-if="item.media_type === 'video'">
              <video
                :src="libraryService.previewUrl(currentVersion(item).preview_url)"
                controls
                preload="none"
                class="h-full w-full object-cover"
              />
            </template>

            <!-- 音频类型预览 -->
            <template v-else-if="item.media_type === 'audio'">
              <div class="flex flex-col items-center justify-center gap-2 p-4 text-center">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 shadow-xs">
                  <MusicIcon class="h-6 w-6" />
                </div>
                <audio
                  :src="libraryService.previewUrl(currentVersion(item).preview_url)"
                  controls
                  preload="none"
                  class="mt-1 w-full max-w-[200px]"
                />
              </div>
            </template>

            <!-- 文档类型预览 -->
            <template v-else>
              <div
                class="flex h-full w-full flex-col justify-between p-4 cursor-pointer transition-colors hover:bg-blue-50/30"
                @click="readDocument(item)"
              >
                <div class="flex items-center justify-between">
                  <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-xs">
                    <FileText class="h-5 w-5" />
                  </div>
                  <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {{ currentVersion(item).mime_type?.includes('pdf') ? 'PDF' : currentVersion(item).mime_type?.includes('word') ? 'DOCX' : 'TXT' }}
                  </span>
                </div>

                <div class="space-y-1">
                  <p class="text-xs font-semibold text-slate-700 line-clamp-2">
                    {{ item.name }}
                  </p>
                  <div class="flex items-center gap-1.5 text-[11px]">
                    <span
                      class="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.2 font-semibold"
                      :class="currentVersion(item).parse_status === 'ready' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                    >
                      <Check v-if="currentVersion(item).parse_status === 'ready'" class="h-3 w-3" />
                      <span>{{ currentVersion(item).parse_status === 'ready' ? '已提取文字' : currentVersion(item).parse_error || '文字提取中' }}</span>
                    </span>
                  </div>
                </div>

                <div class="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                  <Eye class="h-3 w-3" />
                  <span>点击查看正文</span>
                </div>
              </div>
            </template>

            <!-- 顶部类型与用途微标签 -->
            <div class="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5">
              <span class="rounded-md bg-slate-900/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                {{ item.media_type === 'image' ? '图片' : item.media_type === 'video' ? '视频' : item.media_type === 'audio' ? '音频' : '文档' }}
              </span>
              <span class="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-xs backdrop-blur-md">
                {{ getCategoryName(item.category) }}
              </span>
            </div>
          </div>

          <!-- 卡片信息与多级下拉操作区 -->
          <div class="flex flex-1 flex-col p-4 space-y-3">
            <div>
              <h2 class="truncate font-bold text-slate-800 text-[14px] group-hover:text-blue-600 transition-colors" :title="item.name">
                {{ item.name }}
              </h2>
              <p class="mt-1 text-[11px] text-slate-400 font-medium">
                v{{ currentVersion(item).version_no }} · {{ formatFileSize(currentVersion(item).size_bytes) }}
              </p>
            </div>

            <!-- 自定义下拉框群：版本切换 + 用途分类 -->
            <div class="space-y-2 pt-1">
              <!-- 版本选择下拉框 -->
              <div class="w-full">
                <LibrarySelect
                  v-model="versionSelections[item.id]"
                  :options="getItemVersionOptions(item)"
                  prefix="版本:"
                  size="xs"
                  block
                />
              </div>

              <!-- 分类调整下拉框（仅在个人资料且未归档时可修改） -->
              <div v-if="scope === 'personal' && !archived" class="w-full">
                <LibrarySelect
                  :model-value="item.category"
                  :options="getItemCategoryOptions()"
                  prefix="用途:"
                  size="xs"
                  block
                  @change="changeCategory(item, $event)"
                />
              </div>
            </div>

            <!-- 卡片底部快捷操作 -->
            <div class="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <div class="flex items-center gap-2">
                <!-- 文档阅读按钮 -->
                <button
                  v-if="item.media_type === 'document' && !archived"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-blue-600 hover:bg-blue-50 transition-colors"
                  @click="readDocument(item)"
                >
                  <FileText class="h-3.5 w-3.5" />
                  <span>查看文字</span>
                </button>

                <!-- 提取重试 -->
                <button
                  v-if="scope === 'personal' && ['failed', 'unsupported'].includes(currentVersion(item).parse_status) && !archived"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-amber-600 hover:bg-amber-50 transition-colors"
                  @click="retry(item)"
                >
                  <RotateCw class="h-3.5 w-3.5" />
                  <span>重试提取</span>
                </button>

                <!-- 重命名 -->
                <button
                  v-if="scope === 'personal' && !archived"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  @click="rename(item)"
                >
                  <Edit3 class="h-3.5 w-3.5" />
                  <span>重命名</span>
                </button>

                <!-- 新增版本 -->
                <label
                  v-if="scope === 'personal' && !archived"
                  class="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Plus class="h-3.5 w-3.5" />
                  <span>新增版本</span>
                  <input class="sr-only" type="file" @change="addVersion(item, $event)" />
                </label>
              </div>

              <!-- 归档 / 恢复 -->
              <div v-if="scope === 'personal'">
                <button
                  v-if="archived"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-emerald-600 hover:bg-emerald-50 transition-colors"
                  @click="restore(item)"
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                  <span>恢复</span>
                </button>
                <button
                  v-else
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  title="归档后不删除已绑定的作品引用"
                  @click="archive(item)"
                >
                  <Archive class="h-3.5 w-3.5" />
                  <span>归档</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- 分页底栏 -->
      <footer class="mt-8 flex items-center justify-between border-t border-slate-200/80 pt-4 text-xs font-semibold text-slate-500">
        <span class="tabular-nums">共 {{ total }} 项资料 · 第 {{ page }} 页</span>
        <div class="flex items-center gap-2">
          <button
            :disabled="page <= 1 || loading"
            class="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-40"
            @click="page--; refresh()"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
            <span>上一页</span>
          </button>
          <button
            :disabled="page * 24 >= total || loading"
            class="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-40"
            @click="page++; refresh()"
          >
            <span>下一页</span>
            <ChevronRight class="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </template>

    <!-- 文档正文查看抽屉/弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="selectedDocument"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6"
          @click.self="selectedDocument = null"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-doc-modal-title"
            class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 text-slate-800"
          >
            <header class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div class="flex items-center gap-2.5">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText class="h-5 w-5" />
                </div>
                <div>
                  <h2 id="library-doc-modal-title" class="font-bold text-slate-900 text-base">
                    {{ selectedDocument.name }}
                  </h2>
                  <span class="text-xs text-slate-400">
                    文本偏移 {{ documentOffset }} / {{ documentTotal }} 字
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                  @click="copyDocumentText"
                >
                  <Check v-if="copied" class="h-3.5 w-3.5 text-emerald-600" />
                  <Copy v-else class="h-3.5 w-3.5 text-slate-500" />
                  <span>{{ copied ? '已复制' : '复制正文' }}</span>
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  @click="selectedDocument = null"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </header>

            <div class="my-4 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-4 border border-slate-200/80">
              <pre class="whitespace-pre-wrap break-words font-sans text-xs leading-6 text-slate-700">{{ documentLoading ? '正在读取文档内容…' : documentContent }}</pre>
            </div>

            <footer class="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span class="text-slate-400">单次窗口读取上限 4,000 字符</span>
              <div class="flex items-center gap-2">
                <button
                  :disabled="documentOffset <= 0 || documentLoading"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
                  @click="readDocument(selectedDocument, Math.max(0, documentOffset - 4000))"
                >
                  上一段
                </button>
                <button
                  :disabled="documentOffset + 4000 >= documentTotal || documentLoading"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
                  @click="readDocument(selectedDocument, documentOffset + 4000)"
                >
                  下一段
                </button>
              </div>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>

    <!-- 图片大图预览模态框 -->
    <Teleport to="body">
      <div
        v-if="previewImageItem"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
        @click="previewImageItem = null"
      >
        <div class="relative max-h-[90vh] max-w-4xl" @click.stop>
          <img
            :src="libraryService.previewUrl(currentVersion(previewImageItem).preview_url)"
            :alt="previewImageItem.name"
            class="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
          <button
            class="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
            @click="previewImageItem = null"
          >
            <X class="h-5 w-5" />
          </button>
          <div class="mt-3 text-center text-sm font-semibold text-white/90">
            {{ previewImageItem.name }} (v{{ currentVersion(previewImageItem).version_no }})
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 版本 / 归档 确认弹窗 -->
    <LivDialog
      :open="!!(pendingVersion || pendingArchive)"
      :title="pendingVersion ? '确认新增版本' : '确认归档资料'"
      width="sm"
      @update:open="open => { if (!open) cancelLibraryChange() }"
    >
      <p class="text-sm leading-relaxed text-slate-600">
        {{ pendingVersion ? '新增版本不会破坏已有作品的固定引用，是否继续保存？' : `确认将“${pendingArchive?.name}”移入归档？已绑定该素材的作品不受影响。` }}
      </p>
      <template #footer>
        <button
          :disabled="confirming"
          class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          @click="cancelLibraryChange"
        >
          取消
        </button>
        <button
          :disabled="confirming"
          class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          @click="confirmLibraryChange"
        >
          {{ confirming ? '正在处理…' : '确认' }}
        </button>
      </template>
    </LivDialog>
  </div>
</template>
