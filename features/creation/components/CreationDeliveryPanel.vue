<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import type {SessionResult} from '../resultCatalog'
import CreationCompositionPanel from './CreationCompositionPanel.vue'
import CreationGenerationBinding from './CreationGenerationBinding.vue'
import {videoCompositionService as api,type CompositionOutputs} from '~/shared/api/services/videoCompositionService'

const props=defineProps<{sessionId:string;sources:SessionResult[]}>()
const emit=defineEmits<{openRun:[id:string]}>()
const {confirm}=useActionDialog()
const manifest=ref<CompositionOutputs>({schema_version:1,revision:0,output_count:0,outputs:[]})
const selected=ref(''),legacy=ref(false),ready=ref(false),busy=ref(false),loading=ref(false),error=ref('')
const title=ref(''),currentTitle=ref('')
const child=ref<InstanceType<typeof CreationCompositionPanel>|null>(null)
const binding=ref<InstanceType<typeof CreationGenerationBinding>|null>(null),bindingBusy=ref(false),editorVersion=ref(0)
const childBusy=computed(()=>!!child.value?.isBusy()||bindingBusy.value)
const current=computed(()=>manifest.value.outputs.find(item=>item.id===selected.value))
let alive=true,readEpoch=0,addReceipt:{key:string;id:string}|null=null,editReceipt:{key:string;id:string}|null=null
watch([selected,()=>current.value?.title],([id,value],[oldId,oldValue])=>{
  // 刷新目录时保留正在输入的名称；只有换成片或本地名称未修改才同步服务端。
  if(id!==oldId||currentTitle.value===oldValue)currentTitle.value=value||''
})

