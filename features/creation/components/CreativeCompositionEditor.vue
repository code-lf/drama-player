<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue'
import type {CreativeNode} from '../agentCanvas'
import type {SessionResult} from '../resultCatalog'
import {videoCompositionService as api} from '~/shared/api/services/videoCompositionService'
import CreationCompositionPanel from './CreationCompositionPanel.vue'
const props=defineProps<{sessionId:string;ownerId:string;nodeId:string;inputs:CreativeNode[];beforeSave:()=>Promise<boolean>}>()
const emit=defineEmits<{changed:[]}>()
const outputId=ref(''),busy=ref(false),error=ref(''),panel=ref<InstanceType<typeof CreationCompositionPanel>|null>(null)
let alive=true
/** 来源仅接受已完成的真实视频；连接中的任务不会被当作可合成文件。 */
const sources=computed<SessionResult[]>(()=>props.inputs.flatMap(node=>node.data.source?.kind==='video'&&node.data.source.result_id&&node.data.url?[{
  key:node.id,messageId:'',versionKey:node.data.source.result_id,kind:'video' as const,title:node.data.title,
  summary:node.data.prompt,url:node.data.url,source:node.data.source,
}]:[]))
/** 只读恢复绑定；新节点尚未自动保存时404表示需要先显式保存，不创建默认成片。 */
async function read(){
  busy.value=true;error.value=''
  try{const value=await api.canvasBinding(props.sessionId,props.nodeId);if(alive)outputId.value=value.output_id||''}
  catch(cause){if(alive&&(cause as {statusCode?:number}).statusCode!==404)error.value=(cause as Error).message}
  finally{if(alive)busy.value=false}
}
/** 保存画布成功才建立幂等绑定；这里只建立片段计划，生成需下方独立确认。 */
async function create(){
  if(busy.value)return
  busy.value=true;error.value=''
  try{
    if(!await props.beforeSave())throw new Error('画布尚未保存成功，请先处理保存提示。')
    if(!alive)return
    const value=await api.canvasBinding(props.sessionId,props.nodeId,true)
    if(alive){outputId.value=value.output_id||'';emit('changed')}
  }catch(cause){if(alive)error.value=(cause as Error).message}
  finally{if(alive)busy.value=false}
}
onMounted(read);onBeforeUnmount(()=>{alive=false})
defineExpose({isDirty:()=>panel.value?.isDirty()||false,isBusy:()=>busy.value||panel.value?.isBusy()||false})
</script>
<template>
  <div class="creative-composition-editor">
    <p v-if="!inputs.length" class="text-muted">将已完成视频右侧的圆点连接到此节点左侧，作为合成来源。</p>
    <p v-else-if="sources.length!==inputs.length" class="text-muted">部分连接尚无已完成视频，完成后才能加入片段计划。</p>
    <CreationCompositionPanel v-if="outputId" :key="outputId" ref="panel" :session-id="sessionId" :owner-id="ownerId" :output-id="outputId" :sources="sources" linked-only @changed="emit('changed')"/>
    <template v-else><p>按连接来源选择片段、调整顺序和截取区间。原视频保留，合成不新增扣点。</p><UButton :disabled="busy||!sources.length" :loading="busy" @click="create">创建片段计划</UButton></template>
    <p v-if="error" role="alert">{{error}}</p>
  </div>
</template>
