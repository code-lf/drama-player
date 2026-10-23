<script setup lang="ts">
import type {SystemAnnouncement} from '~/entities/announcement/types'
import {useAuthStore} from '~/features/auth/store/useAuthStore'
import {announcementService} from '~/shared/api/services/announcementService'
import {persistAnnouncementReadIds,restoreAnnouncementReadIds} from '~/shared/utils/announcementReadState'
import {sanitizeAnnouncementContent} from '~/shared/utils/sanitizeAnnouncementContent'
import {safeAnnouncementLink} from '~/shared/utils/announcementFeed'
const auth=useAuthStore(),owner=computed(()=>auth.session.user?.id||'guest')
const announcements=ref<SystemAnnouncement[]>([]),loading=ref(false),error=ref(''),hasMore=ref(true),offset=ref(0),sentinel=ref<HTMLElement|null>(null),timeline=ref<HTMLElement|null>(null)
let revision=0,controller:AbortController|undefined,loader:IntersectionObserver|undefined,reader:IntersectionObserver|undefined
let readIds=new Set<string>()
/** 观察器绑定本轮账号和请求版本，旧页面的可见回调不写入新账号已读记录。 */
function createReader(){
  const key=owner.value,current=revision,root=sentinel.value?.closest('.dashboard-main-content')||null
  return new IntersectionObserver(entries=>{
    if(key!==owner.value||current!==revision)return
    let changed=false
    for(const entry of entries){if(!entry.isIntersecting)continue;const id=(entry.target as HTMLElement).dataset.announcementId;if(id&&!readIds.has(id)){readIds.add(id);changed=true}reader?.unobserve(entry.target)}
    if(changed)persistAnnouncementReadIds(key,readIds)
  },{root,threshold:0.1})
}
function dateLabel(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}
/** 每页只拼接未出现的公告，账号切换、卸载和迟到请求均不能污染当前列表。 */
async function loadMore(){
  if(loading.value||!hasMore.value)return
  const current=revision,key=owner.value,start=offset.value
  controller?.abort();controller=new AbortController();loading.value=true;error.value=''
  try{
    const page=await announcementService.feed(start,controller.signal)
    if(current!==revision||key!==owner.value)return
    const ids=new Set(announcements.value.map(item=>item.id))
    announcements.value=[...announcements.value,...page.items.filter(item=>!ids.has(item.id))]
    hasMore.value=page.next_offset!==null&&page.next_offset>start
    offset.value=page.next_offset??start
    await nextTick()
    timeline.value?.querySelectorAll<HTMLElement>('[data-announcement-id]').forEach(node=>{if(!readIds.has(node.dataset.announcementId||''))reader?.observe(node)})
  }catch(reason){if(current===revision)error.value=reason instanceof Error?reason.message:'公告读取失败，请重试。'}
  finally{
    if(current===revision){
      loading.value=false
      // 首屏未填满时继续读下一页；没有真实下一页或失败时不自动循环。
      const target=sentinel.value,root=target?.closest('.dashboard-main-content')
      if(!error.value&&hasMore.value&&target&&target.getBoundingClientRect().top<(root?.getBoundingClientRect().bottom||window.innerHeight)+160)void loadMore()
    }
  }
}
function reset(){revision++;controller?.abort();reader?.disconnect();reader=createReader();announcements.value=[];loading.value=false;offset.value=0;hasMore.value=true;readIds=restoreAnnouncementReadIds(owner.value);void loadMore()}
watch(owner,()=>{if(import.meta.client)reset()})
onMounted(()=>{
  const root=sentinel.value?.closest('.dashboard-main-content')||null
  // 公告只在实际进入可视区后记为已读，不因预加载整页而提前清除全部红点。
  loader=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&!error.value)void loadMore()},{root,rootMargin:'160px'})
  if(sentinel.value)loader.observe(sentinel.value)
  reset()
})
onBeforeUnmount(()=>{revision++;controller?.abort();loader?.disconnect();reader?.disconnect()})
</script>
<template>
  <section class="announcement-timeline-page" :aria-busy="loading">
    <h1>全部公告</h1>
    <div ref="timeline" class="announcement-timeline">
      <article v-for="item in announcements" :key="item.id" :data-announcement-id="item.id" class="announcement-timeline-item">
        <aside><time :datetime="item.createdAt">{{dateLabel(item.createdAt)}}</time></aside>
        <div class="announcement-timeline-copy">
          <h2>{{item.title}}</h2>
          <div class="announcement-timeline-body" v-html="sanitizeAnnouncementContent(item.content)"/>
          <UButton v-if="safeAnnouncementLink(item.linkUrl)" :href="safeAnnouncementLink(item.linkUrl)" :target="item.linkUrl.startsWith('http')?'_blank':undefined" rel="noopener noreferrer" color="neutral" variant="soft" trailing-icon="i-lucide-arrow-up-right">{{item.linkText||'查看详情'}}</UButton>
        </div>
      </article>
    </div>
    <p v-if="!loading&&!error&&!announcements.length" class="announcement-timeline-muted">暂无公告</p>
    <div v-if="error" role="alert" class="announcement-timeline-error"><p>{{error}}</p><UButton color="neutral" variant="soft" @click="loadMore">重新加载</UButton></div>
    <div v-if="loading" class="announcement-timeline-loading" role="status" aria-label="正在读取公告"><USkeleton class="announcement-date-placeholder"/><div><USkeleton class="announcement-title-placeholder"/><USkeleton class="announcement-body-placeholder"/></div></div>
    <div ref="sentinel" class="announcement-feed-sentinel" aria-hidden="true"/>
  </section>
