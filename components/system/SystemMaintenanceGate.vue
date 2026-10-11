<script setup lang="ts">
import { request } from '~/shared/api/adapters/httpAdapter'
import { announcementExcerpt } from '~/shared/utils/announcementExcerpt'
interface MaintenanceItem {
  id: string; title: string; content: string; mode: 'full' | 'features'; starts_at: string
  estimated_resume_at: string | null; affected_features: string[]; blocking: boolean
  phase: 'scheduled' | 'active' | 'extended'; updated_at: string
}
const items = ref<MaintenanceItem[]>([])
const failed = ref(false)
const loading = ref(false)
const now = ref(Date.now())
const serverOffset = ref(0)
const route = useRoute()
const fullNotice = computed(() => items.value.find(item => item.mode === 'full' && item.blocking))
// 登录页含注册入口，充值中心保持开放；其余工作区以维护页替代，不让新用户无法注册。
const essentialPage = computed(() => ['/login', '/register', '/dashboard-billing'].includes(route.path.replace(/\/$/, '')))
const full = computed(() => essentialPage.value ? undefined : fullNotice.value)
const blocked = useState<boolean>('maintenance:full-blocked', () => false)
watch(full, value => { blocked.value = Boolean(value) }, { immediate: true })
const current = computed(() => fullNotice.value || items.value.find(item => item.blocking) || items.value[0])
const detailsOpen = ref(false)
let poll: ReturnType<typeof setInterval> | undefined
let clock: ReturnType<typeof setInterval> | undefined
const names: Record<string, string> = { drama: '短剧创作', image: '图片创作', video: '视频创作', music: '音乐生成' }
const remaining = computed(() => {
  const target = current.value?.estimated_resume_at
  if (!target) return '恢复时间待确认'
  const seconds = Math.ceil((new Date(target).getTime() - now.value) / 1000)
  if (seconds <= 0) return '恢复时间已延后，请等待最新进展'
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60)
  return `预计还需 ${hours ? `${hours} 小时 ` : ''}${minutes} 分钟 ${seconds % 60} 秒`
})
/** 按中国标准时间展示维护安排，倒计时只表达预计时长，不擅自恢复使用。 */
function time(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '待确认'
}
/** 断连时保留最近一次公告，不能把请求失败误判为维护已结束。 */
async function refresh(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const value = await request<{ server_time: string; items: MaintenanceItem[] }>('/system/maintenance')
    serverOffset.value = new Date(value.server_time).getTime() - Date.now()
    items.value = value.items; now.value = Date.now() + serverOffset.value; failed.value = false
    localStorage.setItem('livliv:maintenance:last-status', JSON.stringify(value))
  } catch { failed.value = true }
  finally { loading.value = false }
}
onMounted(() => {
  // 保存的仅是公开维护通知，不包含令牌、个人信息或业务数据。
  try {
    const saved = JSON.parse(localStorage.getItem('livliv:maintenance:last-status') || 'null')
    if (Array.isArray(saved?.items)) items.value = saved.items
  } catch { /* 损坏的浏览器缓存忽略，重新读取服务端状态。 */ }
  void refresh()
  poll = setInterval(() => { if (!document.hidden) void refresh() }, 30000)
  clock = setInterval(() => { now.value = Date.now() + serverOffset.value }, 1000)
  window.addEventListener('focus', refresh)
})
onBeforeUnmount(() => { blocked.value = false; if (poll) clearInterval(poll); if (clock) clearInterval(clock); window.removeEventListener('focus', refresh) })
</script>
<template>
  <Teleport to="body">
    <!-- 全站维护拦截使用，不提供关闭按钮；普通公告仍由原公告组件负责。 -->
    <div v-if="full" class="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-[#f4f8ff] p-6" role="dialog" aria-modal="true" aria-labelledby="maintenance-heading">
      <section class="w-full max-w-xl rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-xl">
        <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl text-blue-600">⚙</div>
        <p class="text-xs font-bold tracking-widest text-blue-600">LIVLIV · 系统维护</p>
        <h1 id="maintenance-heading" class="mt-3 text-2xl font-black text-slate-900">{{ full.title }}</h1>
        <p class="mt-4 whitespace-pre-line text-sm leading-7 text-slate-500">{{ announcementExcerpt(full.content) }}</p>
        <div class="mt-6 rounded-2xl bg-slate-50 p-5 text-sm"><p>预计恢复（北京时间）</p><p class="mt-2 font-bold text-blue-600">{{ time(full.estimated_resume_at) }}</p><p class="mt-2 text-xs text-slate-500">{{ remaining }}</p></div>
        <p class="mt-5 text-xs leading-6 text-slate-500">维护期间暂不可创作，注册、登录和充值仍可使用。恢复后自动返回当前页面，本开关不会取消已提交任务。</p>
        <p v-if="failed" class="mt-3 text-xs text-amber-700">暂时无法连接服务，显示最近一次维护通知，恢复状态待确认。</p>
        <button :disabled="loading" class="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50" @click="refresh">{{ loading ? '检查中…' : '检查是否恢复' }}</button>
        <div class="mt-4 flex justify-center gap-6 text-sm text-blue-600"><NuxtLink to="/login">注册 / 登录</NuxtLink><NuxtLink to="/dashboard-billing?view=recharge">积分充值</NuxtLink></div>
      </section>
    </div>
    <div v-else-if="current" class="fixed inset-x-3 top-3 z-[300] mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg" role="status">
      <div class="flex flex-wrap items-center justify-between gap-2"><p class="text-sm font-bold">{{ current.phase === 'scheduled' ? '维护预告' : '维护中' }} · {{ current.title }}</p><button class="text-xs underline" @click="detailsOpen = !detailsOpen">{{ detailsOpen ? '收起' : '维护详情' }}</button></div>
      <p class="mt-1 text-xs">{{ current.mode === 'full' ? '全站' : current.affected_features.map(key => names[key]).join('、') }} · {{ current.phase === 'scheduled' ? `开始：${time(current.starts_at)}` : remaining }} · 预计恢复：{{ time(current.estimated_resume_at) }}</p>
      <p v-if="detailsOpen" class="mt-2 whitespace-pre-line text-xs leading-6">{{ announcementExcerpt(current.content) }}{{ current.blocking ? '；创作暂不可用，注册、登录、充值不受影响。' : '；当前仅告知，不拦截使用。' }}</p>
      <p v-if="failed" class="mt-1 text-xs">连接中断，以上为最近一次维护通知，状态待确认。</p>
    </div>
  </Teleport>
</template>
