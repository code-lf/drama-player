<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {creationService,type VideoPlan,type CreationRun,type VideoBatchItem} from '~/shared/api/services/creationService'
import {videoPlanChanges,videoPlanDirty,canConfirmVideoBatch,videoBatchStatus,retryableVideoItems} from '../videoPlanState'
import CreationResultCard from './CreationResultCard.vue'
import CreationConfirmationCard from './CreationConfirmationCard.vue'
import type {SessionResult} from '../resultCatalog'
import type {CreationCatalog} from '../types'

const props=defineProps<{runId:string;resultTarget?:string;plan:VideoPlan;catalog?:CreationCatalog|null;busy?:boolean;readonly?:boolean;history?:boolean;quickQuote?:boolean;skipConfirmation?:boolean;rulesReady?:boolean;rulesBusy?:boolean;rulesError?:string}>()
const emit=defineEmits<{updated:[id:string,plan:VideoPlan];compose:[];composeAll:[runId:string];workbench:[runId:string,itemId:string];retry:[sourceId:string,run:CreationRun];rule:[enabled:boolean];settings:[]}>()
const retrySelection=ref<string[]>([])
let retryReceipt:{key:string;id:string}|null=null
const selected=ref<string[]>([]),items=ref<Array<{id:string;title:string;prompt:string}>>([])
const editing=ref(''),working=ref(false),error=ref('')
/** 从哪个版本打开就编辑哪个版本，不默认跳回第一条。 */
function openWorkbench(itemId=local.value.items[0]?.id||''){emit('workbench',props.runId,itemId)}
/** 完成作品复用图片结果同一张卡，业务身份仍绑定真实视频任务与条目。 */
function resultCard(task:VideoBatchItem,result:NonNullable<VideoBatchItem['results']>[number]):SessionResult{
  const title=local.value.items.find(item=>item.id===task.item_id)?.title||'视频'
  return {key:`video:${task.task_id}:${result.id}`,messageId:'',versionKey:result.id,kind:'video',title,summary:title,url:result.video_url,source:{kind:'video',id:task.task_id,result_id:result.id}}
}
function completedResults(task:VideoBatchItem){return (task.results||[]).filter(result=>task.status==='succeeded'&&result.status==='succeeded'&&result.video_url)}
const now=ref(Date.now()),local=ref<VideoPlan>(props.plan)
let epoch=0,saveRequest:{key:string;id:string}|null=null,quoteRequest:string|null=null
let confirmation:{quote:string;revision:number;id:string}|null=null,statusTimer:ReturnType<typeof setTimeout>|undefined
const rootElement=ref<HTMLElement|null>(null),visible=ref(!props.history)
let visibilityObserver:IntersectionObserver|undefined,statusReading=false
// 到期只撤下有效价标记，不自动续价，更不能恢复费用授权。
let clock:ReturnType<typeof setInterval>|undefined
// 首次核价和免费执行准备由后端完成，页面挂载与刷新不再发起报价命令。
onMounted(()=>{
  clock=setInterval(()=>now.value=Date.now(),1000)
  // 长会话的历史卡只在接近视口时读取，避免一次挂载大量卡片导致请求拥堵和限流。
  if(props.history&&rootElement.value&&typeof IntersectionObserver!=='undefined'){
    visibilityObserver=new IntersectionObserver(entries=>{visible.value=!!entries[0]?.isIntersecting},{rootMargin:'200px'})
    visibilityObserver.observe(rootElement.value)
  }else visible.value=true
  void pollStatus()
})
onBeforeUnmount(()=>{epoch++;clearInterval(clock);clearTimeout(statusTimer);visibilityObserver?.disconnect()})
/** 切换运行或收到明确保存结果时恢复服务端快照，迟到响应不得覆盖另一会话。 */
function restore(plan:VideoPlan){
  local.value=plan
  selected.value=[...(plan.selected_ids||plan.items.map(item=>item.id))]
  items.value=plan.items.map(({id,title,prompt})=>({id,title,prompt}))
}
watch(()=>props.runId,()=>{epoch++;error.value='';working.value=false;saveRequest=null;quoteRequest=null;confirmation=null;restore(props.plan);if(clock){clearTimeout(statusTimer);statusTimer=setTimeout(pollStatus,4000)}},{immediate:true})
const dirty=computed(()=>videoPlanDirty(local.value,selected.value,items.value))
const quote=computed(()=>dirty.value?null:local.value.quote)
const expired=computed(()=>!!quote.value&&(quote.value.expired||quote.value.expires_at*1000<=now.value))
const disabled=computed(()=>working.value||props.busy||props.readonly||!!local.value.batch||local.value.status!=='draft')
const confirmable=computed(()=>canConfirmVideoBatch(local.value,now.value,dirty.value,!!props.readonly))
/** 名称来自真实目录；展示不更换冻结模型代码，也不改写历史提示词。 */
function modelName(code:string){
  const rows=Object.values(props.catalog?.skill_models||{}).flat()
  const profiles=Object.values(props.catalog?.profiles||{}).flatMap(profile=>profile?[profile.model,...(profile.allowed_models||[])]:[])
  return [...rows,...profiles].find(row=>row.code===code)?.name||code
}
// 确认只读已选择条目的冻结规格；定位按钮不改稿、不采购。
const confirmationRequests=computed(()=>local.value.items.filter(item=>selected.value.includes(item.id)).map(item=>({id:item.id,
  model:modelName(item.parameters.model),spec:`${item.parameters.durationSec} 秒 · ${item.parameters.aspectRatio} · ${item.parameters.resolution}`})))
