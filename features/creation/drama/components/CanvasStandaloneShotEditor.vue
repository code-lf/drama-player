<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {request} from '~/shared/api/adapters/httpAdapter'
import type {StandaloneStoryboard} from '../standaloneStoryboard'

const props=defineProps<{sessionId:string;runId:string;shotId:string;revision:number;visual:string}>()
const emit=defineEmits<{saved:[runId:string,plan:StandaloneStoryboard]}>()
const text=ref(props.visual),saving=ref(false),error=ref('')
const dirty=computed(()=>text.value.trim()!==props.visual)
// 版本更新时保留尚未保存的文字；不会把旧版本的输入静默覆盖到最新稿。
const inputRevision=ref(props.revision)
watch(()=>[props.visual,props.revision] as const,([visual,revision],[previousVisual])=>{
  if(text.value.trim()===previousVisual||text.value.trim()===visual){text.value=visual;inputRevision.value=revision}
})

/** 只保存当前镜头文字，不自动准备生成，冲突时保留本地输入。 */
async function save(){
  if(!dirty.value||saving.value||!text.value.trim())return
  saving.value=true;error.value=''
  try{
    const plan=await request<StandaloneStoryboard>(`/creation/sessions/${props.sessionId}/runs/${props.runId}/storyboard/shots/${props.shotId}`,{
      method:'PATCH',body:{expected_revision:inputRevision.value,visual:text.value.trim()}})
    const shot=plan.shots.find(shot=>shot.id===props.shotId)
    if(shot){text.value=shot.visual;inputRevision.value=plan.revision;emit('saved',props.runId,plan)}
  }catch(cause){error.value=(cause as Error).message||'镜头没有保存，请重试。'}
  finally{saving.value=false}
}
</script>

<template>
  <UTextarea v-model="text" :maxlength="2400" :rows="5" :disabled="saving" aria-label="镜头画面说明" class="w-full"/>
  <UButton type="button" color="primary" :loading="saving" :disabled="!dirty||!text.trim()" @click="save">保存本镜</UButton>
  <p v-if="error" role="alert" class="creative-node-detail">{{error}}</p>
</template>
