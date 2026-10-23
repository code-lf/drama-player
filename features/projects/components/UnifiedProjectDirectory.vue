<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {UButton,USkeleton,UIcon} from '#components'
import {useRouter,useState,useRoute} from '#imports'
import {useWorkbenchAuth} from '~/composables/useWorkbenchAuth'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import ProjectDirectoryPanel from './ProjectDirectoryPanel.vue'
import {creationProjectService} from '~/shared/api/services/creationProjectService'
import {useProjectRecycleBin} from '~/composables/useProjectRecycleBin'
import ProjectTrashPanel from './ProjectTrashPanel.vue'
import {projectDestination,type CreationProjectCard,type CreationProjectKind} from '../types'

const router=useRouter(),{auth}=useWorkbenchAuth()
const route=useRoute(),recycle=useProjectRecycleBin()
const directoryRevision=useState<number>('creation-project-directory-revision',()=>0)
// 目录分页与短剧详情的工作流独立，不修改父工作台的历史项目缓存。
const pageSize=20,page=ref(1),kind=ref<CreationProjectKind>('all'),items=ref<CreationProjectCard[]>([]),total=ref(0)
const busy=ref(false),error=ref(''),batch=ref(false),selection=ref<string[]>([])
const deleting=ref(false),deleteTargets=ref<CreationProjectCard[]>([]),deleteError=ref(''),createOpen=ref(false)
let revision=0,controller:AbortController|undefined
const pages=computed(()=>Math.max(1,Math.ceil(total.value/pageSize)))
const numbers=computed(()=>{const start=Math.max(1,Math.min(page.value-2,pages.value-4));return Array.from({length:Math.min(5,pages.value)},(_,index)=>start+index)})
const selectable=computed(()=>items.value.filter(item=>item.kind==='drama').map(item=>item.id))
const allSelected=computed(()=>selectable.value.length>0&&selectable.value.every(id=>selection.value.includes(id)))

