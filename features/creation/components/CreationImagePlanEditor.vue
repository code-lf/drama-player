<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import CreationNodeControls from './CreationNodeControls.vue'
import {creationService,type CreationRun,type ImageCreativePlan,type ImagePlanEditCommand,type ImagePlanParameters} from '~/shared/api/services/creationService'
import {canEditImagePlan,editableImageParameters,imageItemCommand} from '../imagePlanState'
import type {CreationCatalog,ComposerReference} from '../types'
import {useActionDialog} from '~/composables/useActionDialog'

/** 图片计划只适配修订命令，输入器、模型/风格/规格和保存插槽全部复用统一组件。 */
const props=defineProps<{run:CreationRun;itemId:string;catalog:CreationCatalog|null;references:ComposerReference[];busy?:boolean}>()
const emit=defineEmits<{updated:[id:string,plan:ImageCreativePlan]}>()
const {confirm}=useActionDialog()
const plan=ref(props.run.image_plan!),prompt=ref(''),parameters=ref<ImagePlanParameters>({}),saving=ref(false),error=ref(''),conflict=ref(false)
let alive=true,epoch=0,receipt:{digest:string;command:ImagePlanEditCommand}|null=null
const item=computed(()=>plan.value.items.find(value=>value.id===props.itemId))
/** 保存期间保留精确命令，超时重试不换请求号；恢复/读取从不恢复费用许可。 */
function restore(value:ImageCreativePlan){
  plan.value=value
  const next=value.items.find(row=>row.id===props.itemId)
  prompt.value=next?.prompt||'';parameters.value=editableImageParameters(next?.parameters||{})
  conflict.value=false;error.value='';receipt=null
}
restore(props.run.image_plan!)
const dirty=computed(()=>!!item.value&&(prompt.value!==item.value.prompt||JSON.stringify(parameters.value)!==JSON.stringify(editableImageParameters(item.value.parameters))))
const readonly=computed(()=>!canEditImagePlan(props.run,props.run.image_plan||plan.value)||conflict.value)
/** 节点不另开采购入口；禁用原因跟随真实批次，已提交不能误报为能力未开放。 */
const sendDisabledReason=computed(()=>{
  const current=props.run.image_plan||plan.value
  if(current.status==='submitted'||current.batch)return '图片任务已提交，请在原批次查看状态；不会重复生成'
  if(conflict.value)return '请先核对图片计划的最新修订'
  if(current.quote&&!current.quote.expired)return '请在左侧费用卡确认本批图片；画布编辑不会直接生成'
  return current.batch_supported?'请在对话中统一核价并确认本批图片':'此运行未开放图片批次执行，可先保存方案'
})
watch(()=>props.run.image_plan,value=>{
  if(!value||(value.revision===plan.value.revision&&value.status===plan.value.status))return
  // 其他页面/选择卡的修订不能覆盖当前未保存正文，必须显式重读核对。
  // 本机保存中的回填交给save响应核对修订；不能把自己的成功回包标成外部冲突。
  if(saving.value)return
  if(dirty.value){conflict.value=true;error.value='图片计划已更新，当前输入保留。请先核对最新计划。'}
  else restore(value)
})
onBeforeUnmount(()=>{alive=false;epoch++})
async function save(){
  if(readonly.value||props.busy||saving.value||!item.value||!dirty.value)return
  saving.value=true;error.value='';const current=++epoch,id=props.run.id
  try{
    const value=imageItemCommand(plan.value,props.itemId,prompt.value,parameters.value,'')
    const digest=JSON.stringify(value)
    if(!receipt||receipt.digest!==digest)receipt={digest,command:{...value,request_id:crypto.randomUUID()}}
    const next=await creationService.saveImagePlan(id,receipt.command)
    if(!alive||current!==epoch)return
    // 保存响应可能晚于另一页面的新修订，不能把较旧成功响应覆盖到最新业务快照。
    if((props.run.image_plan?.revision||0)>next.revision){
      conflict.value=true;error.value='保存请求已返回，但图片计划已有更新修订，请读取最新计划核对。';return
    }
    restore(next);emit('updated',id,next)
  }catch(cause){
    if(alive&&current===epoch){error.value=(cause as Error).message||'图片方案保存失败，输入仍保留。';if((cause as {statusCode?:number}).statusCode===409)conflict.value=true}
  }finally{if(alive&&current===epoch)saving.value=false}
}
/** 冲突时显式确认放弃本机稿，再只读加载最新计划，不能静默覆盖未保存正文。 */
async function reload(){
  if(saving.value)return
  if(dirty.value&&!await confirm('是否放弃当前未保存输入，读取最新图片计划？原作品不受影响。','核对图片计划'))return
  if(!alive||saving.value)return
  saving.value=true;const current=++epoch
  try{const next=await creationService.imagePlan(props.run.id);if(alive&&current===epoch){restore(next);emit('updated',props.run.id,next)}}
  catch(cause){if(alive&&current===epoch)error.value=(cause as Error).message||'读取图片计划失败。'}
  finally{if(alive&&current===epoch)saving.value=false}
}
defineExpose({isDirty:()=>dirty.value,isBusy:()=>saving.value,reload})
</script>
<template>
  <CreationNodeControls v-if="item" full-editor kind="image" :skill="run.skill" :catalog="catalog" :value="parameters" :prompt="prompt" :readonly="readonly" :references="references" :reference-types="references" :busy="busy||saving" :send-disabled-reason="sendDisabledReason" @text="prompt=$event" @update="parameters=editableImageParameters($event)">
    <template #toolbar-actions><UTooltip text="保存本张方案，不生成、不扣点"><UButton icon="i-lucide-save" color="neutral" variant="ghost" square aria-label="保存图片方案" :disabled="readonly||busy||saving||!dirty" :loading="saving" @click="save"/></UTooltip></template>
  </CreationNodeControls>
  <p v-else role="alert">当前图片方案条目暂不可读，请重新选择节点或刷新会话。</p>
  <p v-if="error" role="alert" class="text-warning text-sm">{{error}}</p>
  <UButton v-if="conflict" color="neutral" variant="outline" :disabled="saving" @click="reload">读取最新计划并核对</UButton>
</template>
