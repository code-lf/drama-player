<script setup lang="ts">
import type { FeedbackCategory, UserFeedback } from '~/entities/support/types'
import { supportService } from '~/shared/api/services/supportService'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; submitted: [] }>()

const category = ref<FeedbackCategory>('product')
const content = ref('')
const contactEmail = ref('')
const previews = ref<Array<{ file: File; url: string }>>([])
const enlargedPreviewUrl = ref('')
const files = computed(() => previews.value.map((item) => item.file))
const busy = ref(false)
const message = ref('')
const history = ref<UserFeedback[]>([])

async function loadHistory(): Promise<void> {
  try {
    history.value = (await supportService.getMyFeedback()).items
  } catch {
    // 历史记录加载失败不影响用户继续提交新反馈。
  }
}

watch(() => props.open, (open) => {
  if (open) {
    message.value = ''
    void loadHistory()
  } else {
    enlargedPreviewUrl.value = ''
  }
})

function selectFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  const valid = picked.filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024)
  if (valid.length !== picked.length) {
    message.value = '仅支持 JPG、PNG、WebP，且单张不能超过 5MB。'
  } else {
    message.value = ''
  }
  // 只为实际保留的图片创建预览地址，达到三张上限时不留下多余的对象 URL。
  const available = Math.max(0, 3 - previews.value.length)
  previews.value = [...previews.value, ...valid.slice(0, available).map(file => ({ file, url: URL.createObjectURL(file) }))]
  input.value = ''
}

function removePreview(index: number): void {
  const item = previews.value[index]
  if (!item) return
  if (enlargedPreviewUrl.value === item.url) enlargedPreviewUrl.value = ''
  URL.revokeObjectURL(item.url)
  previews.value = previews.value.filter((_, itemIndex) => itemIndex !== index)
}

function clearPreviews(): void {
  previews.value.forEach((item) => URL.revokeObjectURL(item.url))
  previews.value = []
  enlargedPreviewUrl.value = ''
}

onBeforeUnmount(clearPreviews)

/** 统一收窄模板中的类型转换，避免 Vue 模板解析 TypeScript 断言失败。 */
function selectCategory(value: string): void {
  category.value = value as FeedbackCategory
}

