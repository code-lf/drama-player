<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {creationService,type VideoPlan,type CreationRun,type VideoBatchItem} from '~/shared/api/services/creationService'
import {videoPlanChanges,videoPlanDirty,canConfirmVideoBatch,videoBatchStatus,retryableVideoItems} from '../videoPlanState'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import CreationResultCard from './CreationResultCard.vue'
import type {SessionResult} from '../resultCatalog'

const props=defineProps<{runId:string;plan:VideoPlan;busy?:boolean;readonly?:boolean;history?:boolean}>()
const emit=defineEmits<{updated:[id:string,plan:VideoPlan];compose:[];composeAll:[runId:string];workbench:[runId:string,itemId:string];retry:[sourceId:string,run:CreationRun]}>()
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
const retryable=computed(()=>retryableVideoItems(local.value))
/** 明确勾选失败项后才开新草案；打开已有草案只GET，创建也不自动核价或扣费。 */
async function openRetry(existingId?:string){
  if(working.value||props.busy)return
  const scope=epoch,id=props.runId
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
  if(!document.hidden&&visible.value&&local.value.batch&&!working.value&&!statusReading){
    statusReading=true
    try{const result=await creationService.videoPlan(id);if(scope===epoch&&id===props.runId&&!working.value&&!dirty.value){restore(result);emit('updated',id,result)}}
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
  try{const run=await creationService.cancelRun(id);if(scope===epoch&&id===props.runId&&run.status==='cancelled'){const plan={...local.value,status:'stopped'};restore(plan);emit('updated',id,plan)}}
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
  <section ref="rootElement" class="liv-media-plan space-y-3 text-sm" aria-label="视频创作计划" :aria-busy="working">
    <p class="font-semibold">共 {{local.total_count}} 条方案 · 本次选择 {{selected.length}} 条</p>
    <p>{{local.allocation_note}}</p>
    <p v-if="local.unverified_facts?.length" class="text-muted">待核对：{{local.unverified_facts.join('；')}}</p>
    <!-- 选中状态只跟随真实条目选择，不改变默认数量、报价或提交行为。 -->
    <article v-for="(item,index) in items" :key="item.id" class="liv-plan-panel space-y-3 transition-colors" :class="{'is-selected':selected.includes(item.id)}">
      <UCheckbox :model-value="selected.includes(item.id)" :label="`${index+1}. ${item.title}`" :disabled="disabled" @update:model-value="value=>toggle(item.id,!!value)"/>
      <p class="text-muted">{{local.items[index]?.parameters.model||'未选定模型'}} · {{local.items[index]?.parameters.durationSec}} 秒 · {{local.items[index]?.parameters.aspectRatio}} · {{local.items[index]?.parameters.resolution}} · {{local.items[index]?.references.length||0}} 项固定素材</p>
      <template v-if="editing===item.id">
        <UInput v-model="item.title" class="w-full" :aria-label="`方案${index+1}名称`" :disabled="disabled" :maxlength="100"/>
        <UTextarea v-model="item.prompt" class="w-full" :aria-label="`方案${index+1}完整分镜`" :rows="10" :disabled="disabled" :maxlength="20000"/>
        <p class="text-muted">保留逐段时间轴和当前规格；修改后请保存，旧报价立即失效。</p>
      </template>
      <p v-else class="text-muted">{{local.items[index]?.creative?.hook_description||'完整提示词可在工作台中查看与编辑。'}}</p>
      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="outline" :disabled="working||busy" @click="openWorkbench(item.id)">{{local.batch?'查看视频':'编辑当前提示词'}}</UButton>
      </div>
    </article>
    <p v-if="selected.length<local.total_count" class="text-muted">另外 {{local.total_count-selected.length}} 条仍保留，未选择不等于放弃需求。</p>
    <template v-if="quote">
      <div class="liv-plan-price space-y-2" aria-label="逐项费用">
        <p v-for="item in quote.items" :key="item.id" class="flex justify-between gap-3"><span>{{item.title}}</span><span class="inline-flex items-center gap-1"><CreditIcon/>{{item.credits}}</span></p>
        <div class="liv-batch-total"><span>合计</span><span class="liv-batch-total-value"><CreditIcon/>{{quote.total_credits}} 点数</span></div>
        <p v-if="!local.batch&&expired" class="text-warning">报价已过期，请重新核价。</p>
        <p v-else-if="!local.batch&&!quote.sufficient" class="text-warning">当前余额不足以覆盖所选条目合计。</p>
      </div>
    </template>
    <p v-if="error" role="alert" class="text-error">{{error}}</p>
    <p v-if="dirty" role="status" class="text-muted">有未保存修改，旧报价已隐藏。</p>
    <div v-if="!readonly&&!local.batch&&local.status==='draft'" class="flex flex-wrap gap-2">
      <UButton v-if="dirty" :loading="working" :disabled="disabled||!selected.length" @click="save">保存方案与选择</UButton>
      <UButton v-else :loading="working" :disabled="disabled||!selected.length" @click="price">{{quote?'重新核价':`核算所选 ${selected.length} 条费用`}}</UButton>
      <UButton v-if="error" color="neutral" variant="outline" :disabled="disabled" @click="reload">放弃本地编辑并读取最新</UButton>
    </div>
    <section v-if="confirmable" class="rounded-lg border border-default p-4 space-y-3" aria-label="批次生成确认">
      <p>确认后将提交所选 {{selected.length}} 条视频生成，执行期间不能通过此处取消。任务按实际资源限制排队。</p>
      <div class="flex flex-wrap gap-3">
        <UButton class="liv-plan-primary" color="primary" :loading="working" :disabled="working||busy" @click="confirmBatch">确认生成 {{selected.length}} 条 · <CreditIcon/>{{quote!.total_credits}}</UButton>
        <UButton class="rounded-full justify-center" color="neutral" variant="soft" :disabled="working||busy" @click="stopBatch">停止本次方案</UButton>
      </div>
    </section>
    <!-- 成片规划不要求先有成功视频；打开只读目录，实际回填及合成仍校验全部真实结果。 -->
    <UButton v-if="!local.batch" color="neutral" variant="outline" :disabled="working||busy" @click="emit('compose')">成片计划与片段列表</UButton>
    <section v-if="local.batch" class="space-y-3" aria-label="批次真实任务结果">
      <p class="font-semibold">已完成 {{local.batch.completed??0}} / {{local.batch.selected_count??local.batch.items.length}}</p>
      <div v-if="local.batch.items.every(task=>task.status==='succeeded'&&task.results?.some(result=>result.status==='succeeded'&&result.video_url))" class="flex flex-wrap gap-2"><UButton :disabled="working||busy" @click="emit('composeAll',runId)">直接合成全部片段</UButton><UButton color="neutral" variant="outline" @click="emit('compose')">调整片段后合成</UButton></div>
      <UButton v-else color="neutral" variant="outline" :disabled="working||busy" @click="emit('compose')">成片计划与片段列表</UButton>
      <div class="liv-batch-result-grid">
      <div v-for="task in local.batch.items" :key="task.item_id" class="space-y-2 min-w-0" :class="!completedResults(task).length?'rounded-lg border border-default p-3':''">
        <p v-if="!completedResults(task).length">{{local.items.find(item=>item.id===task.item_id)?.title}} · {{videoBatchStatus(task.status)}}</p>
        <UCheckbox v-if="retryable.some(item=>item.item_id===task.item_id)" :model-value="retrySelection.includes(task.item_id)" label="选择此失败条目重新核价" :disabled="working||busy" @update:model-value="value=>retrySelection=value?[...retrySelection.filter(id=>id!==task.item_id),task.item_id]:retrySelection.filter(id=>id!==task.item_id)"/>
        <UButton v-if="task.retry_run_id" color="neutral" variant="outline" :disabled="working||busy" @click="openRetry(task.retry_run_id)">查看已有重试方案</UButton>
        <p v-if="task.progress!==null&&task.progress!==undefined">生成进度 {{task.progress}}%</p>
        <p v-if="task.error" role="alert">{{task.error}}</p>
        <!-- 对话仅展示真实视频首帧；点击/键盘激活只切换右侧工作台，不在消息中播放。 -->
        <CreationResultCard v-for="result in completedResults(task)" :key="result.id" :item="resultCard(task,result)" :disabled="working||busy" :aria-label="`在右侧工作台打开${local.items.find(item=>item.id===task.item_id)?.title||'视频'}`" @select="openWorkbench(task.item_id)"/>
      </div>
      </div>
      <div v-if="retryable.length" class="space-y-2">
        <p class="text-muted">只为选中的失败条目新建草案，之后重新核价并确认。成功项不重复生成；状态待核对的任务不能重购。</p>
        <UButton color="neutral" variant="outline" :disabled="working||busy||!retrySelection.length" @click="openRetry()">为所选失败项创建重试方案</UButton>
      </div>
    </section>
    <p class="text-muted">{{local.batch?'已提交任务保留原快照；刷新只读取状态，不重复生成。':local.status==='stopped'?'当前方案已停止，已有作品不受影响。':readonly?'此计划仅供查看，不会恢复授权或生成。':local.batch_supported?'核价与正式准备不收费，只有确认所选全部条目后才提交生成。':'当前可编辑和逐条核价，尚未开放批次提交；核价不会扣费或生成视频。'}}</p>
  </section>
</template>

<style scoped>
/* 双结果并排、窄聊天列自然换行，避免竖视频旁边留下整行无效空间。 */
.liv-batch-result-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}
/* 明细与合计分区，避免把合计误看成第三条作品费用。 */
.liv-batch-total{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--ui-border);padding-top:8px;margin-top:8px;font-size:14px;font-weight:500}
.liv-batch-total-value{display:inline-flex;align-items:center;gap:4px;font-size:inherit;line-height:1.5}
.liv-batch-result-grid :deep(.liv-result-card){margin-top:0}
</style>
