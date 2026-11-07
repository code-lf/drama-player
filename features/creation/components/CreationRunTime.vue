<script setup lang="ts">
import {ref,computed,watch,onMounted,onBeforeUnmount} from 'vue'
import {responseElapsedMs,responseTimeLabel,type ResponseTiming} from '../responseTiming'
const props=defineProps<{run:ResponseTiming;runs?:ResponseTiming[]}>()
// 同一需求累计各阶段真实模型响应耗时，等待确认不计入，缺失旧计时不补造。
const phases=computed(()=>props.runs?.length?props.runs:[props.run])
const working=computed(()=>phases.value.some(run=>run.status==='planning'&&!run.response_finished_at))
const now=ref(Date.now()),elapsed=computed(()=>{const values=phases.value.map(run=>responseElapsedMs(run,now.value)).filter((value):value is number=>value!==null);return values.length?values.reduce((sum,value)=>sum+value,0):null})
let timer:ReturnType<typeof setInterval>|undefined
/** 只给当前正在响应的流程启用秒表，历史消息不创建计时器。 */
function synchronize(){if(timer)clearInterval(timer);timer=undefined;now.value=Date.now();if(import.meta.client&&working.value)timer=setInterval(()=>{now.value=Date.now()},1000)}
watch(()=>phases.value.map(run=>[run.status,run.response_started_at,run.response_finished_at,run.response_elapsed_ms]),synchronize,{deep:true})
onMounted(synchronize);onBeforeUnmount(()=>{if(timer)clearInterval(timer)})
</script>
<template><span v-if="elapsed!==null" class="liv-response-time" :aria-label="responseTimeLabel(elapsed,working)">{{responseTimeLabel(elapsed,working)}}</span></template>
<style scoped>.liv-response-time{margin-left:auto;flex:none;white-space:nowrap;font-size:12px;font-weight:400;color:var(--liv-settings-muted);font-variant-numeric:tabular-nums}</style>
