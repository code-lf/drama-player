<script setup lang="ts">
import LoginPage from '~/pages/login.vue'
// liv-ui 目录按前缀自动命名，显式导入避免运行时把弹窗渲染成普通标签。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
defineProps<{modelValue:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:boolean];authenticated:[]}>()
const { loginDestination } = useWorkbenchAuth()
const close=()=>{loginDestination.value='';emit('update:modelValue',false)}
/** 关闭不修改草稿；成功只恢复登录态，任何收费行为仍需用户重新点击。 */
function authenticated(){const destination=loginDestination.value;close();emit('authenticated');if(destination)void navigateTo(destination)}
</script>
<template>
  <LivDialog :open="modelValue" title="注册/登录享福利哦" close-label="关闭登录" settings dark width="sm" @update:open="value=>{if(!value)close()}">
    <LoginPage v-if="modelValue" embedded @authenticated="authenticated" />
  </LivDialog>
</template>
<style scoped>
/* 传送层用真实登录内容定位，仅扩大登录标题，不改变其他设置弹窗。 */
:global(.liv-settings-dialog:has(.login-embedded)){max-width:var(--liv-login-dialog-width)!important}
:global(.liv-settings-dialog:has(.login-embedded) .liv-settings-title){font-size:var(--liv-recharge-title-size)!important;font-weight:700!important;line-height:32px!important;text-align:center}
:global(.liv-settings-dialog:has(.login-embedded) .liv-settings-body){padding-bottom:24px!important}
</style>
