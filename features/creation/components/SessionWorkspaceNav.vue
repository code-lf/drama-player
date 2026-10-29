<script setup lang="ts">
import type {CreationSession} from '../types'
import {hoverMenuBoundary} from '~/features/dashboard/hoverMenuBoundary'
import {workspaceNavigationItems} from '../workspaceNavigation'
// 业务 store 不在 Nuxt 默认自动导入目录，必须显式导入，避免进入会话时触发运行时 500。
import {useAuthStore} from '~/features/auth/store/useAuthStore'
const props=defineProps<{navigationOpen?:boolean}>()
const emit=defineEmits<{navigation:[]}>()
const route=useRoute(),auth=useAuthStore(),historyOpen=ref(false)
const sessions=useState<CreationSession[]>('creation-recent-sessions',()=>[])
const current=useState<{id:string;title:string}|null>('creation-active-session-title',()=>null)
const interaction=ref(false),inside=ref(false),pointerOpen=ref(false)
const brandOpen=ref(false),brandPointer=ref(false)
let brandCloseTimer:ReturnType<typeof setTimeout>|undefined
/** Logo 悬停立即展开；10px 菜单间隙使用短延迟，移入弹层不闪退。触屏仍点击。 */
function enterBrand(){clearTimeout(brandCloseTimer);brandPointer.value=true;brandOpen.value=true;historyOpen.value=false}
function leaveBrand(){clearTimeout(brandCloseTimer);brandCloseTimer=setTimeout(()=>{if(brandPointer.value&&!document.querySelector('.session-brand-trigger:hover,.session-brand-dropdown:hover'))brandOpen.value=false},250)}
function keepBrand(){clearTimeout(brandCloseTimer)}
function brandAutoFocus(event:Event){if(brandPointer.value)event.preventDefault()}
function clearBrand(){clearTimeout(brandCloseTimer);brandOpen.value=false;brandPointer.value=false}
// Nuxt 菜单内容为多根组件，content 的 pointerenter 不会可靠透传；在真实节点边界清理延迟。
const trackBrandBoundary=hoverMenuBoundary('.session-brand-trigger,.session-brand-dropdown',keepBrand,()=>{if(brandOpen.value)leaveBrand()})
onMounted(()=>{document.addEventListener('pointerover',trackBrandBoundary,true);document.addEventListener('pointerout',trackBrandBoundary,true)})
onBeforeUnmount(()=>{document.removeEventListener('pointerover',trackBrandBoundary,true);document.removeEventListener('pointerout',trackBrandBoundary,true)})
let openTimer:ReturnType<typeof setTimeout>|undefined,closeTimer:ReturnType<typeof setTimeout>|undefined
/** 只在历史按钮触发悬停；显式菜单、键盘焦点和重命名期间不自动关闭。 */
function enterHistory(){inside.value=true;clearTimeout(closeTimer);openTimer=setTimeout(()=>{pointerOpen.value=true;historyOpen.value=true},200)}
function leaveHistory(){inside.value=false;clearTimeout(openTimer);clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!interaction.value&&!inside.value&&!document.activeElement?.closest('.session-recent-popover'))historyOpen.value=false},250)}
function preventHoverFocus(event:Event){if(pointerOpen.value)event.preventDefault()}
function keepHistory(){clearTimeout(closeTimer)}
function hold(value:boolean){interaction.value=value;if(value)clearTimeout(closeTimer);else if(!inside.value)leaveHistory()}
onBeforeUnmount(()=>{clearTimeout(openTimer);clearTimeout(closeTimer);clearBrand()})
const title=computed(()=>current.value?.id===route.query.session?current.value.title:sessions.value.find(item=>item.id===route.query.session)?.title||'创作会话')
// 左上角只保留四个创作导航；账单入口继续放在右上角个人中心，不删除底层能力。
const brandItems=computed(()=>[
  workspaceNavigationItems.map(item=>{const active=route.path.replace(/\/+$/,'')===item.to.split('?')[0];return {...item,active,class:active?'is-current-page':undefined}})
])
// 触发器由 UPopover 管理点击、外点及 Esc，悬停延迟和业务菜单保持状态在此统一协调。
watch(()=>[route.fullPath,auth.session.user?.id,props.navigationOpen],()=>{clearTimeout(openTimer);clearTimeout(closeTimer);interaction.value=false;historyOpen.value=false;clearBrand()})
</script>
<template>
<nav class="session-workspace-nav" aria-label="会话工作区导航">
<!-- 手机收起品牌菜单与新建入口，返回创作首页；桌面原导航不变。 -->
<UButton class="session-mobile-back" to="/dashboard?entry=free" icon="i-lucide-chevron-left" color="neutral" variant="ghost" square aria-label="返回创作首页"/>
<!-- 复用既有品牌按钮和下拉样式，组件只负责外点、Esc、焦点与菜单键盘行为。 -->
<UDropdownMenu v-model:open="brandOpen" :modal="false" :items="brandItems" :content="{side:'bottom',align:'start',sideOffset:0,onOpenAutoFocus:brandAutoFocus,onCloseAutoFocus:brandAutoFocus,onKeydown:()=>brandPointer=false}" :ui="{content:'session-nav-dropdown session-brand-dropdown',item:'session-brand-menu-item',itemLeadingIcon:'session-brand-menu-icon'}"><button class="session-brand-trigger" type="button" aria-label="Livliv 导航菜单" @pointerenter="$event.pointerType!=='touch' && enterBrand()" @pointerleave="leaveBrand" @pointerdown="brandPointer=false" @keydown="brandPointer=false"><span>Livliv</span><UIcon name="i-lucide-chevron-down"/></button></UDropdownMenu>
<span class="session-nav-title" :title="title">{{title}}</span>
<UPopover v-if="!navigationOpen" :open="historyOpen" @update:open="!interaction && (historyOpen=$event)" :content="{side:'bottom',align:'start',sideOffset:8,onOpenAutoFocus:preventHoverFocus}" :ui="{content:'session-recent-popover'}">
<UButton icon="i-lucide-history" variant="ghost" color="neutral" square aria-label="最近项目" :aria-expanded="historyOpen" @pointerdown="pointerOpen=false" @keydown="pointerOpen=false" @pointerenter="$event.pointerType!=='touch' && enterHistory()" @pointerleave="leaveHistory"/>
<template #content><section aria-label="最近项目" @pointerenter="inside=true;keepHistory()" @pointerleave="leaveHistory" @focusin="keepHistory" @focusout="leaveHistory"><slot name="history" :hold="hold"/></section></template>
</UPopover>
<UTooltip text="新建创作"><UButton to="/dashboard?entry=free&new=1" icon="i-lucide-square-pen" variant="ghost" color="neutral" square aria-label="新建创作"/></UTooltip>
</nav>
</template>
<style scoped>
/* 桌面标题缩短显示，完整项目名仍可通过原 title 查看；手机继续占满可用空间。 */
@media(min-width:768px){.session-nav-title{max-width:200px}}
</style>
