<script setup lang="ts">
// 显式引入确认弹窗，关闭状态不能作为未知自定义标签在页面内展开。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
/** 指南正文作为技能版本内容保存，不把文件名解释为路径，也不执行Markdown代码。 */
import {ref,computed,watch} from 'vue'
interface TextResource{name:string;content:string}
const props=defineProps<{modelValue:TextResource[];busy:boolean;mediaResources?:Array<{id:string;name:string;kind:'image'|'video';url:string}>}>()
const emit=defineEmits<{'update:modelValue':[value:TextResource[]]}>()
const selected=ref(0),query=ref(''),error=ref(''),removeOpen=ref(false),fileInput=ref<HTMLInputElement|null>(null)
const current=computed(()=>props.modelValue[selected.value])
const selectedMedia=ref(''),failedMedia=ref('')
const currentMedia=computed(()=>props.mediaResources?.find(item=>item.id===selectedMedia.value))
const filteredMedia=computed(()=>(props.mediaResources||[]).filter(item=>item.name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
/** 切换资源销毁旧播放器，失效预览明确显示失败，不自动替换版本或执行媒体任务。 */
function selectMedia(id:string){selectedMedia.value=id;failedMedia.value=''}
watch(()=>props.mediaResources,value=>{if(selectedMedia.value&&!value?.some(item=>item.id===selectedMedia.value))selectedMedia.value=''}, {deep:true})
/** 搜索只筛选目录，不修改资源顺序、当前正文或保存内容。 */
const filtered=computed(()=>props.modelValue.map((resource,index)=>({resource,index})).filter(({resource})=>resource.name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
watch(()=>props.modelValue.length,length=>{if(selected.value>=length)selected.value=Math.max(0,length-1)})
function update(patch:Partial<TextResource>){if(props.busy)return;emit('update:modelValue',props.modelValue.map((row,index)=>index===selected.value?{...row,...patch}:row))}
function add(){if(props.busy||props.modelValue.length>=10)return;let number=props.modelValue.length+1;while(props.modelValue.some(row=>row.name===`guide_${number}.md`))number++;query.value='';selectedMedia.value='';selected.value=props.modelValue.length;emit('update:modelValue',[...props.modelValue,{name:`guide_${number}.md`,content:''}])}
/** 确认期间资源被助手替换时不移除另一份资源，必须重新核对。 */
let removeTarget:TextResource|undefined
function requestRemove(){removeTarget=current.value;removeOpen.value=!!removeTarget}
function remove(){if(props.busy)return;if(removeTarget&&props.modelValue.includes(removeTarget)){emit('update:modelValue',props.modelValue.filter(row=>row!==removeTarget));selected.value=0}else{error.value='资源已更新，请重新选择后移除。'}removeOpen.value=false}
/** 本地文本导入只读取显式选中文件，超限拒绝，不上传或访问任意目录。 */
async function importText(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file||props.busy)return;try{if(props.modelValue.length>=10||file.size>80000||!/^([a-zA-Z0-9_\-\u4e00-\u9fff][a-zA-Z0-9_\-\u4e00-\u9fff.]{0,79})\.(md|txt)$/.test(file.name))throw new Error('只支持简短文件名的 .md/.txt，最多10个资源、单文件80KB。');const content=await file.text();if(props.busy)return;if(content.length>20000||props.modelValue.reduce((total,row)=>total+row.content.length,content.length)>40000||props.modelValue.some(row=>row.name.toLowerCase()===file.name.toLowerCase()))throw new Error('名称重复或文字超限：每份最多20000字、合计40000字。');query.value='';selected.value=props.modelValue.length;emit('update:modelValue',[...props.modelValue,{name:file.name,content}]);error.value=''}catch(cause){error.value=cause instanceof Error?cause.message:'导入失败'}}
</script>
<template>
  <section class="text-resources" aria-label="技能资源附件">
    <LivDialog :open="removeOpen" title="移除文本指南？" description="仅移除当前草稿资源，已保存的历史技能版本不变。" settings dark @update:open="removeOpen=$event"><template #footer><LivButton settings variant="secondary" @click="removeOpen=false">取消</LivButton><LivButton settings variant="primary" @click="remove">移除</LivButton></template></LivDialog>
    <aside class="resource-sidebar">
      <UInput v-model="query" aria-label="搜索资源" placeholder="搜索资源" trailing-icon="i-lucide-search" class="resource-search" :ui="{base:'rounded-full'}"/>
      <nav aria-label="文本指南列表">
        <UButton v-for="{resource,index} in filtered" :key="index" class="resource-file" :class="{selected:!selectedMedia&&selected===index}" :aria-pressed="!selectedMedia&&selected===index" :title="resource.name" icon="i-lucide-file" variant="ghost" color="neutral" @click="selected=index;selectedMedia='' "><span>{{resource.name}}</span></UButton>
        <UButton v-for="resource in filteredMedia" :key="resource.id" class="resource-file" :class="{selected:selectedMedia===resource.id}" :aria-pressed="selectedMedia===resource.id" :title="resource.name" :icon="resource.kind==='image'?'i-lucide-image':'i-lucide-video'" variant="ghost" color="neutral" @click="selectMedia(resource.id)"><span>{{resource.name}}</span></UButton>
        <p v-if="!filtered.length&&!filteredMedia.length" class="resource-list-empty">{{query?'未找到匹配资源':'暂无资源附件'}}</p>
      </nav>
      <footer>
        <UTooltip text="上传 Markdown / TXT 文本指南"><UButton class="resource-upload" color="neutral" variant="soft" icon="i-lucide-upload" :disabled="busy||modelValue.length>=10" @click="fileInput?.click()">上传</UButton></UTooltip>
        <UTooltip text="新建文本指南"><UButton color="neutral" variant="ghost" icon="i-lucide-plus" square aria-label="新增指南" :disabled="busy||modelValue.length>=10" @click="add"/></UTooltip>
        <input ref="fileInput" hidden type="file" accept=".md,.txt" @change="importText"/>
      </footer>
    </aside>
    <div class="resource-detail">
      <p v-if="error" role="alert" class="resource-error">{{error}}</p>
      <div v-if="currentMedia" class="resource-editor">
        <header><h3>{{currentMedia.name}}</h3></header>
        <div class="resource-media" :key="currentMedia.id">
          <p v-if="!currentMedia.url||failedMedia===currentMedia.id" role="status">当前资源暂时无法预览，请重新打开附件读取。</p>
          <img v-else-if="currentMedia.kind==='image'" :src="currentMedia.url" :alt="currentMedia.name" @error="failedMedia=currentMedia.id"/>
          <video v-else :src="currentMedia.url" controls preload="metadata" :aria-label="currentMedia.name" @error="failedMedia=currentMedia.id"/>
        </div>
      </div>
      <div v-else-if="current" class="resource-editor">
        <header><UInput aria-label="资源文件名" placeholder="例如：software_promo_method.md" :model-value="current.name" :maxlength="83" :disabled="busy" class="resource-name" variant="none" @update:model-value="update({name:String($event)})"/><UTooltip text="移除当前资源"><UButton color="neutral" variant="soft" icon="i-lucide-trash-2" square aria-label="移除当前资源" :disabled="busy" @click="requestRemove"/></UTooltip></header>
        <UTextarea aria-label="文本指南正文" :model-value="current.content" placeholder="例如：先确认产品真实功能，再按痛点、方案、演示、行动号召规划画面；缺少真实界面时使用概念视觉。" :maxlength="20000" :rows="18" :disabled="busy" class="resource-body" :ui="{base:'h-full resize-none'}" @update:model-value="update({content:String($event)})"/>
      </div>
      <div v-else class="resource-empty"><UIcon name="i-lucide-file-text"/><p>选择一个资源后查看和编辑</p><small>支持上传 Markdown / TXT，或新建文本指南</small></div>
    </div>
  </section>
</template>
<style scoped>
/* 目录与正文分别占满剩余高度；底部上传不随文件列表滚走。 */
.text-resources{display:grid;grid-template-columns:minmax(160px,var(--liv-builder-resource-column)) minmax(0,1fr);flex:1;min-height:0;overflow:hidden;color:var(--liv-account-text);container-type:inline-size}
.resource-sidebar{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0;padding:0 20px 0 0;border-right:1px solid var(--liv-account-border)}
.resource-sidebar nav{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow:auto}.resource-search{width:100%}
.resource-sidebar .resource-search :deep(input){height:32px;border:0;border-radius:999px;background:var(--liv-account-raised);font-size:13px;box-shadow:none}
.resource-file{flex:none;justify-content:flex-start;gap:12px;min-width:0;min-height:52px;padding:12px;border:2px solid transparent;border-radius:16px;background:transparent;color:var(--liv-account-text)}
.resource-file.selected{border-color:var(--liv-builder-resource-selected-border);background:var(--liv-skill-card-selected)}.resource-file>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.resource-file :deep(.iconify){flex:none;width:20px;height:20px;color:var(--liv-account-muted)}
.resource-sidebar footer{display:flex;justify-content:center;align-items:center;gap:4px;padding-top:12px;flex:none}.resource-upload{border-radius:999px;min-height:36px;padding:8px 20px}
.text-resources .resource-sidebar .resource-upload{background:var(--liv-account-raised);border:0}
.resource-detail{display:flex;flex-direction:column;min-height:0;min-width:0;padding-left:24px}.resource-editor{display:flex;flex-direction:column;gap:16px;flex:1;min-height:0;min-width:0}.resource-editor header{display:flex;align-items:center;gap:8px;flex:none;min-width:0}.resource-name{flex:1;min-width:0}.resource-name :deep(input){width:100%;min-width:0;padding:4px 0;border:0;background:transparent;font-size:18px;line-height:28px;font-weight:700;color:var(--liv-account-text);box-shadow:none}.resource-editor header :deep(button){border-radius:999px}
.resource-body{display:flex;flex:1;min-height:0}.resource-body :deep(textarea){flex:1;min-height:160px;padding:20px;border:0;border-radius:16px;background:var(--liv-skill-card-selected);color:var(--liv-account-text);font-size:14px;line-height:1.7;box-shadow:none}
.resource-media{display:flex;align-items:center;justify-content:center;flex:1;min-height:220px;overflow:auto;border-radius:16px;background:var(--liv-skill-card-selected)}
.resource-media img,.resource-media video{max-width:100%;max-height:65vh;object-fit:contain}.resource-editor h3{font-size:18px;line-height:28px;margin:0;overflow-wrap:anywhere}
.resource-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;flex:1;min-height:220px;text-align:center;color:var(--liv-account-muted)}.resource-empty>.iconify{width:24px;height:24px}.resource-empty p,.resource-list-empty{margin:0;font-size:14px;line-height:1.7}.resource-empty small{font-size:12px}.resource-list-empty{padding:16px 4px;color:var(--liv-account-muted)}.resource-error{color:var(--color-state-danger);font-size:13px;overflow-wrap:anywhere}
@media(max-width:767px){.text-resources{grid-template-columns:1fr;overflow:auto}.resource-sidebar{border-right:0;border-bottom:1px solid var(--liv-account-border);padding:0 0 16px}.resource-sidebar nav{max-height:160px;flex:none}.resource-sidebar footer{padding-top:0}.resource-detail{padding:16px 0 0;min-height:300px}.resource-body :deep(textarea){min-height:260px}.resource-name :deep(input){font-size:16px}}
</style>