async function submit(): Promise<void> {
  if (!content.value.trim() || busy.value) return
  busy.value = true
  message.value = ''
  try {
    await supportService.submitFeedback({
      category: category.value,
      content: content.value.trim(),
      contactEmail: contactEmail.value.trim(),
      pagePath: window.location.pathname,
      files: files.value
    })
    content.value = ''
    contactEmail.value = ''
    clearPreviews()
    emit('submitted')
    emit('close')
  } catch (error) {
    message.value = error instanceof Error ? error.message : '提交失败，请稍后重试。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[115] bg-slate-950/25" @click.self="emit('close')">
    <aside class="absolute bottom-0 right-0 top-0 flex w-full max-w-[520px] flex-col border-l border-[#dbe4f0] bg-white shadow-[-20px_0_60px_rgba(15,23,42,.18)]">
      <header class="flex items-start justify-between border-b border-[#edf1f6] px-6 py-5">
        <div><h2 class="text-[21px] font-black text-[#0f172a]">意见反馈</h2><p class="mt-1 text-sm text-[#64748b]">问题和建议都会在站内跟进处理。</p></div>
        <button type="button" class="rounded-lg px-2 py-1 text-lg text-[#64748b] hover:bg-[#f1f5f9]" aria-label="关闭反馈" @click="emit('close')">×</button>
      </header>
      <div class="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div class="grid grid-cols-4 gap-2">
          <button v-for="item in [{ value: 'product', label: '产品建议' }, { value: 'bug', label: '功能异常' }, { value: 'billing', label: '积分/订单' }, { value: 'other', label: '其他' }]" :key="item.value" type="button" class="rounded-lg border px-2 py-2 text-xs font-bold" :class="category === item.value ? 'border-[#2563eb] bg-[#eff6ff] text-[#2563eb]' : 'border-[#dbe4f0] text-[#64748b]'" @click="selectCategory(item.value)">{{ item.label }}</button>
        </div>
        <label class="block text-sm font-bold text-[#334155]">问题描述<textarea v-model="content" maxlength="5000" class="mt-2 min-h-[150px] w-full rounded-xl border border-[#d8e2ef] p-3 text-sm font-medium leading-6 outline-none focus:border-[#2563eb]" placeholder="请描述你遇到的情况、期望结果和复现步骤。" /></label>
        <label class="block text-sm font-bold text-[#334155]">联系邮箱 <span class="font-medium text-[#94a3b8]">（可选）</span><input v-model="contactEmail" type="email" class="mt-2 h-11 w-full rounded-xl border border-[#d8e2ef] px-3 text-sm outline-none focus:border-[#2563eb]" placeholder="用于必要时补充沟通" /></label>
        <div>
          <p class="text-sm font-bold text-[#334155]">问题截图 <span class="font-medium text-[#94a3b8]">（最多 3 张）</span></p>
          <label class="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#93c5fd] bg-[#eff6ff] px-4 py-4 text-sm font-bold text-[#2563eb]"><input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="selectFiles">上传截图</label>
          <div v-if="previews.length" class="mt-3 grid grid-cols-3 gap-2">
            <div v-for="(item, index) in previews" :key="item.url" class="relative min-w-0 rounded-xl border border-[#dbe4f0] bg-[#f8fafc] p-1.5">
              <button type="button" class="block w-full" :aria-label="`预览截图 ${item.file.name}`" @click="enlargedPreviewUrl = item.url"><img :src="item.url" :alt="item.file.name" class="aspect-square w-full rounded-lg object-cover"></button>
              <p class="mt-1 truncate px-1 text-[11px] text-[#64748b]" :title="item.file.name">{{ item.file.name }}</p>
              <button type="button" class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/75 text-sm text-white" :aria-label="`移除截图 ${item.file.name}`" @click="removePreview(index)">×</button>
            </div>
          </div>
        </div>
        <p v-if="message" class="rounded-xl bg-[#f1f5f9] px-3 py-2 text-sm text-[#475569]">{{ message }}</p>
        <section><h3 class="text-sm font-black text-[#0f172a]">我的反馈</h3><div v-if="!history.length" class="mt-3 rounded-xl bg-[#f8fafc] px-3 py-4 text-sm text-[#94a3b8]">还没有提交过反馈。</div><article v-for="item in history" :key="item.id" class="mt-3 rounded-xl border border-[#e7edf5] p-3"><div class="flex justify-between gap-3"><p class="text-sm font-bold text-[#334155]">{{ item.content }}</p><span class="shrink-0 text-xs font-bold text-[#2563eb]">{{ { submitted: '已提交', processing: '处理中', resolved: '已解决', closed: '已关闭' }[item.status] }}</span></div><p v-if="item.adminReply" class="mt-2 rounded-lg bg-[#eff6ff] px-2 py-2 text-xs leading-5 text-[#315b9b]">管理员回复：{{ item.adminReply }}</p></article></section>
      </div>
      <footer class="border-t border-[#edf1f6] px-6 py-4"><button type="button" class="w-full rounded-xl bg-[#2563eb] py-3 text-sm font-black text-white disabled:opacity-55" :disabled="busy || !content.trim()" @click="submit">{{ busy ? '正在提交…' : '提交反馈' }}</button></footer>
    </aside>
    <div v-if="enlargedPreviewUrl" class="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/75 p-6" @click.self="enlargedPreviewUrl = ''">
      <img :src="enlargedPreviewUrl" alt="截图大图预览" class="max-h-full max-w-full rounded-lg object-contain">
      <button type="button" class="absolute right-6 top-5 text-3xl text-white" aria-label="关闭截图预览" @click="enlargedPreviewUrl = ''">×</button>
    </div>
  </div>
</template>
