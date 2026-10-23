<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {CollectionStage} from '~/shared/api/services/creationService'
import type {ComposerReference} from '../types'
// 业务卡片复用 Nuxt UI 控件；不另造上传、按钮或弹窗基础组件。
const props=defineProps<{stage:CollectionStage;busy:boolean;references:ComposerReference[];save:(answers:Record<string,unknown>,submit:boolean,requestId:string)=>Promise<boolean>}>()
const emit=defineEmits<{upload:[file:File];assets:[]}>()
const page=ref(0),answers=ref<Record<string,unknown>>({}),localError=ref('')
const fields=computed(()=>props.stage.definition.fields)
const field=computed(()=>fields.value[page.value])
// 只有服务端修订改变才回填，避免普通父组件重绘清空正在输入的文字。
watch(()=>props.stage.revision,()=>{answers.value=JSON.parse(JSON.stringify(props.stage.answers));page.value=Math.min(page.value,fields.value.length)},{immediate:true})
const text=computed({get:()=>String(answers.value[field.value?.id||'']||''),set:value=>{if(field.value)answers.value[field.value.id]=value}})
let pending:{fingerprint:string;id:string}|undefined
/** 保存成功才翻页；响应丢失重试复用请求号，不重复提交阶段。 */
async function move(direction:number){
  if(props.busy)return
  localError.value=''
  const submit=page.value===fields.value.length&&direction>0
  if(direction>0&&field.value?.required&&!answers.value[field.value.id]){localError.value='请先填写此项信息。';return}
  const payload=JSON.parse(JSON.stringify(answers.value)) as Record<string,unknown>
  const fingerprint=JSON.stringify([props.stage.revision,payload,submit])
  if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()}
  if(await props.save(payload,submit,pending.id)){pending=undefined;if(!submit)page.value=Math.max(0,Math.min(fields.value.length,page.value+direction))}
}
/** 文件对话框取消不更新答案，上传仍走工作台已有权限链。 */
function receive(file:File|null|undefined){if(file)emit('upload',file)}
function useReferences(){if(field.value)answers.value[field.value.id]=props.references.map(({item_id,version_id,purpose,start,end})=>({item_id,version_id,purpose,start,end}))}
function toggle(option:string){if(!field.value)return;const selected=(answers.value[field.value.id]||[]) as string[];answers.value[field.value.id]=selected.includes(option)?selected.filter(value=>value!==option):[...selected,option]}
</script>

<template>
  <section class="rounded-xl bg-surfaceRaised p-4 space-y-4" aria-label="阶段信息收集" :aria-busy="busy">
    <header class="flex items-center justify-between gap-3"><strong class="text-sm text-textMain">{{stage.definition.title}}</strong><span class="text-xs text-textMuted">{{Math.min(page+1,fields.length)}}/{{fields.length}} · {{field?'填写信息':'核对汇总'}}</span></header>
    <template v-if="field">
      <div class="flex items-center justify-between gap-3"><label class="text-sm text-textMain" :for="`stage-${field.id}`">{{field.label}}</label><span class="text-xs text-textMuted">{{field.required?'必填':'可选'}}</span></div>
      <template v-if="field.kind==='reference'">
        <p class="text-sm text-textMuted">可上传正面、背面或标签细节；也可从资料库选择。</p>
        <div class="flex flex-wrap items-start gap-3">
          <img v-for="item in references.filter(item=>item.media_type==='image')" :key="item.version_id" :src="item.preview_url" :alt="item.name" class="size-16 rounded-lg object-contain" />
          <UFileUpload accept="image/*" icon="i-lucide-plus" label="上传图片" class="w-24" :disabled="busy" @update:model-value="receive" />
        </div>
        <div class="flex flex-wrap gap-3"><UButton variant="soft" :disabled="busy" @click="emit('assets')">从资料库选择</UButton><UButton variant="outline" :disabled="busy || !references.length" @click="useReferences">使用已选素材</UButton><UButton variant="ghost" :disabled="busy" @click="answers[field.id]=[]">清除此项引用</UButton></div>
        <p class="text-xs text-textMuted">此项已选 {{Array.isArray(answers[field.id])?(answers[field.id] as unknown[]).length:0}} 项；上传后点击“使用已选素材”。</p>
      </template>
      <div v-else-if="field.kind==='single'||field.kind==='multiple'" class="flex flex-wrap gap-3"><UButton v-for="option in field.options" :key="option" :variant="text===option || (Array.isArray(answers[field.id])&&(answers[field.id] as string[]).includes(option))?'solid':'soft'" :disabled="busy" @click="field.kind==='multiple'?toggle(option):text=option">{{option}}</UButton></div>
      <UTextarea v-else :id="`stage-${field.id}`" v-model="text" :aria-label="field.label" :disabled="busy" :maxlength="2000" :rows="3" class="w-full" />
    </template>
    <dl v-else class="space-y-3 text-sm"><div v-for="item in fields" :key="item.id"><dt class="text-textMuted">{{item.label}}</dt><dd class="text-textMain whitespace-pre-wrap break-words">{{item.kind==='reference'?`${Array.isArray(answers[item.id])?(answers[item.id] as unknown[]).length:0} 项素材`:answers[item.id]||'未填写'}}</dd></div></dl>
    <p v-if="localError" role="alert" class="text-sm text-stateDanger">{{localError}}</p>
    <footer class="flex flex-wrap gap-3"><UButton variant="soft" :disabled="busy||page===0" @click="move(-1)">上一步</UButton><UButton :loading="busy" :disabled="busy" @click="move(1)">{{field?'下一步':'提交本阶段'}}</UButton></footer>
  </section>
</template>