const retryable=computed(()=>retryableVideoItems(local.value))
/** 明确勾选失败项后才开新草案；打开已有草案只GET，创建也不自动核价或扣费。 */
async function openRetry(existingId?:string){
  if(working.value||props.busy)return
  const scope=epoch,id=props.runId,revision=local.value.revision,quoteId=local.value.quote?.id
  const selectedIds=retryable.value.filter(task=>retrySelection.value.includes(task.item_id)).map(task=>task.item_id)
  if(!existingId&&!selectedIds.length)return
  working.value=true;error.value=''
  try{
    let nextId=existingId
    if(!nextId){
      const key=JSON.stringify([local.value.revision,selectedIds])
      if(retryReceipt?.key!==key)retryReceipt={key,id:crypto.randomUUID()}
      nextId=(await creationService.retryVideoBatch(id,{expected_revision:local.value.revision,request_id:retryReceipt.id,item_ids:selectedIds})).run_id
    }
    if(scope!==epoch||id!==props.runId)return
    const run=await creationService.run(nextId)
    if(scope===epoch&&id===props.runId)emit('retry',id,run)
  }catch(cause){if(scope===epoch)error.value=(cause as Error).message||'重试草案读取失败，请使用原请求重试。'}
  finally{if(scope===epoch)working.value=false}
}
/** 自动恢复只读取原批次，隐藏页暂停；写操作期间不让旧读取覆盖新提交结果。 */
async function pollStatus(){
  clearTimeout(statusTimer)
  const scope=epoch,id=props.runId
  // 报价由后端异步准备；未建批次时也必须只读跟进，否则会一直停在准备费用。
  if(!document.hidden&&visible.value&&(local.value.batch||local.value.quote_delivery==='pending')&&!working.value&&!statusReading){
    statusReading=true
    try{const result=await creationService.videoPlan(id);if(scope===epoch&&id===props.runId&&!working.value&&!dirty.value&&revision===local.value.revision&&quoteId===local.value.quote?.id){restore(result);emit('updated',id,result)}}
    catch(cause){if(scope===epoch)error.value=(cause as Error).message||'批次状态同步失败，原任务继续执行。'}
    finally{statusReading=false}
  }
  if(scope===epoch)statusTimer=setTimeout(pollStatus,props.history?15000:4000)
}
// 进入视口立即读取一次；退出视口/隐藏页面不重复发请求，也不触发写入。
watch(visible,value=>{if(value&&clock&&!statusReading)void pollStatus()})
/** 正式准备只冻结素材与子方案，不收费；迟到或跨运行的结果不能继续确认。 */
async function prepareBatch(plan:VideoPlan){
  if(!plan.batch_supported||!plan.quote)return plan
  return creationService.prepareVideoBatch(props.runId,{expected_revision:plan.revision,quote_id:plan.quote.id,request_id:crypto.randomUUID()})
}
/** 一次点击授权已展示的全部选择；网络重试沿用同一请求号，绝不由轮询触发。 */
async function confirmBatch(){
  if(!confirmable.value||working.value||props.busy)return
  const scope=epoch,id=props.runId,plan=local.value,q=plan.quote!
  if(confirmation?.quote!==q.id||confirmation.revision!==plan.revision)confirmation={quote:q.id,revision:plan.revision,id:crypto.randomUUID()}
  working.value=true;error.value=''
  try{const result=await creationService.confirmVideoBatch(id,{expected_revision:plan.revision,quote_id:q.id,request_id:confirmation.id});if(scope===epoch&&id===props.runId){restore(result);emit('updated',id,result)}}
  catch(cause){if(scope===epoch)error.value=(cause as Error).message||'受理状态尚未确认，请读取原批次或用原请求重试。'}
  finally{if(scope===epoch)working.value=false}
}
/** 稍等只停止尚未提交的当前方案，等待服务端确认，不影响既有媒体任务。 */
async function stopBatch(){
  if(disabled.value)return
  const scope=epoch,id=props.runId
  working.value=true;error.value=''
  try{const run=await creationService.cancelRun(id,'confirmation_defer');if(scope===epoch&&id===props.runId&&run.status==='cancelled'){const plan={...local.value,status:'stopped'};restore(plan);emit('updated',id,plan)}}
  catch(cause){if(scope===epoch)error.value=(cause as Error).message||'停止未完成，请重试。'}
  finally{if(scope===epoch)working.value=false}
}
// 跨页最新快照不能吞掉本地编辑；仅无修改且无写入时同步服务端结果。
watch(()=>props.plan,value=>{
  if(working.value)return
  if(!dirty.value)restore(value)
  else if(value.revision!==local.value.revision)error.value='其他页面已更新计划，已保留本地编辑，请核对最新版本。'
})
/** 勾选仅影响本次选择；没有保存前不让旧报价继续显示为有效。 */
function toggle(id:string,value:boolean){selected.value=value?[...selected.value,id]:selected.value.filter(item=>item!==id)}
/** 写入失败保留内容和请求号；同文重试可恢复服务端已经受理的结果。 */
async function save(){
  if(disabled.value||!selected.value.length)return
  const changes=videoPlanChanges(local.value,selected.value,items.value)
  const key=JSON.stringify({revision:local.value.revision,...changes})
  if(saveRequest?.key!==key)saveRequest={key,id:crypto.randomUUID()}
  const scope=epoch,id=props.runId
  working.value=true;error.value=''
  try{
    const result=await creationService.saveVideoPlan(id,{expected_revision:local.value.revision,request_id:saveRequest.id,...changes})
    if(scope!==epoch||id!==props.runId)return
    restore(result);saveRequest=null;quoteRequest=null;editing.value='';emit('updated',id,result)
  }catch(cause){if(scope===epoch)error.value=(cause as Error).message||'保存未完成，已保留本地内容。'}
  finally{if(scope===epoch)working.value=false}
}
/** 核价只读取已保存条目，不自动保存本地修改，也不确认生成。 */
async function price(){
  if(disabled.value||dirty.value)return
  quoteRequest ||= crypto.randomUUID()
  const scope=epoch,id=props.runId
  working.value=true;error.value=''
  try{
    let result=await creationService.quoteVideoPlan(id,{expected_revision:local.value.revision,request_id:quoteRequest})
    if(scope!==epoch||id!==props.runId)return
    // 有效预算自动进入正式准备，不把“准备”再推成一次多余的确认回合。
    restore(result);emit('updated',id,result)
    result=await prepareBatch(result)
    if(scope!==epoch||id!==props.runId)return
    restore(result);quoteRequest=null;emit('updated',id,result)
  }catch(cause){if(scope===epoch)error.value=(cause as Error).message||'核价失败，请重试。'}
  finally{if(scope===epoch)working.value=false}
}
/** 确认方案只保存选择并核价，之后仍必须通过独立费用确认才能提交媒体任务。 */
async function confirmPlan(){
  if(dirty.value)await save()
  if(!dirty.value&&!error.value)await price()
}
/** 明确点击才放弃当前本地稿并读取最新版本，冲突时不暗中覆盖。 */
async function reload(){
  if(disabled.value)return
  const scope=epoch,id=props.runId
  working.value=true
  try{const result=await creationService.videoPlan(id);if(scope===epoch&&id===props.runId){restore(result);error.value='';saveRequest=null;quoteRequest=null;emit('updated',id,result)}}
  catch(cause){if(scope===epoch)error.value=(cause as Error).message}
  finally{if(scope===epoch)working.value=false}
}
</script>

