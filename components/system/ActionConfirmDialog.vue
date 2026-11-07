<script setup lang="ts">
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import { useActionDialog } from '~/composables/useActionDialog'

const { current, settle } = useActionDialog()
const value = ref('')
// 每个新请求独立初始化输入，取消、关闭和 Escape 都返回未确认。
watch(current, request => { value.value = request?.initialValue || '' })
</script>

<template>
  <LivDialog :open="!!current" :title="current?.title || '操作确认'" settings dark width="sm" @update:open="open => { if (!open) settle(null) }">
    <p class="whitespace-pre-wrap text-sm leading-7">{{ current?.message }}</p>
    <input v-if="current?.input" v-model="value" aria-label="填写内容" class="mt-4 w-full rounded border border-default bg-default p-3" @keyup.enter="settle(value)">
    <template #footer>
      <LivButton settings variant="secondary" @click="settle(null)">取消</LivButton>
      <LivButton settings variant="primary" @click="settle(current?.input ? value : 'confirmed')">确认</LivButton>
    </template>
  </LivDialog>
</template>
