<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { invoiceService, type InvoiceTitle } from '~/shared/api/services/invoiceService'
import { getApiErrorMessage } from '~/shared/api/client'
const props = defineProps<{ open: boolean; title?: InvoiceTitle | null }>()
const emit = defineEmits<{ close: []; saved: [title: InvoiceTitle] }>()
const busy = ref(false)
const error = ref('')
const form = reactive({ title_type: 'personal' as 'personal' | 'company', title_name: '', tax_id: '', email: '', phone: '', is_default: false })
// 弹窗打开时才填充编辑草稿，不在页面常驻展示完整表单。
watch(() => props.open, (open) => {
  if (!open) return
  const title = props.title
  Object.assign(form, { title_type: title?.title_type || 'personal', title_name: title?.title_name || '', tax_id: title?.tax_id || '', email: title?.email || '', phone: title?.phone || '', is_default: title?.is_default || false })
  error.value = ''
}, { immediate: true })
/** 保存抬头仅影响今后的申请，历史申请继续使用服务端快照。 */
async function save(): Promise<void> {
  busy.value = true; error.value = ''
  try {
    const body = { ...form, tax_id: form.title_type === 'company' ? form.tax_id : '' }
    const title = props.title ? await invoiceService.updateTitle(props.title.id, body) : await invoiceService.createTitle(body)
    emit('saved', title); emit('close')
  } catch (cause) { error.value = getApiErrorMessage(cause, '保存抬头失败。') }
  finally { busy.value = false }
}
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 p-4" @click.self="!busy && emit('close')">
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-title-heading" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between"><h3 id="invoice-title-heading" class="text-lg font-black">{{ title ? '编辑开票抬头' : '新增开票抬头' }}</h3><button :disabled="busy" aria-label="关闭" @click="emit('close')">✕</button></div>
        <form class="mt-5 grid gap-4" @submit.prevent="save">
          <label class="text-sm">抬头类型<select v-model="form.title_type" class="mt-1 w-full rounded-lg border p-2"><option value="personal">个人</option><option value="company">企业</option></select></label>
          <label class="text-sm">抬头名称<input v-model="form.title_name" required minlength="2" maxlength="160" class="mt-1 w-full rounded-lg border p-2"></label>
          <label v-if="form.title_type === 'company'" class="text-sm">纳税人识别号<input v-model="form.tax_id" required maxlength="20" class="mt-1 w-full rounded-lg border p-2"></label>
          <label class="text-sm">接收邮箱<input v-model="form.email" type="email" required maxlength="254" class="mt-1 w-full rounded-lg border p-2"></label>
          <label class="text-sm">联系电话（选填）<input v-model="form.phone" maxlength="32" class="mt-1 w-full rounded-lg border p-2"></label>
          <label class="flex items-center gap-2 text-sm"><input v-model="form.is_default" type="checkbox">设为默认抬头</label>
          <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
          <div class="flex justify-end gap-3"><button type="button" :disabled="busy" class="rounded-lg border px-4 py-2" @click="emit('close')">取消</button><button :disabled="busy" class="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{{ busy ? '保存中…' : '保存抬头' }}</button></div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
