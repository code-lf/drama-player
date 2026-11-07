<script setup lang="ts">
import {computed} from 'vue'
import {runProcessEvents} from '../processEvents'
import type {CanvasToolEvent,ProcessEvent} from '../processEvents'
// 已有公开正文在输出，或可见操作正在进行时，不重复显示通用等待提示。
const props=defineProps<{run:{status:string;response_phase?:'queued'|'thinking'|'responding';stream_text?:string;skill_agent_events?:CanvasToolEvent[];flow_runtime?:{events?:ProcessEvent[]}}}>()
const toolProcessing=computed(()=>runProcessEvents(props.run).some(event=>event.status==='processing'&&
  (!event.kind||event.kind==='business_record'||event.kind==='assistant_text')))
</script>
<template>
  <p v-if="run.status==='planning' && !run.stream_text && !toolProcessing" class="liv-thinking-indicator" role="status">
    <UIcon name="i-lucide-loader-circle" class="animate-spin" aria-hidden="true"/>
    <span class="is-thinking">正在思考…</span>
  </p>
</template>
<style scoped>
.liv-thinking-indicator{display:flex;align-items:center;gap:7px;margin:4px 0 12px!important;padding:0!important;font-size:12px;font-weight:400;color:var(--liv-settings-muted)!important}
.liv-thinking-indicator>.iconify{width:14px;height:14px;flex:none}
/* 这是等待公开结果的界面提示，不表示展示模型内部推理；正文、结束、失败或取消退出。 */
/* 固定文字盒与完整单向扫光区间，避免行内背景跨循环时在半个字宽处回卷。 */
.is-thinking{display:inline-block;flex:none;background:linear-gradient(90deg,var(--liv-settings-muted) 0%,var(--liv-settings-muted) 35%,var(--liv-account-text) 50%,var(--liv-settings-muted) 65%,var(--liv-settings-muted) 100%);background-size:300% 100%;background-repeat:no-repeat;background-clip:text;-webkit-background-clip:text;color:transparent;animation:liv-thinking-shimmer 1.8s linear infinite}
@keyframes liv-thinking-shimmer{from{background-position:100% 0}to{background-position:0% 0}}
@media(prefers-reduced-motion:reduce){.is-thinking{animation:none;background:none;color:var(--liv-settings-muted)}.animate-spin{animation:none}}
</style>
