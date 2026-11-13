<script setup lang="ts">
import {onBeforeUnmount,ref} from 'vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {request} from '~/shared/api/adapters/httpAdapter'

const props=defineProps<{sessionId:string;projectId:string;documentRevision:number;disabled?:boolean}>()
type Review={project_id:string;document_revision:number;token:string;version:string;source_text:string;confirmed:boolean}
type Quote={status:string;asset_count:number;required_credits:number;sufficient:boolean;summary:string;confirmation_token?:string|null}
type AssetRun={status:'ready'|'preparing';asset_count:number}
type Analysis={project_id:string;document_revision:number;status:string;token?:string|null;dispatch?:string;required_credits?:number;sufficient?:boolean;source_chars?:number}
const review=ref<Review|null>(null),quote=ref<Quote|null>(null),error=ref('')
const analysis=ref<Analysis|null>(null)
const analysisLabels:Record<string,string>={queued:'已排队',running:'正在解析',succeeded:'基础解析已完成',failed:'解析失败',retryable_failed:'解析失败，可在标准工作台处理',stale:'状态待核对',unknown:'状态待核对'}
const busy=ref('')
const emit=defineEmits<{busy:[boolean]}>()
let active=true
onBeforeUnmount(()=>{active=false})

/** 报价或恢复都只读；仅确认按钮发送一次已查看的报价令牌。 */
async function analyze(submit=false){
  const token=analysis.value?.token
  if(props.disabled||busy.value||submit&&(!token||!analysis.value?.sufficient))return
  busy.value=submit?'analysis-submit':'analysis-read';emit('busy',true);error.value=''
  analysis.value=null
  try{
    const body={project_id:props.projectId,document_revision:props.documentRevision,token}
    const value=await request<Analysis>(`/creation/sessions/${props.sessionId}/production-analysis`,submit?{method:'POST',body}:undefined)
    if(!active)return
    if(value.project_id!==props.projectId||value.document_revision!==props.documentRevision)throw new Error('关联已更新，请重新打开弹窗核对。')
    analysis.value=value
  }catch(cause){if(active)error.value=(cause as Error).message||'解析状态未能读取，请重新核对。'}
  finally{if(active){busy.value='';emit('busy',false)}}
}

/** 只接受当前弹窗对应的项目和修订，失败时不沿用旧报价。 */
async function act(action:'read'|'confirm'|'quote'|'submit-assets'){
  if(props.disabled||busy.value||action!=='read'&&!review.value)return
  if(action==='confirm'&&review.value?.confirmed||action==='quote'&&!review.value?.confirmed)return
  const assetQuote=quote.value
  if(action==='submit-assets'&&(!review.value?.confirmed||!assetQuote?.confirmation_token||!assetQuote.sufficient))return
  const base=`/creation/sessions/${props.sessionId}`
  const candidate=review.value
  const body=candidate?{project_id:candidate.project_id,document_revision:candidate.document_revision,token:candidate.token}:undefined
  busy.value=action;emit('busy',true);error.value='';quote.value=null
  if(action==='read')review.value=null
  try{
    if(action==='submit-assets'){
      // 只在确认按钮点击时送出范围令牌；刷新和恢复不调用提交接口。
      const value=await request<AssetRun>(`${base}/production-assets`,{
        method:'POST',body:{...body,confirmation_token:assetQuote?.confirmation_token}
      })
      if(active)quote.value={status:value.status,asset_count:value.asset_count,required_credits:0,sufficient:true,
        summary:value.status==='ready'?'已复用资产资料。':'资产提炼任务已提交，可以刷新查看状态。'}
    }else if(action==='quote'){
      const value=await request<Quote>(`${base}/production-assets/estimate`,{method:'POST',body})
      if(active)quote.value=value
    }else{
      const value=await request<Review>(`${base}/production-script-review`,action==='confirm'?{method:'POST',body}:undefined)
      if(!active)return
      if(value.project_id!==props.projectId||value.document_revision!==props.documentRevision)throw new Error('关联已变更，请关闭弹窗后重新打开。')
      review.value=value
    }
  }catch(cause){if(active){if(action!=='submit-assets')review.value=null;error.value=(cause as Error).message||'未能读取当前制作资料，请重新核对。'}}
  finally{if(active){busy.value='';emit('busy',false)}}
}
</script>

<template>
  <div class="grid gap-3">
    <template v-if="!review">
      <LivButton settings :loading="busy==='analysis-read'" :disabled="disabled||!!busy" @click="analyze()">{{analysis?'刷新解析状态':'核对基础解析'}}</LivButton>
      <template v-if="analysis?.token">
        <p class="liv-settings-note" role="status">正式剧本 {{analysis.source_chars}} 字，预计 {{analysis.required_credits}} 积分；基础解析成功后扣点。{{analysis.sufficient?'':'余额不足。'}}</p>
        <LivButton settings variant="primary" :disabled="disabled||!!busy||!analysis.sufficient" @click="analyze(true)">确认并开始解析</LivButton>
      </template>
      <p v-else-if="analysis" class="liv-settings-note" role="status">
        {{analysis.status==='queued'&&['unknown','claimed'].includes(analysis.dispatch||'')?'队列回执待核对，不会重复提交。':analysisLabels[analysis.status]||'请刷新核对解析状态。'}}
      </p>
    </template>
    <LivButton v-if="!review" settings variant="primary" :disabled="disabled||!!busy" :loading="busy==='read'" @click="act('read')">核对正式剧本</LivButton>
    <template v-else>
      <p class="liv-settings-copy">{{review.version}} · {{review.confirmed?'已确认':'待确认'}}</p>
      <UTextarea :model-value="review.source_text" :rows="6" readonly aria-label="正式剧本原文"/>
      <div class="flex flex-wrap gap-2">
        <LivButton v-if="!review.confirmed" settings variant="primary" :loading="busy==='confirm'" :disabled="disabled||!!busy" @click="act('confirm')">确认正式剧本</LivButton>
        <LivButton v-else settings :loading="busy==='quote'" :disabled="disabled||!!busy" @click="act('quote')">{{quote?.status==='preparing'?'刷新资产提炼状态':'核对资产提炼'}}</LivButton>
        <LivButton settings variant="ghost" :disabled="disabled||!!busy" @click="act('read')">重新核对</LivButton>
      </div>
      <p v-if="quote" class="liv-settings-note" role="status">
        {{quote.summary}} 共 {{quote.asset_count}} 项。<template v-if="quote.confirmation_token">预计 {{quote.required_credits}} 积分；确认后提交。{{quote.sufficient?'':'余额不足。'}}</template>
      </p>
      <p v-if="busy==='submit-assets'" class="liv-settings-note" role="status">正在提交资产提炼…</p>
      <LivButton v-else-if="quote?.confirmation_token" settings variant="primary" :disabled="disabled||!!busy||!quote.sufficient" @click="act('submit-assets')">确认并提炼资产</LivButton>
    </template>
    <p v-if="error" class="liv-settings-note" role="alert">{{error}}</p>
  </div>
</template>
