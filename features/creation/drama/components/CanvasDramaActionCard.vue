<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import CreationConfirmationCard from '~/features/creation/components/CreationConfirmationCard.vue'
import CreationProcessEvents from '~/features/creation/components/CreationProcessEvents.vue'
import type {ProcessEvent} from '~/features/creation/processEvents'
import {creationService,type CreationRun,type DramaRenderReceipt} from '~/shared/api/services/creationService'
import {request} from '~/shared/api/adapters/httpAdapter'

const props=defineProps<{run:CreationRun;disabled?:boolean;trackProgress?:boolean}>()
const emit=defineEmits<{updated:[CreationRun];productionChanged:[];progress:[revision:string,status:string]}>()
const busy=ref(''),error=ref(''),script=ref(''),uncertain=ref(false)
const action=computed(()=>props.run.drama_action)
const isReview=computed(()=>action.value?.stage==='confirm_script')
// 锁定版本不是生成任务；只呈现服务端已确认的实际动作。
const isAssetLock=computed(()=>action.value?.stage==='lock_assets')
const isTake=computed(()=>action.value?.stage==='select_take')
const isRender=computed(()=>action.value?.stage==='render_episode')
const isPrevisual=computed(()=>action.value?.stage==='previsualize_shots')
const isShots=computed(()=>action.value?.stage==='generate_shots')
// 同一确认卡负责状态查询，底部进度只消费结果，不另开一组轮询。
const isSharedStage=computed(()=>!!(props.trackProgress&&action.value?.result&&(action.value.result.run_id||action.value.result.submission_id)&&
  ['analyze_script','prepare_assets','generate_asset_images','plan_storyboards'].includes(action.value.stage)))
const jobKey=computed(()=>isPrevisual.value?action.value?.result?.receipt:isShots.value?action.value?.result?.batch_id:isRender.value?action.value?.result?.job_id:isSharedStage.value?action.value?.revision:undefined)
const statusText=computed<Record<string,string>>(()=>({claimed:'确认已接收，正在核对操作结果。',unknown:'操作结果待核对，不会重复提交。',submitted:'本阶段已提交。',confirmed:isTake.value?'镜头版本已切换。':isAssetLock.value?'所选资产版本已锁定。':'正式剧本已确认。',rejected:'执行条件已变化，请重新准备本阶段。'}))
const render=ref<DramaRenderReceipt>(),renderBusy=ref(false),renderError=ref('')
const renderMessages:Record<string,string>={queued:'成片任务等待执行。',running:'正在合成本集。',completed:'本集成片已完成。',failed:'成片合成失败，原镜头和剪辑稿已保留。',blocked:'当前无法执行合成，原镜头和剪辑稿已保留。'}
const previsualMessages:Record<string,string>={waiting_for_results:'首帧预演正在处理。',ready:'测试首帧已保存到对应分镜。',failed:'首帧样本处理失败，原分镜已保留。',superseded:'分镜已更新，旧首帧不作为当前结果。'}
const shotMessages:Record<string,string>={waiting_for_results:'等待镜头视频结果。',ready:'测试镜头已保存到对应分镜。',failed:'部分镜头处理失败，已完成素材仍保留。',superseded:'分镜已更新，旧镜头不作为当前结果。'}
const sharedMessages:Record<string,string>={waiting_for_results:'本阶段已提交，等待实际结果。',ready:'本阶段成果已就绪。',failed:'本阶段未完成，已完成的成果仍保留。',superseded:'制作版本已变化，请核对最新结果。'}
// 后台任务与聊天模型分开表达：排队不冒充思考，终态说明采用真实产物摘要。
const renderMessage=computed(()=>render.value?.summary||(
  isSharedStage.value&&action.value?.stage==='analyze_script'&&render.value?.status==='waiting_for_results'
    ?render.value.phase==='queued'?'剧本解析任务等待开始，尚未返回解析结果。'
      :render.value.phase==='running'?'正在解析剧本结构，完成后将在本对话反馈结果。':'正在核对剧本解析进度。'
    :(isSharedStage.value?sharedMessages:isPrevisual.value?previsualMessages:isShots.value?shotMessages:renderMessages)[render.value?.status||'']||''))
let active=true
/** 业务执行也投影为同一紧凑处理行，字体、图标、前后间距不另写第二套。 */
const executionEvents=computed<ProcessEvent[]>(()=>{
  const value=action.value, receipt=render.value
  if(!value)return []
  const status:ProcessEvent['status']=error.value||['failed','blocked','rejected'].includes(receipt?.status||value.status)?'failed'
    :receipt?.phase==='running'||receipt?.status==='running'?'processing'
    :['ready','completed'].includes(receipt?.status||'')||value.status==='confirmed'?'succeeded'
    :receipt?.phase==='queued'||value.status==='submitted'?'queued':'unknown'
  return [{id:props.run.id+':'+value.revision,kind:'business_record',status,
    // 紧凑状态行只写阶段与真实状态；成果和错误另列反馈，不再把等待长句当正文挤在上一段下方。
    title:status==='processing'?`正在执行：${value.label}`:status==='queued'?`等待执行：${value.label}`:value.label,
    feedback:error.value||(status==='succeeded'?renderMessage.value:status==='failed'?renderMessage.value||statusText.value[value.status]:undefined)}]
})
let renderTimer:ReturnType<typeof setTimeout>|undefined
let renderRead=0
onBeforeUnmount(()=>{active=false;clearTimeout(renderTimer)})

