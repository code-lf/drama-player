<script setup lang="ts">
import {computed,onBeforeUnmount,ref} from 'vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import CanvasProductionReview from './CanvasProductionReview.vue'
import {request} from '~/shared/api/adapters/httpAdapter'
import type {CanvasScriptProductionOptions} from '../scriptDocument'

const props=defineProps<{sessionId:string;revision:number;disabled?:boolean;production?:CanvasScriptProductionOptions;styleLabel?:string}>()
const emit=defineEmits<{linked:[]}>()
type Intake={project_id:string;document_revision:number;origin:'intake'|'binding';stage:string;status:string}
const open=ref(false),loading=ref(false),submitting=ref(false),loaded=ref(false),error=ref('')
const result=ref<Intake|null>(null),ratio=ref<'16:9'|'9:16'>('16:9')
const candidateRevision=ref(0)
const reviewBusy=ref(false)
const stale=computed(()=>candidateRevision.value!==props.revision)
// 短剧入口沿用原后端的横、竖屏范围，默认清晰度和风格仍由生产服务决定。
const ratios=[{label:'横屏 16:9',value:'16:9'},{label:'竖屏 9:16',value:'9:16'}] as const
let epoch=0
onBeforeUnmount(()=>{epoch++})
const path=()=>`/creation/sessions/${props.sessionId}/production-intake`

/** 打开弹窗只核对既有项目；读取失败时禁止发起导入。 */
async function inspect(){
  const current=++epoch
  candidateRevision.value=props.revision
  open.value=true;loading.value=true;loaded.value=false;error.value='';result.value=null
  try{
    const value=await request<Intake|null>(path())
    if(current===epoch){result.value=value;loaded.value=true}
  }catch{if(current===epoch)error.value='无法读取项目关联，请重试。'}
  finally{if(current===epoch)loading.value=false}
}

/** 确认只导入已保存版本；网络重试由服务端返回同一个正式项目。 */
async function submit(){
  if(!loaded.value||result.value||submitting.value||props.disabled||stale.value)return
  const current=epoch
  submitting.value=true;error.value=''
  try{
    const value=await request<Intake>(path(),{method:'POST',body:{expected_document_revision:candidateRevision.value,aspect_ratio:ratio.value}})
    if(current===epoch){result.value=value;emit('linked')}
  }catch(cause){if(current===epoch)error.value=(cause as Error).message||'导入失败，请重试。'}
  finally{if(current===epoch)submitting.value=false}
}

function close(){
  if(submitting.value||reviewBusy.value)return
  epoch++;open.value=false
}
</script>

<template>
  <UButton color="neutral" variant="soft" icon="i-lucide-clapperboard" :disabled="disabled" @click="inspect">短剧制作项目</UButton>
  <LivDialog :open="open" :dismissible="!submitting&&!reviewBusy" settings dark title="短剧制作项目" description="导入剧本不会启动任务；解析、资产提炼均需单独核对费用后提交。" @update:open="value=>{if(!value)close()}">
    <div class="grid gap-3">
      <p v-if="loading" class="liv-settings-note" role="status">正在核对项目关联…</p>
      <template v-else-if="result">
        <p class="liv-settings-copy" role="status">{{result.origin==='binding'?'已关联现有短剧项目。':'剧本已导入正式短剧项目。'}}</p>
        <p v-if="result.document_revision!==revision" class="liv-settings-note">画布剧本已有新修改，正式项目未被覆盖。</p>
        <CanvasProductionReview v-if="open" :key="result.project_id" :session-id="sessionId" :project-id="result.project_id" :document-revision="result.document_revision" :disabled="disabled||result.document_revision!==revision" @busy="reviewBusy=$event"/>
        <UButton color="neutral" variant="soft" :to="`/drama/${result.project_id}`">在标准工作台打开</UButton>
      </template>
      <template v-else-if="loaded">
        <p class="liv-settings-note">{{stale?'画布文稿已更新，请重新核对。':`本次导入画布文稿 V${candidateRevision}。`}}</p>
        <p v-if="production" class="liv-settings-copy">{{production.aspect_ratio}} · {{production.resolution}}<template v-if="production.style_id"> · {{styleLabel||'已选风格'}} V{{production.style_version}}</template></p>
        <USelect v-else v-model="ratio" :items="[...ratios]" aria-label="短剧画幅" :disabled="submitting"/>
      </template>
      <p v-if="error" class="liv-settings-note" role="alert">{{error}}</p>
    </div>
    <template #footer>
      <LivButton settings :disabled="submitting||reviewBusy" @click="close">{{result?'关闭':'取消'}}</LivButton>
      <LivButton v-if="loaded&&!result&&stale" settings variant="primary" :disabled="submitting" @click="inspect">重新核对</LivButton>
      <LivButton v-else-if="loaded&&!result" settings variant="primary" :loading="submitting" :disabled="submitting||disabled" @click="submit">确认导入</LivButton>
      <LivButton v-else-if="error&&!loading" settings variant="primary" @click="inspect">重试读取</LivButton>
    </template>
  </LivDialog>
</template>
