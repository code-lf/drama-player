<script setup lang="ts">
import LoginDialog from '~/features/auth/components/LoginDialog.vue'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  CreditCard,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageSquareText,
  Play,
  Plus,
  Rocket,
  Sparkles,
  UploadCloud,
  UserRound,
  UsersRound,
  WandSparkles,
  Zap
} from '@lucide/vue'

const authStore = useAuthStore()
const accountStore = useAccountStore()
const router = useRouter()

const loginVisible = ref(false)
const isUserMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

const displayNickname = computed(() => authStore.session.user?.nickname || '创作者')

// 顶部导航配置：集中维护文案和锚点，方便后续接入真实二级菜单。
const navItems = [
  { label: '短剧创作', href: '#workflow' },
  { label: 'AI工具', href: '#tools', hasMenu: true },
  { label: '解决方案', href: '#cases', hasMenu: true },
  { label: '案例展示', href: '#cases' },
  { label: '价格方案', href: '#pricing' },
  { label: '帮助中心', href: '#footer', hasMenu: true }
]

// 核心能力卡片：图片由提供的素材精确裁切，保持设计稿中的 3D 玻璃图标质感。
const capabilityCards = [
  {
    title: 'AI 剧本解析',
    desc: '深度理解剧情结构，提炼人物关系与冲突亮点',
    image: '/landing/core-script.png'
  },
  {
    title: '角色设定',
    desc: '智能生成角色画像，轻松导入多风格设定',
    image: '/landing/core-role.png'
  },
  {
    title: '分镜生成',
    desc: '自动拆解剧情，生成专业分镜脚本',
    image: '/landing/core-storyboard.png'
  },
  {
    title: '智景创作',
    desc: '多风格场景生成，匹配剧情氛围',
    image: '/landing/core-scene.png'
  },
  {
    title: '台词优化',
    desc: 'AI 润色台词，更加贴近短剧张力',
    image: '/landing/core-dialogue.png'
  },
  {
    title: '一键导出',
    desc: '支持视频剧本分镜/PDF，主流格式导出',
    image: '/landing/core-export.png'
  }
]

// 五步流程配置：使用精灵图定位还原设计稿中的圆形流程图标。
const workflowSteps = [
  {
    title: '输入灵感/剧本',
    desc: '上传短剧人设或故事，支持多种文本格式',
    spritePosition: '0% 50%'
  },
  {
    title: 'AI 理解剧情',
    desc: '分析剧情结构与节奏，提炼关键要素',
    spritePosition: '25% 50%'
  },
  {
    title: '生成角色与世界观',
    desc: '创建角色设定与关系网，构建完整世界观',
    spritePosition: '50% 50%'
  },
  {
    title: '输出分镜与场景',
    desc: '自动生成分镜脚本，匹配场景与镜头建议',
    spritePosition: '75% 50%'
  },
  {
    title: '进入创作与发布',
    desc: '导出成稿并进入拍摄发布同步平台',
    spritePosition: '100% 50%'
  }
]

// 工具箱卡片：第一张保持高亮态，用来模拟设计稿中的当前推荐工具。
const toolCards = [
  {
    title: '短剧创作',
    desc: '剧本到短视频分镜，一站式短剧创作',
    image: '/landing/tool-short-drama.png',
    hot: true
  },
  {
    title: '商品图生成',
    desc: 'AI 生成高级商品图，电商营销的好帮手',
    image: '/landing/tool-product.png'
  },
  {
    title: '无限画布',
    desc: '自由创意空间，构思与灵感无限延展',
    image: '/landing/tool-canvas.png'
  },
  {
    title: '角色形象设计',
    desc: '生成角色形象与场景，多风格可控',
    image: '/landing/tool-character.png'
  },
  {
    title: '故事板编辑',
    desc: '可视化故事板编辑，镜头调度更高效',
    image: '/landing/tool-storyboard.png'
  },
  {
    title: 'AI 文案',
    desc: '生成标题、提纲、台词，内容创作更轻松',
    image: '/landing/tool-copy.png'
  },
  {
    title: '创意提案',
    desc: '生成创意大纲与提案，快速打动客户',
    image: '/landing/tool-idea.png'
  }
]