/** 只跟踪当前这条确认卡关联的任务；迟到响应不能覆盖别轮作品。 */
async function inspectRender(){
  const id=props.run.id,job=jobKey.value,previsual=isPrevisual.value,shots=isShots.value,shared=isSharedStage.value
  if(!job||renderBusy.value)return
  clearTimeout(renderTimer)
  const read=++renderRead
  renderBusy.value=true;renderError.value=''
  try{
    const next=await (shared?creationService.dramaStageReceipt(id):previsual?creationService.dramaPrevisualReceipt(id):shots?creationService.dramaShotReceipt(id):creationService.dramaRenderReceipt(id))
    if(active&&read===renderRead&&id===props.run.id&&next.id===jobKey.value){
      const changed=render.value?.status!==next.status
      render.value=next
      if(['queued','running','waiting_for_results'].includes(next.status))renderTimer=setTimeout(inspectRender,4000)
      if(action.value)emit('progress',action.value.revision,next.status)
      if(changed&&(!shared||next.status==='ready'))emit('productionChanged')
    }
  }catch{if(active&&read===renderRead){
    renderError.value='暂时无法读取任务状态，可以重试查询。'
    if(action.value)emit('progress',action.value.revision,'unavailable')
  }}
  finally{if(active&&read===renderRead)renderBusy.value=false}
}
onMounted(()=>void inspectRender())
watch([()=>props.run.id,jobKey],()=>{
  ++renderRead;clearTimeout(renderTimer)
  renderBusy.value=false;render.value=undefined;renderError.value=''
  void inspectRender()
})

/** 剧本确认先展示服务端正式原文；不会用聊天摘要替代版本核对。 */
async function inspectScript(){
  if(busy.value||!props.run.session_id)return
  busy.value='read';error.value=''
  try{
    const result=await request<{source_text:string;project_id:string}>(`/creation/sessions/${props.run.session_id}/production-script-review`)
    if(active&&result.project_id===action.value?.project_id)script.value=result.source_text
  }catch(cause){if(active)error.value=(cause as Error).message||'暂时无法查看正式剧本。'}
  finally{if(active)busy.value=''}
}

/** 刷新与异常恢复只读原轮；只有明确点击确认才发送确认请求。 */
async function act(mode:'confirm'|'cancel'|'refresh'){
  const value=action.value,id=props.run.id
  if(!value||props.disabled||busy.value)return
  if(mode==='confirm'&&(uncertain.value||value.status!=='awaiting_confirmation'||!value.sufficient||isReview.value&&!script.value))return
  busy.value=mode;error.value=''
  try{
    if(mode==='confirm')await creationService.confirmDramaStage(id,value.revision)
    const result=mode==='cancel'?await creationService.cancelRun(id,'confirmation_defer'):await creationService.run(id)
    if(active&&result.id===props.run.id){uncertain.value=false;emit('updated',result);if(mode==='confirm'&&isTake.value)emit('productionChanged')}
  }catch(cause){
    if(active){
      if(mode==='confirm')uncertain.value=true
      error.value=(cause as Error).message||'暂时无法核对提交状态。'
    }
  }finally{if(active)busy.value=''}
}
</script>

<template>
  <CreationConfirmationCard v-if="action?.status==='awaiting_confirmation'&&!uncertain" model="" :spec="action.summary" target="drama"
    :action-name="action.label" :credits="action.credits??undefined" :no-charge="isReview||isAssetLock||isTake" hide-rules has-quote
    :warning="isReview?'本次只锁定正式剧本，不提交生成任务。':isAssetLock?'只锁定资产组当前选中的图片，不会重新生成或扣点。':isTake?'只切换原镜头版本，不重新生成。':isRender?'确认后按当前剪辑与音轨导出新成片，不覆盖旧作品。':'确认后提交本阶段，后续付费阶段仍需单独确认。'"
    :sufficient="action.sufficient" :quoting="false" :busy="!!busy||!!disabled" :cancelling="busy==='cancel'"
    :confirmation-disabled="isReview&&!script" :error="error" @confirm="act('confirm')" @cancel="act('cancel')">
    <template v-if="isReview">
      <UButton v-if="!script" color="neutral" variant="soft" :loading="busy==='read'" :disabled="disabled||!!busy" @click="inspectScript">查看正式剧本</UButton>
      <UTextarea v-else :model-value="script" :rows="6" readonly aria-label="正式剧本原文"/>
    </template>
  </CreationConfirmationCard>
  <div v-else-if="action&&(uncertain||statusText[action.status])" class="grid gap-2" role="status">
    <CreationProcessEvents :events="executionEvents"/>
    <UButton v-if="uncertain||action.status==='claimed'||action.status==='unknown'&&!jobKey" color="neutral" variant="soft" :loading="busy==='refresh'" :disabled="disabled||!!busy" @click="act('refresh')">刷新状态</UButton>
    <template v-if="jobKey">
      <video v-if="render?.status==='completed'&&render.output_url" class="aspect-video w-full rounded-lg bg-black" controls preload="metadata" :src="render.output_url" aria-label="短剧成片"/>
      <UButton v-if="render?.status==='completed'&&render.output_url" :to="render.output_url" target="_blank" color="neutral" variant="soft" icon="i-lucide-download">打开成片</UButton>
      <p v-if="renderError">{{renderError}}</p>
      <UButton v-if="!render||renderError" color="neutral" variant="soft" :loading="renderBusy" @click="inspectRender">{{isSharedStage?'查看阶段状态':isPrevisual?'查看首帧状态':isShots?'查看镜头状态':'查看成片状态'}}</UButton>
    </template>
  </div>
</template>

