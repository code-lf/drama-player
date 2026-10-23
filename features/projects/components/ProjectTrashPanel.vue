<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue'
import {creationProjectService} from '~/shared/api/services/creationProjectService'
import {useProjectRecycleBin} from '~/composables/useProjectRecycleBin'
import type {CreationProjectCard} from '../types'
const {auth}=useWorkbenchAuth(),recycle=useProjectRecycleBin()
const revision=useState<number>('creation-project-directory-revision',()=>0)
const items=ref<CreationProjectCard[]>([]),busy=ref(false),error=ref(''),restoring=ref(''),page=ref(1),total=ref(0)
let request=0,controller:AbortController|undefined
/** 按账号和页码隔离回收站读取，换号或离开时不显示旧账号内容。 */
async function load(){
  const current=++request,owner=auth.session.user?.id
  controller?.abort();controller=new AbortController();busy.value=true;error.value='';items.value=[]
  if(!owner){busy.value=false;total.value=0;return}
  try{const result=await creationProjectService.list(20,(page.value-1)*20,'all',controller.signal,true);if(current!==request||owner!==auth.session.user?.id)return;items.value=result.items;total.value=result.total;if(!items.value.length&&page.value>1)page.value--}
  catch(reason){if(current===request)error.value=reason instanceof Error?reason.message:'回收站读取失败，请重试。'}
  finally{if(current===request)busy.value=false}
}
async function restore(item:CreationProjectCard){if(restoring.value)return;restoring.value=item.id;try{await recycle.restore(item)}catch(reason){error.value=reason instanceof Error?reason.message:'恢复失败，请重试。'}finally{restoring.value=''}}
watch(()=>[page.value,auth.session.user?.id,revision.value],load,{immediate:true})
onBeforeUnmount(()=>{request++;controller?.abort()})
</script>
<template>
  <section class="project-trash-panel" :aria-busy="busy">
    <header><UButton to="/dashboard-projects" icon="i-lucide-arrow-left" color="neutral" variant="ghost" aria-label="返回我的项目"/><h1>项目回收站</h1></header>
    <p class="project-trash-copy">删除的项目可在这里恢复。对话、制作数据与独立作品仍保留。</p>
    <div v-if="error" role="alert"><p>{{error}}</p><UButton color="neutral" variant="soft" @click="load">重试</UButton></div>
    <div v-if="busy" class="project-trash-grid"><USkeleton v-for="index in 4" :key="index" class="project-trash-loading"/></div>
    <p v-else-if="!error&&!items.length" class="project-trash-copy">回收站暂无项目</p>
    <div v-else class="project-trash-grid"><article v-for="item in items" :key="item.id" class="project-trash-card"><img v-if="item.coverImageUrl" :src="item.coverImageUrl" :alt="item.title"><UIcon v-else :name="item.kind==='drama'?'i-lucide-clapperboard':'i-lucide-messages-square'" class="project-trash-placeholder"/><strong>{{item.title}}</strong><UButton icon="i-lucide-undo-2" color="neutral" variant="soft" :loading="restoring===item.id" :disabled="!!restoring" @click="restore(item)">恢复</UButton></article></div>
    <nav v-if="total>20" class="project-trash-pages" aria-label="回收站分页"><UButton color="neutral" variant="soft" :disabled="page===1||busy" @click="page--">上一页</UButton><span>{{page}} / {{Math.ceil(total/20)}}</span><UButton color="neutral" variant="soft" :disabled="page*20>=total||busy" @click="page++">下一页</UButton></nav>
  </section>
</template>
<style scoped>
.project-trash-panel{color:var(--color-text-main);font-size:14px}.project-trash-panel>header{display:flex;align-items:center;gap:12px}.project-trash-panel h1{font-size:24px;font-weight:700}.project-trash-copy{color:var(--color-text-muted);margin:16px 0 24px}.project-trash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:12px}.project-trash-card{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:12px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-workspace-surface);min-width:0}.project-trash-card>img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px}.project-trash-card>strong{font-size:16px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%}.project-trash-placeholder{width:100%;height:100px;color:var(--color-text-muted)}.project-trash-loading{height:210px}.project-trash-pages{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px}
</style>
