<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {creationService,type ImageCreativePlan,type CreationRun} from '~/shared/api/services/creationService'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import CreationResultCard from './CreationResultCard.vue'
import {batchImageResults} from '../resultCatalog'
import {imagePlanNeedsPolling} from '../imagePlanState'
import type {WorkspacePreview} from '../types'
/** 对话只显示逐张名称/规格与画布入口，完整画面内容在对应节点统一输入区查看。 */
const props=defineProps<{runId:string;plan:ImageCreativePlan;referencePreviews?:Record<string,WorkspacePreview>;busy?:boolean;readonly?:boolean;history?:boolean;draftDirty?:boolean;beforeCommand?:()=>Promise<boolean>}>()
const emit=defineEmits<{open:[itemId:string];updated:[id:string,plan:ImageCreativePlan];retry:[sourceId:string,run:CreationRun]}>()
const retryReceipts=new Map<string,string>()
const local=ref(props.plan),selected=ref([...props.plan.selected_ids]),working=ref(false),error=ref(''),conflict=ref(false),now=ref(Date.now())
let alive=true,epoch=0,timer:ReturnType<typeof setInterval>|undefined,receipt:{key:string;id:string}|null=null
const rootElement=ref<HTMLElement|null>(null),visible=ref(!props.history)
let statusTimer:ReturnType<typeof setTimeout>|undefined,statusReading=false,observer:IntersectionObserver|undefined
let confirmationReceipt:{key:string;prepared:boolean;command:{expected_revision:number;quote_id:string;request_id:string}}|null=null
const dirty=computed(()=>JSON.stringify(local.value.items.filter(item=>selected.value.includes(item.id)).map(item=>item.id))!==JSON.stringify(local.value.selected_ids))
const quote=computed(()=>dirty.value||props.draftDirty?null:local.value.quote)
const expired=computed(()=>!!quote.value&&(quote.value.expired||quote.value.expires_at*1000<=now.value))
const pendingCommand=computed(()=>{const pending=local.value.flow_runtime?.pending_command;return pending&&['prepare','confirm'].includes(pending.action)?pending:undefined})
const locked=computed(()=>!!props.readonly||!!props.busy||working.value||conflict.value||!!pendingCommand.value||local.value.status!=='draft')
const confirmable=computed(()=>!locked.value&&!dirty.value&&!props.draftDirty&&local.value.batch_supported&&quote.value?.sufficient&&!expired.value&&quote.value.plan_revision===local.value.revision&&JSON.stringify(quote.value.item_ids)===JSON.stringify(local.value.selected_ids))
const completedResults=computed(()=>batchImageResults([{id:props.runId,image_plan:local.value}]))
const failedCovers=ref<Record<string,boolean>>({})
/** 只使用本条成功作品或服务端授权参考预览；未出图时标注参考图，不拿素材冒充成品。 */
function itemCover(item:ImageCreativePlan['items'][number]){
  const task=local.value.batch?.items.find(value=>value.item_id===item.id)
  const result=task?.delivery_status==='completed'?task.results.find(value=>value.status==='success'&&value.image_url):undefined
  if(result)return {url:result.image_url,label:'生成结果'}
  const reference=item.references.map(value=>props.referencePreviews?.[value.version_id]).find(value=>value?.available&&value.media_type==='image'&&value.preview_url)
  return reference?{url:reference.preview_url!,label:'参考图'}:undefined
}
/** 对话只显示统一完成卡，点击定位右侧对应节点，不在对话内开播放器。 */
function openResult(key:string){const result=completedResults.value.find(value=>value.key===key),item=local.value.batch?.items.find(value=>value.task_id===result?.source.id);if(item)emit('open',item.item_id)}
/** 每个失败项复用稳定草案请求；加载原草案后才导航，不在此处核价或提交生成。 */
async function openRetry(itemId:string){
  const task=local.value.batch?.items.find(value=>value.item_id===itemId)
  if(!task||working.value||props.busy||(!task.retry_run_id&&task.delivery_status!=='failed'))return
  const id=props.runId,current=++epoch;working.value=true;error.value=''
  try{
    let runId=task.retry_run_id
    if(!runId){
      const key=JSON.stringify([id,local.value.revision,itemId])
      if(!retryReceipts.has(key))retryReceipts.set(key,crypto.randomUUID())
      runId=(await creationService.retryImageBatch(id,{expected_revision:local.value.revision,request_id:retryReceipts.get(key)!,item_ids:[itemId]})).run_id
    }
    const run=await creationService.run(runId)
    if(!run.image_plan||run.image_plan.retry_of!==id)throw new Error('重试方案来源不一致，请重新读取原任务。')
    if(alive&&current===epoch&&id===props.runId)emit('retry',id,run)
  }catch(cause){if(alive&&current===epoch)error.value=(cause as Error).message||'重试草案读取失败，请使用原操作重试。'}
  finally{if(alive&&current===epoch)working.value=false}
}
function restore(plan:ImageCreativePlan){local.value=plan;selected.value=[...plan.selected_ids];conflict.value=false;error.value='';receipt=null}
watch(()=>props.plan,plan=>{
  if(plan.revision===local.value.revision&&plan.quote?.id===local.value.quote?.id&&plan.status===local.value.status&&JSON.stringify(plan.batch)===JSON.stringify(local.value.batch)&&JSON.stringify(plan.flow_runtime)===JSON.stringify(local.value.flow_runtime))return
  if(dirty.value||working.value){conflict.value=true;error.value='图片计划已更新，本机选择保留，请读取最新计划核对。'}
  else restore(plan)
})
onMounted(()=>{
  timer=setInterval(()=>{now.value=Date.now()},1000)
  // 历史长会话只读取视口附近的活动卡；隐藏标签页不发请求。
  if(props.history&&rootElement.value&&typeof IntersectionObserver!=='undefined'){
    observer=new IntersectionObserver(entries=>{visible.value=!!entries[0]?.isIntersecting},{rootMargin:'200px'});observer.observe(rootElement.value)
  }else visible.value=true
  scheduleStatus()
})
onBeforeUnmount(()=>{alive=false;epoch++;clearInterval(timer);clearTimeout(statusTimer);observer?.disconnect()})
/** 轮询仅GET已有任务；写操作/本机改稿期间不覆盖草稿，旧会话迟到响应作废。 */
function scheduleStatus(){clearTimeout(statusTimer);if(alive&&imagePlanNeedsPolling(local.value))statusTimer=setTimeout(()=>{void pollStatus()},4000)}
async function pollStatus(){
  if(!alive||statusReading)return
  const id=props.runId,current=epoch,revision=local.value.revision,quoteId=local.value.quote?.id,batchId=local.value.batch?.request_id
  try{
    if(!imagePlanNeedsPolling(local.value)||working.value||props.busy||dirty.value||props.draftDirty||!visible.value||(typeof document!=='undefined'&&document.hidden))return
    statusReading=true
    const value=await creationService.imagePlan(id)
    if(!alive||id!==props.runId||current!==epoch||working.value||dirty.value||props.draftDirty||revision!==local.value.revision||quoteId!==local.value.quote?.id)return
    if(value.revision!==revision||value.status!=='submitted'||value.batch?.request_id!==batchId)return
    restore(value);emit('updated',id,value)
  }catch{/* 保留原真实状态，网络恢复后仅重读同一批次，不重发生成。 */}
  finally{statusReading=false;scheduleStatus()}
}
watch(()=>local.value.batch,()=>scheduleStatus())
/** 勾选只更新本机意图，不减少总需求、不扣点；保存成功才改变服务端本次选择。 */
function choose(id:string,checked:boolean){if(locked.value)return;selected.value=local.value.items.filter(item=>item.id===id?checked:selected.value.includes(item.id)).map(item=>item.id)}
async function command(action:'save'|'quote'){
  if(locked.value||props.draftDirty||!selected.value.length||(action==='quote'&&dirty.value))return
  working.value=true;error.value='';const current=++epoch,id=props.runId
  const originalQuote=props.plan.quote?.id,revision=props.plan.revision
  try{
    if(props.beforeCommand&&!await props.beforeCommand()){error.value='请先保存当前图片提示词，再调整选择或核价。';return}
    if(!alive||current!==epoch)return
    if(conflict.value||props.plan.revision!==revision||props.plan.quote?.id!==originalQuote)throw new Error('图片计划已变化，请先核对最新方案。')
    const ids=local.value.items.filter(item=>selected.value.includes(item.id)).map(item=>item.id)
    const key=JSON.stringify([action,local.value.revision,ids])
    if(!receipt||receipt.key!==key)receipt={key,id:crypto.randomUUID()}
    const base={expected_revision:local.value.revision,request_id:receipt.id}
    const plan=action==='save'?await creationService.saveImagePlan(id,{...base,selected_ids:ids,items:[]}):await creationService.quoteImagePlan(id,base)
    if(!alive||current!==epoch)return
    if(props.plan.revision>plan.revision||(props.plan.quote?.id!==originalQuote&&props.plan.quote?.id!==plan.quote?.id)){
      conflict.value=true;throw new Error('已有更新的图片计划或报价，请读取最新计划核对。')
    }
    restore(plan);emit('updated',id,plan)
  }catch(cause){if(alive&&current===epoch){error.value=(cause as Error).message||'图片计划操作失败，当前选择保留。';if((cause as {statusCode?:number}).statusCode===409)conflict.value=true}}
  finally{if(alive&&current===epoch)working.value=false}
}
/** 唯一人工点击绑定当前报价；正式准备改价或晚到响应时停止，不静默换金额/请求号。 */
async function confirmBatch(){
  if(!confirmable.value||!quote.value)return
  const id=props.runId,current=++epoch,revision=local.value.revision,price=quote.value,selection=JSON.stringify(local.value.selected_ids)
  working.value=true;error.value=''
  const valid=()=>alive&&current===epoch&&id===props.runId&&local.value.revision===revision&&props.plan.quote?.id===price.id&&!conflict.value&&!props.draftDirty&&JSON.stringify(local.value.selected_ids)===selection
  try{
    if(props.beforeCommand&&!await props.beforeCommand())throw new Error('请先保存当前图片提示词，再核对生成费用。')
    if(!valid())return
    const key=JSON.stringify([id,revision,price.id,selection])
    if(!confirmationReceipt||confirmationReceipt.key!==key)confirmationReceipt={key,prepared:!!local.value.execution_available,command:{expected_revision:revision,quote_id:price.id,request_id:crypto.randomUUID()}}
    const data={...confirmationReceipt.command}
    const prepared=confirmationReceipt.prepared?local.value:await creationService.prepareImageBatch(id,data)
    if(!valid())return
    if(!prepared.execution_available||prepared.revision!==revision||prepared.quote?.id!==price.id||prepared.quote.total_credits!==price.total_credits||JSON.stringify(prepared.selected_ids)!==selection||JSON.stringify(prepared.quote.item_ids)!==selection)throw new Error('正式准备与当前报价不一致，请重新核对费用；未提交生成。')
    confirmationReceipt.prepared=true
    restore(prepared);emit('updated',id,prepared)
    if(!valid())return
    const accepted=await creationService.confirmImageBatch(id,data)
    if(!valid())return
    if(accepted.status!=='submitted'||accepted.batch?.request_id!==data.request_id||accepted.batch.quote_id!==price.id||accepted.batch.plan_revision!==revision)throw new Error('提交结果待核对，请读取原批次，不要重新创建生成任务。')
    restore(accepted);emit('updated',id,accepted)
  }catch(cause){if(alive&&current===epoch){
    const message=(cause as Error).message||'图片提交状态待核对，请保留原请求重试。'
    error.value=message
    // 网络断开先GET对账，恢复按钮只使用服务器已持久化的原命令；不自动POST或换号。
    try{const latest=await creationService.imagePlan(id);if(alive&&current===epoch&&id===props.runId&&latest.revision===revision&&latest.quote?.id===price.id){restore(latest);emit('updated',id,latest);error.value=message}}catch{/* 原请求身份保留，不能因对账暂不可用改成新采购。 */}
    if((cause as {statusCode?:number}).statusCode===409&&!pendingCommand.value)conflict.value=true
  }}
  finally{if(alive&&current===epoch)working.value=false}
}
/** 仅显式恢复服务器原命令，不使用本机输入重新发放授权，过期报价也不自动续价。 */
async function resumePending(){
  const pending=pendingCommand.value
  if(!pending||working.value||props.busy||props.draftDirty||dirty.value)return
  const id=props.runId,current=++epoch;working.value=true;error.value=''
  try{
    const run=await creationService.resumeFlow(id,{...pending})
    if(alive&&current===epoch&&id===props.runId&&run.id===id&&run.image_plan){const next={...run.image_plan,flow_runtime:run.flow_runtime};restore(next);emit('updated',id,next)}
  }catch(cause){if(alive&&current===epoch)error.value=(cause as Error).message||'原操作尚待恢复，请稍后重试，不会重新采购。'}
  finally{if(alive&&current===epoch)working.value=false}
}
/** 冲突只重读原计划；有本机选择时由明确按钮告知会放弃，不创建新报价。 */
async function reload(){
  if(working.value)return
  working.value=true;const current=++epoch,id=props.runId
  try{const plan=await creationService.imagePlan(id);if(alive&&current===epoch){restore(plan);error.value='';emit('updated',id,plan)}}
  catch(cause){if(alive&&current===epoch)error.value=(cause as Error).message||'图片计划读取失败。'}
  finally{if(alive&&current===epoch)working.value=false}
}
</script>
<template>
  <section ref="rootElement" class="creation-image-plan liv-media-plan" aria-label="逐张图片方案">
    <p>共 {{local.total_count}} 张方案 · 本次选择 {{selected.length}} 张<span v-if="selected.length<local.total_count">，另 {{local.total_count-selected.length}} 张未提交</span></p>
    <div v-for="item in local.items" :key="item.id" class="creation-image-plan-item liv-plan-panel" :class="{'is-selected':selected.includes(item.id)}">
    <UCheckbox :model-value="selected.includes(item.id)" :disabled="locked" :aria-label="`本次选择${item.title}`" @update:model-value="choose(item.id,!!$event)"/>
    <UButton color="neutral" variant="ghost" class="creation-image-plan-open" :disabled="busy||working" @click="emit('open',item.id)">
      <span class="creation-image-plan-cover"><img v-if="itemCover(item)&&!failedCovers[itemCover(item)!.url]" :src="itemCover(item)!.url" :alt="`${item.title} · ${itemCover(item)!.label}`" loading="lazy" @error="failedCovers[itemCover(item)!.url]=true"/><UIcon v-else name="i-lucide-image"/><small>{{itemCover(item)?.label||'图片方案'}}</small></span><span class="creation-image-plan-copy"><strong>{{item.title}}</strong><small>{{[item.parameters.model,item.parameters.aspectRatio,item.parameters.resolution].filter(Boolean).join(' · ')}}</small></span><UIcon name="i-lucide-chevron-right"/>
    </UButton>
    </div>
    <p v-if="dirty||draftDirty" class="text-muted text-sm">图片改稿或选择尚未保存，旧报价已隐藏。</p>
    <div v-if="quote" class="creation-image-plan-price liv-plan-price" aria-label="图片逐项费用">
      <p v-for="item in quote.items" :key="item.id" class="flex justify-between gap-3"><span>{{item.title}}</span><span class="inline-flex items-center gap-1"><CreditIcon/>{{item.credits}}</span></p>
      <p class="creation-image-plan-total flex justify-between gap-3"><span>合计</span><span class="inline-flex items-center gap-1"><CreditIcon/>{{quote.total_credits}} 点数</span></p>
      <p v-if="!local.batch&&expired" class="text-warning">报价已过期，请重新核价。</p>
      <p v-else-if="!local.batch&&!quote.sufficient" class="text-warning">当前余额不足以覆盖所选图片合计。</p>
    </div>
    <template v-if="local.batch">
      <p role="status">已完成 {{local.batch.completed??0}} / {{local.batch.selected_count??local.batch.items.length}}</p>
      <p v-if="local.batch.unknown" class="text-muted text-sm">{{local.batch.unknown}} 张提交状态待核对，不会自动重复提交。</p>
      <UButton v-if="local.batch.items.some(item=>['unknown','result_error'].includes(item.delivery_status))" class="creation-image-plan-action" icon="i-lucide-refresh-cw" color="neutral" variant="soft" :loading="working" @click="reload">重新读取原任务</UButton>
      <div v-for="item in local.batch.items.filter(value=>value.delivery_status!=='completed')" :key="item.item_id" class="text-muted text-sm"><span>{{local.items.find(value=>value.id===item.item_id)?.title}}</span> · {{item.error||item.detail||'正在同步任务状态'}}
        <UButton v-if="item.retry_run_id||item.delivery_status==='failed'" color="neutral" variant="outline" :disabled="working||busy" @click="openRetry(item.item_id)">{{item.retry_run_id?'继续原重试方案':'为此失败图片创建重试方案'}}</UButton>
      </div>
      <CreationResultCard v-for="item in completedResults" :key="item.key" :item="item" @select="openResult"/>
    </template>
    <p v-if="error" role="alert" class="text-warning text-sm">{{error}}</p>
    <UButton v-if="pendingCommand" color="neutral" variant="outline" :loading="working" :disabled="working||busy||draftDirty||dirty" @click="resumePending">恢复原{{pendingCommand.action==='confirm'?'提交':'准备'}}状态</UButton>
    <UButton v-if="conflict" color="neutral" variant="outline" :disabled="working" @click="reload">放弃本机选择，读取最新计划</UButton>
    <div v-else-if="!readonly&&local.status==='draft'" class="flex gap-2 flex-wrap">
      <UButton v-if="dirty" color="neutral" variant="outline" :loading="working" :disabled="locked||draftDirty||!selected.length" @click="command('save')">保存本次选择</UButton>
      <UButton v-else color="neutral" variant="outline" :loading="working" :disabled="locked||draftDirty||!selected.length" @click="command('quote')">{{quote?'重新核价':'逐张核价'}}</UButton>
      <template v-if="local.batch_supported&&quote"><p class="w-full text-muted text-sm">确认后提交本次所选图片，执行期间不能取消；未选择的方案保留。</p><UButton class="liv-plan-primary" color="primary" :loading="working" :disabled="!confirmable" @click="confirmBatch">确认生成 {{selected.length}} 张 · {{quote.total_credits}} 点数</UButton></template>
    </div>
    <p class="text-muted text-sm">{{local.batch?'点击完成卡在画布查看；已提交图片保留原快照，刷新不重新生成。':local.batch_supported?'在画布查看与编辑完整内容；核价不生成，只有明确确认才提交。':'在画布查看与编辑完整内容；此运行未开放图片批次执行，核价不生成、不扣点。'}}</p>
  </section>