<template>
  <section v-if="local.status!=='stopped'" ref="rootElement" class="liv-media-plan space-y-3 text-sm" aria-label="视频创作计划" :aria-busy="working">
    <p v-if="!local.batch&&!confirmable" class="font-semibold">共 {{local.total_count}} 条方案 · 本次选择 {{selected.length}} 条</p>
    <p v-if="local.unverified_facts?.length" class="text-muted">待核对：{{local.unverified_facts.join('；')}}</p>
    <!-- 选中状态只跟随真实条目选择，不改变默认数量、报价或提交行为。 -->
    <article v-for="(item,index) in (local.batch||confirmable?[]:items)" :key="item.id" class="liv-plan-panel liv-video-task-row transition-colors" :class="{'is-selected':selected.includes(item.id)}">
      <!-- 单条/历史条目整行定位原节点；多条选择独立保留，不能把查看误当费用授权。 -->
      <UCheckbox v-if="items.length>1&&!readonly" :model-value="selected.includes(item.id)" :aria-label="`选择${item.title}`" :disabled="disabled" @update:model-value="value=>toggle(item.id,!!value)"/>
      <button class="liv-plan-inspect" :disabled="working||busy" @click="openWorkbench(item.id)"><span>{{index+1}}. {{item.title}}<small>{{modelName(local.items[index]?.parameters.model||'')}} · {{local.items[index]?.parameters.durationSec}} 秒 · {{local.items[index]?.parameters.aspectRatio}} · {{local.items[index]?.parameters.resolution}}</small></span><UIcon name="i-lucide-focus"/></button>
      <template v-if="editing===item.id">
        <UInput v-model="item.title" class="w-full" :aria-label="`方案${index+1}名称`" :disabled="disabled" :maxlength="100"/>
        <UTextarea v-model="item.prompt" class="w-full" :aria-label="`方案${index+1}完整分镜`" :rows="10" :disabled="disabled" :maxlength="20000"/>
        <p class="text-muted">保留逐段时间轴和当前规格；修改后请保存，旧报价立即失效。</p>
      </template>
    </article>
    <p v-if="selected.length<local.total_count" class="text-muted">另外 {{local.total_count-selected.length}} 条仍保留，未选择不等于放弃需求。</p>
    <!-- 费用仅在采购前确认；已提交批次保留账务记录，不在成果区重复报价。 -->
    <template v-if="quote&&!expired&&!local.batch&&!confirmable">
      <div class="liv-plan-price space-y-2" aria-label="逐项费用">
        <p v-for="item in quote.items" :key="item.id" class="flex justify-between gap-3"><span>{{item.title}}</span><span>{{item.credits}} 积分</span></p>
        <div class="liv-batch-total"><span>本次预计消耗</span><span class="liv-batch-total-value">{{quote.total_credits}} 积分</span></div>
        <p v-if="!quote.sufficient" class="text-warning">当前余额不足以覆盖所选条目合计。</p>
      </div>
    </template>
    <p v-if="local.review_required&&local.review_reason&&!local.batch&&!confirmable" class="text-muted text-sm">{{local.review_reason}}</p>
    <p v-if="error||local.quote_error" role="alert" class="text-error">{{error||local.quote_error}}</p>
    <p v-if="local.quote_delivery==='pending'&&!quote&&!dirty" role="status">正在准备费用确认…</p>
    <p v-if="dirty" role="status" class="text-muted">有未保存修改，旧报价已隐藏。</p>
    <div v-if="!readonly&&!local.batch&&local.status==='draft'&&!confirmable&&(local.quote_delivery!=='pending'||dirty)" class="liv-plan-actions">
      <!-- 与图片方案统一文案：改动选择后仍确认方案，后续费用卡才确认执行，不改变原核价/提交边界。 -->
      <UButton color="primary" class="liv-plan-primary liv-plan-confirm" :loading="working" :disabled="disabled||!selected.length" @click="confirmPlan">{{local.quote_error?'重试准备':'确认方案'}}</UButton>
      <UButton v-if="error" color="neutral" variant="outline" :disabled="disabled" @click="reload">放弃本地编辑并读取最新</UButton>
    </div>
    <CreationConfirmationCard v-if="confirmable" model="" spec="" target="video" :requests="confirmationRequests" :credits="quote!.total_credits" has-quote :sufficient="quote!.sufficient" :quoting="false" :busy="working||!!busy" :skip-confirmation="skipConfirmation" :rules-ready="rulesReady" :rules-busy="rulesBusy" :rules-error="rulesError" @confirm="confirmBatch" @cancel="stopBatch" @inspect="openWorkbench" @rule="emit('rule',$event)" @settings="emit('settings')"/>
    <section v-if="local.batch" class="space-y-3" aria-label="批次真实任务结果">
      <p class="font-semibold">已完成 {{local.batch.completed??0}} / {{local.batch.selected_count??local.batch.items.length}}</p>
      <p v-if="local.batch.items.length&&local.batch.items.every(task=>completedResults(task).length)" class="liv-batch-feedback">本批 {{local.batch.items.length}} 条视频已全部返回，原参考素材保留。可以继续选择配乐后合成，或直接合成这些片段。</p>
      <div v-if="local.batch.items.every(task=>task.status==='succeeded'&&task.results?.some(result=>result.status==='succeeded'&&result.video_url))" class="flex flex-wrap gap-2"><UButton :disabled="working||busy" @click="emit('composeAll',runId)">直接合成全部片段</UButton><UButton color="neutral" variant="outline" @click="emit('compose')">调整片段后合成</UButton></div>
      <div class="liv-batch-result-grid">
      <div v-for="task in local.batch.items" :key="task.item_id" class="space-y-2 min-w-0" :class="!completedResults(task).length?'rounded-lg border border-default p-3':''">
        <p v-if="!completedResults(task).length">{{local.items.find(item=>item.id===task.item_id)?.title}} · {{videoBatchStatus(task.status)}}</p>
        <UCheckbox v-if="retryable.some(item=>item.item_id===task.item_id)" :model-value="retrySelection.includes(task.item_id)" label="选择此失败条目重新核价" :disabled="working||busy" @update:model-value="value=>retrySelection=value?[...retrySelection.filter(id=>id!==task.item_id),task.item_id]:retrySelection.filter(id=>id!==task.item_id)"/>
        <UButton v-if="task.retry_run_id" color="neutral" variant="outline" :disabled="working||busy" @click="openRetry(task.retry_run_id)">查看已有重试方案</UButton>
        <p v-if="task.progress!==null&&task.progress!==undefined">生成进度 {{task.progress}}%</p>
        <p v-if="task.error" role="alert">{{task.error}}</p>
        <!-- 对话仅展示真实视频首帧；点击/键盘激活只切换右侧工作台，不在消息中播放。 -->
        <Teleport defer :disabled="!resultTarget" :to="resultTarget||'body'"><CreationResultCard v-for="result in completedResults(task)" :key="result.id" :item="resultCard(task,result)" :disabled="working||busy" :aria-label="`在右侧工作台打开${local.items.find(item=>item.id===task.item_id)?.title||'视频'}`" @select="openWorkbench(task.item_id)"/></Teleport>
      </div>
      </div>
      <div v-if="retryable.length" class="space-y-2">
        <p class="text-muted">只为选中的失败条目新建草案，之后重新核价并确认。成功项不重复生成；状态待核对的任务不能重购。</p>
        <UButton color="neutral" variant="outline" :disabled="working||busy||!retrySelection.length" @click="openRetry()">为所选失败项创建重试方案</UButton>
      </div>
    </section>
    <p v-if="!confirmable&&!local.batch&&!readonly" class="text-muted">{{local.batch_supported?'核价与正式准备不收费，只有确认所选全部条目后才提交生成。':'当前可编辑和逐条核价，尚未开放批次提交；核价不会扣费或生成视频。'}}</p>
  </section>
