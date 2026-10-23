<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { nearestDurationIndex } from '../durationOptions'

// 复用USlider：拖动位置是临时小数索引，松开才吸附并提交真实合法秒数。
const props=withDefaults(defineProps<{modelValue:number; values:number[]; disabled?:boolean; label?:string}>(),{disabled:false,label:'时长'})
const emit=defineEmits<{'update:modelValue':[value:number]}>()
const options=computed(()=>[...new Set(props.values.filter(n=>Number.isInteger(n)&&n>0))].sort((a,b)=>a-b))
const position=computed(()=>nearestDurationIndex(options.value,props.modelValue))
const draftPosition=ref(position.value)
const current=computed(()=>options.value[Math.max(0,Math.min(options.value.length-1,Math.round(draftPosition.value)))])
// 模型、目录或锁定状态改变时丢弃旧拖动位置，避免将上一模型的档位带入新报价。
watch([position,options,()=>props.disabled],()=>{draftPosition.value=position.value})
/** 拖动过程仅更新滑块，不修改业务参数、草稿和报价。 */
function select(value:number|number[]|undefined){
  if(props.disabled||!options.value.length||typeof value!=='number'||!Number.isFinite(value))return
  draftPosition.value=Math.max(0,Math.min(options.value.length-1,value))
}
/** USlider的change来自原生value-commit；松开时吸附，且只提交目录内有效秒数。 */
function commit(){
  if(props.disabled||!options.value.length)return
  draftPosition.value=Math.round(draftPosition.value)
  const seconds=options.value[draftPosition.value]
  if(seconds!==undefined&&seconds!==props.modelValue)emit('update:modelValue',seconds)
}
/** 键盘按合法档逐个选择，不受鼠标跟手所需的细步长影响。 */
function onKeydown(event:KeyboardEvent){
  if(props.disabled||options.value.length<2)return
  const offsets:Record<string,number>={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:1,PageDown:-1}
  if(!(event.key in offsets)&&event.key!=='Home'&&event.key!=='End')return
  event.preventDefault();event.stopPropagation()
  select(event.key==='Home'?0:event.key==='End'?options.value.length-1:Math.round(draftPosition.value)+(offsets[event.key]||0))
  commit()
}
</script>

<template>
  <div class="duration-slider" @keydown.capture="onKeydown">
    <div class="duration-slider-heading"><span>{{label}}</span><output>{{current===undefined?'暂无可选时长':`${current}秒`}}</output></div>
    <template v-if="options.length">
      <!-- 当前秒数已在标题实时显示；不在滑块端点重复弹提示，避免被参数浮层边界裁掉。 -->
      <USlider :model-value="draftPosition" :min="0" :max="Math.max(1,options.length-1)" :step="0.001" :disabled="disabled||options.length===1" :aria-label="label" :aria-valuetext="`${current}秒`" @update:model-value="select" @change="commit"/>
      <div class="duration-slider-scale" aria-hidden="true"><span v-for="(n,i) in options" :key="n" class="duration-slider-tick"><i/><span v-if="options.length<=6||i===0||i===options.length-1">{{n}}秒</span></span></div>
      <p v-if="options.length<=6" class="duration-slider-hint">仅支持 {{options.map(n=>`${n}秒`).join('／')}}</p>
    </template>
  </div>
</template>

<style scoped>
.duration-slider{display:grid;gap:12px;width:100%;min-width:0;padding-block:4px}
.duration-slider-heading{display:flex;justify-content:space-between;align-items:center;font-size:14px;line-height:1.7;color:var(--color-text-muted)}
.duration-slider-heading output{color:var(--color-text-main);font-weight:500}
.duration-slider-scale{display:flex;justify-content:space-between;gap:0;color:var(--color-text-muted);font-size:12px;line-height:1.6}
.duration-slider-tick{display:flex;flex-direction:column;align-items:center;position:relative;min-width:0}
.duration-slider-tick i{width:4px;height:4px;border-radius:50%;background:var(--color-text-muted);opacity:.5;margin-bottom:4px}
.duration-slider-hint{margin:0;color:var(--color-text-muted);font-size:12px;line-height:1.6}
</style>
