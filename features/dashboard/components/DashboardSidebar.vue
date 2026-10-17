<script setup lang="ts">
import SidebarIcon from './SidebarIcon.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import { libraryService } from '~/shared/api/services/libraryService'
import { creationService } from '~/shared/api/services/creationService'
import {creationProjectService} from '~/shared/api/services/creationProjectService'
import {projectDestination,type CreationProjectCard} from '~/features/projects/types'
import { skillCenterService } from '~/shared/api/services/skillCenterService'
import { requestFeatureConsent } from '~/shared/legal/featureConsent'
import type { CreationSession } from '~/features/creation/types'
import {appendSessionPage,SESSION_PAGE_SIZE} from '../sessionPagination'
const { $siteAsset: siteAsset } = useNuxtApp()
const props = defineProps<{
  sessionsOnly?: boolean
  embedded?: boolean
  activeMenu: 'drama' | 'product' | 'product-video' | 'music' | 'none'
  activeWorkspaceView: 'console' | 'projects' | 'exports' | 'billing' | 'announcements' | 'help' | 'library' | 'skills'
  billingView: 'recharge' | 'orders' | 'invoices'
  currentCreditBalance: number | string
  loggedIn: boolean
  nickname: string
  avatarUrl?: string
  themeMode: 'dark' | 'light'
}>()
const emit = defineEmits<{ interaction: [busy:boolean]; requestFeedback: []; featureMenuClick: [menu: 'drama' | 'product' | 'product-video' | 'music'] }>()
const route = useRoute()
const { auth, requireLogin } = useWorkbenchAuth()
/** 私人菜单先登录，取消时保留当前路由与草稿；公开工作台和技能仍可浏览。 */
function guardPrivateMenu(event: MouseEvent) {
  const link = (event.target as Element).closest('a')
  const destination = link?.getAttribute('href') || ''
  if (/^\/dashboard-(library|projects|billing|exports)(?:[/?#]|$)/.test(destination) && !requireLogin(destination)) {
    event.preventDefault()
    event.stopPropagation()
  }
}
const mobileOpen = ref(false)
const libraryEnabled = ref(false)
const resources = ref({help_url:'',follow_qr:'',creator_document_codes:[] as string[]}), showQr = ref(false)
const creationSessions = useState<CreationSession[]>('creation-recent-sessions', () => [])
// 最近列表和“我的项目”读取同一聚合接口；保留旧会话缓存供工作台标题与恢复使用。
const recentProjects=useState<CreationProjectCard[]>('creation-recent-projects',()=>[])
const directoryRevision=useState<number>('creation-project-directory-revision',()=>0)
// 可见条数与服务器读取偏移独立保存，其他工作区刷新共享缓存时不提前展开全部会话。
const recentSessionLimit = ref(SESSION_PAGE_SIZE), sessionOffset=ref(0), moreSessionsAvailable=ref(false)
const sessionsBusy=ref(false),sessionsError=ref('')
let sidebarRevision=0
const recentSessions = computed(() => recentProjects.value.slice(0, recentSessionLimit.value))
const hasMoreSessions = computed(() => moreSessionsAvailable.value || recentProjects.value.length>recentSessionLimit.value)
const openSessionMenu=ref(''),renameTarget=ref<Pick<CreationSession,'id'|'title'>|null>(null),renameTitle=ref(''),renameBusy=ref(false),renameError=ref('')
// 操作菜单和重命名期间保持父浮层，传送层获取焦点时不能卸载列表。
watch(()=>!!openSessionMenu.value||!!renameTarget.value,value=>emit('interaction',value))
let menuCloseTimer:ReturnType<typeof setTimeout>|undefined
/** 标题的历史换行仅在单行导航中合并，原记录不做截短或覆盖。 */
const sessionLabel=(title:string)=>title.replace(/\s+/g,' ').trim()
/** 鼠标可从三点跨过锚点间隙进入菜单，键盘与触屏仍可点击展开。 */
function holdSessionMenu(id:string){clearTimeout(menuCloseTimer);openSessionMenu.value=id}
function leaveSessionMenu(){clearTimeout(menuCloseTimer);menuCloseTimer=setTimeout(()=>{openSessionMenu.value=''},180)}
function beginRename(item:CreationProjectCard){const session=item.sessions[0];if(!session)return;openSessionMenu.value='';renameTarget.value={id:session.id,title:session.title};renameTitle.value=sessionLabel(session.title);renameError.value=''}
/** 只展示已接入能力；多个关联会话仍可逐一打开，不把短剧重命名误写到会话。 */
function sessionMenu(item:CreationProjectCard){return [
  ...(item.sessions.length?[{label:item.kind==='drama'?'重命名最近对话':'重命名',icon:'i-lucide-pencil',onSelect:()=>beginRename(item)}]:[]),
  ...(item.kind==='drama'?[{label:'进入短剧制作',icon:'i-lucide-clapperboard',to:`/drama/${encodeURIComponent(item.projectId)}?from=dashboard-projects`}]:[]),
  ...item.sessions.map((session,index)=>({label:item.sessions.length>1?`打开对话 ${index+1}`:'继续对话',icon:'i-lucide-messages-square',to:`/dashboard?session=${session.id}`})),
]}
/** 只在请求成功后替换共享缓存；失败时保留表单，允许重试。 */
async function saveSessionName(){
  if(!renameTarget.value || renameBusy.value || !renameTitle.value.trim())return
  renameBusy.value=true;renameError.value=''
  const owner=auth.session.user?.id
  try{const saved=await creationService.renameSession(renameTarget.value.id,renameTitle.value.trim());if(owner!==auth.session.user?.id)return;creationSessions.value=creationSessions.value.map(item=>item.id===saved.id?{...item,...saved}:item);recentProjects.value=recentProjects.value.map(item=>({...item,title:item.kind==='creation'&&item.sessions.some(session=>session.id===saved.id)?saved.title:item.title,sessions:item.sessions.map(session=>session.id===saved.id?{...session,title:saved.title}:session)}));renameTarget.value=null;directoryRevision.value++}
  catch(error){if(owner===auth.session.user?.id)renameError.value=error instanceof Error?error.message:'名称保存失败，请重试。'}
  finally{renameBusy.value=false}
}
onBeforeUnmount(()=>{++sidebarRevision;clearTimeout(menuCloseTimer)})
/** “更多”只补下一页，不跳转项目页；换号后的迟到响应不得写入当前账号。 */
async function loadMoreSessions(){
  if(sessionsBusy.value || !props.loggedIn)return
  const revision=sidebarRevision,owner=auth.session.user?.id
  sessionsBusy.value=true;sessionsError.value=''
  try{
    const result=await creationProjectService.list(SESSION_PAGE_SIZE+1,sessionOffset.value)
    if(revision!==sidebarRevision || owner!==auth.session.user?.id)return
    const next=appendSessionPage(recentSessions.value,result.items)
    recentProjects.value=next.sessions;recentSessionLimit.value=next.sessions.length
    sessionOffset.value+=next.consumed;moreSessionsAvailable.value=next.hasMore
  }catch{if(revision===sidebarRevision)sessionsError.value='项目加载失败，请重试。'}
  finally{if(revision===sidebarRevision)sessionsBusy.value=false}
}
// 每个工作区复用同一菜单，直接进入项目页或资料库也读取最近会话。
async function loadSidebar() {
  const revision=++sidebarRevision,owner=auth.session.user?.id
  sessionsBusy.value=true;sessionsError.value='';recentSessionLimit.value=SESSION_PAGE_SIZE;sessionOffset.value=0
  const results = await Promise.allSettled([libraryService.capabilities(), props.loggedIn ? creationProjectService.list(SESSION_PAGE_SIZE+1) : Promise.resolve({items:[] as CreationProjectCard[]})])
  if(revision!==sidebarRevision || owner!==auth.session.user?.id)return
  if (results[0].status === 'fulfilled') libraryEnabled.value = results[0].value.enabled
  if (results[1].status === 'fulfilled') {
    const next=appendSessionPage([],results[1].value.items)
    recentProjects.value=next.sessions;sessionOffset.value=next.consumed;moreSessionsAvailable.value=next.hasMore
  }else sessionsError.value='项目加载失败，请重试。'
  sessionsBusy.value=false
  if(props.loggedIn){try { const nextResources = await skillCenterService.resources();if(revision===sidebarRevision&&owner===auth.session.user?.id)resources.value=nextResources } catch { /* 未配置时保持禁用。 */ }}
}
onMounted(loadSidebar)
// 其他目录实例删除或重命名后，最近入口重新读取服务端事实，不保留失效卡片。
watch(directoryRevision,()=>{openSessionMenu.value='';void loadSidebar()})
watch(()=>[props.loggedIn,auth.session.user?.id],()=>{creationSessions.value=[];recentProjects.value=[];openSessionMenu.value='';renameTarget.value=null;showQr.value=false;moreSessionsAvailable.value=false;void loadSidebar()})
watch(() => route.fullPath, () => { mobileOpen.value = false })
// 显式选中当前工作区，避免包含查询参数的工作台链接在其他页面仍高亮。
const isWorkbench = computed(() => props.activeWorkspaceView === 'console' && !route.query.session)
const billingItems = [
  { label: '积分充值', view: 'recharge', to: '/dashboard-billing', icon: 'i-lucide-coins' },
  { label: '订单记录', view: 'orders', to: '/dashboard-billing?view=orders', icon: 'i-lucide-receipt' },
  { label: '发票管理', view: 'invoices', to: '/dashboard-billing?view=invoices', icon: 'i-lucide-file-text' }
]
</script>
<template>
  <button v-if="!sessionsOnly && !embedded" class="creation-mobile-menu" aria-label="打开创作导航" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen"><SidebarIcon :name="mobileOpen ? 'i-lucide-x' : 'i-lucide-menu'" /></button>
  <div v-if="mobileOpen" class="creation-sidebar-backdrop" @click="mobileOpen = false" />
  <aside class="dashboard-sidebar dashboard-sidebar--dark dashboard-sidebar--compact" :class="{ 'is-mobile-open': mobileOpen, 'is-sessions-only': sessionsOnly, 'is-embedded': embedded }" @click.capture="guardPrivateMenu">
    <NuxtLink v-if="!sessionsOnly" to="/dashboard?entry=free" class="liv-sidebar-brand"><img :src="siteAsset('/branding/livliv-logo.jpeg')" alt="Livliv Logo"><div><p class="dashboard-brand-title">Livliv</p><p class="dashboard-brand-subtitle">短剧创作平台</p></div></NuxtLink>
    <nav v-if="!sessionsOnly" class="liv-sidebar-primary" aria-label="创作导航">
      <NuxtLink to="/dashboard?entry=free" class="liv-sidebar-item" :class="{ 'is-active': isWorkbench }"><SidebarIcon name="i-lucide-panels-top-left" /><span>Liv 工作台</span></NuxtLink>
      <NuxtLink v-if="libraryEnabled" to="/dashboard-library" class="liv-sidebar-item" :class="{ 'is-active': activeWorkspaceView === 'library' }"><SidebarIcon name="i-lucide-folder-open" /><span>资料库</span></NuxtLink>
      <NuxtLink to="/dashboard-skills" class="liv-sidebar-item" :class="{ 'is-active': activeWorkspaceView === 'skills' }"><SidebarIcon name="i-lucide-zap" /><span>技能</span></NuxtLink>
    </nav>
    <hr v-if="!sessionsOnly" class="creation-sidebar-divider">
    <h3 v-if="sessionsOnly" class="liv-sidebar-session-heading">最近项目</h3>
    <NuxtLink v-if="sessionsOnly" class="liv-sidebar-item" to="/dashboard?entry=free&new=1"><SidebarIcon name="i-lucide-plus"/>新建创作</NuxtLink>
    <nav class="liv-sidebar-projects" aria-label="项目导航">
      <NuxtLink to="/dashboard-projects" class="liv-sidebar-item" :class="{ 'is-active': activeWorkspaceView === 'projects' }"><SidebarIcon name="i-lucide-folder" /><span>我的项目</span><SidebarIcon class="liv-sidebar-project-arrow" name="i-lucide-chevron-right" /></NuxtLink>
      <div class="creation-sidebar-recent" aria-label="最近项目" :aria-busy="sessionsBusy">
        <!-- 会话区域占剩余高度并独立滚动，不推动品牌、菜单和底部工具。 -->
        <DashboardSkeleton v-if="sessionsBusy && !recentSessions.length" variant="rows" :rows="3" :heading="false"/>
        <p v-if="!sessionsBusy && !sessionsError && !recentSessions.length" class="liv-sidebar-session-error">暂无最近项目。</p>
        <div v-for="item in recentSessions" :key="item.id" class="liv-session-row" :class="{'is-active':item.sessions.some(session=>session.id===route.query.session)||route.params.projectId===item.projectId,'is-menu-open':openSessionMenu===item.id}">
          <NuxtLink :title="sessionLabel(item.title)" :to="projectDestination(item)"><SidebarIcon :name="item.kind==='drama'?'i-lucide-clapperboard':'i-lucide-messages-square'" /><span class="liv-session-title">{{sessionLabel(item.title)}}</span></NuxtLink>
          <UDropdownMenu :open="openSessionMenu===item.id" :items="sessionMenu(item)" :content="{side:'right',align:'start',sideOffset:8,onPointerEnter:()=>holdSessionMenu(item.id),onPointerLeave:leaveSessionMenu}" :ui="{content:'liv-session-actions-menu min-w-52',item:'min-h-9 text-sm'}" @update:open="openSessionMenu=$event?item.id:''">
            <UButton class="liv-session-actions" icon="i-lucide-ellipsis" color="neutral" variant="ghost" square :aria-label="`会话菜单：${sessionLabel(item.title)}`" @mouseenter="holdSessionMenu(item.id)" @mouseleave="leaveSessionMenu"/>
          </UDropdownMenu>
        </div>
      </div>
      <p v-if="sessionsError" class="liv-sidebar-session-error" role="alert">{{sessionsError}}</p>
      <UButton v-if="hasMoreSessions || sessionsError" class="creation-sidebar-more" color="neutral" variant="ghost" :loading="sessionsBusy" :disabled="sessionsBusy" @click="loadMoreSessions">更多</UButton>
      <template v-if="activeWorkspaceView === 'billing'">
        <NuxtLink v-for="item in billingItems" :key="item.view" :to="item.to" class="liv-sidebar-item" :class="{ 'is-active': billingView === item.view }"><SidebarIcon :name="item.icon" /><span>{{ item.label }}</span></NuxtLink>
      </template>
      <NuxtLink v-if="activeWorkspaceView === 'exports'" to="/dashboard-exports" class="liv-sidebar-item is-active"><SidebarIcon name="i-lucide-download" /><span>我的导出</span></NuxtLink>
    </nav>
    <nav v-if="!sessionsOnly" class="liv-sidebar-bottom" aria-label="帮助与协议">
      <a v-if="resources.help_url" :href="resources.help_url" target="_blank" rel="noopener noreferrer" title="帮助" aria-label="帮助"><SidebarIcon name="i-lucide-circle-help" /></a><button v-else disabled title="帮助未配置" aria-label="帮助未配置"><SidebarIcon name="i-lucide-circle-help" /></button>
      <button title="创作者协议" aria-label="创作者协议" :disabled="!resources.creator_document_codes.length" @click="requestFeatureConsent(resources.creator_document_codes)"><SidebarIcon name="i-lucide-file-text" /></button>
      <button :disabled="!resources.follow_qr" :title="resources.follow_qr?'扫码关注':'关注二维码未配置'" aria-label="扫码关注" @click="showQr=!showQr"><SidebarIcon name="i-lucide-qr-code" /></button>
      <div v-if="showQr && resources.follow_qr" class="follow-card"><img :src="resources.follow_qr" alt="官方关注二维码"><p>扫码关注，获取官方资讯</p></div>
    </nav>
  </aside>
  <LivDialog :open="!!renameTarget" settings dark title="重命名会话" width="sm" @update:open="!$event && !renameBusy && (renameTarget=null)">
    <form id="rename-session-form" @submit.prevent="saveSessionName"><label class="liv-settings-copy" for="rename-session-title">会话名称</label><UInput id="rename-session-title" v-model="renameTitle" :maxlength="160" :disabled="renameBusy" class="w-full" autofocus/><p v-if="renameError" role="alert" class="liv-settings-note">{{renameError}}</p></form>
    <template #footer><LivButton settings variant="primary" block type="submit" form="rename-session-form" :loading="renameBusy" :disabled="!renameTitle.trim()">保存</LivButton></template>
  </LivDialog>
</template>
<style scoped>
/* 主菜单统一字号、图标与左留白；仅会话和更多使用小字号。 */
.dashboard-sidebar{display:flex;flex-direction:column;flex-shrink:0;width:212px;height:100dvh;min-height:0;padding:16px 14px;background:#0e0e10!important;color:#d4d4dc;border-right:1px solid #ffffff26!important;overflow:hidden!important}
/* 最近会话浮层复用同一列表、分页与重命名，不额外创建第二套会话数据源。 */
.liv-sidebar-session-heading{font-size:16px;font-weight:600;padding:4px 8px 12px}
.dashboard-sidebar.is-embedded{position:relative!important;inset:auto!important;transform:none!important;width:100%;height:100%;padding-top:16px!important}
.dashboard-sidebar.is-sessions-only{position:relative!important;inset:auto!important;transform:none!important;width:min(300px,calc(100vw - 24px));height:min(560px,70dvh);padding:12px;border:0!important;border-radius:16px;background:var(--liv-workspace-surface)!important}
.liv-sidebar-brand,.liv-sidebar-primary,.creation-sidebar-divider,.liv-sidebar-bottom{flex:none}
.liv-sidebar-projects{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.liv-sidebar-projects>.liv-sidebar-item{flex:none}
.liv-sidebar-projects .creation-sidebar-recent{flex:1;min-height:0;margin:8px 0 0!important;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.creation-sidebar-more{flex:none;justify-content:flex-start;width:100%;min-height:36px;margin-top:8px}
.liv-sidebar-session-error{flex:none;font-size:12px;line-height:1.5;padding:4px 8px}
.liv-session-menu-note{margin:0;padding:8px 12px;font-size:12px;line-height:1.5;color:var(--liv-settings-muted);border-top:1px solid var(--color-border-soft)}
.liv-sidebar-brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.liv-sidebar-brand img{width:48px;height:48px;border-radius:12px;object-fit:cover}
.dashboard-brand-title{margin:0;font-size:20px;font-weight:800;color:#fff}
.dashboard-brand-subtitle{margin:4px 0 0;font-size:12px;color:#a6a6b0}
.liv-sidebar-primary{margin-top:35px;display:grid;gap:6px}
.liv-sidebar-item{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:0 14px;border:0;border-radius:11px;background:transparent;font-size:15px;font-weight:600;text-align:left;color:#d4d4dc;text-decoration:none;cursor:pointer}
.liv-sidebar-item>.iconify{width:20px;height:20px;flex:none}
.liv-sidebar-item:hover,.creation-sidebar-recent a:hover{background:#222225!important;color:#fff!important}
.liv-sidebar-item.is-active,.creation-sidebar-recent .is-active{background:#29292e!important;color:#fff!important}
.creation-sidebar-divider{margin:26px 0 16px;border:0;border-top:1px solid #ffffff26}
.creation-sidebar-recent{margin:8px 0 20px!important}
.creation-sidebar-recent a{display:flex;flex:1;min-width:0;padding:10px 8px;gap:8px;font-size:13px;line-height:20px}
/* 三点独立于标题省略号；未悬停时标题占满可用宽度，出现操作按钮时才让出空间。 */
.liv-session-row{display:flex;align-items:center;min-width:0;border-radius:9px}
.liv-session-row:hover,.liv-session-row:focus-within,.liv-session-row.is-menu-open{background:var(--liv-session-hover)}
.liv-session-row .liv-session-actions{display:none;flex:none;width:28px;min-width:28px;height:28px;padding:4px!important;margin-right:4px}
.liv-session-row:hover .liv-session-actions,.liv-session-row:focus-within .liv-session-actions,.liv-session-row.is-menu-open .liv-session-actions{display:inline-flex}
.creation-sidebar-recent .liv-session-title{display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
@media(hover:none){.liv-session-row .liv-session-actions{display:inline-flex}}
.creation-sidebar-recent .iconify{width:16px;height:16px;flex:none}
.creation-sidebar-recent span:not(.iconify){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.liv-sidebar-item>.liv-sidebar-project-arrow{margin-left:auto;width:16px;height:16px;color:#96969f}
.liv-sidebar-bottom{position:relative;margin-top:auto;padding-top:24px;display:flex;justify-content:space-around;gap:6px}.liv-sidebar-bottom button,.liv-sidebar-bottom a{border:0;background:transparent;color:#a6a6b0;padding:9px;cursor:pointer}.liv-sidebar-bottom button:disabled{opacity:.3;cursor:not-allowed}.follow-card{position:absolute;bottom:50px;left:0;background:#26262c;border:1px solid #444;border-radius:14px;padding:14px;width:190px;z-index:150}.follow-card img{width:160px;height:160px;object-fit:contain}.follow-card p{font-size:11px;text-align:center}
@media(max-width:900px){.dashboard-sidebar{position:fixed;z-index:149;transform:translateX(-100%);transition:transform .2s}.dashboard-sidebar.is-mobile-open{transform:translateX(0)}}
</style>
