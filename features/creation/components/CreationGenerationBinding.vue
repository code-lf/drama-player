<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {creationService,type CreationRun} from '~/shared/api/services/creationService'
import {videoCompositionService as api,type CompositionGeneration} from '~/shared/api/services/videoCompositionService'
import {videoBatchStatus} from '../videoPlanState'
import AssistantReply from './AssistantReply.vue'

const props=defineProps<{sessionId:string;outputId:string;beforeChange:()=>boolean}>()
const emit=defineEmits<{busy:[value:boolean];changed:[];openRun:[id:string]}>()
const {confirm}=useActionDialog()
const state=ref<CompositionGeneration>({draft_revision:0,generation:null}),ready=ref(false),loading=ref(false),busy=ref(false),error=ref('')
const choices=ref<CreationRun[]>([]),picker=ref(false),runId=ref(''),selected=ref<string[]>([]),expanded=ref('')
const source=computed(()=>choices.value.find(run=>run.id===runId.value))
const sourceItems=computed(()=>source.value?.creative_plan?.items||[])
const bound=computed(()=>state.value.generation)
const canReadResults=computed(()=>bound.value?.phase==='waiting_generation'&&!!bound.value.statuses.length&&bound.value.statuses.every(item=>item.status==='succeeded'))
let alive=true,readEpoch=0,receipt:{key:string;id:string}|null=null
watch(busy,value=>emit('busy',value))
watch(runId,()=>{selected.value=[...(source.value?.creative_plan?.selected_ids||sourceItems.value.map(item=>item.id))];expanded.value=''})
/** 恢复只读，刷新不替换片段、不自动收费或生成。 */
async function reload(){
  const epoch=++readEpoch;loading.value=true
  try{const value=await api.generation(props.sessionId,props.outputId);if(alive&&epoch===readEpoch){state.value=value;ready.value=true}}
  catch(cause){if(alive&&epoch===readEpoch)error.value=(cause as Error).message||'规划来源读取失败。'}
  finally{if(alive&&epoch===readEpoch)loading.value=false}
}
/** 用户明确展开选择器后才读取同会话来源，不让全部历史规划阻塞片段编辑。 */
async function chooseSource(){
  if(busy.value)return
  busy.value=true;error.value=''
  try{const runs=await creationService.runs(props.sessionId);if(!alive)return;choices.value=runs.filter(run=>run.creative_plan?.items.length&&!run.superseded_by&&run.status!=='cancelled');picker.value=true;if(!choices.value.some(run=>run.id===runId.value))runId.value=choices.value[0]?.id||''}
  catch(cause){if(alive)error.value=(cause as Error).message||'来源视频方案读取失败。'}
  finally{if(alive)busy.value=false}
}
function toggle(id:string,value:boolean){selected.value=value?[...selected.value.filter(item=>item!==id),id]:selected.value.filter(item=>item!==id)}
function move(id:string,direction:number){const ids=[...selected.value],index=ids.indexOf(id),target=index+direction;if(index<0||target<0||target>=ids.length)return;[ids[index],ids[target]]=[ids[target]!,ids[index]!];selected.value=ids}
/** 只打开后台已核对的正式重试计划；不在合成卡里生成或绕过费用确认。 */
function retrySource(id:string){return bound.value?.statuses.find(item=>item.item_id===id)?.retry_run_id}
/** 所有写入均来自明确按钮，先统一说明替换/未保存影响；同一内容的网络重试沿用请求号。 */
async function change(action:'bind'|'materialize'|'clear'){
  if(!ready.value||loading.value||busy.value||!props.beforeChange())return
  if(action==='bind'&&(!source.value?.creative_plan||!selected.value.length))return
  if(action==='materialize'&&!canReadResults.value)return
  busy.value=true;error.value=''
  try{
    const text=action==='bind'?'绑定将替换当前成片的片段清单，未保存名称/片段编辑不会自动保存。视频仍需返回原方案独立核价和确认，不会现在生成。是否继续？':action==='materialize'?'将按绑定顺序读取全部真实视频，并替换当前片段清单；未保存编辑不会自动保存。不自动合成、不重新生成视频。是否继续？':'解除来源后转为手动选片，未保存编辑不会自动保存。已经提交的视频任务和现有作品不会取消或删除。是否继续？'
    if(!await confirm(text,'核对成片来源')||!alive||!props.beforeChange())return
    const key=JSON.stringify([action,state.value.draft_revision,runId.value,source.value?.creative_plan?.revision,selected.value])
    if(receipt?.key!==key)receipt={key,id:crypto.randomUUID()}
    if(action==='bind')await api.bindGeneration(props.sessionId,props.outputId,{expected_revision:state.value.draft_revision,request_id:receipt.id,run_id:runId.value,plan_revision:source.value!.creative_plan!.revision,item_ids:selected.value})
    else if(action==='materialize')await api.materialize(props.sessionId,props.outputId,state.value.draft_revision)
    else await api.clearGeneration(props.sessionId,props.outputId,{expected_revision:state.value.draft_revision,request_id:receipt.id})
    if(!alive)return
    picker.value=false;emit('changed');await reload();receipt=null
  }catch(cause){if(alive)error.value=(cause as Error).message||'操作状态待核对，请刷新来源和草稿，不要重复创建视频。'}
  finally{if(alive)busy.value=false}
}
defineExpose({reload})
onMounted(()=>void reload())
onBeforeUnmount(()=>{alive=false;readEpoch++;emit('busy',false)})
</script>
<template>
  <section class="rounded-lg border border-default p-3 space-y-3" aria-label="规划片段来源">
    <h3 class="font-semibold">规划片段与生成结果</h3>
    <p v-if="bound">{{bound.phase==='needs_rebind'?'来源已变化，请重新核对绑定':bound.phase==='ready_to_compose'?'已回填真实片段，仍需下方确认合成':'已固定规划片段，等待逐条视频结果'}} · {{bound.item_ids.length}} 个规划片段</p>
    <p v-else>可手动选已有视频，也可绑定本会话的视频方案。绑定不等于已核价、已生成或已合成。</p>
    <ol v-if="bound" class="space-y-1">
      <li v-for="(id,index) in bound.item_ids" :key="id" class="flex flex-wrap items-center gap-2">
        <span>{{index+1}}. {{bound.items.find(item=>item.id===id)?.title}} · {{bound.statuses.find(item=>item.item_id===id)?.status==='not_submitted'?'尚未提交生成':videoBatchStatus(bound.statuses.find(item=>item.item_id===id)?.status)}}</span>
        <UButton v-if="retrySource(id)" color="neutral" variant="outline" :disabled="busy||loading" @click="emit('openRun',retrySource(id)!)">查看本片段重试方案</UButton>
      </li>
    </ol>
    <div class="flex flex-wrap gap-2">
      <UButton color="neutral" variant="outline" :disabled="busy||loading||!ready" @click="chooseSource">选择视频方案作为规划片段</UButton>
      <UButton color="neutral" variant="outline" :disabled="busy||loading" :loading="loading" @click="reload">刷新片段任务状态</UButton>
      <UButton v-if="bound" color="neutral" variant="outline" :disabled="busy" @click="emit('openRun',bound.run_id)">打开原视频方案核价与确认</UButton>
      <UButton v-if="bound" color="neutral" variant="outline" :disabled="busy||loading" @click="change('clear')">解除绑定，改为手动选片</UButton>
      <UButton v-if="canReadResults" :disabled="busy||loading" @click="change('materialize')">读取全部真实结果并填入片段</UButton>
    </div>
    <div v-if="picker" class="space-y-3">
      <p v-if="!choices.length" class="text-muted">本会话尚无可绑定的视频计划，请先在对话中整理完整方案。</p>
      <USelect v-else v-model="runId" :items="choices.map(run=>({label:`${run.creative_plan?.items[0]?.title||'视频方案'} · ${run.creative_plan?.total_count} 条 · 修订${run.creative_plan?.revision}`,value:run.id}))" aria-label="来源视频方案" :disabled="busy"/>
      <div v-for="item in sourceItems" :key="item.id" class="rounded-xl border p-3 space-y-2" :class="selected.includes(item.id)?'border-primary bg-primary/5':'border-default'">
        <UCheckbox :model-value="selected.includes(item.id)" :label="item.title" :disabled="busy" @update:model-value="value=>toggle(item.id,!!value)"/>
        <p class="text-muted">{{item.parameters.model}} · {{item.parameters.durationSec}} 秒 · {{item.parameters.aspectRatio}} · {{item.parameters.resolution}}</p>
        <UButton color="neutral" variant="ghost" :disabled="busy" @click="expanded=expanded===item.id?'':item.id">核对完整分镜</UButton>
        <AssistantReply v-if="expanded===item.id" :text="item.prompt"/>
      </div>
      <ol class="space-y-1"><li v-for="(id,index) in selected" :key="id" class="flex flex-wrap items-center gap-2">{{index+1}}. {{sourceItems.find(item=>item.id===id)?.title}}<UButton color="neutral" variant="outline" :disabled="busy||index===0" @click="move(id,-1)">片段前移</UButton><UButton color="neutral" variant="outline" :disabled="busy||index===selected.length-1" @click="move(id,1)">片段后移</UButton></li></ol>
      <UButton :disabled="busy||loading||!selected.length" @click="change('bind')">绑定所选 {{selected.length}} 个规划片段，不提交生成</UButton>
    </div>
    <p v-if="error" role="alert" class="text-error">{{error}}</p>
  </section>
</template>