/** 读取仅恢复目录；不自动新增成片、转移旧草稿或提交合成。 */
async function load(){
  const epoch=++readEpoch;loading.value=true
  try{const value=await api.outputs(props.sessionId);if(!alive||epoch!==readEpoch)return;manifest.value=value;ready.value=true;if(!value.outputs.some(item=>item.id===selected.value))selected.value=value.outputs[0]?.id||''}
  catch(cause){if(alive&&epoch===readEpoch)error.value=(cause as Error).message||'成片清单读取失败，请重试。'}
  finally{if(alive&&epoch===readEpoch)loading.value=false}
}
/** 切换前明确确认未保存编辑；保存失败不把当前片段带到另一条成片。 */
async function canLeave(){
  if(child.value?.isBusy()){error.value='当前片段计划正在处理，请完成后再切换。';return false}
  const previous=selected.value,wasLegacy=legacy.value
  if((child.value?.isDirty()||(!legacy.value&&current.value&&currentTitle.value!==current.value.title))&&!await confirm('当前成片还有未保存的名称或片段编辑。切换后这些编辑不会自动保存，已生成作品不受影响。是否继续？','切换成片'))return false
  return alive&&previous===selected.value&&wasLegacy===legacy.value
}
/** 绑定卡已经统一说明替换风险；此处只做当前编辑器/输出归属门禁，不重复弹问。 */
function beforeBindingChange(){return alive&&!legacy.value&&!!current.value&&!child.value?.isBusy()}
function bindingChanged(){editorVersion.value++;void load()}
function editorChanged(){void load();void binding.value?.reload()}
async function openSourceRun(id:string){
  if(busy.value||childBusy.value)return
  busy.value=true
  try{if(await canLeave()&&alive)emit('openRun',id)}finally{if(alive)busy.value=false}
}
async function choose(id:string){
  if(busy.value||childBusy.value||(legacy.value&&id==='legacy')||(!legacy.value&&selected.value===id))return
  busy.value=true;error.value=''
  try{if(!await canLeave())return;legacy.value=id==='legacy';if(!legacy.value)selected.value=id}
  finally{if(alive)busy.value=false}
}
/** 新增只保存空成片；网络失败沿用原请求号，不因重复点击多建成片。 */
async function add(){
  if(!ready.value||busy.value||childBusy.value||manifest.value.output_count>=12||!title.value.trim())return
  busy.value=true;error.value=''
  try{
    if(!await canLeave())return
    const key=JSON.stringify([manifest.value.revision,title.value])
    if(addReceipt?.key!==key)addReceipt={key,id:crypto.randomUUID()}
    const value=await api.addOutput(props.sessionId,{expected_revision:manifest.value.revision,request_id:addReceipt.id,title:title.value})
    if(!alive)return
    manifest.value=value;selected.value=value.outputs.some(item=>item.id===value.created_output_id)?value.created_output_id!:value.outputs[0]?.id||'';legacy.value=false;title.value='';addReceipt=null
  }catch(cause){if(alive)error.value=(cause as Error).message||'新增成片失败，请使用原请求重试。'}
  finally{if(alive)busy.value=false}
}
/** 目录修改不带片段和任务入参；明确移除只归档，不删除旧任务及成片。 */
async function edit(order_ids:string[],titles:Record<string,string>={},removed_ids:string[]=[]){
  if(!ready.value||busy.value||childBusy.value)return
  busy.value=true;error.value=''
  try{
    if(removed_ids.length&&!await confirm('仅从当前成片清单移除，已提交任务和作品不会删除。当前未保存编辑不会保留。是否继续？','移除成片计划'))return
    if(!alive)return
    const content={expected_revision:manifest.value.revision,order_ids,titles,removed_ids},key=JSON.stringify(content)
    if(editReceipt?.key!==key)editReceipt={key,id:crypto.randomUUID()}
    const value=await api.editOutputs(props.sessionId,{...content,request_id:editReceipt.id})
    if(!alive)return
    manifest.value=value;if(!value.outputs.some(item=>item.id===selected.value))selected.value=value.outputs[0]?.id||''
    editReceipt=null
  }catch(cause){if(alive)error.value=(cause as Error).message||'成片清单保存失败，已保留当前内容。'}
  finally{if(alive)busy.value=false}
}
function move(direction:number){
  const ids=manifest.value.outputs.map(item=>item.id),index=ids.indexOf(selected.value),target=index+direction
  if(index<0||target<0||target>=ids.length)return
  ;[ids[index],ids[target]]=[ids[target]!,ids[index]!]
  void edit(ids)
}
onMounted(()=>void load())
onBeforeUnmount(()=>{alive=false;readEpoch++})
</script>
<template>
  <section class="space-y-4 text-sm" aria-label="成片与片段计划">
    <p>每条成片都有独立的片段清单和合成记录。多个片段不会当成多条广告；本次确认只合成当前成片。</p>
    <p v-if="ready" class="font-semibold">已保存 {{manifest.output_count}} 条成片计划 · {{manifest.outputs.reduce((count,item)=>count+item.clip_count,0)}} 个片段引用</p>
    <USkeleton v-else class="h-8 w-full" aria-label="正在读取成片清单"/>
    <div class="flex flex-wrap gap-2">
      <UButton v-for="output in manifest.outputs" :key="output.id" :color="!legacy&&selected===output.id?'primary':'neutral'" :variant="!legacy&&selected===output.id?'soft':'outline'" :disabled="busy||childBusy" @click="choose(output.id)">{{output.title}} · {{output.clip_count}} 段</UButton>
      <UButton color="neutral" variant="outline" :disabled="busy||childBusy" @click="choose('legacy')">打开原单片计划</UButton>
      <UButton color="neutral" variant="ghost" :loading="loading" :disabled="busy||childBusy||loading" @click="load">刷新清单</UButton>
    </div>
    <div class="flex flex-wrap gap-2 items-center">
      <UInput v-model="title" aria-label="新增成片名称" placeholder="新成片名称，例如冰川版" :maxlength="100" :disabled="busy||!ready"/>
      <UButton :disabled="busy||childBusy||!ready||!title.trim()||manifest.output_count>=12" @click="add">新增成片计划</UButton>
    </div>
    <div v-if="current&&!legacy" class="rounded-lg border border-default p-3 space-y-2">
      <div class="flex flex-wrap gap-2 items-center">
        <UInput v-model="currentTitle" aria-label="当前成片名称" :maxlength="100" :disabled="busy||childBusy"/>
        <UButton color="neutral" variant="outline" :disabled="busy||childBusy||!currentTitle.trim()||currentTitle===current.title" @click="edit(manifest.outputs.map(item=>item.id),{[selected]:currentTitle})">保存名称</UButton>
        <UButton color="neutral" variant="outline" :disabled="busy||childBusy||manifest.outputs[0]?.id===selected" @click="move(-1)">成片前移</UButton>
        <UButton color="neutral" variant="outline" :disabled="busy||childBusy||manifest.outputs.at(-1)?.id===selected" @click="move(1)">成片后移</UButton>
        <UButton color="neutral" variant="outline" :disabled="busy||childBusy" @click="edit(manifest.outputs.filter(item=>item.id!==selected).map(item=>item.id),{},[selected])">移出清单</UButton>
      </div>
      <p class="text-muted">片段修订和合成历史独立保存。修改后重新合成会产生新版本，不改写已提交任务。</p>
    </div>
    <p v-if="error" role="alert" class="text-error">{{error}}</p>
    <div :inert="busy||bindingBusy||undefined" :aria-busy="busy||bindingBusy" class="space-y-4">
      <CreationGenerationBinding v-if="current&&!legacy" ref="binding" :key="`${sessionId}:${selected}:binding`" :session-id="sessionId" :output-id="selected" :before-change="beforeBindingChange" @busy="bindingBusy=$event" @changed="bindingChanged" @open-run="openSourceRun"/>
      <CreationCompositionPanel v-if="legacy||current" ref="child" :key="`${sessionId}:${legacy?'legacy':selected}:${editorVersion}`" :session-id="sessionId" :output-id="legacy?undefined:selected" :sources="sources" @changed="editorChanged"/>
      <p v-else-if="ready" class="text-muted">先新增成片计划，再添加该成片的片段。原单片草稿保持原样，可从上方打开。</p>
    </div>
  </section>
</template>
