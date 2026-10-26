<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {creationService,type VideoPlan,type CreationRun} from '~/shared/api/services/creationService'
import type {CompositionJob} from '~/shared/api/services/videoCompositionService'
import type {WorkspaceSource,CreationParameterState} from '../types'
import CreationResultCanvas,{type CanvasVersion} from './CreationResultCanvas.vue'
import {workbenchMedia} from '../videoWorkbenchMedia'
import type {CreativeNodeParameters} from '../agentCanvas'

// 提示词模式只替换原播放器底栏，不再常驻名称表单或左右分栏编辑区。
const props=defineProps<{runId:string;plan:VideoPlan;initialItemId?:string;savedRuns?:CreationRun[];composition?:CompositionJob|null;composing?:boolean;compositionError?:string;saveBusy?:boolean;canvasMode?:boolean}>()
const emit=defineEmits<{updated:[id:string,plan:VideoPlan];saved:[source:string,run:CreationRun];revise:[source:string,run:CreationRun];compose:[];close:[];save:[value:{file:Blob;source:WorkspaceSource;operations:Record<string,unknown>[];requestId:string}];ai:[action:string,source:WorkspaceSource]}>()
const selected=ref(props.initialItemId||props.plan.items[0]?.id||''),busy=ref(false),editing=ref(!props.plan.batch),error=ref(''),notice=ref('')
/** 改稿只携带允许编辑的规格，不把原条目extra、素材或价格反传为客户端授权。 */
function editableItem(item:{id:string;title:string;prompt:string;parameters?:Partial<CreationParameterState>}):{id:string;title:string;prompt:string;parameters?:Partial<CreativeNodeParameters>}{
  const keys:Array<keyof CreativeNodeParameters>=['model','style','styleId','aspectRatio','durationSec','resolution','quality']
  const values=Object.fromEntries(keys.filter(key=>item.parameters?.[key]!==undefined).map(key=>[key,item.parameters![key]])) as Partial<CreativeNodeParameters>
  return {id:item.id,title:item.title,prompt:item.prompt,...(Object.keys(values).length?{parameters:values}:{})}
}
const drafts=ref(props.plan.items.map(editableItem))
const baseline=ref(JSON.stringify(drafts.value)),savedRuns=ref<Record<string,CreationRun>>({})
const current=computed(()=>drafts.value.find(item=>item.id===selected.value))
// 处理中/失败条目仍走原重试入口，不把本编辑器当作重新购买的快捷通道。
const canEditCurrent=computed(()=>!props.plan.batch||props.plan.batch.items.some(item=>item.item_id===current.value?.id&&item.status==='succeeded'))
let alive=true,receipt:{key:string;id:string}|null=null
onBeforeUnmount(()=>{alive=false})
defineExpose({isBusy:()=>busy.value,isDirty:()=>baseline.value!==JSON.stringify(drafts.value)})

/** 刷新从当前会话的真实改稿记录恢复保存内容，不写回已成功任务。 */
watch(()=>props.savedRuns,runs=>{
  for(const run of runs||[]){
    if(run.revision_parent!==props.runId||!run.creative_plan||run.creative_plan.batch)continue
    for(const id of run.creative_plan.selected_ids){
      const item=drafts.value.find(value=>value.id===id),saved=run.creative_plan.items.find(value=>value.id===id)
      const previous=(JSON.parse(baseline.value) as typeof drafts.value).find(value=>value.id===id)
      if(!item||!saved||JSON.stringify(item)!==JSON.stringify(previous))continue
      Object.assign(item,editableItem(saved));savedRuns.value[id]=run;rememberSaved(item)
    }
  }
},{immediate:true,deep:true})
// 切换版本收起编辑器；未保存内容仍在本页保留，离开整个工作台继续提示保护。
watch(()=>props.initialItemId,id=>{if(id&&drafts.value.some(item=>item.id===id))selectVersion(id)})
watch(()=>props.composition?.id,id=>{if(id&&props.composition?.output.public_url)selectVersion('composition')})
function selectVersion(id:string){if(busy.value)return;selected.value=id;editing.value=!props.plan.batch&&id!=='composition';error.value='';notice.value=''}
function rememberSaved(item:typeof drafts.value[number]){baseline.value=JSON.stringify((JSON.parse(baseline.value) as typeof drafts.value).map(value=>value.id===item.id?{...item}:value))}
/** 只回写当前片段，保存/核价仍由原改稿命令显式提交。 */
function updateParameters(value:CreativeNodeParameters){if(current.value&&!busy.value&&canEditCurrent.value)current.value.parameters=editableItem({...current.value,parameters:value}).parameters}

