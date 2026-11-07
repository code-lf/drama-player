<script setup lang="ts">
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue'
import type {CollectionStage} from '~/shared/api/services/creationService'
import type {ComposerReference} from '../types'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {mergeStageAnswers} from '../stageMerge'
import {preferredQuestionOption} from '../questionInteraction'
import {libraryErrorMessage} from '~/features/library/libraryError'
import {creationInputExample} from '../inputExamples'
// 业务卡片复用 Nuxt UI 控件；不另造上传、按钮或弹窗基础组件。
const props=defineProps<{stage:CollectionStage;busy:boolean;stateKey?:string;reload?:()=>Promise<CollectionStage|null>;references:ComposerReference[];save:(answers:Record<string,unknown>,submit:boolean,requestId:string,cursor?:number,note?:string)=>Promise<boolean>;upload:(file:File,progress?:(percent:number|null)=>void)=>Promise<ComposerReference|null>;selectImages:()=>Promise<ComposerReference[]>}>()
const emit=defineEmits<{preview:[item:ComposerReference]}>()
// 冲突恢复由父级只读加载当前版本；不自动保存、提交或调用模型。
const conflicts=ref<Record<string,{local:unknown;remote:unknown}>>({}),recovering=ref(false)
// 旧草稿可能停在已取消的汇总游标；回到最后一题供显式提交，不在刷新时自动提交。
const lastFieldIndex=()=>Math.max(0,props.stage.definition.fields.length-1)
const page=ref(Math.min(props.stage.cursor||0,lastFieldIndex())),answers=ref<Record<string,unknown>>({}),localError=ref(''),fileSequence=ref(0),saving=ref(false)
const fields=computed(()=>props.stage.definition.fields)
const field=computed(()=>fields.value[page.value])
// 一页只问一项：参考用途是选图后的独立选填页，业务cursor仍指向原字段，不改历史阶段合同。
const referencePurpose=ref((props.stage.cursor||0)>=fields.value.length&&field.value?.kind==='reference')
// 最后一个真实问题（含参考用途页）直接提交，取消独立核对汇总页。
const lastQuestion=computed(()=>page.value>=fields.value.length-1&&(field.value?.kind!=='reference'||referencePurpose.value))
const questionCount=computed(()=>fields.value.length+fields.value.filter(item=>item.kind==='reference').length)
const questionNumber=computed(()=>Math.min(questionCount.value,page.value+1+fields.value.slice(0,page.value).filter(item=>item.kind==='reference').length+(referencePurpose.value?1:0)))
try{if(props.stateKey&&typeof sessionStorage!=='undefined'){const saved=JSON.parse(sessionStorage.getItem('stage-reference-page:'+props.stateKey)||'null');if(saved?.page===page.value)referencePurpose.value=saved?.purpose===true&&field.value?.kind==='reference'}}catch{/* 存储不可用仍可逐页填写。 */}
watch([page,referencePurpose],()=>{try{if(props.stateKey)sessionStorage.setItem('stage-reference-page:'+props.stateKey,JSON.stringify({page:page.value,purpose:referencePurpose.value}))}catch{/* 页签恢复失败不触发保存或生成。 */}})
// 只有服务端修订改变才回填，避免普通父组件重绘清空正在输入的文字。
watch(()=>props.stage.revision,()=>{
  answers.value=JSON.parse(JSON.stringify(props.stage.answers))
  // 只为尚无答案的偏好题提供候选，不覆盖已保存的空多选或用户已确认事实。
  for(const item of fields.value){if(Object.prototype.hasOwnProperty.call(answers.value,item.id))continue;const preferred=preferredQuestionOption(item);if(preferred)answers.value[item.id]=item.kind==='multiple'?[preferred]:preferred}
  page.value=Math.min(page.value,lastFieldIndex())
},{immediate:true})
const text=computed({get:()=>String(answers.value[field.value?.id||'']||''),set:value=>{if(field.value)answers.value[field.value.id]=value}})
const metadata=ref<Record<string,ComposerReference>>({}),replacing=ref(''),replaceInput=ref<HTMLInputElement|null>(null),materialBusy=ref(false)
const fileInput=ref<HTMLInputElement|null>(null),uploadProgress=ref<number|null>(null),uploadPreview=ref(''),failedFile=ref<File|null>(null),pendingSave=ref(false)
const initialNote=(props.stage.notes||[]).filter(value=>value.startsWith('参考图要求：')).at(-1)?.slice(6)||''
const referenceNote=ref(initialNote),savedReferenceNote=ref(initialNote)
// 未提交的用途说明仅按账号/运行保存在当前浏览器会话；远端基线改变时不拿旧草稿覆盖。
try{if(props.stateKey&&typeof sessionStorage!=='undefined'){const draft=JSON.parse(sessionStorage.getItem('stage-reference-note:'+props.stateKey)||'null');if(draft?.base===initialNote&&typeof draft.text==='string')referenceNote.value=draft.text.slice(0,500)}}catch{/* 存储不可用不影响正常编辑。 */}
watch([referenceNote,savedReferenceNote],()=>{try{if(props.stateKey)sessionStorage.setItem('stage-reference-note:'+props.stateKey,JSON.stringify({text:referenceNote.value,base:savedReferenceNote.value}))}catch{/* 不因本地缓存失败阻止用户保存。 */}})
/** 文件状态与已落盘引用分开；失败不会留下看似可提交的本地图片。 */
function clearUpload(){if(uploadPreview.value)URL.revokeObjectURL(uploadPreview.value);uploadPreview.value='';failedFile.value=null;uploadProgress.value=null}
onBeforeUnmount(clearUpload)
/** 本轮参考图入口仅开放本地上传；资料库底层选择能力保留，但不在此处展示。 */
function openLocalUpload(){replacing.value='';fileInput.value?.click()}
const chosen=computed(()=>((answers.value[field.value?.id||'']||[]) as ComposerReference[]).map(ref=>({...ref,...props.references.find(item=>item.version_id===ref.version_id),...metadata.value[ref.version_id]})))
let pending:{fingerprint:string;id:string}|undefined
/** 保存成功才翻页；响应丢失重试复用请求号，不重复提交阶段。 */
async function move(direction:number){
  if(props.busy||saving.value||recovering.value||Object.keys(conflicts.value).length||(direction!==0&&(failedFile.value||pendingSave.value||materialBusy.value)))return false
  if(direction<0&&referencePurpose.value){referencePurpose.value=false;return true}
  localError.value=''
  const submit=lastQuestion.value&&direction>0
  const value=answers.value[field.value?.id||'']
  if(direction>0&&field.value?.required&&(!value||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length))){localError.value='请先填写此项信息。';return false}
  const payload=JSON.parse(JSON.stringify(answers.value)) as Record<string,unknown>
  const enterPurpose=direction>0&&field.value?.kind==='reference'&&!referencePurpose.value
  const cursor=enterPurpose?page.value:Math.max(0,Math.min(fields.value.length,page.value+direction))
  // 参考用途沿原阶段文字补充协议保存，不把用途说明冒充图片内容或媒体采购授权。
  const note=direction>0&&referencePurpose.value&&referenceNote.value.trim()!==savedReferenceNote.value?`参考图要求：${referenceNote.value.trim()||'（已清空此前要求）'}`:undefined
  const fingerprint=JSON.stringify([props.stage.revision,payload,submit,cursor,note])
  if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()}
  saving.value=true
  try{if(await props.save(payload,submit,pending.id,cursor,note)){pending=undefined;if(note)savedReferenceNote.value=referenceNote.value.trim();if(!submit&&direction!==0){page.value=cursor;referencePurpose.value=enterPurpose||direction<0&&fields.value[cursor]?.kind==='reference'}return true}else{localError.value='未保存成功，本页填写仍保留。可重试，或核对最新版本后继续。';return false}}
  catch{localError.value='未保存成功，本页填写仍保留，请重试。';return false}
  finally{saving.value=false}
}
/** 先冻结本页修改，再读取远端基线；冲突项不静默覆盖，也不自动重新提交。 */
async function recover(){
  if(!props.reload||props.busy||saving.value||materialBusy.value||recovering.value)return
  const local=JSON.parse(JSON.stringify(answers.value)),base=JSON.parse(JSON.stringify(props.stage.answers)),cursor=page.value
  recovering.value=true
  try{
    const latest=await props.reload();if(!latest)return
    await nextTick()
    const merged=mergeStageAnswers(base,local,latest.answers)
    answers.value=merged.answers;conflicts.value=merged.conflicts;page.value=Math.min(cursor,lastFieldIndex());pending=undefined
    localError.value=Object.keys(merged.conflicts).length?'请选择冲突字段采用哪一份；核对完成后仍需点击下一步保存。':'已读取最新版本并保留本页独立修改，请核对后点击下一步保存。'
  }finally{recovering.value=false}
}
function resolveConflict(key:string,side:'local'|'remote'){
  answers.value[key]=conflicts.value[key]?.[side]
  const remaining={...conflicts.value};delete remaining[key];conflicts.value=remaining
  if(!Object.keys(remaining).length)localError.value=''
}
/** 素材只显示数量，不能把内部固定版本编号当作用户文案。 */
function describe(value:unknown){return Array.isArray(value)?`${value.length} 项`:(String(value??'')||'（未填写）')}
/** 文件对话框取消不更新答案，上传仍走工作台已有权限链。 */
async function saveImages(items:ComposerReference[]){
  if(!field.value)return
  answers.value[field.value.id]=items.map(({item_id,version_id,purpose,start,end})=>({item_id,version_id,purpose,start,end}))
  pendingSave.value=!(await move(0))
  // 保存失败只重试固定版本引用，不重复上传已成功的文件。
  if(pendingSave.value)localError.value='图片已上传，但引用尚未保存，请重试保存。'
}
/** 只处理当前按钮的真实上传结果，不监听所有草稿素材变化，避免旧图自动回填。 */
async function receive(file:File|null|undefined){
  if(!file||props.busy||saving.value||materialBusy.value)return
  const old=replacing.value;replacing.value='';fileSequence.value++;materialBusy.value=true;clearUpload();localError.value='';uploadProgress.value=0
  if(typeof File!=='undefined'&&file instanceof File)uploadPreview.value=URL.createObjectURL(file)
  try{
    const item=await props.upload(file,value=>{uploadProgress.value=value});await nextTick()
    if(!item)throw new Error('未完成图片上传，请重试或移除。')
    metadata.value[item.version_id]=item
    const current=chosen.value
    await saveImages(old?current.map(value=>value.version_id===old?item:value):[...current.filter(value=>value.version_id!==item.version_id),item])
    clearUpload()
  }catch(cause){failedFile.value=file;replacing.value=old;localError.value=libraryErrorMessage(cause,'图片上传失败，请重试或移除。')}
  finally{materialBusy.value=false}
}
/** 失败重试保留同一文件；取消只移除本次待上传占位，不删资料库和原参考图。 */
async function retryUpload(){const file=failedFile.value;if(file)await receive(file)}
function discardUpload(){clearUpload();localError.value=''}
function receiveLocal(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';void receive(file)}
async function selectImages(){
  if(props.busy||saving.value||materialBusy.value)return
  materialBusy.value=true
  try{const items=await props.selectImages();if(!items.length)return;clearUpload();for(const item of items)metadata.value[item.version_id]=item;await saveImages([...chosen.value,...items.filter(item=>!chosen.value.some(old=>old.version_id===item.version_id))])}
  catch(cause){localError.value=libraryErrorMessage(cause,'资料未选择成功，请重试。')}
  finally{materialBusy.value=false}
}
function replaceImage(id:string){if(props.busy||saving.value||materialBusy.value)return;replacing.value=id;replaceInput.value?.click()}
function receiveReplacement(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';void receive(file)}
async function removeImage(id:string){if(props.busy||saving.value||materialBusy.value)return;await saveImages(chosen.value.filter(item=>item.version_id!==id))}
function toggle(option:string){if(!field.value)return;const selected=(answers.value[field.value.id]||[]) as string[];answers.value[field.value.id]=selected.includes(option)?selected.filter(value=>value!==option):[...selected,option]}
/** 底部输入发送时带上未保存字段，避免阶段合并覆盖用户刚编辑的内容。 */
defineExpose({snapshot:()=>({answers:JSON.parse(JSON.stringify(answers.value)),cursor:page.value}),isBusy:()=>saving.value||materialBusy.value||recovering.value||!!failedFile.value||pendingSave.value||Object.keys(conflicts.value).length>0})
</script>

<template>
  <section class="creation-stage-question p-4 space-y-4" aria-label="阶段信息收集" :aria-busy="busy">
    <header class="flex items-center justify-between gap-3"><strong class="text-sm text-textMain">{{stage.definition.title}}</strong><span class="text-xs text-textMuted">{{questionNumber}}/{{questionCount}} · 填写信息</span></header>
    <template v-if="field">
      <div class="flex items-center justify-between gap-3"><label class="text-sm text-textMain" :for="referencePurpose?`reference-note-${field.id}`:`stage-${field.id}`">{{referencePurpose?'希望参考图中的哪些内容？':field.label}}<span v-if="!referencePurpose&&field.required" class="text-stateDanger" aria-label="必填"> *</span></label><span class="text-xs text-textMuted">{{referencePurpose||!field.required?'选填':''}}</span></div>
      <template v-if="referencePurpose">
        <p class="text-sm text-textMuted">可以说明希望保留的色调、背景、人物动作或构图。只作风格参考也可以；留空将结合本次创作需求使用参考图。</p>
        <UTextarea :id="`reference-note-${field.id}`" v-model="referenceNote" class="w-full" aria-label="参考图要求" placeholder="例如：只参考深灰科技背景，保持人物和二维码不变；或参考色调、构图、人物动作。" :maxlength="500" :rows="3" autoresize :disabled="busy||saving||materialBusy"/>
      </template>
      <template v-else-if="field.kind==='reference'">
        <p class="stage-reference-help text-textMuted">添加本次创作的参考图。</p>
        <div class="stage-reference-grid">
          <div v-for="item in chosen" :key="item.version_id" class="stage-reference-item"><UButton class="stage-reference-preview" color="neutral" variant="ghost" :disabled="!item.preview_url" :aria-label="`预览参考图：${item.name||'图片'}`" @click="emit('preview',item)"><img v-if="item.preview_url" :src="item.preview_url" :alt="item.name"/><UIcon v-else name="i-lucide-image"/></UButton><UDropdownMenu :items="[{label:'替换图片',onSelect:()=>replaceImage(item.version_id)},{label:'移除',onSelect:()=>removeImage(item.version_id)}]"><UButton icon="i-lucide-ellipsis" square color="neutral" variant="soft" class="stage-reference-more" :disabled="busy||saving||materialBusy" :aria-label="`管理参考图：${item.name||'图片'}`"/></UDropdownMenu></div>
          <div v-if="materialBusy||failedFile" class="stage-reference-pending" role="status"><img v-if="uploadPreview" :src="uploadPreview" alt="待上传参考图"/><span>{{failedFile?'上传失败':uploadProgress===100?'正在保存…':uploadProgress==null?'正在处理…':`上传 ${uploadProgress}%`}}</span><UProgress v-if="materialBusy" :model-value="uploadProgress" :max="100" size="xs"/><div v-if="failedFile" class="flex gap-1"><UButton color="neutral" variant="soft" @click="retryUpload">重试</UButton><UButton color="neutral" variant="ghost" @click="discardUpload">移除</UButton></div></div>
          <UButton class="stage-reference-add" color="neutral" variant="ghost" :disabled="busy||saving||materialBusy||!!failedFile||pendingSave" aria-label="上传图片" @click="openLocalUpload"><UIcon name="i-lucide-plus" class="stage-reference-plus"/><span class="stage-reference-source-label">上传图片</span></UButton>
        </div>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="receiveLocal"/>
        <input ref="replaceInput" type="file" accept="image/*" hidden @change="receiveReplacement" />
        <UButton v-if="pendingSave" color="neutral" variant="soft" :disabled="busy||saving||materialBusy" @click="saveImages(chosen)">重试保存引用</UButton>
      </template>
      <div v-else-if="field.kind==='single'||field.kind==='multiple'" class="stage-question-options"><template v-for="option in field.options" :key="option"><UCheckbox v-if="field.kind==='multiple'" class="stage-question-option" :label="option" :model-value="Array.isArray(answers[field.id])&&(answers[field.id] as string[]).includes(option)" :disabled="busy||saving" @update:model-value="toggle(option)"/><UButton v-else color="neutral" variant="soft" class="stage-question-option" :aria-pressed="text===option" :disabled="busy||saving" @click="text=option">{{option}}</UButton></template></div>
      <UTextarea v-else :id="`stage-${field.id}`" v-model="text" :aria-label="field.label" :placeholder="creationInputExample(field.label,field.id)" :disabled="busy" :maxlength="2000" :rows="3" class="w-full" />
    </template>
    <p v-if="localError" role="alert" class="text-sm text-stateDanger">{{localError}}</p>
    <UButton v-if="localError&&reload" variant="soft" :disabled="busy||saving||materialBusy||recovering||!!Object.keys(conflicts).length" @click="recover">核对最新版本</UButton>
    <div v-for="(conflict,key) in conflicts" :key="key" class="space-y-2 text-sm">
      <strong>{{fields.find(item=>item.id===key)?.label}}</strong>
      <p class="whitespace-pre-wrap break-words">本页：{{describe(conflict.local)}}</p><p class="whitespace-pre-wrap break-words">最新保存：{{describe(conflict.remote)}}</p>
      <div class="flex flex-wrap gap-3"><UButton variant="soft" @click="resolveConflict(String(key),'local')">采用本页填写</UButton><UButton variant="soft" @click="resolveConflict(String(key),'remote')">采用最新保存</UButton></div>
    </div>
    <footer class="stage-question-actions" :class="{'has-previous':page>0||referencePurpose}"><LivButton v-if="page>0||referencePurpose" block variant="secondary" :disabled="busy||saving||materialBusy||!!failedFile||pendingSave" @click="move(-1)">上一步</LivButton><LivButton block variant="primary" :loading="busy||saving" :disabled="busy||saving||materialBusy||!!failedFile||pendingSave" @click="move(1)">{{lastQuestion?'提交并继续':'下一步'}}</LivButton></footer>
  </section>
</template>
<style scoped>
/* 阶段卡与Agent分页题统一视觉，底层保存/冲突/费用合同保持原样。 */
.creation-stage-question{border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface)}
.stage-reference-grid{display:flex;align-items:flex-start;flex-wrap:wrap;gap:12px}
.stage-reference-item,.stage-reference-pending{position:relative;width:96px;height:96px;flex:none;border-radius:12px;overflow:hidden;background:var(--liv-question-option)}
.stage-reference-preview{width:100%;height:100%;padding:0!important}.stage-reference-preview img{width:100%;height:100%;object-fit:cover}
.stage-reference-more{position:absolute;top:4px;right:4px;width:24px;height:24px;padding:4px!important}
.stage-reference-help{font-size:var(--liv-workflow-font-size);line-height:1.6}
.stage-reference-add{display:flex;flex-direction:column;align-items:center;justify-content:center!important;width:96px;height:96px;gap:8px;padding:8px!important;border:1px dashed var(--color-border-soft);border-radius:12px;background:transparent}
.stage-reference-add .stage-reference-plus{width:24px;height:24px}
.stage-reference-source-label{display:flex;align-items:center;gap:3px;padding:4px 5px;border-radius:6px;background:var(--liv-question-option);font-size:12px;line-height:16px;font-weight:500;white-space:nowrap}
.stage-reference-source-label :deep(.iconify){width:12px;height:12px}
.stage-reference-pending{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;padding:6px;font-size:12px}
.stage-reference-pending>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.2}.stage-reference-pending>span,.stage-reference-pending>div{position:relative}
.stage-question-options{display:grid;gap:8px}
.stage-question-option{justify-content:flex-start;min-height:48px;padding:12px 16px;border:1px solid transparent;border-radius:12px;background:var(--liv-question-option);text-align:left;white-space:normal}
.stage-question-option[aria-pressed=true]{border-color:var(--liv-chat-assistant-text)}
.stage-question-actions{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
.stage-question-actions.has-previous{grid-template-columns:repeat(2,minmax(0,1fr))}
.stage-question-actions :deep(button){width:100%;height:var(--liv-question-action-height);min-height:var(--liv-question-action-height);padding:0 12px;border-radius:999px;justify-content:center!important;font-size:var(--liv-chat-font);white-space:nowrap}
.stage-question-actions :deep(button:first-child:not(:last-child)){background:var(--liv-question-option);border:1px solid transparent;color:var(--liv-chat-assistant-text)}
.stage-question-actions :deep(button:last-child){background:var(--liv-ui-primary);color:var(--liv-control-on-primary)}
</style>
