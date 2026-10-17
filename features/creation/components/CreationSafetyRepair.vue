<script setup lang="ts">
import {ref, watch, onBeforeUnmount} from 'vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import type {ImageSafetyRepair} from '~/entities/product-image/types'
import {productImageService} from '~/shared/api/services/productImageService'
import {productVideoService} from '~/shared/api/services/productVideoService'

const props=defineProps<{batchId:string;mediaKind?:'image'|'video';saved?:ImageSafetyRepair|null;automatic?:boolean;disabled?:boolean}>()
const emit=defineEmits<{adopt:[value:ImageSafetyRepair & {edited?:boolean},restore:()=>void]}>()
const candidate=ref<ImageSafetyRepair|null>(null),busy=ref(false),error=ref(''),attempted=ref(false)
const suggestedText=ref(''),dismissed=ref(false)
let epoch=0,timer:ReturnType<typeof setTimeout>|undefined,polls=0
/** 断线后只读取原候选，不重放 POST；最多轮询一分钟，避免永久加载。 */
function scheduleRead(){
  // 服务端渲染不启动定时请求，建议恢复轮询只在浏览器进行。
  if(typeof window==='undefined')return
  if(candidate.value?.status!=='processing')return
  if(polls++>=20){error.value='整理仍未返回，可稍后重读建议。';return}
  timer=setTimeout(()=>void readSaved(),3000)
}
async function readSaved(){
  const current=epoch,id=props.batchId
  busy.value=true;error.value=''
  try{
    const history=props.mediaKind==='video'?await productVideoService.getTask(id):await productImageService.getHistory(id)
    if(current!==epoch)return
    candidate.value=history.safetyRepair||null
    if(!candidate.value)error.value='尚未读到建议，请稍后重读或手动修改需求。'
    scheduleRead()
  }catch{if(current===epoch)error.value='建议读取失败，请重读建议。'}
  finally{if(current===epoch)busy.value=false}
}
async function propose(){
  if(busy.value||attempted.value||props.disabled)return
  attempted.value=true;busy.value=true;error.value=''
  const current=epoch
  try{
    const result=props.mediaKind==='video'?await productVideoService.safetyRepair(props.batchId):await productImageService.safetyRepair(props.batchId)
    if(current!==epoch)return
    candidate.value=result;scheduleRead()
  }catch{if(current===epoch)error.value='建议暂未返回，请重读建议。'}
  finally{if(current===epoch)busy.value=false}
}
watch(()=>props.batchId,()=>{
  epoch++;clearTimeout(timer);polls=0;busy.value=false;error.value='';attempted.value=!!props.saved
  dismissed.value=false;suggestedText.value=props.saved?.prompt||''
  candidate.value=props.saved||null
  if(candidate.value?.status==='processing')scheduleRead()
},{immediate:true})
watch(()=>props.saved,value=>{if(value){candidate.value=value;attempted.value=true}},{deep:true})
// 只在首次读到候选时填入，后续历史轮询不能覆盖用户在卡片内编辑的文字。
watch(()=>candidate.value?.prompt,(value,previous)=>{if(value && !previous)suggestedText.value=value},{immediate:true})
/** 取消只收起本条建议，不删除任务；确认发送可编辑的新需求，仍需核对真实报价。 */
function confirmSuggestion(){
  const value=candidate.value,text=suggestedText.value.trim()
  if(value?.status!=='ready'||!text||text.length>8000||busy.value||props.disabled)return
  // 点击后立即收起旧操作区，避免新轮次进行中仍展示失效输入框；未接收时允许恢复。
  dismissed.value=true
  const current=epoch
  emit('adopt',{...value,prompt:text,edited:text!==value.prompt},()=>{if(current===epoch)dismissed.value=false})
}
function cancelSuggestion(){dismissed.value=true;epoch++;clearTimeout(timer);busy.value=false}
// 仅本页观察到的新失败主动整理；刷新历史只展示已有候选或手动入口。
watch(()=>[props.automatic,props.disabled],([automatic,disabled])=>{if(automatic&&!disabled)void propose()},{immediate:true})
onBeforeUnmount(()=>{epoch++;clearTimeout(timer)})
</script>

<template>
  <section v-if="!dismissed && (candidate || busy || error)" class="liv-safety-repair" aria-label="AI 合规修改建议" @click.stop>
    <p v-if="busy || (candidate?.status==='processing' && !error)" role="status">正在重新整理中…</p>
    <template v-if="candidate?.status==='ready'">
      <p>建议按以下内容生成：</p>
      <UTextarea v-model="suggestedText" class="liv-safety-input" aria-label="建议内容" :rows="5" :maxlength="8000" :disabled="disabled || busy"/>
      <div class="liv-safety-actions">
        <LivButton settings variant="primary" block :disabled="disabled || busy || !suggestedText.trim()" @click="confirmSuggestion">确认</LivButton>
        <LivButton settings variant="secondary" block class="liv-safety-cancel" :disabled="busy" @click="cancelSuggestion">取消</LivButton>
      </div>
    </template>
    <p v-else-if="candidate && candidate.status!=='processing'">{{candidate.message?.replace('；未重新生成。','。') || '请手动修改需求。'}}</p>
    <p v-if="error" role="status">{{error}}</p>
    <UButton v-if="error" variant="ghost" :disabled="busy" @click="polls=0;readSaved()">重读建议</UButton>
  </section>
</template>

<style scoped>
.liv-safety-repair{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:8px;font-size:12px;color:var(--liv-settings-muted);min-width:0}
.liv-safety-repair p{margin:0;padding:0;overflow-wrap:anywhere;white-space:pre-wrap}
/* 仅输入框承载建议，不恢复外层灰色空卡；正文与控件沿用工作台深色令牌。 */
.liv-safety-input{width:100%;min-width:0}
.liv-safety-input :deep(textarea){width:100%;font-size:14px;line-height:1.7;color:var(--liv-chat-assistant-text);background:var(--liv-number-surface);border:1px solid var(--color-border-soft);border-radius:8px}
.liv-safety-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
/* 胶囊尺寸和主色复用 LivButton settings；取消使用真实灰色实心表面。 */
.liv-safety-actions :deep(.liv-safety-cancel){background:var(--liv-number-surface)!important;color:var(--liv-chat-assistant-text)!important}
</style>