// 案例展示数据：缩略图来自设计稿素材，数值用于还原案例卡片底部信息条。
const caseCards = [
  {
    tag: '热门剧集',
    title: '爱在霓虹之下',
    meta: '都市情感短剧 / 24集',
    stats: ['分镜数 186', '短视频 82', '制作周期 3天'],
    image: '/landing/case-love.png'
  },
  {
    tag: '悬疑探索',
    title: '消失的真相',
    meta: '悬疑短剧 / 18集',
    stats: ['分镜数 142', '短视频 67', '制作周期 2天'],
    image: '/landing/case-truth.png'
  },
  {
    tag: '浪漫灵感',
    title: '为热爱上场',
    meta: '励志短剧 / 6集',
    stats: ['分镜数 68', '短视频 28', '制作周期 1天'],
    image: '/landing/case-youth.png'
  },
  {
    tag: '升级案例',
    title: '逆光而行',
    meta: '分镜脚本案例',
    stats: ['分镜数 96', '短视频 44', '风格 写实'],
    image: '/landing/case-city.png'
  }
]

// 选择理由卡片：图标使用精灵图位置，保证与素材中的渐变玻璃图标一致。
const whyCards = [
  {
    value: '10x',
    title: '脚本生成效率提升',
    desc: 'AI 助力创作效率提升 10 倍+',
    spritePosition: '0% 50%'
  },
  {
    value: '分钟级',
    title: '分镜输出速度',
    desc: '从脚本到分镜仅需分钟级',
    spritePosition: '25% 50%'
  },
  {
    value: '100+',
    title: '风格与场景支持',
    desc: '覆盖多种风格与场景类型',
    spritePosition: '50% 50%'
  },
  {
    value: '多端协作',
    title: '团队高效协同',
    desc: '多人在线协作，版本管理清晰',
    spritePosition: '75% 50%'
  },
  {
    value: '安全可靠',
    title: '数据与版权保障',
    desc: '企业级安全与隐私保护',
    spritePosition: '100% 50%'
  }
]

const footerGroups = [
  { title: '产品', links: ['短剧创作', 'AI 工具', '价格方案', '帮助中心'] },
  { title: '解决方案', links: ['短剧营销团队', '品牌营销', 'MCN 机构', '教育培训'] },
  { title: '资源', links: ['案例展示', '创作指南', '帮助中心', '更新日志'] },
  { title: '公司', links: ['关于我们', '加入我们', '合作伙伴', '新闻资讯'] }
]

// 打开登录弹窗：用于顶部登录按钮和未登录状态下的轻量触达。
function openLoginDialog(): void {
  loginVisible.value = true
}

// 开始创作：当前产品创作入口统一收敛到控制台。
function startCreateFromHome(): void {
  router.push('/dashboard')
}

