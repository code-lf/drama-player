<script setup lang="ts">
import {ref,computed,watch,onMounted,onBeforeUnmount} from 'vue'
import {responseElapsedMs,responseTimeLabel,type ResponseTiming} from '../responseTiming'
const props=defineProps<{run:ResponseTiming}>()
const now=ref(Date.now()),elapsed=computed(()=>responseElapsedMs(props.run,now.value))
let timer:ReturnType<typeof setInterval>|undefined
/** 只给当前正在响应的流程启用秒表，历史消息不创建计时器。 */
function synchronize(){if(timer)clearInterval(timer);timer=undefined;now.value=Date.now();if(import.meta.client&&props.run.status==='planning'&&props.run.response_started_at)timer=setInterval(()=>{now.value=Date.now()},1000)}
watch([()=>props.run.status,()=>props.run.response_started_at],synchronize)
onMounted(synchronize);onBeforeUnmount(()=>{if(timer)clearInterval(timer)})
</script>
<template><span v-if="elapsed!==null" class="liv-response-time" :aria-label="responseTimeLabel(elapsed,run.status==='planning')">{{responseTimeLabel(elapsed,run.status==='planning')}}</span></template>
<style scoped>.liv-response-time{margin-left:auto;flex:none;white-space:nowrap;font-size:12px;font-weight:400;color:var(--liv-settings-muted);font-variant-numeric:tabular-nums}</style>
