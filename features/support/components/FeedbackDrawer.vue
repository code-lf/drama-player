<script setup lang="ts">
import type { FeedbackCategory, UserFeedback } from '~/entities/support/types'
import { supportService } from '~/shared/api/services/supportService'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; submitted: [] }>()

const category = ref<FeedbackCategory>('product')
const content = ref('')
const contactEmail = ref('')
const files = ref<File[]>([])
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
  if (open) void loadHistory()
})

function selectFiles(event: Event): void {
  const picked = Array.from((event.target as HTMLInputElement).files || [])
  const next = [...files.value, ...picked].slice(0, 3)
  if (picked.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
    message.value = '仅支持 JPG、PNG、WebP，且单张不能超过 5MB。'
  }
  files.value = next.filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024)
}

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
    files.value = []
    message.value = '反馈已提交，我们会在站内回复处理进度。'
    emit('submitted')
    await loadHistory()
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
        <div><p class="text-sm font-bold text-[#334155]">问题截图 <span class="font-medium text-[#94a3b8]">（最多 3 张）</span></p><label class="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#93c5fd] bg-[#eff6ff] px-4 py-4 text-sm font-bold text-[#2563eb]"><input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="selectFiles">上传截图</label><div v-if="files.length" class="mt-2 flex flex-wrap gap-2"><span v-for="(file, index) in files" :key="`${file.name}-${index}`" class="rounded-lg bg-[#f1f5f9] px-2 py-1 text-xs text-[#475569]">{{ file.name }} <button type="button" class="ml-1 text-rose-500" @click="files.splice(index, 1)">×</button></span></div></div>
        <p v-if="message" class="rounded-xl bg-[#f1f5f9] px-3 py-2 text-sm text-[#475569]">{{ message }}</p>
        <section><h3 class="text-sm font-black text-[#0f172a]">我的反馈</h3><div v-if="!history.length" class="mt-3 rounded-xl bg-[#f8fafc] px-3 py-4 text-sm text-[#94a3b8]">还没有提交过反馈。</div><article v-for="item in history" :key="item.id" class="mt-3 rounded-xl border border-[#e7edf5] p-3"><div class="flex justify-between gap-3"><p class="text-sm font-bold text-[#334155]">{{ item.content }}</p><span class="shrink-0 text-xs font-bold text-[#2563eb]">{{ { submitted: '已提交', processing: '处理中', resolved: '已解决', closed: '已关闭' }[item.status] }}</span></div><p v-if="item.adminReply" class="mt-2 rounded-lg bg-[#eff6ff] px-2 py-2 text-xs leading-5 text-[#315b9b]">管理员回复：{{ item.adminReply }}</p></article></section>
      </div>
      <footer class="border-t border-[#edf1f6] px-6 py-4"><button type="button" class="w-full rounded-xl bg-[#2563eb] py-3 text-sm font-black text-white disabled:opacity-55" :disabled="busy || !content.trim()" @click="submit">{{ busy ? '正在提交…' : '提交反馈' }}</button></footer>
    </aside>
  </div>
</template>