// 案例演示：保持单页浏览体验，点击后滚动到案例区域。
function scrollToCases(): void {
  document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 用户菜单：登录态下点击头像展示退出、订单等入口。
function toggleUserMenu(): void {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

// 点击外部关闭用户菜单，避免下拉层停留影响首页浏览。
function handleClickOutside(event: MouseEvent): void {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    isUserMenuOpen.value = false
  }
}

// 退出登录：同步清理账户信息，保证回到首页后不展示旧余额。
function handleLogout(): void {
  accountStore.reset()
  authStore.logout()
  isUserMenuOpen.value = false
  router.push('/')
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 登录态变化后刷新账户资料，用于顶栏头像和余额等信息兜底。
watch(
  () => authStore.session.loggedIn,
  async (loggedIn) => {
    if (!loggedIn) {
      accountStore.reset()
      return
    }

    await accountStore.refreshProfile()
  },
  { immediate: true }
)
</script>

<template>
  <main class="landing-page min-h-screen bg-[#f5f8ff] text-[#081333] selection:bg-[#005ffe]/20 selection:text-[#005ffe]">
    <header class="sticky top-0 z-50 border-b border-[#dce6f7] bg-white/90 backdrop-blur-2xl">
      <div class="mx-auto flex h-[78px] w-full max-w-[1320px] items-center justify-between px-5 lg:px-6">
        <NuxtLink to="/" class="flex items-center gap-3" aria-label="Livliv AI 首页">
          <span class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#0866ff] text-white shadow-[0_12px_24px_rgba(0,95,254,0.22)]">
            <WandSparkles class="h-5 w-5" />
          </span>
          <span class="text-[23px] font-black leading-none tracking-[-0.01em] text-[#07142e]">Livliv AI</span>
        </NuxtLink>

        <nav class="hidden items-center gap-9 text-[15px] font-semibold text-[#17213c] lg:flex">
          <a
            v-for="item in navItems"
            :key="item.label"
            :href="item.href"
            class="flex items-center gap-1.5 transition hover:text-[#005ffe]"
          >
            <span>{{ item.label }}</span>
            <ChevronDown v-if="item.hasMenu" class="h-3.5 w-3.5" />
          </a>
        </nav>

        <div class="flex items-center gap-3">
          <template v-if="!authStore.session.loggedIn">
            <button
              class="hidden rounded-[12px] border border-[#d9e2f3] bg-white px-5 py-2.5 text-sm font-bold text-[#132142] shadow-[0_8px_22px_rgba(18,43,86,0.06)] transition hover:border-[#a9bceb] sm:inline-flex"
              type="button"
              @click="openLoginDialog"
            >
              登录
            </button>
            <button
              class="rounded-[12px] bg-gradient-to-r from-[#0a72ff] to-[#6a48ff] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(24,100,255,0.28)] transition hover:-translate-y-0.5"
              type="button"
              @click="startCreateFromHome"
            >
              立即体验
            </button>
          </template>

          <template v-else>
            <NuxtLink
              to="/dashboard"
              class="hidden items-center gap-2 rounded-[12px] border border-[#cfe0fb] bg-[#f7fbff] px-4 py-2.5 text-sm font-bold text-[#005ffe] transition hover:border-[#8fb5ff] md:inline-flex"
            >
              <LayoutDashboard class="h-4 w-4" />
              控制台
            </NuxtLink>

            <div ref="userMenuRef" class="relative">
              <button
                class="flex items-center gap-2 rounded-[999px] border border-[#d9e2f3] bg-white px-3 py-2 text-sm font-bold text-[#132142] shadow-[0_10px_24px_rgba(18,43,86,0.08)]"
                type="button"
                @click.stop="toggleUserMenu"
              >
                <span class="h-7 w-7 overflow-hidden rounded-full bg-[#eaf2ff]">
                  <img
                    class="h-full w-full object-cover"
                    :src="authStore.session.user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=livliv'"
                    alt="用户头像"
                  />
                </span>
                <span class="hidden max-w-[88px] truncate sm:inline">{{ displayNickname }}</span>
                <ChevronDown class="h-3.5 w-3.5" />
              </button>

              <div
                v-if="isUserMenuOpen"
                class="absolute right-0 top-full z-50 mt-3 w-52 rounded-2xl border border-[#d8e3f6] bg-white p-2 shadow-[0_24px_60px_rgba(13,43,89,0.16)]"
              >
                <NuxtLink
                  to="/dashboard-billing"
                  class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#42506c] transition hover:bg-[#f2f7ff] hover:text-[#005ffe]"
                  @click="isUserMenuOpen = false"
                >
                  <CreditCard class="h-4 w-4" />
                  我的订单
                </NuxtLink>
                <button
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#e14949] transition hover:bg-[#fff2f2]"
                  type="button"
                  @click="handleLogout"
                >
                  <LogOut class="h-4 w-4" />
                  退出登录
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </header>

    <section class="relative overflow-hidden border-b border-[#dce7f8] bg-[#f4f8ff]">
      <div class="hero-shell absolute inset-0" />
      <div class="mx-auto grid min-h-[590px] w-full max-w-[1320px] items-center px-5 py-16 lg:grid-cols-[0.47fr_0.53fr] lg:px-6 lg:py-10">
        <div class="relative z-10 max-w-[560px]">
          <div class="mb-7 inline-flex items-center gap-2 rounded-full border border-[#b9d3ff] bg-white/70 px-5 py-2 text-[15px] font-bold text-[#005ffe] shadow-[0_12px_28px_rgba(39,111,255,0.08)] backdrop-blur">
            <Sparkles class="h-4 w-4" />
            <span>AI 短剧创作平台</span>
          </div>

          <h1 class="text-[46px] font-black leading-[1.08] tracking-normal text-[#07142e] sm:text-[58px] lg:text-[64px]">
            用 <span class="text-[#005ffe]">AI</span> 重塑<br />
            <span class="text-[#005ffe]">短剧创作</span>流程
          </h1>

          <p class="mt-7 max-w-[520px] text-[18px] font-medium leading-[1.9] text-[#43516e]">
            从剧本理解、角色设定、分镜生成到短剧创作，一站式 AI 驱动短剧生产，创意变快，制作更轻松。
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-4">
            <button
              class="inline-flex h-14 items-center gap-2 rounded-full bg-[#0068ff] px-8 text-[16px] font-black text-white shadow-[0_18px_34px_rgba(0,104,255,0.28)] transition hover:-translate-y-0.5 hover:bg-[#0058df]"
              type="button"
              @click="startCreateFromHome"
            >
              <Play class="h-5 w-5 fill-current" />
              立即开始创作
            </button>
            <button
              class="inline-flex h-14 items-center gap-2 rounded-full border border-[#c9d8f0] bg-white/80 px-8 text-[16px] font-black text-[#102044] shadow-[0_12px_30px_rgba(20,47,88,0.08)] transition hover:border-[#9fbfff] hover:text-[#005ffe]"
              type="button"
              @click="scrollToCases"
            >
              <Play class="h-4 w-4 text-[#005ffe]" />
              查看演示
            </button>
          </div>

          <div class="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-[14px] font-semibold text-[#60708f]">
            <span class="inline-flex items-center gap-2">
              <CheckCircle2 class="h-4 w-4 text-[#0068ff]" />
              分钟级生成分镜
            </span>
            <span class="inline-flex items-center gap-2">
              <CheckCircle2 class="h-4 w-4 text-[#0068ff]" />
              多风格场景创作
            </span>
            <span class="inline-flex items-center gap-2">
              <CheckCircle2 class="h-4 w-4 text-[#0068ff]" />
              支持高清导出
            </span>
          </div>
        </div>

        <div class="relative hidden min-h-[500px] lg:block" aria-hidden="true" />
      </div>
    </section>

    <section class="relative z-10 mx-auto -mt-4 w-full max-w-[1320px] rounded-[28px] border border-[#dbe6f7] bg-white/96 px-5 py-9 shadow-[0_26px_80px_rgba(35,70,120,0.12)] backdrop-blur lg:px-10">
      <div id="features" class="scroll-mt-28">
        <div class="mb-7 flex items-center gap-2">
          <h2 class="text-[29px] font-black tracking-normal text-[#081333]">核心能力，全面赋能短剧创作</h2>
          <Sparkles class="h-5 w-5 text-[#0068ff]" />
        </div>

        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          <article
            v-for="item in capabilityCards"
            :key="item.title"
            class="rounded-[14px] border border-[#dce6f5] bg-white px-5 py-6 shadow-[0_10px_28px_rgba(28,62,112,0.06)] transition hover:-translate-y-1 hover:border-[#a9c7ff]"
          >
            <h3 class="text-[17px] font-black text-[#102044]">{{ item.title }}</h3>
            <p class="mt-2 min-h-[48px] text-[13px] font-medium leading-[1.65] text-[#65738f]">{{ item.desc }}</p>
            <img class="mx-auto mt-4 h-[92px] w-[112px] object-contain" :src="item.image" :alt="item.title" />
          </article>
        </div>
      </div>

      <div id="workflow" class="mt-10 scroll-mt-28">
        <div class="mb-8 flex items-center gap-2">
          <h2 class="text-[28px] font-black tracking-normal text-[#081333]">智能创作流程，5 步打造高质量短剧</h2>
          <Sparkles class="h-5 w-5 text-[#0068ff]" />
        </div>

        <div class="workflow-grid grid gap-7 lg:grid-cols-5">
          <article v-for="(step, index) in workflowSteps" :key="step.title" class="relative text-center">
            <div
              v-if="index < workflowSteps.length - 1"
              class="workflow-line absolute left-[calc(50%+52px)] top-[40px] hidden h-px w-[calc(100%-70px)] border-t border-dashed border-[#80adff] lg:block"
            />
            <div class="mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-full bg-[#f1f6ff] shadow-[inset_0_0_0_1px_#d7e5ff,0_12px_30px_rgba(48,108,214,0.12)]">
              <span class="workflow-icon" :style="{ '--sprite-position': step.spritePosition }" />
            </div>
            <div class="mt-4 flex justify-center">
              <span class="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1c74ff] text-xs font-black text-white">{{ index + 1 }}</span>
              <h3 class="text-[15px] font-black text-[#142343]">{{ step.title }}</h3>
            </div>
            <p class="mx-auto mt-2 max-w-[180px] text-[13px] font-medium leading-[1.6] text-[#667591]">{{ step.desc }}</p>
          </article>
        </div>
      </div>

      <div id="tools" class="mt-12 scroll-mt-28">
        <div class="mb-6 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <h2 class="text-[28px] font-black tracking-normal text-[#081333]">不止短剧，更是你的 AI 创作工具箱</h2>
            <Sparkles class="h-5 w-5 text-[#0068ff]" />
          </div>
          <a href="#features" class="hidden items-center gap-1 text-[14px] font-black text-[#0068ff] sm:flex">
            探索全部工具
            <ArrowRight class="h-4 w-4" />
          </a>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
          <article
            v-for="item in toolCards"
            :key="item.title"
            class="overflow-hidden rounded-[14px] border p-2 shadow-[0_10px_28px_rgba(28,62,112,0.06)] transition hover:-translate-y-1"
            :class="item.hot ? 'border-[#0b6dff] bg-[#0b6dff] text-white' : 'border-[#dce6f5] bg-white text-[#102044]'"
          >
            <div class="relative overflow-hidden rounded-[10px] bg-[#eef5ff]">
              <span v-if="item.hot" class="absolute left-2 top-2 z-10 rounded-md bg-[#0b6dff] px-2 py-1 text-xs font-black text-white">热门</span>
              <img class="h-[128px] w-full object-cover" :src="item.image" :alt="item.title" />
            </div>
            <div class="px-2 py-3">
              <h3 class="text-center text-[16px] font-black">{{ item.title }}</h3>
              <p class="mt-2 text-center text-[13px] font-semibold leading-[1.6]" :class="item.hot ? 'text-white/85' : 'text-[#677590]'">
                {{ item.desc }}
              </p>
            </div>
          </article>
        </div>
      </div>

      <div id="cases" class="mt-12 scroll-mt-28">
        <div class="mb-6 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <h2 class="text-[28px] font-black tracking-normal text-[#081333]">创作案例，灵感看得见</h2>
            <Sparkles class="h-5 w-5 text-[#0068ff]" />
          </div>
          <a href="#cases" class="hidden items-center gap-1 text-[14px] font-black text-[#0068ff] sm:flex">
            查看更多案例
            <ArrowRight class="h-4 w-4" />
          </a>
        </div>

        <div class="grid gap-5 lg:grid-cols-4">
          <article
            v-for="item in caseCards"
            :key="item.title"
            class="overflow-hidden rounded-[14px] border border-[#dce6f5] bg-white shadow-[0_14px_34px_rgba(23,58,111,0.08)] transition hover:-translate-y-1 hover:border-[#a9c7ff]"
          >
            <div class="relative h-[156px] overflow-hidden">
              <img class="h-full w-full object-cover" :src="item.image" :alt="item.title" />
              <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/72 to-transparent" />
              <span class="absolute left-3 top-3 rounded-md bg-[#0b6dff] px-2.5 py-1 text-xs font-black text-white">{{ item.tag }}</span>
              <div class="absolute bottom-4 left-4 text-white">
                <h3 class="text-[20px] font-black">{{ item.title }}</h3>
                <p class="mt-1 text-xs font-semibold text-white/78">{{ item.meta }}</p>
              </div>
            </div>
            <div class="grid grid-cols-3 divide-x divide-[#dfe8f6] text-center text-[12px] font-bold text-[#5f6f8b]">
              <span v-for="stat in item.stats" :key="stat" class="px-2 py-3">{{ stat }}</span>
            </div>
          </article>
        </div>
      </div>

      <div id="pricing" class="mt-12 scroll-mt-28">
        <div class="mb-6 flex items-center gap-2">
          <h2 class="text-[28px] font-black tracking-normal text-[#081333]">为什么选择 Livliv AI</h2>
          <Sparkles class="h-5 w-5 text-[#0068ff]" />
        </div>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <article
            v-for="item in whyCards"
            :key="item.title"
            class="flex min-h-[112px] items-center gap-4 rounded-[14px] border border-[#dce6f5] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(28,62,112,0.05)]"
          >
            <span class="why-icon shrink-0" :style="{ '--sprite-position': item.spritePosition }" />
            <div>
              <div class="text-[27px] font-black leading-none text-[#245bff]">{{ item.value }}</div>
              <h3 class="mt-2 text-[15px] font-black text-[#102044]">{{ item.title }}</h3>
              <p class="mt-1 text-[12px] font-semibold leading-[1.5] text-[#687792]">{{ item.desc }}</p>
            </div>
          </article>
        </div>
      </div>

      <div class="mt-10 overflow-hidden rounded-[14px] bg-[#071cc8] text-white shadow-[0_22px_52px_rgba(21,66,210,0.22)]">
        <div class="relative grid min-h-[148px] items-center gap-6 px-8 py-8 lg:grid-cols-[1fr_auto_280px]">
          <div class="relative z-10">
            <h2 class="text-[28px] font-black tracking-normal">现在就用 Livliv AI 开启你的短剧创作之旅</h2>
            <p class="mt-3 text-[16px] font-medium text-white/82">让 AI 成为你的创作伙伴，释放更多想象力</p>
          </div>
          <div class="relative z-10 flex flex-wrap gap-4">
            <button
              class="h-12 rounded-full bg-[#0b7cff] px-8 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(0,104,255,0.4)] transition hover:bg-[#2490ff]"
              type="button"
              @click="startCreateFromHome"
            >
              免费开始创作
            </button>
            <button
              class="h-12 rounded-full border border-white/60 px-8 text-[15px] font-black text-white transition hover:bg-white/10"
              type="button"
              @click="scrollToCases"
            >
              联系演示
            </button>
          </div>
          <div class="cta-orbit pointer-events-none absolute right-0 top-1/2 hidden h-[180px] w-[300px] -translate-y-1/2 lg:block">
            <span>AI</span>
          </div>
          <div class="relative z-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-white/78 lg:col-span-3">
            <span class="inline-flex items-center gap-1.5"><CheckCircle2 class="h-3.5 w-3.5 text-[#62fbff]" />无限信用卡</span>
            <span class="inline-flex items-center gap-1.5"><CheckCircle2 class="h-3.5 w-3.5 text-[#62fbff]" />免费领取体验</span>
            <span class="inline-flex items-center gap-1.5"><CheckCircle2 class="h-3.5 w-3.5 text-[#62fbff]" />完整的创作方案</span>
          </div>
        </div>
      </div>

      <footer id="footer" class="mt-10 scroll-mt-28 border-t border-[#dfe8f6] pt-8">
        <div class="grid gap-8 lg:grid-cols-[1.6fr_repeat(4,1fr)_1.2fr]">
          <div>
            <div class="flex items-center gap-3">
              <span class="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#0866ff] text-white">
                <WandSparkles class="h-4 w-4" />
              </span>
              <span class="text-[18px] font-black text-[#07142e]">Livliv AI</span>
            </div>
            <p class="mt-4 max-w-[230px] text-[13px] font-medium leading-[1.8] text-[#60708f]">
              AI 驱动的创作平台，让创意制作更高效、更自由。
            </p>
            <div class="mt-5 flex gap-3 text-[#4d5e7d]">
              <span class="footer-social"><Sparkles class="h-4 w-4" /></span>
              <span class="footer-social"><Play class="h-4 w-4" /></span>
              <span class="footer-social"><Lightbulb class="h-4 w-4" /></span>
              <span class="footer-social"><UsersRound class="h-4 w-4" /></span>
            </div>
          </div>

          <div v-for="group in footerGroups" :key="group.title">
            <h3 class="text-[14px] font-black text-[#142343]">{{ group.title }}</h3>
            <ul class="mt-4 space-y-2.5 text-[13px] font-semibold text-[#667591]">
              <li v-for="link in group.links" :key="link">
                <a href="#features" class="transition hover:text-[#005ffe]">{{ link }}</a>
              </li>
            </ul>
          </div>

          <div class="lg:text-right">
            <div class="inline-flex h-[92px] w-[92px] items-center justify-center rounded-[12px] border border-[#dce6f5] bg-white">
              <Grid2X2 class="h-10 w-10 text-[#94a7c8]" />
            </div>
            <p class="mt-3 text-[13px] font-semibold leading-[1.7] text-[#667591]">关注我们<br />获取短剧市场教程</p>
          </div>
        </div>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-[#dfe8f6] py-5 text-[12px] font-medium text-[#7c8aa4]">
          <span>© 2025 Livliv AI. 保留所有权利。</span>
          <a href="#footer">用户协议</a>
          <a href="#footer">隐私政策</a>
          <a href="#footer">服务条款</a>
          <span>备案号：粤ICP备202500000号</span>
        </div>
      </footer>
    </section>

    <LoginDialog v-model="loginVisible" />
  </main>
</template>

<style scoped>
.landing-page {
  /* 首页背景：覆盖全局深色背景，匹配设计稿的浅色科技感基调。 */
  background:
    linear-gradient(180deg, rgba(238, 245, 255, 0.92) 0%, rgba(248, 251, 255, 0.96) 34%, #ffffff 100%),
    #f5f8ff;
}

.hero-shell {
  /* 首屏大图：使用设计稿提供的整张控制台图，左侧留白刚好承载标题文案。 */
  background-image:
    linear-gradient(90deg, rgba(245, 249, 255, 0.82) 0%, rgba(245, 249, 255, 0.5) 36%, rgba(245, 249, 255, 0.08) 68%),
    url('/landing/hero-console.png');
  background-position: center;
  background-size: cover;
}

.workflow-icon,
.why-icon {
  display: block;
  background-repeat: no-repeat;
  background-position: var(--sprite-position);
}

.workflow-icon {
  /* 流程图标精灵图：五个图标横向排列，通过变量控制定位。 */
  width: 64px;
  height: 64px;
  background-image: url('/landing/workflow-icons.png');
  background-size: 520% auto;
}

.why-icon {
  /* 选择理由图标精灵图：复用素材中的火箭、时钟、网格、协作、安全图标。 */
  width: 54px;
  height: 54px;
  background-image: url('/landing/why-icons.png');
  background-size: 530% auto;
}

.cta-orbit::before {
  content: '';
  position: absolute;
  inset: 8px 8px 8px 42px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 999px;
  transform: rotate(-18deg);
  box-shadow:
    0 0 42px rgba(120, 147, 255, 0.7),
    inset 0 0 40px rgba(122, 246, 255, 0.26);
}

.cta-orbit::after {
  content: '';
  position: absolute;
  right: 52px;
  top: 42px;
  width: 116px;
  height: 116px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 45% 45%, rgba(255, 255, 255, 0.88), rgba(111, 90, 255, 0.34) 38%, rgba(36, 108, 255, 0.06) 72%);
  filter: blur(0.2px);
}

.cta-orbit span {
  position: absolute;
  right: 86px;
  top: 76px;
  z-index: 1;
  font-size: 24px;
  font-weight: 900;
}

.footer-social {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid #dce6f5;
  border-radius: 999px;
  background: #ffffff;
}

@media (max-width: 1023px) {
  .hero-shell {
    background-position: 62% center;
    opacity: 0.44;
  }
}

@media (max-width: 640px) {
  .hero-shell {
    background-size: auto 100%;
    background-position: 70% center;
  }
}
</style>
