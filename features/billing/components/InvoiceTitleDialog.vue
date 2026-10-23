<script setup lang="ts">
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
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
  <LivDialog :open="open" :title="title?'编辑开票抬头':'新增开票抬头'" settings dark @update:open="!$event&&!busy&&emit('close')">
    <form id="invoice-title-form" class="liv-settings-copy grid gap-4" @submit.prevent="save">
      <label>抬头类型<USelect v-model="form.title_type" :items="[{value:'personal',label:'个人'},{value:'company',label:'企业'}]" class="w-full"/></label>
      <label>抬头名称<UInput v-model="form.title_name" required :minlength="2" :maxlength="160" class="w-full"/></label>
      <label v-if="form.title_type==='company'">纳税人识别号<UInput v-model="form.tax_id" required :maxlength="20" class="w-full"/></label>
      <label>接收邮箱<UInput v-model="form.email" type="email" required :maxlength="254" class="w-full"/></label>
      <label>联系电话（选填）<UInput v-model="form.phone" :maxlength="32" class="w-full"/></label>
      <UCheckbox v-model="form.is_default" label="设为默认抬头"/>
      <p v-if="error" role="alert">{{error}}</p>
    </form>
    <template #footer><LivButton settings variant="secondary" :disabled="busy" @click="emit('close')">取消</LivButton><LivButton settings variant="primary" form="invoice-title-form" type="submit" :disabled="busy" :loading="busy">保存抬头</LivButton></template>
  </LivDialog>
</template>
