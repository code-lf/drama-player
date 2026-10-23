<script setup lang="ts">
// 仅反映本轮真实请求阶段，不承载模型思考正文或额外生成的摘要。
defineProps<{run:{status:string;response_phase?:'queued'|'thinking'|'responding';stream_text?:string}}>()
</script>
<template>
  <p v-if="run.status==='planning' && !run.stream_text" class="liv-thinking-indicator" role="status">
    <UIcon name="i-lucide-loader-circle" class="animate-spin" aria-hidden="true"/>
    <span :class="{'is-thinking':run.response_phase==='thinking'}">{{run.response_phase==='thinking'?'思考中':'正在响应'}}</span>
  </p>
</template>
<style scoped>
.liv-thinking-indicator{display:flex;align-items:center;gap:7px;margin:4px 0 12px!important;padding:0!important;font-size:12px;font-weight:400;color:var(--liv-settings-muted)!important}
.liv-thinking-indicator>.iconify{width:14px;height:14px;flex:none}
/* 仅收到真实思考事件时扫光，正式正文、结束、失败或取消都会退出此状态。 */
.is-thinking{background:linear-gradient(100deg,var(--liv-settings-muted) 25%,var(--liv-account-text) 45%,var(--liv-settings-muted) 65%);background-size:250% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;animation:liv-thinking-shimmer 1.8s linear infinite}
@keyframes liv-thinking-shimmer{from{background-position:150% 0}to{background-position:-100% 0}}
@media(prefers-reduced-motion:reduce){.is-thinking{animation:none;background:none;color:var(--liv-settings-muted)}.animate-spin{animation:none}}
</style>
