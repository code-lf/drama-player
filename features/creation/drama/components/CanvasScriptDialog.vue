<script setup lang="ts">
import {ref,watch} from 'vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {readScriptTextFile,type CanvasScriptDocument} from '../scriptDocument'
const props=defineProps<{open:boolean;document:CanvasScriptDocument|null;busy?:boolean;error?:string}>()
const emit=defineEmits<{'update:open':[open:boolean];save:[document:Omit<CanvasScriptDocument,'id'>]}>()
const title=ref(''),source=ref(''),requirements=ref(''),fileInput=ref<HTMLInputElement|null>(null),fileError=ref(''),reading=ref(false)
// 仅重新打开时加载已保存版本；保存错误或父状态回填不能清空本地未保存内容。
watch(()=>props.open,open=>{if(open){title.value=props.document?.title||'我的剧本';source.value=props.document?.source_text||'';requirements.value=props.document?.requirements||'';fileError.value=''}},{immediate:true})
async function fileChanged(event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0];input.value=''
  if(!file||reading.value||props.busy)return
  reading.value=true;fileError.value=''
  try{source.value=await readScriptTextFile(file);if(!props.document)title.value=file.name.replace(/\.txt$/i,'').slice(0,100)}
  catch(cause){fileError.value=(cause as Error).message}finally{reading.value=false}
}
function submit(){if(!props.busy&&!reading.value&&title.value.trim()&&source.value.trim())emit('save',{title:title.value,source_text:source.value,requirements:requirements.value})}
</script>
<template>
  <LivDialog :open="open" settings dark title="剧本文稿" description="保存原文后创建画布剧本节点；不会自动解析、生成或扣积分。" @update:open="value=>{if(!busy&&!reading)emit('update:open',value)}">
    <div class="canvas-script-form">
      <label><span>剧本名称 <span class="required" aria-hidden="true">*</span></span><UInput v-model="title" aria-label="剧本名称" required :maxlength="100" :disabled="busy||reading"/></label>
      <div class="canvas-script-file"><input ref="fileInput" type="file" hidden accept=".txt,text/plain" @change="fileChanged"><LivButton settings icon="i-lucide-upload" :disabled="busy||reading" @click="fileInput?.click()">{{reading?'正在读取…':'选择 TXT'}}</LivButton><small>或直接粘贴原文</small></div>
      <label><span>剧本原文 <span class="required" aria-hidden="true">*</span></span><UTextarea v-model="source" aria-label="剧本原文" required :rows="10" :maxlength="200000" :disabled="busy||reading"/></label>
      <label>制作要求（不写入剧情）<UTextarea v-model="requirements" aria-label="制作要求" :rows="3" :maxlength="10000" :disabled="busy||reading" placeholder="例如画幅、对白语言、风格偏好"/></label>
      <p v-if="fileError||error" role="alert">{{fileError||error}}</p>
      <small>保存的是原文，不会把普通对话自动当成剧本，也不会绑定已有短剧项目。</small>
    </div>
    <template #footer><div class="canvas-script-actions"><LivButton settings :disabled="busy||reading" @click="emit('update:open',false)">取消</LivButton><LivButton settings variant="primary" :loading="busy" :disabled="busy||reading||!title.trim()||!source.trim()" @click="submit">保存剧本</LivButton></div></template>
  </LivDialog>
</template>
<style scoped>
.canvas-script-form{display:grid;gap:16px;color:var(--ui-text)}
.canvas-script-form label{display:grid;gap:8px;font-size:14px}
.canvas-script-form .required,.canvas-script-form p{color:var(--ui-error)}
.canvas-script-file,.canvas-script-actions{display:flex;align-items:center;gap:12px}
.canvas-script-form small{color:var(--ui-text-muted);line-height:1.6}
.canvas-script-actions{width:100%;justify-content:flex-end}
</style>
