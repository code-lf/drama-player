<script setup lang="ts">
import type { SupportCenter, UserFeedback } from '~/entities/support/types'
import { supportService } from '~/shared/api/services/supportService'

const loading = ref(true)
const center = ref<SupportCenter>({ supportEmail: '', articles: [] })
const feedbackHistory = ref<UserFeedback[]>([])
const errorMessage = ref('')

onMounted(async () => {
  try {
    const [supportCenter, feedbackPage] = await Promise.all([
      supportService.getSupportCenter(),
      supportService.getMyFeedback()
    ])
    center.value = supportCenter
    feedbackHistory.value = feedbackPage.items
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '帮助中心暂时不可用。'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="mx-auto max-w-[1080px] space-y-5">
    <header class="rounded-[24px] border border-[#dce7f5] bg-panel p-7"><p class="text-sm font-black text-[#4F46E5]">帮助中心</p><h1 class="mt-2 text-[30px] font-black tracking-[-0.04em] text-[#0f172a]">使用指南与支持方式</h1><p class="mt-3 text-sm leading-6 text-[#64748b]">在这里查找常见问题；如需人工协助，可直接通过客服邮箱联系。</p><a v-if="center.supportEmail" class="mt-5 inline-flex rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-black text-white" :href="`mailto:${center.supportEmail}`">联系邮箱：{{ center.supportEmail }}</a><p v-else class="mt-5 text-sm font-semibold text-[#94a3b8]">客服邮箱暂未配置，请先通过“意见反馈”联系我们。</p></header>
    <p v-if="errorMessage" class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ errorMessage }}</p>
    <DashboardSkeleton v-else-if="loading" :rows="3" />
    <div v-else-if="!center.articles.length" class="rounded-[20px] border border-dashed border-[#d7e1ef] bg-white p-8 text-sm text-[#94a3b8]">暂无已发布的帮助文章。</div>
    <article v-for="article in center.articles" :key="article.id" class="rounded-[20px] border border-[#e3eaf4] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,.04)]"><p class="text-xs font-black text-[#4F46E5]">{{ article.category }}</p><h2 class="mt-2 text-[19px] font-black text-[#0f172a]">{{ article.title }}</h2><p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#52627a]">{{ article.content }}</p></article>
    <section class="rounded-[20px] border border-[#e3eaf4] bg-white p-6"><h2 class="text-[19px] font-black text-[#0f172a]">我的反馈进度</h2><p class="mt-1 text-sm text-[#64748b]">管理员的处理结果会在这里同步显示。</p><p v-if="!feedbackHistory.length" class="mt-4 text-sm text-[#94a3b8]">暂时没有反馈记录。</p><article v-for="item in feedbackHistory" :key="item.id" class="mt-4 rounded-xl bg-[#f8fafc] p-4"><div class="flex items-start justify-between gap-4"><p class="text-sm font-bold text-[#334155]">{{ item.content }}</p><span class="shrink-0 text-xs font-black text-[#4F46E5]">{{ { submitted: '已提交', processing: '处理中', resolved: '已解决', closed: '已关闭' }[item.status] }}</span></div><p v-if="item.adminReply" class="mt-3 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-[#52627a]">管理员回复：{{ item.adminReply }}</p></article></section>
  </section>
</template>