</template>

<style scoped>
/* 双结果并排、窄聊天列自然换行，避免竖视频旁边留下整行无效空间。 */
.liv-batch-result-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}
/* 明细与合计分区，避免把合计误看成第三条作品费用。 */
.liv-batch-total{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--ui-border);padding-top:8px;margin-top:8px;font-size:14px;font-weight:500}
.liv-batch-total-value{display:inline-flex;align-items:center;gap:4px;font-size:inherit;line-height:1.5}
.liv-batch-result-grid :deep(.liv-result-card){margin-top:0}
/* 方案入口与确认卡的任务行同样紧凑，整行可点击、键盘可达。 */
.liv-media-plan .liv-video-task-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border:0;border-radius:8px;box-shadow:none;background:var(--liv-confirm-task-surface)}
.liv-video-task-row:has(input:checked){outline:1px solid var(--liv-account-border)}
.liv-video-task-row>.liv-plan-inspect{flex:1;min-width:0;padding:0!important}
.liv-plan-actions{display:grid;gap:8px}
.liv-media-plan button.liv-plan-confirm{width:100%;min-height:44px!important;justify-content:center!important;border-radius:999px;font-size:15px;color:var(--liv-control-on-primary)}
.liv-batch-feedback{font-size:13px;line-height:22px;color:var(--liv-settings-muted)}
.liv-plan-inspect{display:flex!important;width:100%;align-items:center;justify-content:space-between;gap:8px;text-align:left;min-height:52px;border:0!important;border-radius:8px!important;background:var(--liv-confirm-task-surface)!important;padding:8px 12px!important;color:var(--liv-chat-assistant-text)}
.liv-plan-inspect span{min-width:0;font-size:14px}.liv-plan-inspect small{display:block;font-size:12px;color:var(--liv-settings-muted);margin-top:4px}.liv-plan-inspect .iconify{flex:none}
</style>
