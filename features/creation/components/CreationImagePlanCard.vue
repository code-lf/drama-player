<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {creationService,type ImageCreativePlan,type CreationRun} from '~/shared/api/services/creationService'
import CreationResultCard from './CreationResultCard.vue'
import CreationConfirmationCard from './CreationConfirmationCard.vue'
import {batchImageResults} from '../resultCatalog'
import {imagePlanNeedsPolling,imagePlanDeliveryLabel} from '../imagePlanState'
import type {WorkspacePreview} from '../types'
/** 对话只显示逐张名称/规格与画布入口，完整画面内容在对应节点统一输入区查看。 */
const props=defineProps<{runId:string;resultTarget?:string;plan:ImageCreativePlan;referencePreviews?:Record<string,WorkspacePreview>;busy?:boolean;readonly?:boolean;history?:boolean;quickQuote?:boolean;draftDirty?:boolean;beforeCommand?:()=>Promise<boolean>}>()
const emit=defineEmits<{open:[itemId:string];updated:[id:string,plan:ImageCreativePlan];retry:[sourceId:string,run:CreationRun]}>()
const retryReceipts=new Map<string,string>()
const local=ref(props.plan),selected=ref([...props.plan.selected_ids]),working=ref(false),error=ref(''),conflict=ref(false),now=ref(Date.now())
let alive=true,epoch=0,timer:ReturnType<typeof setInterval>|undefined,receipt:{key:string;id:string}|null=null
const rootElement=ref<HTMLElement|null>(null),visible=ref(!props.history)
let statusTimer:ReturnType<typeof setTimeout>|undefined,statusReading=false,observer:IntersectionObserver|undefined
// 每份过期报价只自动更新一次，网络故障不得形成后台无限重试或任何生成授权。
const refreshedQuotes=new Set<string>()
let confirmationReceipt:{key:string;prepared:boolean;command:{expected_revision:number;quote_id:string;request_id:string}}|null=null
// 首次报价由后端随规划交付；挂载/刷新只读取，不能再由页面重复发起报价。
const dirty=computed(()=>JSON.stringify(local.value.items.filter(item=>selected.value.includes(item.id)).map(item=>item.id))!==JSON.stringify(local.value.selected_ids))
const quote=computed(()=>dirty.value||props.draftDirty?null:local.value.quote)
const expired=computed(()=>!!quote.value&&(quote.value.expired||quote.value.expires_at*1000<=now.value))
const pendingCommand=computed(()=>{const pending=local.value.flow_runtime?.pending_command;return pending&&['prepare','confirm'].includes(pending.action)?pending:undefined})
const locked=computed(()=>!!props.readonly||!!props.busy||working.value||conflict.value||!!pendingCommand.value||local.value.status!=='draft')
const confirmable=computed(()=>!locked.value&&!dirty.value&&!props.draftDirty&&local.value.batch_supported&&quote.value?.sufficient&&!expired.value&&quote.value.plan_revision===local.value.revision&&JSON.stringify(quote.value.item_ids)===JSON.stringify(local.value.selected_ids))
const completedResults=computed(()=>batchImageResults([{id:props.runId,image_plan:local.value}]))
// 报价过期仍留在最终确认卡；更新只取价格，不进入准备或生成提交。
const showingConfirmation=computed(()=>!props.readonly&&local.value.status==='draft'&&!local.value.batch&&!pendingCommand.value&&!!quote.value&&local.value.batch_supported)
const confirmationRequests=computed(()=>local.value.items.filter(item=>selected.value.includes(item.id)).map(item=>({id:item.id,model:item.parameters.model||'图片',spec:[item.parameters.aspectRatio,item.parameters.resolution,item.parameters.quality].filter(Boolean).join(' · ')})))
/** 稍等通过服务端取消原运行，只隐藏尚未提交方案，不撤销已有任务。 */
async function stopBatch(){
  if(locked.value)return
  working.value=true;const id=props.runId,current=++epoch
  try{
    const run=await creationService.cancelRun(id,'confirmation_defer')
    // 停止必须有服务端收据，迟到响应和已提交任务不能被本机标记为停止。
    if(!alive||current!==epoch||id!==props.runId)return
    if(run.id!==id||run.status!=='cancelled'||run.executed_request)throw new Error('停止尚未确认，请读取原任务状态。')
    local.value={...local.value,status:'stopped'};emit('updated',id,local.value)
  }
  catch(cause){error.value=(cause as Error).message||'停止未完成，请重试'}
  finally{working.value=false}
}
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
  if(plan.revision===local.value.revision&&plan.quote?.id===local.value.quote?.id&&plan.status===local.value.status&&plan.quote_delivery===local.value.quote_delivery&&plan.quote_error===local.value.quote_error&&JSON.stringify(plan.batch)===JSON.stringify(local.value.batch)&&JSON.stringify(plan.flow_runtime)===JSON.stringify(local.value.flow_runtime))return
  // 写操作自行核对响应身份、报价与修订；父级回填自己的操作不制造第二个冲突。
  if(working.value)return
  if(dirty.value){conflict.value=true;error.value='图片计划已更新，本机选择保留，请读取最新计划核对。'}
  else restore(plan)
})
onMounted(()=>{
  timer=setInterval(()=>{now.value=Date.now();void refreshExpiredQuote()},1000)
  // 历史长会话只读取视口附近的活动卡；隐藏标签页不发请求。
  if(props.history&&rootElement.value&&typeof IntersectionObserver!=='undefined'){
    observer=new IntersectionObserver(entries=>{visible.value=!!entries[0]?.isIntersecting},{rootMargin:'200px'});observer.observe(rootElement.value)
  }else visible.value=true
  scheduleStatus()
  void refreshExpiredQuote()
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
    // 报价就绪和任务结果共用只读恢复；不可将不同修订或批次覆盖到本机改稿。
    if(value.revision!==revision||value.status!==local.value.status||value.batch?.request_id!==batchId)return
    restore(value);emit('updated',id,value)
  }catch{/* 保留原真实状态，网络恢复后仅重读同一批次，不重发生成。 */}
  finally{statusReading=false;scheduleStatus()}
}
watch(()=>[local.value.batch,local.value.quote_delivery],()=>scheduleStatus())
/** 可见且未改稿的待确认卡自动续价；历史、在途原命令、冲突和用户编辑均不得触发。 */
async function refreshExpiredQuote(){
  if(!alive||!visible.value||!showingConfirmation.value||!expired.value||locked.value||dirty.value||props.draftDirty||(typeof document!=='undefined'&&document.hidden))return
  const key=JSON.stringify([props.runId,local.value.revision,quote.value?.id])
  if(refreshedQuotes.has(key))return
  refreshedQuotes.add(key)
  await command('quote')
}
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
    // 已成功的旧报价过期后使用新身份；同一次断网重试仍复用请求号。
    const key=JSON.stringify([action,local.value.revision,ids,...(action==='quote'?[local.value.quote?.id??null]:[])])
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
/** 确认方案仅保存本次选择并读取真实报价；生成仍由独立费用确认卡授权。 */
async function confirmPlan(){
  if(locked.value||props.draftDirty||!selected.value.length)return
  error.value=''
  if(dirty.value)await command('save')
  if(!dirty.value&&!error.value)await command('quote')
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
  <section v-if="local.status!=='stopped'" ref="rootElement" class="creation-image-plan liv-media-plan" aria-label="逐张图片方案">
    <p v-if="local.review_required&&local.review_reason&&!local.batch&&!showingConfirmation" class="text-muted text-sm">{{local.review_reason}}</p>
    <p v-if="!local.batch&&!showingConfirmation">共 {{local.total_count}} 张方案 · 本次选择 {{selected.length}} 张<span v-if="selected.length<local.total_count">，另 {{local.total_count-selected.length}} 张未提交</span></p>
    <div v-for="item in (local.batch||showingConfirmation?[]:local.items)" :key="item.id" class="creation-image-plan-item liv-plan-panel" :class="{'is-selected':selected.includes(item.id)}">
    <UCheckbox :model-value="selected.includes(item.id)" :disabled="locked" :aria-label="`本次选择${item.title}`" @update:model-value="choose(item.id,!!$event)"/>
    <UButton color="neutral" variant="ghost" class="creation-image-plan-open" :disabled="busy||working" @click="emit('open',item.id)">
      <span class="creation-image-plan-cover"><img v-if="itemCover(item)&&!failedCovers[itemCover(item)!.url]" :src="itemCover(item)!.url" :alt="`${item.title} · ${itemCover(item)!.label}`" loading="lazy" @error="failedCovers[itemCover(item)!.url]=true"/><UIcon v-else name="i-lucide-image"/><small v-if="itemCover(item)">{{itemCover(item)!.label}}</small></span><span class="creation-image-plan-copy"><strong>{{item.title}}</strong><small>{{[item.parameters.model,item.parameters.aspectRatio,item.parameters.resolution].filter(Boolean).join(' · ')}}</small></span><UIcon name="i-lucide-chevron-right"/>
    </UButton>
    </div>
    <p v-if="dirty||draftDirty" class="text-muted text-sm">图片改稿或选择尚未保存，旧报价已隐藏。</p>
    <!-- 成果卡不重复展示采购明细；实际报价与授权合同不变。 -->
    <div v-if="quote&&!expired&&!local.batch&&!showingConfirmation" class="creation-image-plan-price liv-plan-price" aria-label="图片逐项费用">
      <p v-for="item in quote.items" :key="item.id" class="flex justify-between gap-3"><span>{{item.title}}</span><span>{{item.credits}} 积分</span></p>
      <p class="creation-image-plan-total flex justify-between gap-3"><span>本次预计消耗</span><span>{{quote.total_credits}} 积分</span></p>
      <p v-if="!quote.sufficient" class="text-warning">当前余额不足以覆盖所选图片合计。</p>
    </div>
    <template v-if="local.batch">
      <!-- 提交后是独立媒体任务，保留真实加载状态；不因对话结束或停止把它画成已完成。 -->
      <p role="status" class="creation-image-delivery"><UIcon :name="imagePlanNeedsPolling(local)?'i-lucide-loader-circle':local.batch.failed||local.batch.unknown?'i-lucide-circle-alert':'i-lucide-check-circle-2'" :class="{'image-delivery-spin':imagePlanNeedsPolling(local)}"/><span>{{imagePlanDeliveryLabel(local)}}（{{local.batch.completed??0}}/{{local.batch.selected_count??local.batch.items.length}}）</span></p>
      <p v-if="local.batch.items.length&&local.batch.items.every(item=>item.mock)" class="text-muted text-sm">开发 mock：使用已有样本，不调用生图供应商、不收取媒体积分。</p>
      <p v-if="local.batch.unknown" class="text-muted text-sm">{{local.batch.unknown}} 张提交状态待核对，不会自动重复提交。</p>
      <UButton v-if="local.batch.items.some(item=>['unknown','result_error'].includes(item.delivery_status))" class="creation-image-plan-action" icon="i-lucide-refresh-cw" color="neutral" variant="soft" :loading="working" @click="reload">重新读取原任务</UButton>
      <div v-for="item in local.batch.items.filter(value=>value.delivery_status!=='completed')" :key="item.item_id" class="text-muted text-sm"><span>{{local.items.find(value=>value.id===item.item_id)?.title}}</span>（{{item.error||item.detail||'正在同步任务状态'}}）
        <UButton v-if="item.retry_run_id||item.delivery_status==='failed'" color="neutral" variant="outline" :disabled="working||busy" @click="openRetry(item.item_id)">{{item.retry_run_id?'继续原重试方案':'为此失败图片创建重试方案'}}</UButton>
      </div>
      <Teleport defer :disabled="!resultTarget" :to="resultTarget||'body'"><CreationResultCard v-for="item in completedResults" :key="item.key" :item="item" @select="openResult"/></Teleport>
    </template>
    <p v-if="error||(!quote&&local.quote_error)" role="alert" class="text-warning text-sm">{{error||local.quote_error}}</p>
    <p v-if="local.quote_delivery==='pending'&&!quote&&!dirty&&!draftDirty" role="status">正在准备费用确认…</p>
    <UButton v-if="pendingCommand" color="neutral" variant="outline" :loading="working" :disabled="working||busy||draftDirty||dirty" @click="resumePending">恢复原{{pendingCommand.action==='confirm'?'提交':'准备'}}状态</UButton>
    <UButton v-if="conflict" color="neutral" variant="outline" :disabled="working" @click="reload">放弃本机选择，读取最新计划</UButton>
    <CreationConfirmationCard v-if="showingConfirmation" model="" spec="" target="image" :requests="confirmationRequests" :credits="quote!.total_credits" has-quote :sufficient="!!quote!.sufficient" :quoting="false" :quote-expired="expired" :busy="working||!!busy" :confirmation-disabled="!confirmable" @confirm="confirmBatch" @cancel="stopBatch" @inspect="emit('open',$event)"/>
    <div v-else-if="!readonly&&!pendingCommand&&local.status==='draft'&&(local.quote_delivery!=='pending'||dirty||draftDirty)" class="liv-plan-actions">
      <!-- 选择或改稿后仍是确认本轮方案，不用“更新”暗示只保存；真正生成由后续确认执行授权。 -->
      <UButton color="primary" class="liv-plan-primary liv-plan-confirm" :loading="working" :disabled="locked||draftDirty||!selected.length" @click="confirmPlan">{{local.quote_error?'重试准备':local.review_required===false?'准备费用确认':'确认方案'}}</UButton>
    </div>
    <p class="text-muted text-sm">{{local.batch?imagePlanNeedsPolling(local)?'已确认本次生成任务。停止对话不会中止生成，结果会回填原节点。':completedResults.length?'可以点击图片卡查看效果，继续告诉我想修改的细节。':'原任务已保留，请根据上方实际状态处理。':local.batch_supported?'在画布查看与编辑完整内容；只有确认执行才提交。':'在画布查看与编辑完整内容；此运行未开放图片批次执行。'}}</p>
  </section>
</template>
<style scoped>
/* 图片方案行采用紧凑间距与40px缩略图；无真实图片时只显示图标，不用“图片方案”占位文字撑高卡片。 */
.creation-image-plan{display:grid;gap:12px;min-width:0;font-size:14px;line-height:1.7}
.creation-image-plan-item{display:flex;align-items:center;gap:8px;min-width:0}
.creation-image-plan .creation-image-plan-item{padding:8px 12px}
.creation-image-plan-item:focus-within{outline:2px solid var(--liv-ui-primary);outline-offset:2px}
.creation-image-plan-open{display:flex!important;align-items:center;gap:8px;min-width:0;flex:1;padding:0!important;text-align:left;white-space:normal;color:var(--liv-chat-assistant-text)!important}
.creation-image-plan-open>.iconify{flex:none;width:16px;height:16px;color:var(--liv-settings-muted)}
.creation-image-plan-cover{position:relative;display:grid;place-items:center;flex:none;width:40px;height:40px;overflow:hidden;border-radius:8px;background:var(--liv-account-raised);color:var(--liv-settings-muted)}
.creation-image-plan-cover img{width:100%;height:100%;object-fit:cover}
.creation-image-plan-cover>.iconify{width:18px;height:18px}
.creation-image-plan-cover small{position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:10px;line-height:14px;background:var(--liv-workspace-surface);color:var(--liv-settings-muted)}
.creation-image-plan-copy{display:grid;gap:2px;flex:1;min-width:0;line-height:1.35}
.creation-image-plan-copy strong,.creation-image-plan-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.creation-image-plan-copy strong{font-size:14px;font-weight:600;line-height:20px}
.creation-image-plan-copy small{font-size:12px;line-height:18px;color:var(--liv-settings-muted)}
.creation-image-plan-price{display:grid;gap:8px}
.creation-image-plan-total{border-top:1px solid var(--color-border-soft);padding-top:8px;font-weight:600}
.creation-image-plan-action{justify-self:start;padding-inline:16px}
.creation-image-delivery{display:flex;align-items:center;gap:8px;color:var(--liv-chat-assistant-text)}
.creation-image-delivery>.iconify{width:16px;height:16px;flex:none}
.image-delivery-spin{animation:image-delivery-spin 1.2s linear infinite}
@keyframes image-delivery-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.image-delivery-spin{animation:none}}
/* 确认方案仅保存选择并核价；按钮独立占满操作行，避免被全局聊天按钮规则挤小。 */
.liv-plan-actions{display:flex;justify-content:center;width:100%}
.liv-media-plan .liv-plan-actions :deep(button.liv-plan-confirm){display:flex;width:100%;min-height:44px!important;justify-content:center!important;border-radius:999px;font-size:15px;color:var(--liv-control-on-primary)}
</style>
