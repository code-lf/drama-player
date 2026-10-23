<script setup lang="ts">
import SidebarIcon from './SidebarIcon.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import { libraryService } from '~/shared/api/services/libraryService'
import {useProjectRecycleBin} from '~/composables/useProjectRecycleBin'
import {creationProjectService} from '~/shared/api/services/creationProjectService'
import {projectDestination,type CreationProjectCard} from '~/features/projects/types'
import { skillCenterService } from '~/shared/api/services/skillCenterService'
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
const recycleBin=useProjectRecycleBin(),toast=useToast()
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
const mobileMenuTrigger=ref<HTMLButtonElement|null>(null)
const mobileSidebar=ref<HTMLElement|null>(null)
// 切换按钮位置后同步键盘焦点，关闭或遮罩退出仍回到原展开入口。
watch(mobileOpen,async value=>{await nextTick();if(value)mobileSidebar.value?.querySelector<HTMLButtonElement>('.creation-sidebar-close')?.focus();else mobileMenuTrigger.value?.focus()})
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
const recentScroll=ref<HTMLElement|null>(null),recentRows=ref<HTMLElement|null>(null),listFilled=ref(false)
let capacityObserver:ResizeObserver|undefined
/** 高屏先补足可见空间，更多按钮位于列表尾部，不固定在空白区域底端。 */
async function updateSessionCapacity(){
  await nextTick()
  if(!recentScroll.value||!recentRows.value)return
  listFilled.value=recentRows.value.scrollHeight>=recentScroll.value.clientHeight-40
  if(!listFilled.value&&hasMoreSessions.value&&!sessionsBusy.value&&!sessionsError.value)void loadMoreSessions()
}
watch(()=>[recentSessions.value.length,sessionsBusy.value,moreSessionsAvailable.value],updateSessionCapacity,{flush:'post'})
onMounted(()=>{capacityObserver=new ResizeObserver(()=>void updateSessionCapacity());if(recentScroll.value)capacityObserver.observe(recentScroll.value)})
onBeforeUnmount(()=>capacityObserver?.disconnect())
const hasMoreSessions = computed(() => moreSessionsAvailable.value || recentProjects.value.length>recentSessionLimit.value)
const openSessionMenu=ref(''),renameTarget=ref<CreationProjectCard|null>(null),renameTitle=ref(''),renameBusy=ref(false),renameError=ref('')
const deleteTarget=ref<CreationProjectCard|null>(null),deleteBusy=ref(false),deleteError=ref('')
const coverTarget=ref<CreationProjectCard|null>(null),coverFile=ref<File|null>(null),coverBusy=ref(false),coverError=ref(''),favoriteBusy=ref('')
// 操作菜单和重命名期间保持父浮层，传送层获取焦点时不能卸载列表。
watch(()=>!!openSessionMenu.value||!!renameTarget.value||!!deleteTarget.value||!!coverTarget.value,value=>emit('interaction',value))
/** 标题的历史换行仅在单行导航中合并，原记录不做截短或覆盖。 */
const sessionLabel=(title:string)=>title.replace(/\s+/g,' ').trim()
function beginRename(item:CreationProjectCard){openSessionMenu.value='';renameTarget.value=item;renameTitle.value=sessionLabel(item.title);renameError.value=''}
/** 旧菜单的延迟关闭只能关闭自身，避免快速移入下一行时清掉刚打开的新菜单。 */
function updateSessionMenu(id:string,open:boolean){
  if(open)openSessionMenu.value=id
  else if(openSessionMenu.value===id)openSessionMenu.value=''
}
/** 菜单四个动作均接真实目录接口，不重复继续对话；底层制作入口仍由项目卡保留。 */
function sessionMenu(item:CreationProjectCard){return [
  {label:'重命名',icon:'i-lucide-pencil',onSelect:()=>beginRename(item)},
  {label:'修改封面',icon:'i-lucide-image',onSelect:()=>{coverTarget.value=item;coverFile.value=null;coverError.value=''}},
  {label:item.isFavorite?'取消收藏':'收藏',icon:'i-lucide-star',onSelect:()=>void toggleFavorite(item)},
  {label:'删除项目',icon:'i-lucide-trash-2',color:'error' as const,onSelect:()=>{deleteError.value='';deleteTarget.value=item}},
]}
/** 统一软删除进入回收站；不调用旧短剧永久删除接口。 */
async function confirmDeleteProject(){
  const item=deleteTarget.value,owner=auth.session.user?.id
  if(!item||deleteBusy.value)return
  deleteBusy.value=true;deleteError.value=''
  try{await recycleBin.remove(item);if(owner!==auth.session.user?.id)return;deleteTarget.value=null}
  catch(error){if(owner===auth.session.user?.id)deleteError.value=error instanceof Error?error.message:'删除失败，请重试。'}
  finally{deleteBusy.value=false}
}
/** 收藏只在保存成功后刷新排序，失败不假装选中。 */
async function toggleFavorite(item:CreationProjectCard){
  if(favoriteBusy.value)return
  const owner=auth.session.user?.id;favoriteBusy.value=item.id
  try{await creationProjectService.patch(item,{is_favorite:!item.isFavorite});if(owner===auth.session.user?.id)directoryRevision.value++}
  catch(error){if(owner===auth.session.user?.id)toast.add({title:'收藏未保存',description:error instanceof Error?error.message:'请重试',color:'error'})}
  finally{favoriteBusy.value=''}
}
/** 封面复用资料库上传、格式校验与固定版本引用，不接受任意外部URL。 */
async function saveCover(reset=false){
  const item=coverTarget.value,owner=auth.session.user?.id,file=coverFile.value
  if(!item||coverBusy.value||(!reset&&!file))return
  coverBusy.value=true;coverError.value=''
  try{
    let cover=null
    if(!reset&&file){
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('请选择5MB以内的JPG、PNG、WebP图片。')
      const saved=await libraryService.upload(file,'other')
      if(owner!==auth.session.user?.id||coverTarget.value?.id!==item.id)return
      const version=saved.versions[0];if(!version)throw new Error('图片版本尚未就绪，请重试。')
      cover={item_id:saved.id,version_id:version.id,purpose:'project_cover'}
    }
    await creationProjectService.patch(item,{cover})
    if(owner===auth.session.user?.id){directoryRevision.value++;coverTarget.value=null;coverFile.value=null}
  }catch(error){if(owner===auth.session.user?.id)coverError.value=error instanceof Error?error.message:'封面保存失败，请重试。'}
  finally{coverBusy.value=false}
}
/** 只在请求成功后替换共享缓存；失败时保留表单，允许重试。 */
async function saveSessionName(){
  if(!renameTarget.value || renameBusy.value || !renameTitle.value.trim())return
  renameBusy.value=true;renameError.value=''
  const owner=auth.session.user?.id
  try{const item=renameTarget.value;await creationProjectService.patch(item,{title:renameTitle.value.trim()});if(owner!==auth.session.user?.id)return;renameTarget.value=null;directoryRevision.value++}
  catch(error){if(owner===auth.session.user?.id)renameError.value=error instanceof Error?error.message:'名称保存失败，请重试。'}
  finally{renameBusy.value=false}
}
onBeforeUnmount(()=>{++sidebarRevision})
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
// 分别比较登录态与账号编号；余额刷新替换同一用户对象时不能清空并重读会话。
watch([()=>props.loggedIn,()=>auth.session.user?.id],()=>{creationSessions.value=[];recentProjects.value=[];openSessionMenu.value='';renameTarget.value=null;deleteTarget.value=null;coverTarget.value=null;coverFile.value=null;showQr.value=false;moreSessionsAvailable.value=false;void loadSidebar()})
watch(() => route.fullPath, () => { mobileOpen.value = false })
// 显式选中当前工作区，避免包含查询参数的工作台链接在其他页面仍高亮。
const isWorkbench = computed(() => props.activeWorkspaceView === 'console' && !route.query.session)
</script>
<template>
  <button v-if="!sessionsOnly && !embedded" v-show="!mobileOpen" ref="mobileMenuTrigger" class="creation-mobile-menu" aria-label="打开创作导航" :aria-expanded="mobileOpen" @click="mobileOpen = true"><SidebarIcon name="i-lucide-menu" /></button>
  <div v-if="mobileOpen" class="creation-sidebar-backdrop" @click="mobileOpen = false" />
  <aside ref="mobileSidebar" class="dashboard-sidebar dashboard-sidebar--dark dashboard-sidebar--compact" :class="{ 'is-mobile-open': mobileOpen, 'is-sessions-only': sessionsOnly, 'is-embedded': embedded }" @click.capture="guardPrivateMenu" @keydown.esc="mobileOpen=false">
    <!-- 关闭键以侧栏自身为定位容器，放在右上角，不复用左上角的导航展开键遮挡 Logo。 -->
    <UButton v-if="mobileOpen && !sessionsOnly && !embedded" class="creation-sidebar-close" color="neutral" variant="ghost" square icon="i-lucide-x" aria-label="关闭创作导航" @click="mobileOpen=false"/>
    <!-- 品牌说明覆盖图片、视频、音乐等现有能力，保持原 Logo、字号和首页导航行为。 -->
    <NuxtLink v-if="!sessionsOnly" to="/dashboard?entry=free" class="liv-sidebar-brand"><img :src="siteAsset('/branding/livliv-logo.jpeg')" alt="Livliv Logo"><div><p class="dashboard-brand-title">Livliv</p><p class="dashboard-brand-subtitle">AI 创作平台</p></div></NuxtLink>
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
      <div ref="recentScroll" class="creation-sidebar-recent" aria-label="最近项目" :aria-busy="sessionsBusy">
        <!-- 会话区域占剩余高度并独立滚动，不推动品牌、菜单和底部工具。 -->
        <DashboardSkeleton v-if="sessionsBusy && !recentSessions.length" variant="rows" :rows="3" :heading="false"/>
        <!-- 游客没有私人项目目录，不展示登录后的空列表提示。 -->
        <p v-if="loggedIn && !sessionsBusy && !sessionsError && !recentSessions.length" class="liv-sidebar-session-error">暂无最近项目。</p>
        <div ref="recentRows"><div v-for="item in recentSessions" :key="item.id" class="liv-session-row" :class="{'is-active':item.sessions.some(session=>session.id===route.query.session)||route.params.projectId===item.projectId,'is-menu-open':openSessionMenu===item.id}">
          <NuxtLink :title="sessionLabel(item.title)" :to="projectDestination(item)">
            <!-- 复用目录真实作品封面；UAvatar 自带图片错误回退，缺图不额外读取私人任务。 -->
            <UAvatar as="div" class="liv-session-cover" :src="item.coverImageUrl || undefined" :icon="item.kind==='drama'?'i-lucide-clapperboard':'i-lucide-messages-square'" alt="" size="xs" :ui="{root:'rounded-lg',icon:'size-4'}" loading="lazy" decoding="async" aria-hidden="true"/>
            <span class="liv-session-title">{{sessionLabel(item.title)}}</span>
            <UIcon v-if="item.isFavorite" name="i-lucide-star" class="liv-session-favorite" aria-label="已收藏"/>
          </NuxtLink>
          <!-- 使用组件原生HoverCard处理触发器、间隙和内容的悬停范围，业务层不写离开计时器。 -->
          <UPopover mode="hover" :open-delay="0" :close-delay="200" :open="openSessionMenu===item.id" :content="{side:'right',align:'start',sideOffset:8}" :ui="{content:'liv-session-actions-menu'}" @update:open="updateSessionMenu(item.id,$event)">
            <UButton class="liv-session-actions" icon="i-lucide-ellipsis" color="neutral" variant="ghost" square :aria-label="`会话菜单：${sessionLabel(item.title)}`"/>
            <template #content><nav class="liv-session-menu-actions" aria-label="项目操作"><UButton v-for="action in sessionMenu(item)" :key="action.label" :icon="action.icon" :color="'color' in action ? action.color : 'neutral'" variant="ghost" class="liv-session-menu-item" @click="()=>{openSessionMenu='';action.onSelect()}">{{action.label}}</UButton></nav></template>
          </UPopover>
        </div>
        </div>
        <UButton v-if="hasMoreSessions && listFilled" class="creation-sidebar-more" color="neutral" variant="ghost" :loading="sessionsBusy" :disabled="sessionsBusy" @click="loadMoreSessions">更多</UButton>
      </div>
      <p v-if="sessionsError" class="liv-sidebar-session-error" role="alert">{{sessionsError}}</p>
      <UButton v-if="sessionsError" class="creation-sidebar-more" color="neutral" variant="ghost" :loading="sessionsBusy" :disabled="sessionsBusy" @click="loadMoreSessions">重试加载</UButton>
      <NuxtLink v-if="activeWorkspaceView === 'exports'" to="/dashboard-exports" class="liv-sidebar-item is-active"><SidebarIcon name="i-lucide-download" /><span>我的导出</span></NuxtLink>
    </nav>
    <nav v-if="!sessionsOnly" class="liv-sidebar-bottom" aria-label="帮助与协议">
      <a v-if="resources.help_url" :href="resources.help_url" target="_blank" rel="noopener noreferrer" title="帮助" aria-label="帮助"><SidebarIcon name="i-lucide-circle-help" /></a><button v-else disabled title="帮助未配置" aria-label="帮助未配置"><SidebarIcon name="i-lucide-circle-help" /></button>
      <NuxtLink to="/creator-agreement" title="创作者协议" aria-label="创作者协议"><SidebarIcon name="i-lucide-file-text" /></NuxtLink>
      <button :disabled="!resources.follow_qr" :title="resources.follow_qr?'扫码关注':'关注二维码未配置'" aria-label="扫码关注" @click="showQr=!showQr"><SidebarIcon name="i-lucide-qr-code" /></button>
      <div v-if="showQr && resources.follow_qr" class="follow-card"><img :src="resources.follow_qr" alt="官方关注二维码"><p>扫码关注，获取官方资讯</p></div>
    </nav>
  </aside>
  <LivDialog :open="!!renameTarget" settings dark title="重命名项目" width="sm" @update:open="!$event && !renameBusy && (renameTarget=null)">
    <form id="rename-session-form" @submit.prevent="saveSessionName"><label class="liv-settings-copy" for="rename-session-title">项目名称</label><UInput id="rename-session-title" v-model="renameTitle" :maxlength="160" :disabled="renameBusy" class="w-full" autofocus/><p v-if="renameError" role="alert" class="liv-settings-note">{{renameError}}</p></form>
    <template #footer><LivButton settings variant="primary" block type="submit" form="rename-session-form" :loading="renameBusy" :disabled="!renameTitle.trim()">保存</LivButton></template>
  </LivDialog>
  <LivDialog :open="!!deleteTarget" settings dark title="移入回收站" width="sm" @update:open="!$event&&!deleteBusy&&(deleteTarget=null)">
    <p class="liv-settings-copy">将此项目移入回收站？可以撤销或在回收站恢复，对话、制作数据和独立作品不会被清除。</p><p v-if="deleteError" role="alert" class="liv-settings-note">{{deleteError}}</p>
    <template #footer><LivButton settings variant="secondary" :disabled="deleteBusy" @click="deleteTarget=null">取消</LivButton><LivButton settings variant="primary" :loading="deleteBusy" @click="confirmDeleteProject">移入回收站</LivButton></template>
  </LivDialog>
  <LivDialog :open="!!coverTarget" settings dark title="修改封面" width="sm" @update:open="!$event&&!coverBusy&&(coverTarget=null)">
    <UFileUpload v-model="coverFile" accept="image/png,image/jpeg,image/webp" label="选择封面图片" description="JPG、PNG、WebP · 最大5MB" :disabled="coverBusy"/>
    <p v-if="coverError" class="liv-settings-note" role="alert">{{coverError}}</p>
    <template #footer><LivButton settings variant="secondary" :disabled="coverBusy" @click="saveCover(true)">恢复默认封面</LivButton><LivButton settings variant="primary" :disabled="!coverFile" :loading="coverBusy" @click="saveCover()">保存封面</LivButton></template>
  </LivDialog>