/** 请求按账号、类型和页码隔离；卸载或换号的旧响应不能写回私人项目。 */
async function load(){
  const version=++revision,owner=auth.session.user?.id
  controller?.abort();controller=new AbortController();error.value='';busy.value=true
  if(route.query.view==='trash'){busy.value=false;return}
  if(!auth.session.loggedIn||!owner){items.value=[];total.value=0;busy.value=false;return}
  try{
    const result=await creationProjectService.list(pageSize,(page.value-1)*pageSize,kind.value,controller.signal)
    if(version!==revision||owner!==auth.session.user?.id)return
    if(page.value>1&&!result.items.length){page.value=Math.max(1,Math.ceil(result.total/pageSize));return}
    items.value=result.items;total.value=result.total
  }catch(reason){if(version===revision)error.value=reason instanceof Error?reason.message:'项目读取失败，请重试。'}
  finally{if(version===revision)busy.value=false}
}
watch(()=>[page.value,kind.value,auth.session.user?.id,auth.session.loggedIn,route.query.view],()=>{selection.value=[];batch.value=false;deleteTargets.value=[];createOpen.value=false;void load()},{immediate:true})
// 侧栏重命名后刷新同一目录；本组件删除期间由确认流程自行刷新，避免双请求。
watch(directoryRevision,()=>{if(!deleting.value)void load()})
onBeforeUnmount(()=>{revision++;controller?.abort()})
/** 全选仅操作明确支持删除的当前页短剧，绝不把会话编号发给短剧接口。 */
function toggle(id:string){if(!selectable.value.includes(id))return;selection.value=selection.value.includes(id)?selection.value.filter(value=>value!==id):[...selection.value,id]}
function selectAll(){selection.value=allSelected.value?[]:[...selectable.value]}
function changeKind(value:CreationProjectKind){kind.value=value;page.value=1}
function open(id:string){const item=items.value.find(value=>value.id===id);if(item)void router.push(projectDestination(item))}
function askDelete(targets:CreationProjectCard[]){deleteError.value='';deleteTargets.value=targets.filter(item=>item.kind==='drama')}
/** 项目页与侧栏一致移入回收站，不再在目录执行不可恢复的旧短剧删除。 */
async function confirmDelete(){
  if(deleting.value||!deleteTargets.value.length)return
  deleting.value=true;deleteError.value=''
  const owner=auth.session.user?.id
  try{
    for(const item of deleteTargets.value){if(owner!==auth.session.user?.id)return;await recycle.remove(item)}
    if(owner!==auth.session.user?.id)return
    deleteTargets.value=[];selection.value=[];batch.value=false
    directoryRevision.value++
    await load()
  }catch(reason){if(owner===auth.session.user?.id)deleteError.value=reason instanceof Error?reason.message:'删除失败，请重试。'}
  finally{deleting.value=false}
}
</script>
<template>
  <ProjectTrashPanel v-if="route.query.view==='trash'"/>
  <section v-else class="unified-project-directory" :aria-busy="busy">
    <UButton to="/dashboard-projects?view=trash" icon="i-lucide-trash-2" color="neutral" variant="soft" class="project-trash-entry">回收站</UButton>
    <div v-if="busy" class="unified-project-loading" aria-label="正在读取我的项目"><USkeleton class="project-loading-title"/><USkeleton class="project-loading-toolbar"/><div class="project-loading-grid"><USkeleton v-for="index in 6" :key="index" class="project-loading-card"/></div></div>
    <div v-if="error" class="unified-project-error" role="alert"><p>{{error}}</p><UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="busy" @click="load">重试读取项目</UButton></div>
    <ProjectDirectoryPanel v-show="!busy&&!error" :current-project-page="page" :total-project-pages="pages" :page-number-list="numbers" :workspace-project-cards="items" :kind-filter="kind" project-overview-label="在一个地方继续对话，管理图片、视频、音乐与短剧创作" :is-all-current-page-selected="allSelected" :is-batch-selecting-projects="batch" :is-creating-workspace-project="false" :is-deleting-projects="deleting" :selected-project-count="selection.length" :selected-project-ids="selection" @create-project="createOpen=true" @go-to-page="page=$event" @update-kind="changeKind" @open-project="open" @toggle-batch-mode="batch=!batch;selection=[]" @toggle-select-all="selectAll" @toggle-project-selection="toggle" @request-delete-project="askDelete([$event as CreationProjectCard])" @request-delete-batch="askDelete(items.filter(item=>selection.includes(item.id)))"/>
    <LivDialog :open="createOpen" title="新建项目" settings dark @update:open="createOpen=$event">
      <p class="liv-settings-copy">从自由创作开始，或使用短剧专业流程。</p>
      <div class="project-create-options"><UButton to="/dashboard?entry=free&new=1" color="primary" variant="soft" @click="createOpen=false"><UIcon name="i-lucide-sparkles"/><span>自由创作<small>对话构思，创作图片、视频和音乐</small></span></UButton><UButton to="/dashboard?entry=drama&new=1" color="neutral" variant="outline" @click="createOpen=false"><UIcon name="i-lucide-clapperboard"/><span>短剧项目<small>剧本、资产、分镜与成片制作</small></span></UButton></div>
    </LivDialog>
    <LivDialog :open="!!deleteTargets.length" title="移入回收站" settings dark @update:open="!$event&&!deleting&&(deleteTargets=[])">
      <p class="liv-settings-copy">将这 {{deleteTargets.length}} 个项目移入回收站？可以撤销或恢复，关联对话和独立图片、视频、音乐作品不会删除。</p><p v-if="deleteError" class="liv-settings-note" role="alert">{{deleteError}}</p>
      <template #footer><LivButton settings variant="secondary" :disabled="deleting" @click="deleteTargets=[]">取消</LivButton><LivButton settings variant="primary" :loading="deleting" @click="confirmDelete">确认删除</LivButton></template>
    </LivDialog>
  </section>
</template>
<style scoped>
.project-trash-entry{margin-bottom:16px}
/* 首屏读取保持目录外壳，重试与业务表单共用语义令牌。 */
.unified-project-directory{min-width:0;width:100%}.unified-project-error{display:flex;align-items:center;gap:16px;flex-wrap:wrap;color:var(--color-state-danger);font-size:var(--liv-font-body);padding:24px 0}
/* 加载占位跟随紧凑卡片令牌，避免读取完成后卡片高度明显跳变。 */
.project-loading-title{width:180px;height:36px}.project-loading-toolbar{width:100%;height:40px;margin:16px 0 12px}.project-loading-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:var(--liv-project-grid-gap)}.project-loading-card{height:calc(var(--liv-project-cover-max-height) + 96px)}
.project-create-options{display:grid;gap:12px;margin-top:20px}.project-create-options>a{min-height:80px;justify-content:flex-start;gap:16px;padding:16px;text-align:left;font-size:var(--liv-font-section)}.project-create-options .iconify{width:24px;height:24px;flex:none}.project-create-options small{display:block;margin-top:4px;font-size:var(--liv-font-body);font-weight:400;color:var(--color-text-muted);white-space:normal}
</style>
