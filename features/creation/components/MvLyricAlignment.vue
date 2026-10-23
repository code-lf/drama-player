<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import type {CreationDraft} from '../types'
import {creationService,type MvAlignment,type MvLyricCue} from '~/shared/api/services/creationService'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
const props=defineProps<{draft:CreationDraft;audioUrl?:string}>()
const emit=defineEmits<{confirmed:[extra:Record<string,unknown>]}>()
const open=ref(false),busy=ref(false),error=ref(''),state=ref<MvAlignment|null>(null),lyrics=ref(''),cues=ref<MvLyricCue[]>([])
let epoch=0,timer:ReturnType<typeof setTimeout>|undefined
const extra=computed(()=>props.draft.parameters.extra||{})
const pending=computed(()=>['queued','waiting','running','submitting'].includes(state.value?.status||''))
const confirmed=computed(()=>!!extra.value.mv_alignment_confirmation)
/** 切歌、关闭和卸载丢弃迟到响应；只读轮询绝不重新提交识别。 */
function stop(){epoch++;busy.value=false;if(timer)clearTimeout(timer)}
watch(()=>props.draft.references[0]?.version_id,()=>{stop();state.value=null;open.value=false})
watch(open,value=>{if(!value)stop()})
onBeforeUnmount(stop)
function adopt(value:MvAlignment){state.value=value;lyrics.value=String(extra.value.mv_lyrics||value.lyrics||'');cues.value=value.cues.map(c=>({...c}))}
async function poll(token:number){
  if(token!==epoch||!open.value||!state.value||!pending.value)return
  try{const value=await creationService.mvAlignment(state.value.id);if(token!==epoch)return;adopt(value);if(pending.value)timer=setTimeout(()=>poll(token),5000)}catch(cause){if(token===epoch)error.value=(cause as Error).message}
}
async function show(){
  stop();open.value=true;error.value='';state.value=null
  lyrics.value=String(extra.value.mv_lyrics||'');cues.value=[]
  const id=String(extra.value.mv_alignment_id||'');if(!id)return
  busy.value=true;const token=epoch
  try{const value=await creationService.mvAlignment(id,String(extra.value.mv_alignment_confirmation||''));if(token===epoch){adopt(value);void poll(token)}}catch(cause){if(token===epoch)error.value=(cause as Error).message}finally{if(token===epoch)busy.value=false}
}
async function start(retry=false){
  if(busy.value)return
  busy.value=true;error.value='';const token=epoch
  try{const value=await creationService.startMvAlignment(props.draft,retry);if(token!==epoch)return;adopt(value);emit('confirmed',{mv_alignment_id:value.id,mv_alignment_confirmation:''});void poll(token)}catch(cause){if(token===epoch)error.value=(cause as Error).message}finally{if(token===epoch)busy.value=false}
}
async function confirm(){
  if(!state.value||busy.value)return
  busy.value=true;error.value='';const token=epoch
  try{const value=await creationService.confirmMvAlignment(state.value.id,lyrics.value,cues.value,state.value.input_revision);if(token!==epoch)return;emit('confirmed',{mv_alignment_id:value.alignment_id,mv_alignment_confirmation:value.confirmation,mv_lyrics:value.lyrics,mv_lyrics_source:'user'});open.value=false}catch(cause){if(token===epoch)error.value=(cause as Error).message}finally{if(token===epoch)busy.value=false}
}
/** 人工添加必须填写真实起止，默认空时长不能蒙混确认，也不会均分歌曲。 */
function add(){cues.value.push({sort_index:cues.value.length+1,start_ms:cues.value.at(-1)?.end_ms||0,end_ms:0,text:''})}
</script>
<template>
  <UButton v-if="draft.references.length && !extra.mv_instrumental" color="neutral" variant="ghost" @click="show">{{confirmed?'歌词已确认 · 校正':'歌词时间轴'}}</UButton>
  <LivDialog :open="open" @update:open="open=$event" settings dark title="试听与校正歌词">
    <div class="liv-settings-copy space-y-4">
      <audio v-if="audioUrl" :src="audioUrl" controls preload="metadata" class="w-full"/>
      <p class="liv-settings-note">对齐由平台承担，同一音频版本复用结果。请试听并校正真实时间；不会按字数估算，也不会自动改写歌词。</p>
      <UButton v-if="!state" :loading="busy" @click="start()">获取原歌曲时间轴</UButton>
      <p v-if="pending" role="status">正在读取时间轴，可关闭后继续查询。</p>
      <p v-if="state?.error" class="liv-settings-note">{{state.error}}</p>
      <UButton v-if="state?.can_retry" :disabled="busy" @click="start(true)">重试对齐（最多一次）</UButton>
      <UButton v-else-if="state && !pending" :disabled="busy" variant="ghost" @click="start()">重新查询原任务</UButton>
      <label class="block">歌词原文<UTextarea v-model="lyrics" :disabled="pending||busy" :rows="5" class="w-full" placeholder="保留原歌词，逐句校正下方时间轴"/></label>
      <div v-for="(cue,index) in cues" :key="index" class="space-y-2">
        <div class="flex flex-wrap items-center gap-2"><span>第 {{index+1}} 句（毫秒）</span><UInputNumber v-model="cue.start_ms" :min="0" :max="state?.duration_ms||0" :step="10" aria-label="歌词起点毫秒"/><UInputNumber v-model="cue.end_ms" :min="0" :max="state?.duration_ms||0" :step="10" aria-label="歌词终点毫秒"/><UButton color="neutral" variant="ghost" aria-label="移除本句" icon="i-lucide-trash-2" @click="cues.splice(index,1)"/></div>
        <UTextarea v-model="cue.text" :rows="2" class="w-full" aria-label="本句歌词"/>
      </div>
      <UButton v-if="state" variant="ghost" @click="add">添加一句</UButton>
      <p v-if="error" role="alert">{{error}}</p>
    </div>
    <template #footer><LivButton settings block variant="primary" :disabled="!state||!cues.length||busy||pending" :loading="busy" @click="confirm">已试听，确认当前歌词</LivButton></template>
  </LivDialog>
</template>
