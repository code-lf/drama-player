<script setup lang="ts">
import type {SystemAnnouncement} from '~/entities/announcement/types'
import {useAuthStore} from '~/features/auth/store/useAuthStore'
import {announcementService} from '~/shared/api/services/announcementService'
import {ANNOUNCEMENT_READ_CHANGED_EVENT,restoreAnnouncementReadIds} from '~/shared/utils/announcementReadState'
const auth=useAuthStore(),router=useRouter()
const announcements=ref<SystemAnnouncement[]>([]),readIds=ref(new Set<string>())
const owner=computed(()=>auth.session.user?.id||'guest')
const unreadCount=computed(()=>announcements.value.filter(item=>!readIds.value.has(item.id)).length)
let revision=0
function restoreRead(){readIds.value=restoreAnnouncementReadIds(owner.value)}
/** 铃铛直接进入全部公告，不再自动弹详情或叠加预览弹窗。 */
async function load(){const current=++revision,key=owner.value;announcements.value=[];restoreRead();try{const items=await announcementService.getActive('global');if(current===revision&&key===owner.value)announcements.value=items}catch{/* 读取失败不阻断公告页入口，也不显示虚假未读数量。 */}}
watch(owner,()=>{if(import.meta.client)void load()})
onMounted(()=>{void load();window.addEventListener(ANNOUNCEMENT_READ_CHANGED_EVENT,restoreRead)})
onBeforeUnmount(()=>{revision++;window.removeEventListener(ANNOUNCEMENT_READ_CHANGED_EVENT,restoreRead)})
</script>
<template>
  <UButton class="announcement-bell" color="neutral" variant="soft" square aria-label="全部公告" title="全部公告" @click="router.push('/dashboard-announcements')">
    <UIcon name="i-lucide-bell" aria-hidden="true"/>
    <span v-if="unreadCount" class="announcement-unread">{{unreadCount>9?'9+':unreadCount}}</span>
  </UButton>
</template>
<style scoped>
.announcement-bell{position:relative;display:flex;align-items:center;justify-content:center;width:var(--liv-topbar-control-height);height:var(--liv-topbar-control-height);padding:0!important;border-radius:999px;background:var(--liv-account-raised)!important;color:var(--liv-account-text)!important}
.announcement-bell>.iconify{width:18px;height:18px}
.announcement-unread{position:absolute;top:-3px;right:-3px;min-width:15px;height:15px;padding:0 3px;display:grid;place-items:center;border-radius:999px;background:var(--liv-accent);color:var(--liv-settings-text);font-size:10px;font-weight:700}
</style>
