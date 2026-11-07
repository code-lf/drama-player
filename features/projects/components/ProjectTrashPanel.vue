<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue'
import {creationProjectService} from '~/shared/api/services/creationProjectService'
import {useProjectRecycleBin} from '~/composables/useProjectRecycleBin'
import type {CreationProjectCard} from '../types'
import '~/assets/css/project-directory-grid.css'
const failedCovers=ref(new Set<string>())
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
    <header><h1>我的项目</h1></header>
    <nav class="project-trash-tabs" aria-label="项目分类"><NuxtLink to="/dashboard-projects">全部</NuxtLink><NuxtLink to="/dashboard-projects?kind=drama">剧本</NuxtLink><span aria-current="page">回收站</span></nav>
    <div v-if="error" role="alert"><p>{{error}}</p><UButton color="neutral" variant="soft" @click="load">重试</UButton></div>
    <DashboardSkeleton v-if="busy" variant="projects" :heading="false" :rows="6" aria-label="正在读取回收站"/>
    <div v-else-if="!error&&!items.length" class="project-trash-empty" role="status"><UIcon name="i-lucide-inbox" aria-hidden="true"/><p>回收站为空</p></div>
    <div v-else class="project-trash-grid project-card-grid"><article v-for="item in items" :key="item.id" class="project-trash-card"><div class="trash-cover"><img v-if="item.coverImageUrl&&!failedCovers.has(item.id)" :src="item.coverImageUrl" :alt="item.title" loading="lazy" @error="failedCovers.add(item.id)"><span v-else aria-label="暂无项目封面">Livliv</span></div><div class="trash-copy"><strong :title="item.title">{{item.title}}</strong><time>{{new Date(item.updatedAt||item.createdAt).toLocaleDateString('zh-CN')}}</time><UButton icon="i-lucide-undo-2" color="neutral" variant="ghost" :loading="restoring===item.id" :disabled="!!restoring" @click="restore(item)">恢复</UButton></div></article></div>
    <nav v-if="total>20" class="project-trash-pages" aria-label="回收站分页"><UButton color="neutral" variant="soft" :disabled="page===1||busy" @click="page--">上一页</UButton><span>{{page}} / {{Math.ceil(total/20)}}</span><UButton color="neutral" variant="soft" :disabled="page*20>=total||busy" @click="page++">下一页</UButton></nav>
  </section>
</template>
<style scoped>
/* 回收站沿用目录标题与页签；空态无卡片背景，灰色图标和短文案垂直居中。 */
.project-trash-panel{padding:0 32px}.project-trash-panel h1{margin:0;line-height:36px}.project-trash-tabs{display:flex;align-items:center;gap:16px;margin:34px 0 22px;height:36px;font-size:18px;font-weight:600;color:var(--liv-project-muted)}.project-trash-tabs a{color:inherit;text-decoration:none}.project-trash-tabs [aria-current]{color:var(--liv-project-text)}.project-trash-empty{min-height:400px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}.project-trash-empty>.iconify{width:48px;height:48px;color:var(--liv-project-muted);opacity:.65}.project-trash-empty p{margin:0;font-size:15px;line-height:24px;font-weight:400;color:var(--liv-project-muted)}@media(max-width:767px){.project-trash-panel{padding:0}}
.project-trash-panel{color:var(--color-text-main);font-size:14px}.project-trash-panel>header{display:flex;align-items:center;gap:12px}.project-trash-panel h1{font-size:24px;font-weight:700}.project-trash-copy{color:var(--color-text-muted);margin:16px 0 24px}.project-trash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:12px}.project-trash-card{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:12px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-workspace-surface);min-width:0}.project-trash-card>img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px}.project-trash-card>strong{font-size:16px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%}.project-trash-placeholder{width:100%;height:100px;color:var(--color-text-muted)}.project-trash-loading{height:210px}.project-trash-pages{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px}
/* 回收站与全部共用列数、封面和信息区规格；恢复操作不改变卡片高度。 */
.project-trash-panel{padding:0;container:project-directory / inline-size}
.project-trash-grid.project-card-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@container project-directory (min-width:440px){.project-trash-grid.project-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container project-directory (min-width:680px){.project-trash-grid.project-card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.project-trash-card{display:block;padding:0;overflow:hidden;gap:0;background:var(--liv-project-card-surface)}
.trash-cover{aspect-ratio:16/9;display:grid;place-items:center;background:var(--liv-project-cover-surface);color:var(--liv-project-placeholder-mark)}
.trash-cover img{width:100%;height:100%;object-fit:cover}.trash-cover span{font-size:28px;font-weight:800}
.trash-copy{position:relative;min-height:64px;padding:8px 12px;box-sizing:border-box}
.trash-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:400;line-height:22px}
.trash-copy time{display:block;color:var(--liv-project-muted);font-size:12px;line-height:24px;padding-right:70px}
.trash-copy>button{position:absolute;right:6px;bottom:5px;font-size:12px;color:var(--liv-project-text);background:transparent;border:0;border-radius:8px}
.trash-copy>button:hover{background:var(--liv-project-hover)}
</style>
