<script setup lang="ts">
import {onBeforeUnmount,onMounted,ref} from 'vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {request} from '~/shared/api/adapters/httpAdapter'
import {creationProjectService} from '~/shared/api/services/creationProjectService'

const props=defineProps<{sessionId:string}>()
const emit=defineEmits<{close:[];bound:[]}>()
type Candidate={project_id:string;binding_revision:number;document_revision:number;confirmed_snapshot_id:string;confirmed_content_hash:string;production_version_id:string;source_script_version:string;asset_count:number}
const items=ref<Array<{label:string;value:string}>>([]),selected=ref(''),candidate=ref<Candidate|null>(null)
const busy=ref(false),error=ref(''),offset=ref(0),total=ref(0)
const limit=20
let active=true
onBeforeUnmount(()=>{active=false})
const path=()=>`/creation/sessions/${props.sessionId}/production-workspace`
/** 使用原项目目录分页，仅显示当前账号的短剧项目。 */
async function list(next=0){
  busy.value=true;error.value=''
  try{
    const page=await creationProjectService.list(limit,next,'drama')
    if(!active)return
    items.value=page.items.filter(row=>row.projectId).map(row=>({label:row.title,value:row.projectId}))
    selected.value='';candidate.value=null;offset.value=next;total.value=page.total
  }catch{if(active)error.value='无法读取短剧项目，请重试。'}
  finally{if(active)busy.value=false}
}
/** 先预览，再用服务端返回的身份确认；改选项目会撤销旧预览。 */
async function preview(){
  const projectId=selected.value
  if(busy.value||!projectId)return
  busy.value=true;error.value='';candidate.value=null
  try{
    const value=await request<Candidate>(`${path()}/preview`,{query:{project_id:projectId}})
    if(active&&value.project_id===selected.value)candidate.value=value
  }catch{if(active)error.value='无法预览。请确认项目已有正式剧本和资产工作区。'}
  finally{if(active)busy.value=false}
}
async function bind(){
  const value=candidate.value
  if(!value||value.project_id!==selected.value||busy.value)return
  busy.value=true;error.value=''
  try{
    const result=await request<{binding:{project_id:string}|null}>(path(),{method:'PUT',body:{
      project_id:value.project_id,expected_binding_revision:value.binding_revision,expected_document_revision:value.document_revision,
      confirmed_snapshot_id:value.confirmed_snapshot_id,confirmed_content_hash:value.confirmed_content_hash,production_version_id:value.production_version_id,
    }})
    if(result.binding?.project_id!==value.project_id)throw new Error('绑定回执不匹配')
    if(active)emit('bound')
  }catch{if(active){candidate.value=null;error.value='未确认绑定，请重新预览项目后再试。'}}
  finally{if(active)busy.value=false}
}
onMounted(()=>void list())
</script>

<template>
  <LivDialog :open="true" :dismissible="!busy" settings dark title="绑定短剧项目" description="画布将显示该项目的共享生产资产，不覆盖本地文稿，也不会提交生成。" @update:open="value=>{if(!value&&!busy)emit('close')}">
    <div class="grid gap-3">
      <USelect :model-value="selected" :items="items" :disabled="busy||!items.length" placeholder="选择已有短剧项目" aria-label="短剧项目" @update:model-value="value=>{selected=String(value||'');candidate=null}"/>
      <div class="flex flex-wrap gap-2">
        <UButton v-if="offset>0" color="neutral" :disabled="busy" @click="list(offset-limit)">上一页</UButton>
        <UButton v-if="offset+limit<total" color="neutral" :disabled="busy" @click="list(offset+limit)">下一页</UButton>
        <UButton v-if="!items.length&&!busy" color="neutral" @click="list(offset)">重新读取项目</UButton>
      </div>
      <p v-if="candidate" role="status">确认剧本：{{candidate.source_script_version}} · {{candidate.asset_count}} 项资产</p>
      <p v-if="error" role="alert">{{error}}</p>
    </div>
    <template #footer>
      <LivButton settings :disabled="busy" @click="emit('close')">取消</LivButton>
      <LivButton v-if="!candidate" settings variant="primary" :disabled="!selected||busy" :loading="busy" @click="preview">核对项目</LivButton>
      <LivButton v-else settings variant="primary" :loading="busy" :disabled="busy" @click="bind">确认绑定</LivButton>
    </template>
  </LivDialog>
</template>
