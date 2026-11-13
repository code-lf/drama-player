<script setup lang="ts">
import LivButton from '~/components/liv-ui/LivButton.vue'

const props=defineProps<{start:number;end:number;offset?:number;disabled?:boolean;step:number;label:string}>()
const emit=defineEmits<{apply:[range:{start:number;end:number;offset?:number}]}>()
const start=ref<number>(),end=ref<number>(),offset=ref<number>()
// 以已投影的候选作为显示来源；用户编辑三个数值后一次提交，不逐键保存。
watch(()=>[props.start,props.end,props.offset],()=>{
  start.value=props.start/1000;end.value=props.end/1000
  offset.value=props.offset===undefined?undefined:props.offset/1000
},{immediate:true})
const valid=computed(()=>Number.isFinite(start.value)&&Number.isFinite(end.value)&&Number(end.value)>Number(start.value)&&
  (props.offset===undefined||Number.isFinite(offset.value)))
function apply(){
  if(props.disabled||!valid.value)return
  const toMs=(value:number|undefined)=>Math.round(Number(value)*1000/props.step)*props.step
  emit('apply',{start:toMs(start.value),end:toMs(end.value),...(props.offset===undefined?{}:{offset:toMs(offset.value)})})
}
</script>

<template>
  <form class="editing-range" :aria-label="label" @submit.prevent="apply">
    <label>源起点（秒）<UInputNumber v-model="start" :min="0" :step="step/1000" :disabled="disabled" /></label>
    <label>源终点（秒）<UInputNumber v-model="end" :min="step/1000" :step="step/1000" :disabled="disabled" /></label>
    <label v-if="props.offset!==undefined">在成片中开始（秒）<UInputNumber v-model="offset" :min="0" :step="step/1000" :disabled="disabled" /></label>
    <LivButton type="submit" :disabled="disabled||!valid">{{label}}</LivButton>
  </form>
</template>

<style scoped>
.editing-range{display:grid;gap:8px}
.editing-range label{display:flex;gap:8px;align-items:center;justify-content:space-between}
.editing-range :deep([data-slot=root]){width:132px;flex:none}
</style>