/** 原作品播放器负责首帧、尺寸和截帧，版本选择与底部产物条也继续复用。 */
const media=computed(()=>workbenchMedia(props.runId,props.plan,props.savedRuns||[]))
const inherited=computed(()=>media.value.some(value=>value.itemId===selected.value&&value.inherited))
const versions=computed<CanvasVersion[]>(()=>{
  const values:CanvasVersion[]=props.plan.items.map(item=>{
    const found=media.value.find(value=>value.itemId===item.id)
    return {key:item.id,title:item.title,kind:'video',url:found?.result.url||'',source:found?.result.source||{kind:'video',id:''}}
  })
  // 合成任务并非工作区派生图片，不能冒用其编号调用原媒体下载或截图接口。
  if(props.composition?.output.public_url)values.push({key:'composition',title:'合成结果',kind:'video',url:props.composition.output.public_url,source:{kind:'artifact',id:props.composition.id},downloadable:false})
  return values
})
const results=computed(()=>media.value.map(value=>value.result))
const selectedResult=computed(()=>results.value.find(value=>value.source.result_id===versions.value.find(item=>item.key===selected.value)?.source.result_id)?.key||'')
function selectResult(key:string){const value=results.value.find(item=>item.key===key);const version=versions.value.find(item=>item.source.result_id===value?.source.result_id);if(version)selectVersion(version.key)}
const canSave=computed(()=>!!current.value&&current.value.prompt.trim().length>=20&&!busy.value&&canEditCurrent.value)

