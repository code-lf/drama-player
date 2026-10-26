<script setup lang="ts">
import {computed,onBeforeUnmount,ref} from 'vue'
import {creationService,type CreationRun} from '~/shared/api/services/creationService'

const props=defineProps<{run:CreationRun;busy?:boolean}>()
const emit=defineEmits<{updated:[run:CreationRun]}>()
const pending=computed(()=>props.run.flow_runtime?.pending_command)
const working=ref(false),error=ref('')
const {confirm}=useActionDialog()
let alive=true
/** 明确恢复原命令，确认提交需再次说明影响；不在挂载、刷新或订阅时自动执行。 */
async function resume(){
  if(!pending.value||working.value||props.busy)return
  const id=props.run.id,command={...pending.value},identity=JSON.stringify(command)
  working.value=true;error.value=''
  try{
    const message=command.action==='confirm'
      ?'将恢复你此前确认的同一批任务：尚未提交时仍须通过原报价校验，已提交时只恢复原任务，不重复扣费。是否继续？'
      :'将继续服务器已保存的原操作，不更换请求编号，也不创建新的生成需求。是否继续？'
    if(!await confirm(message,'恢复原操作')||!alive||id!==props.run.id||identity!==JSON.stringify(pending.value))return
    const result=await creationService.resumeFlow(id,command)
    if(alive&&id===props.run.id&&identity===JSON.stringify(pending.value))emit('updated',result)
  }catch(cause){
    if(!alive||id!==props.run.id)return
    error.value=(cause as Error).message||'原操作尚未恢复，请读取当前状态后重试。'
    // 失败后只读核对，业务拒绝可能已结束原命令；不得因此换请求号重发。
    try{const result=await creationService.run(id);if(alive&&id===props.run.id&&identity===JSON.stringify(pending.value))emit('updated',result)}catch{/* 保留原恢复入口和错误，等待用户重试。 */}
  }finally{if(alive)working.value=false}
}
onBeforeUnmount(()=>{alive=false})
</script>
<template>
  <div v-if="(pending&&!busy)||error" class="space-y-2" role="status">
    <p v-if="pending">上次操作尚待核对。刷新只恢复状态，不会再次提交生成。</p>
    <p v-if="pending?.action==='confirm'&&run.creative_plan?.quote" class="text-muted">原确认合计 {{run.creative_plan.quote.total_credits}} 积分，恢复时仍须通过服务端校验。</p>
    <UButton v-if="pending" color="neutral" variant="outline" :loading="working" :disabled="working||busy" @click="resume">核对并恢复原操作</UButton>
    <p v-if="error" class="text-error" role="alert">{{error}}</p>
  </div>
</template>
