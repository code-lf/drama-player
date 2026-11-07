<script setup lang="ts">
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import type {ComposerReference} from '../types'
import {libraryErrorMessage} from '~/features/library/libraryError'

/** 参考图是独立资料问题：上传只保存素材，用户确认后才沿原回答接口继续。 */
const props=defineProps<{questionKey:string;text:string;busy:boolean;upload:(file:File,progress?:(percent:number|null)=>void)=>Promise<ComposerReference|null>;restore?:(item:ComposerReference)=>Promise<ComposerReference|null>}>()
const emit=defineEmits<{submit:[items:ComposerReference[]]}>()
const input=ref<HTMLInputElement|null>(null),selected=ref<ComposerReference|null>(null)
const uploading=ref(false),progress=ref<number|null>(null),preview=ref(''),error=ref(''),failedFile=ref<File|null>(null)
let sequence=0
const canConfirm=computed(()=>!props.busy&&!uploading.value&&!failedFile.value&&!!selected.value)
function clearPreview(){if(preview.value)URL.revokeObjectURL(preview.value);preview.value=''}
// 缓存只保留固定版本标识，不保存私有签名地址或文件内容；服务端仍核对本人素材权限。
function cache(){try{const item=selected.value;sessionStorage.setItem('question-image:'+props.questionKey,JSON.stringify(item?{item_id:item.item_id,version_id:item.version_id,purpose:'reference',media_type:'image',name:item.name}:null))}catch{/* 缓存不可用不自动提交或重新上传。 */}}
watch(()=>props.questionKey,async()=>{
  sequence++;clearPreview();selected.value=null;uploading.value=false;progress.value=null;failedFile.value=null;error.value=''
  const current=sequence
  try{
    const item=JSON.parse(sessionStorage.getItem('question-image:'+props.questionKey)||'null')
    if(typeof item?.item_id!=='string'||typeof item?.version_id!=='string'||item.media_type!=='image')return
    // 刷新通过原鉴权服务读取同一版本的预览；不缓存私有地址，也不换成最新版本。
    if(props.restore){uploading.value=true;const restored=await props.restore(item);if(current!==sequence)return;if(!restored)throw new Error('素材不可读取');selected.value=restored}
    else selected.value=item
  }catch{if(current===sequence)error.value='已上传参考图暂不可读取，请重新选择。'}
  finally{if(current===sequence)uploading.value=false}
},{immediate:true})
onBeforeUnmount(()=>{sequence++;clearPreview()})
function chooseFile(){if(!props.busy&&!uploading.value)input.value?.click()}
/** XHR的实际传输进度与服务端入库分开；本地缩略图不能作为成功凭证。 */
async function receive(file:File|undefined){
  if(!file||props.busy||uploading.value)return
  const current=++sequence,key=props.questionKey
  clearPreview();error.value='';failedFile.value=null;selected.value=null;cache();progress.value=0;uploading.value=true
  preview.value=URL.createObjectURL(file)
  try{
    const item=await props.upload(file,value=>{if(current===sequence)progress.value=value})
    if(current!==sequence||key!==props.questionKey)return
    if(!item)throw new Error('未完成图片上传，请重试或移除。')
    selected.value=item;cache()
  }catch(cause){if(current===sequence){failedFile.value=file;error.value=libraryErrorMessage(cause,'图片上传失败，请重试或移除。')}}
  finally{if(current===sequence)uploading.value=false}
}
function change(event:Event){const element=event.target as HTMLInputElement;const file=element.files?.[0];element.value='';void receive(file)}
function remove(){if(props.busy||uploading.value)return;sequence++;clearPreview();selected.value=null;failedFile.value=null;progress.value=null;error.value='';cache()}
function confirm(){if(canConfirm.value&&selected.value)emit('submit',[selected.value])}
defineExpose({chooseFile})
</script>
<template>
  <section class="creation-reference-question" aria-label="上传参考图">
    <strong>上传参考图</strong>
    <p>{{text}}</p>
    <input ref="input" type="file" accept="image/*" hidden aria-label="选择本地参考图片" @change="change"/>
    <div class="reference-question-content">
      <div v-if="preview||selected" class="reference-question-image">
        <img v-if="preview||selected?.preview_url" :src="preview||selected?.preview_url" alt="本题参考图"/>
        <UIcon v-else name="i-lucide-image" aria-hidden="true"/>
        <UButton v-if="!uploading" icon="i-lucide-x" color="neutral" variant="solid" size="xs" aria-label="移除本题参考图" :disabled="busy" @click="remove"/>
      </div>
      <UButton v-if="!uploading&&!selected&&!failedFile" class="reference-question-add" color="neutral" variant="ghost" :disabled="busy" @click="chooseFile"><UIcon name="i-lucide-plus"/><span>上传图片</span></UButton>
    </div>
    <div v-if="uploading" class="reference-question-progress" role="status">
      <UProgress :model-value="progress===null||progress===100?null:progress"/>
      <span>{{progress===100?'正在保存图片…':progress===null?'正在处理图片…':`上传中 ${progress}%`}}</span>
    </div>
    <p v-else-if="selected" class="reference-question-status" :title="selected.name">已上传：{{selected.name||'参考图'}}</p>
    <p v-if="error" role="alert" class="reference-question-error">{{error}}</p>
    <UButton v-if="failedFile" color="neutral" variant="soft" :disabled="busy||uploading" @click="receive(failedFile||undefined)">重试上传</UButton>
    <LivButton block variant="primary" class="reference-question-confirm" :disabled="!canConfirm" :loading="busy" @click="confirm">确认</LivButton>
  </section>
</template>
<style scoped>
/* 复用问题卡令牌，不另建上传基础控件、来源菜单或第二组问题选项。 */
.creation-reference-question{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;gap:14px;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface)}
.creation-reference-question>p{margin:0;font-size:var(--liv-workflow-font-size);line-height:1.65}
.reference-question-content{display:flex;gap:12px}
.reference-question-add{display:flex;flex-direction:column;justify-content:center!important;gap:8px;width:96px;height:96px;padding:8px!important;border:1px dashed var(--color-border-soft);border-radius:12px;background:transparent;font-size:12px}
.reference-question-add :deep(.iconify){width:24px;height:24px}
.reference-question-image{position:relative;display:grid;place-items:center;width:96px;height:96px;border-radius:12px;overflow:hidden;background:var(--liv-question-option)}
.reference-question-image>img{width:100%;height:100%;object-fit:cover}
.reference-question-image>button{position:absolute;top:3px;right:3px;padding:3px!important}
.reference-question-progress{display:grid;gap:6px;font-size:12px;color:var(--liv-settings-muted)}
.reference-question-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--liv-settings-muted)}
.reference-question-error{color:var(--color-state-danger)}
.reference-question-confirm{width:100%;height:var(--liv-question-action-height);min-height:var(--liv-question-action-height);padding:0 12px;border-radius:999px;justify-content:center!important;background:var(--liv-ui-primary)!important;color:var(--liv-control-on-primary)!important}
</style>