/** 保存仅持久化草案；立即生成先保存、核价和准备，再交原对话明确确认费用。 */
async function save(mode:'save'|'generate'){
  if(!canSave.value||!current.value)return
  busy.value=true;error.value='';notice.value=''
  const item={...current.value}
  try{
    let run=savedRuns.value[item.id]
    if(props.plan.batch&&!run){
      const key=JSON.stringify([props.plan.revision,item]);if(receipt?.key!==key)receipt={key,id:crypto.randomUUID()}
      const value=await creationService.reviseCompletedVideo(props.runId,{expected_revision:props.plan.revision,request_id:receipt.id,selected_ids:[item.id],items:[item]})
      run=await creationService.run(value.run_id)
    }else{
      const id=run?.id||props.runId,plan=run?.creative_plan||props.plan
      const key=JSON.stringify([id,plan.revision,item]);if(receipt?.key!==key)receipt={key,id:crypto.randomUUID()}
      const planValue=await creationService.saveVideoPlan(id,{expected_revision:plan.revision,request_id:receipt.id,selected_ids:[item.id],items:[item]})
      run=run?{...run,creative_plan:planValue}:await creationService.run(id)
    }
    if(!alive)return
    savedRuns.value[item.id]=run;rememberSaved(item);emit('saved',props.runId,run)
    if(mode==='save'){notice.value='编辑稿已保存';return}
    let plan=await creationService.quoteVideoPlan(run.id,{expected_revision:run.creative_plan!.revision,request_id:crypto.randomUUID()})
    if(!alive)return
    savedRuns.value[item.id]={...run,creative_plan:plan}
    if(plan.batch_supported&&plan.quote){
      plan=await creationService.prepareVideoBatch(run.id,{expected_revision:plan.revision,quote_id:plan.quote.id,request_id:crypto.randomUUID()})
      if(!alive)return
    }
    run={...run,creative_plan:plan};savedRuns.value[item.id]=run;editing.value=false;emit('revise',props.runId,run)
  }catch(cause){if(alive)error.value=(cause as Error).message||'操作未完成，修改仍保留。'}
  finally{if(alive)busy.value=false}
}
</script>
<template>
  <section class="liv-inline-video-workbench" :class="{'is-canvas-editor':canvasMode}" aria-label="右侧视频工作台">
    <!-- 画布模式仅复用改稿/核价逻辑，播放器已经在节点内，不能再挂第二个播放器。 -->
    <div v-if="canvasMode&&current" class="liv-video-prompt-editor">
      <slot name="editor" :prompt="current.prompt" :readonly="busy||!canEditCurrent" :value="current.parameters||{}" :initial="plan.items.find(item=>item.id===current?.id)?.parameters" :references="plan.items.find(item=>item.id===current?.id)?.references||[]" :update="(text:string)=>{if(current&&!busy&&canEditCurrent)current.prompt=text}" :parameters="updateParameters" :submit="()=>save('generate')" :save="()=>save('save')" :busy="busy" :can-save="canSave">
      <slot name="prompt-input" :prompt="current.prompt" :readonly="busy||!canEditCurrent" :update="(text:string)=>{if(current&&!busy&&canEditCurrent)current.prompt=text}" :submit="()=>save('generate')"><UTextarea v-model="current.prompt" class="w-full" :rows="5" :disabled="busy||!canEditCurrent" :maxlength="20000" aria-label="当前提示词"/></slot>
      <slot name="parameter-controls" :value="current.parameters||{}" :initial="plan.items.find(item=>item.id===current?.id)?.parameters" :references="plan.items.find(item=>item.id===current?.id)?.references||[]" :busy="busy||!canEditCurrent" :update="updateParameters"/>
      <p v-if="!canEditCurrent" class="text-muted text-xs">此片段尚未成功，请返回方案使用失败项重试入口。</p>
      <div class="liv-video-prompt-actions"><span v-if="notice" role="status" class="text-muted">{{notice}}</span><UButton color="neutral" variant="outline" :disabled="!canSave" :loading="busy" @click="save('save')">保存</UButton><UButton :disabled="!canSave" :loading="busy" @click="save('generate')">整理方案并核价</UButton><UButton color="neutral" variant="ghost" :disabled="busy" @click="emit('close')">退出编辑</UButton></div>
      </slot>
    </div>
    <CreationResultCanvas v-else :versions="versions" :selected="selected" :results="results" :selected-result="selectedResult" :selection-disabled="busy" :video-editing="editing" :save-busy="saveBusy||busy" @select="selectVersion" @result="selectResult" @save="emit('save',$event)" @ai="(action,source)=>emit('ai',action,source)">
      <template #media-caption><span v-if="inherited" class="liv-original-video-label">原视频 · 尚未重新生成</span></template>
      <template #top-actions><UTooltip text="关闭视频工作台"><UButton square icon="i-lucide-x" color="neutral" variant="ghost" aria-label="关闭视频工作台" :disabled="busy" @click="emit('close')"/></UTooltip></template>
      <template #video-toolbar><UButton v-if="current" icon="i-lucide-text-cursor-input" variant="ghost" color="neutral" :disabled="busy" @click="editing=true;notice='';error=''">当前提示词</UButton></template>
      <template #video-editor>
        <div v-if="current" class="liv-video-prompt-editor">
          <UTextarea v-model="current.prompt" class="w-full" :rows="7" :disabled="busy" :maxlength="20000" aria-label="当前提示词"/>
          <div class="liv-video-prompt-actions"><span v-if="notice" role="status" class="text-muted">{{notice}}</span><UButton color="neutral" variant="outline" :disabled="!canSave" :loading="busy" @click="save('save')">保存</UButton><UButton :disabled="!canSave" :loading="busy" @click="save('generate')">立即生成</UButton><UButton color="neutral" variant="ghost" :disabled="busy" @click="editing=false">退出编辑</UButton></div>
        </div>
      </template>
    </CreationResultCanvas>
    <p v-if="error||compositionError" role="alert" class="text-error liv-video-workbench-feedback">{{error||compositionError}}</p>
    <p v-if="composition&&!composition.output.public_url" role="status" class="liv-video-workbench-feedback">{{composition.status==='failed'?'合成失败':'正在合成短片'}}{{composition.error_message?'：'+composition.error_message:''}}</p>
  </section>
</template>
<style scoped>
/* 媒体、工具、缩略图居中成组；提示词模式仅替换工具区域，不新增平行播放器。 */
.liv-inline-video-workbench{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;height:100%;color:var(--ui-text);--liv-workspace-video-max-height:var(--liv-workspace-video-expanded-max-height)}
.liv-video-prompt-editor{width:100%;min-width:0;text-align:left}
.liv-video-prompt-editor :deep(textarea){resize:vertical;min-height:var(--liv-video-prompt-min-height);max-height:var(--liv-video-prompt-max-height);line-height:1.7}
.liv-video-prompt-actions{display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px}
.liv-video-prompt-actions>span{margin-right:auto;font-size:12px}
.liv-video-workbench-feedback{padding:8px 16px;font-size:14px}
.liv-inline-video-workbench.is-canvas-editor{height:auto;flex:none}
.is-canvas-editor .liv-video-prompt-editor :deep(textarea){min-height:var(--liv-graph-editor-height);max-height:45dvh;resize:vertical}
.liv-original-video-label{color:var(--ui-text-muted);font-size:12px}
</style>