</template>
<style scoped>
/* 对话方案统一为有层次的紧凑卡：沿用现有令牌，缩略图不随长标题被挤掉。 */
.creation-image-plan{display:grid;gap:12px;min-width:0;font-size:14px;line-height:1.7}
.creation-image-plan-item{display:flex;align-items:center;gap:8px;min-width:0}
.creation-image-plan-item:focus-within{outline:2px solid var(--liv-ui-primary);outline-offset:2px}
.creation-image-plan-open{display:flex!important;align-items:center;gap:12px;min-width:0;flex:1;padding:0!important;text-align:left;white-space:normal;color:var(--liv-chat-assistant-text)!important}
.creation-image-plan-open>.iconify{flex:none;width:16px;height:16px;color:var(--liv-settings-muted)}
.creation-image-plan-cover{position:relative;display:grid;place-items:center;flex:none;width:56px;height:64px;overflow:hidden;border-radius:8px;background:var(--liv-account-raised);color:var(--liv-settings-muted)}
.creation-image-plan-cover img{width:100%;height:100%;object-fit:cover}
.creation-image-plan-cover>.iconify{width:20px;height:20px}
.creation-image-plan-cover small{position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:12px;line-height:18px;background:var(--liv-workspace-surface);color:var(--liv-settings-muted)}
.creation-image-plan-copy{display:grid;gap:4px;flex:1;min-width:0}
.creation-image-plan-copy strong{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.creation-image-plan-copy small{font-size:12px;color:var(--liv-settings-muted);overflow-wrap:anywhere}
.creation-image-plan-price{display:grid;gap:8px}
.creation-image-plan-total{border-top:1px solid var(--color-border-soft);padding-top:8px;font-weight:600}
.creation-image-plan-action{justify-self:start;padding-inline:16px}
</style>
