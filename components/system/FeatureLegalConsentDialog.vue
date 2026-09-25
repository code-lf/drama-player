<script setup lang="ts">
import { activeFeatureDocumentCodes, finishFeatureConsent } from '~/shared/legal/featureConsent'
import { supportService } from '~/shared/api/services/supportService'
import type { LegalDocument } from '~/entities/support/types'
import LegalDocumentContent from '~/components/legal/LegalDocumentContent.vue'

const documents = ref<LegalDocument[]>([])
const loading = ref(false)
const saving = ref(false)
const agreed = ref(false)
const errorMessage = ref('')
// 确认文案随协议版本由后台维护，前端不再根据编码写死法律文本。
const confirmationTexts = computed(() => documents.value
  .map(item => item.versions[0]?.confirmationText?.trim() || '')
  .filter(Boolean))
const dialogTitle = computed(() => documents.value.length === 1
  ? documents.value[0]?.versions[0]?.title || '功能使用须知'
  : 'AI 功能使用与发布须知')

// 每次后端要求重新确认时都读取已发布的当前版本，不能复用本地缓存代签旧条款。
watch(() => activeFeatureDocumentCodes.value.join('|'), async () => {
  const codes = [...activeFeatureDocumentCodes.value]
  documents.value = []
  agreed.value = false
  errorMessage.value = ''
  if (!codes.length) return
  loading.value = true
  try {
    const published = await supportService.getLegalDocuments()
    const matched = codes
      .map(code => published.find(item => item.code === code && item.versions[0]?.status === 'published'))
      .filter((item): item is LegalDocument => Boolean(item))
    if (matched.length !== codes.length) errorMessage.value = '当前功能告知尚未就绪，请稍后再试。'
    else documents.value = matched
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '协议读取失败，请稍后再试。'
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function accept(): Promise<void> {
  const payload = documents.value.map(item => ({
    documentCode: item.code,
    documentVersionId: item.versions[0]?.id || ''
  })).filter(item => item.documentVersionId)
  if (!payload.length || payload.length !== activeFeatureDocumentCodes.value.length || !agreed.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    // 一次请求原子写入所有已展示版本，用户只需一次勾选和一次点击。
    await supportService.acceptFeatureLegalDocuments(payload)
    finishFeatureConsent(true)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '确认失败，请重新阅读后重试。'
  } finally {
    saving.value = false
  }
}

function cancel(): void {
  if (saving.value) return
  finishFeatureConsent(false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="activeFeatureDocumentCodes.length" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4" @click.self="cancel">
      <section role="dialog" aria-modal="true" :aria-label="dialogTitle" class="flex max-h-[88vh] w-full max-w-[720px] flex-col rounded-2xl bg-white shadow-2xl">
        <header class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-lg font-bold text-slate-900">{{ dialogTitle }}</h2>
          <p v-if="documents.length" class="mt-1 text-xs text-slate-500">已合并 {{ documents.length }} 项当前有效告知 · 阅读后只需确认一次</p>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-7 text-slate-700">
          <p v-if="loading">正在读取协议...</p>
          <div v-else-if="documents.length" class="space-y-6">
            <section v-for="(item, index) in documents" :key="item.code" :class="index ? 'border-t border-slate-200 pt-6' : ''">
              <div class="mb-3 flex items-start justify-between gap-4">
                <h3 class="text-base font-bold text-slate-900">{{ item.versions[0]?.title }}</h3>
                <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">版本 {{ item.versions[0]?.version }}</span>
              </div>
              <p v-if="item.versions[0]?.summary" class="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-blue-800">{{ item.versions[0]?.summary }}</p>
              <LegalDocumentContent :content="item.versions[0]?.content || ''" />
            </section>
          </div>
          <p v-else class="text-rose-600">{{ errorMessage }}</p>
        </div>
        <footer class="border-t border-slate-200 px-6 py-4">
          <label v-if="documents.length && confirmationTexts.length === documents.length" class="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input v-model="agreed" type="checkbox" class="mt-1" />
            <span>我已阅读并同意上述全部告知，并确认下列事项。</span>
          </label>
          <ul v-if="confirmationTexts.length" class="mt-2 list-disc space-y-1 pl-7 text-xs text-slate-500">
            <li v-for="text in confirmationTexts" :key="text">{{ text }}</li>
          </ul>
          <p v-if="errorMessage && documents.length" class="mt-2 text-xs text-rose-600">{{ errorMessage }}</p>
          <div class="mt-4 flex justify-end gap-3">
            <button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm" @click="cancel">暂不使用</button>
            <button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" :disabled="!documents.length || confirmationTexts.length !== documents.length || !agreed || saving" @click="accept">
              {{ saving ? '记录确认中...' : '同意并继续' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
