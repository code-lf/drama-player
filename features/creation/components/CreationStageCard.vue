<script setup lang="ts">
import {computed,ref,watch,nextTick} from 'vue'
import type {CollectionStage} from '~/shared/api/services/creationService'
import type {ComposerReference} from '../types'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {mergeStageAnswers} from '../stageMerge'
// 业务卡片复用 Nuxt UI 控件；不另造上传、按钮或弹窗基础组件。
const props=defineProps<{stage:CollectionStage;busy:boolean;reload?:()=>Promise<CollectionStage|null>;references:ComposerReference[];save:(answers:Record<string,unknown>,submit:boolean,requestId:string,cursor?:number)=>Promise<boolean>;upload:(file:File)=>Promise<ComposerReference|null>;selectImages:()=>Promise<ComposerReference[]>}>()
const emit=defineEmits<{preview:[item:ComposerReference]}>()
// 冲突恢复由父级只读加载当前版本；不自动保存、提交或调用模型。
const conflicts=ref<Record<string,{local:unknown;remote:unknown}>>({}),recovering=ref(false)
const page=ref(props.stage.cursor||0),answers=ref<Record<string,unknown>>({}),localError=ref(''),fileSequence=ref(0),saving=ref(false)
const fields=computed(()=>props.stage.definition.fields)
const field=computed(()=>fields.value[page.value])
// 只有服务端修订改变才回填，避免普通父组件重绘清空正在输入的文字。
watch(()=>props.stage.revision,()=>{answers.value=JSON.parse(JSON.stringify(props.stage.answers));page.value=Math.min(page.value,fields.value.length)},{immediate:true})
const text=computed({get:()=>String(answers.value[field.value?.id||'']||''),set:value=>{if(field.value)answers.value[field.value.id]=value}})
const metadata=ref<Record<string,ComposerReference>>({}),replacing=ref(''),replaceInput=ref<HTMLInputElement|null>(null),materialBusy=ref(false)
const chosen=computed(()=>((answers.value[field.value?.id||'']||[]) as ComposerReference[]).map(ref=>({...ref,...props.references.find(item=>item.version_id===ref.version_id),...metadata.value[ref.version_id]})))
let pending:{fingerprint:string;id:string}|undefined
/** 保存成功才翻页；响应丢失重试复用请求号，不重复提交阶段。 */
async function move(direction:number){
  if(props.busy||saving.value||recovering.value||Object.keys(conflicts.value).length)return
  localError.value=''
  const submit=page.value===fields.value.length&&direction>0
  const value=answers.value[field.value?.id||'']
  if(direction>0&&field.value?.required&&(!value||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length))){localError.value='请先填写此项信息。';return}
  const payload=JSON.parse(JSON.stringify(answers.value)) as Record<string,unknown>
  const cursor=Math.max(0,Math.min(fields.value.length,page.value+direction))
  const fingerprint=JSON.stringify([props.stage.revision,payload,submit,cursor])
  if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()}
  saving.value=true
  try{if(await props.save(payload,submit,pending.id,cursor)){pending=undefined;if(!submit)page.value=cursor}else localError.value='未保存成功，本页填写仍保留。可重试，或核对最新版本后继续。'}
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
    answers.value=merged.answers;conflicts.value=merged.conflicts;page.value=cursor;pending=undefined
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
  await move(0)
  // 保存失败保留本地候选以便重试，不能声称已经落盘。
  if(JSON.stringify(props.stage.answers[field.value.id]||[])!==JSON.stringify(answers.value[field.value.id])&&pending)localError.value='素材尚未保存，请重试下一步。'
}
/** 只处理当前按钮的真实上传结果，不监听所有草稿素材变化，避免旧图自动回填。 */
async function receive(file:File|null|undefined){
  if(!file||props.busy||saving.value||materialBusy.value)return
  const old=replacing.value;replacing.value='';fileSequence.value++;materialBusy.value=true
  try{
    const item=await props.upload(file);await nextTick()
    if(!item)return
    metadata.value[item.version_id]=item
    const current=chosen.value
    await saveImages(old?current.map(value=>value.version_id===old?item:value):[...current.filter(value=>value.version_id!==item.version_id),item])
  }finally{materialBusy.value=false}
}
async function selectImages(){
  if(props.busy||saving.value||materialBusy.value)return
  materialBusy.value=true
  try{const items=await props.selectImages();if(!items.length)return;for(const item of items)metadata.value[item.version_id]=item;await saveImages([...chosen.value,...items.filter(item=>!chosen.value.some(old=>old.version_id===item.version_id))])}
  finally{materialBusy.value=false}
}
function replaceImage(id:string){if(props.busy||saving.value||materialBusy.value)return;replacing.value=id;replaceInput.value?.click()}
function receiveReplacement(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';void receive(file)}
async function removeImage(id:string){if(props.busy||saving.value||materialBusy.value)return;await saveImages(chosen.value.filter(item=>item.version_id!==id))}
function toggle(option:string){if(!field.value)return;const selected=(answers.value[field.value.id]||[]) as string[];answers.value[field.value.id]=selected.includes(option)?selected.filter(value=>value!==option):[...selected,option]}
/** 底部输入发送时带上未保存字段，避免阶段合并覆盖用户刚编辑的内容。 */
defineExpose({snapshot:()=>({answers:JSON.parse(JSON.stringify(answers.value)),cursor:page.value}),isBusy:()=>saving.value||materialBusy.value||recovering.value||Object.keys(conflicts.value).length>0})
</script>

<template>
  <section class="rounded-xl bg-surfaceRaised p-4 space-y-4" aria-label="阶段信息收集" :aria-busy="busy">
    <header class="flex items-center justify-between gap-3"><strong class="text-sm text-textMain">{{stage.definition.title}}</strong><span class="text-xs text-textMuted">{{Math.min(page+1,fields.length)}}/{{fields.length}} · {{field?'填写信息':'核对汇总'}}</span></header>
    <template v-if="field">
      <div class="flex items-center justify-between gap-3"><label class="text-sm text-textMain" :for="`stage-${field.id}`">{{field.label}}</label><span class="text-xs text-textMuted">{{field.required?'必填':'可选'}}</span></div>
      <template v-if="field.kind==='reference'">
        <p class="text-sm text-textMuted">可上传正面、背面或标签细节；也可从资料库选择。</p>
        <div class="flex flex-wrap items-start gap-3">
          <div v-for="item in chosen" :key="item.version_id" class="flex flex-col gap-1"><UButton variant="ghost" :disabled="!item.preview_url" :aria-label="`预览参考图：${item.name||'图片'}`" @click="emit('preview',item)"><img v-if="item.preview_url" :src="item.preview_url" :alt="item.name" class="size-16 rounded-lg object-contain" /><span v-else class="text-xs text-textMuted">{{item.name||'素材不可预览'}}</span></UButton><div class="flex gap-1"><UButton variant="ghost" :disabled="busy||saving||materialBusy" :aria-label="`替换参考图：${item.name||'图片'}`" @click="replaceImage(item.version_id)">替换</UButton><UButton variant="ghost" :disabled="busy||saving||materialBusy" :aria-label="`移除参考图：${item.name||'图片'}`" @click="removeImage(item.version_id)">移除</UButton></div></div>
          <UFileUpload :key="fileSequence" accept="image/*" icon="i-lucide-plus" label="上传图片" class="w-24" :disabled="busy||saving||materialBusy" @update:model-value="file=>{replacing='';receive(file)}" />
        </div>
        <input ref="replaceInput" type="file" accept="image/*" hidden @change="receiveReplacement" />
        <div class="flex flex-wrap gap-3"><UButton variant="soft" :disabled="busy||saving||materialBusy" @click="selectImages">从资料库选择</UButton><span v-if="materialBusy" role="status" class="text-sm text-textMuted">正在处理素材…</span></div>
        <p class="text-xs text-textMuted">此项已选 {{chosen.length}} 项；此步骤不生成作品。移除仅影响本次引用，不删除资料库文件。</p>
      </template>
      <div v-else-if="field.kind==='single'||field.kind==='multiple'" class="flex flex-wrap gap-3"><UButton v-for="option in field.options" :key="option" :variant="text===option || (Array.isArray(answers[field.id])&&(answers[field.id] as string[]).includes(option))?'solid':'soft'" :disabled="busy" @click="field.kind==='multiple'?toggle(option):text=option">{{option}}</UButton></div>
      <UTextarea v-else :id="`stage-${field.id}`" v-model="text" :aria-label="field.label" :disabled="busy" :maxlength="2000" :rows="3" class="w-full" />
    </template>
    <dl v-else class="space-y-3 text-sm"><div v-for="item in fields" :key="item.id"><dt class="text-textMuted">{{item.label}}</dt><dd class="text-textMain whitespace-pre-wrap break-words">{{item.kind==='reference'?`${Array.isArray(answers[item.id])?(answers[item.id] as unknown[]).length:0} 项素材`:answers[item.id]||'未填写'}}</dd></div></dl>
    <p v-if="localError" role="alert" class="text-sm text-stateDanger">{{localError}}</p>
    <UButton v-if="localError&&reload" variant="soft" :disabled="busy||saving||materialBusy||recovering||!!Object.keys(conflicts).length" @click="recover">核对最新版本</UButton>
    <div v-for="(conflict,key) in conflicts" :key="key" class="space-y-2 text-sm">
      <strong>{{fields.find(item=>item.id===key)?.label}}</strong>
      <p class="whitespace-pre-wrap break-words">本页：{{describe(conflict.local)}}</p><p class="whitespace-pre-wrap break-words">最新保存：{{describe(conflict.remote)}}</p>
      <div class="flex flex-wrap gap-3"><UButton variant="soft" @click="resolveConflict(String(key),'local')">采用本页填写</UButton><UButton variant="soft" @click="resolveConflict(String(key),'remote')">采用最新保存</UButton></div>
    </div>
    <div v-if="stage.notes?.length" class="text-sm space-y-2"><strong>本阶段补充</strong><p v-for="(note,index) in stage.notes" :key="index" class="whitespace-pre-wrap break-words">{{note}}</p></div>
    <p v-if="stage.feedback" role="status" class="text-sm text-textMuted">{{stage.feedback}}</p>
    <footer class="flex flex-wrap gap-3"><LivButton settings variant="secondary" :disabled="busy||saving||materialBusy||page===0" @click="move(-1)">上一步</LivButton><LivButton settings variant="primary" :loading="busy||saving" :disabled="busy||saving||materialBusy" @click="move(1)">{{field?'下一步':'提交本阶段'}}</LivButton></footer>
  </section>
</template>