</template>
<style scoped>
.announcement-timeline-page{max-width:1000px;margin:0 auto;color:var(--liv-account-text)}
.announcement-timeline-page>h1{font-size:24px;line-height:1.5;font-weight:700;margin:0 0 36px}
.announcement-timeline-item{display:grid;grid-template-columns:160px minmax(0,1fr);gap:36px;padding:0 0 44px;margin-bottom:44px;border-bottom:1px solid var(--liv-account-border)}
.announcement-timeline-item>aside{position:relative;font-size:13px;line-height:24px;color:var(--liv-account-muted);padding-left:18px;border-left:1px solid var(--liv-account-border)}
.announcement-timeline-item>aside::before{content:'';position:absolute;left:-4px;top:8px;width:7px;height:7px;border-radius:50%;background:var(--liv-account-muted)}
.announcement-timeline-copy{min-width:0}.announcement-timeline-copy>h2{margin:0 0 20px;font-size:20px;line-height:1.5;font-weight:600;color:var(--liv-account-text)}
.announcement-timeline-body{font-size:14px;line-height:1.85;overflow-wrap:anywhere;color:var(--liv-account-muted)}
.announcement-timeline-body :deep(p){margin:0 0 12px;color:inherit!important}
.announcement-timeline-body :deep(h1),.announcement-timeline-body :deep(h2),.announcement-timeline-body :deep(h3),.announcement-timeline-body :deep(h4){font-size:18px;font-weight:600;line-height:1.6;margin:24px 0 12px;color:var(--liv-account-text)!important}
.announcement-timeline-body :deep(ul),.announcement-timeline-body :deep(ol){padding-left:24px;margin:12px 0;list-style:revert}
.announcement-timeline-body :deep(img){display:block;width:auto;max-width:100%;height:auto;border-radius:14px;margin:20px 0}
.announcement-timeline-body :deep(a){color:var(--liv-ui-primary-foreground)!important;text-decoration:underline}
.announcement-timeline-body :deep(pre){white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;padding:12px;background:var(--liv-account-raised);border-radius:8px}
.announcement-timeline-copy>.liv-button,.announcement-timeline-copy>a{margin-top:12px}
.announcement-timeline-muted,.announcement-timeline-error{color:var(--liv-account-muted);font-size:14px}.announcement-feed-sentinel{height:1px}
.announcement-timeline-loading{display:grid;grid-template-columns:160px minmax(0,1fr);gap:36px}.announcement-date-placeholder{height:20px;width:120px}.announcement-title-placeholder{height:28px;width:60%;margin-bottom:20px}.announcement-body-placeholder{height:160px;width:100%}
@media(max-width:640px){.announcement-timeline-page>h1{margin-bottom:24px}.announcement-timeline-item,.announcement-timeline-loading{grid-template-columns:minmax(0,1fr);gap:12px}.announcement-timeline-item{margin-bottom:28px;padding-bottom:28px}.announcement-timeline-copy>h2{font-size:18px;margin-bottom:16px}}
</style>