</template>
<style scoped>
/* 主菜单统一字号、图标与左留白；仅会话和更多使用小字号。 */
.dashboard-sidebar{display:flex;flex-direction:column;flex-shrink:0;width:212px;height:100dvh;min-height:0;padding:16px 14px;background:#0e0e10!important;color:#d4d4dc;border-right:1px solid #ffffff26!important;overflow:hidden!important}
/* 使用实际侧栏右边缘定位，宽度变化时不需要同步一份固定横坐标。 */
.creation-sidebar-close{position:absolute;top:13px;right:12px;z-index:1;display:grid;place-items:center;width:32px;height:32px;min-height:32px;padding:0;border-radius:8px;background:var(--liv-number-surface);color:var(--liv-chat-assistant-text)}
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
/* 三点始终保留命中位置，仅切换透明度，避免鼠标进入时重新排版造成漏触发。 */
.liv-session-row{display:flex;align-items:center;min-width:0;border-radius:9px}
.liv-session-row:hover,.liv-session-row:focus-within,.liv-session-row.is-menu-open{background:var(--liv-session-hover)}
.liv-session-row .liv-session-actions{display:inline-flex;opacity:0;flex:none;width:28px;min-width:28px;height:28px;padding:4px!important;margin-right:4px}
.liv-session-row:hover .liv-session-actions,.liv-session-row:focus-within .liv-session-actions,.liv-session-row.is-menu-open .liv-session-actions{opacity:1}
.creation-sidebar-recent .liv-session-title{display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
@media(hover:none){.liv-session-row .liv-session-actions{opacity:1}}
.creation-sidebar-recent .iconify{width:16px;height:16px;flex:none}
/* 封面固定占位，不挤压标题及三点菜单；无图图标与已加载缩略图保持同尺寸。 */
.creation-sidebar-recent .liv-session-cover{width:var(--liv-session-cover-size);height:var(--liv-session-cover-size);flex:0 0 var(--liv-session-cover-size);overflow:hidden;background:var(--color-surface-raised);color:var(--color-text-muted)}
.liv-session-cover :deep(img){width:100%;height:100%;object-fit:cover}
.creation-sidebar-recent span:not(.iconify){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.liv-sidebar-item>.liv-sidebar-project-arrow{margin-left:auto;width:16px;height:16px;color:#96969f}
.liv-sidebar-bottom{position:relative;margin-top:auto;padding-top:24px;display:flex;justify-content:space-around;gap:6px}.liv-sidebar-bottom button,.liv-sidebar-bottom a{border:0;background:transparent;color:#a6a6b0;padding:9px;cursor:pointer}.liv-sidebar-bottom button:disabled{opacity:.3;cursor:not-allowed}.follow-card{position:absolute;bottom:50px;left:0;background:#26262c;border:1px solid #444;border-radius:14px;padding:14px;width:190px;z-index:150}.follow-card img{width:160px;height:160px;object-fit:contain}.follow-card p{font-size:11px;text-align:center}
@media(max-width:900px){.dashboard-sidebar{position:fixed;z-index:149;transform:translateX(-100%);transition:transform .2s}.dashboard-sidebar.is-mobile-open{transform:translateX(0)}}
</style>
