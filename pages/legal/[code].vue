<script setup lang="ts">
import { supportService } from '~/shared/api/services/supportService'
import type { LegalDocument } from '~/entities/support/types'
import LegalDocumentContent from '~/components/legal/LegalDocumentContent.vue'

const route = useRoute()
const document = ref<LegalDocument | null>(null)
const loading = ref(true)
const errorMessage = ref('')

// 公开协议页始终读取服务端已发布版本，历史草稿和后台未生效内容不向用户展示。
watch(() => route.params.code, async code => {
  loading.value = true
  document.value = null
  errorMessage.value = ''
  try {
    const documents = await supportService.getLegalDocuments()
    document.value = documents.find(item => item.code === code && item.versions[0]?.status === 'published') || null
    if (!document.value) errorMessage.value = '该协议尚未发布或已停止生效。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '协议读取失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}, { immediate: true })

useHead({ title: '平台协议 - Livliv' })
</script>

<template>
  <main class="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-8 text-slate-800 sm:py-12">
    <div class="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <header class="border-b border-slate-200 bg-slate-50/80 px-6 py-5 sm:px-10">
        <NuxtLink to="/" class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">← 返回首页</NuxtLink>
      </header>
      <section class="px-6 py-8 sm:px-10 sm:py-10">
      <DashboardSkeleton v-if="loading" :rows="4" />
      <template v-else-if="document?.versions[0]">
        <h1 class="text-3xl font-black tracking-tight text-slate-950">{{ document.versions[0].title }}</h1>
        <p class="mt-2 text-sm text-slate-500">版本 {{ document.versions[0].version }} · 发布时间 {{ document.versions[0].publishedAt ? new Date(document.versions[0].publishedAt).toLocaleDateString('zh-CN') : '待生效' }}</p>
        <p v-if="document.versions[0].summary" class="mt-5 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{{ document.versions[0].summary }}</p>
        <LegalDocumentContent class="mt-8" :content="document.versions[0].content" />
      </template>
      <p v-else class="mt-8 text-sm text-rose-600">{{ errorMessage }}</p>
      </section>
    </div>
  </main>
</template>
