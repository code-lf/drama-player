<script setup lang="ts">
import type {CreationSession} from '../types'
// 业务 store 不在 Nuxt 默认自动导入目录，必须显式导入，避免进入会话时触发运行时 500。
import {useAuthStore} from '~/features/auth/store/useAuthStore'
const props=defineProps<{navigationOpen?:boolean}>()
const emit=defineEmits<{navigation:[]}>()
const route=useRoute(),auth=useAuthStore(),historyOpen=ref(false)
const sessions=useState<CreationSession[]>('creation-recent-sessions',()=>[])
const current=useState<{id:string;title:string}|null>('creation-active-session-title',()=>null)
const interaction=ref(false),inside=ref(false),pointerOpen=ref(false)
let openTimer:ReturnType<typeof setTimeout>|undefined,closeTimer:ReturnType<typeof setTimeout>|undefined
/** 只在历史按钮触发悬停；显式菜单、键盘焦点和重命名期间不自动关闭。 */
function enterHistory(){inside.value=true;clearTimeout(closeTimer);openTimer=setTimeout(()=>{pointerOpen.value=true;historyOpen.value=true},200)}
function leaveHistory(){inside.value=false;clearTimeout(openTimer);clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!interaction.value&&!inside.value&&!document.activeElement?.closest('.session-recent-popover'))historyOpen.value=false},250)}
function preventHoverFocus(event:Event){if(pointerOpen.value)event.preventDefault()}
function keepHistory(){clearTimeout(closeTimer)}
function hold(value:boolean){interaction.value=value;if(value)clearTimeout(closeTimer);else if(!inside.value)leaveHistory()}
onBeforeUnmount(()=>{clearTimeout(openTimer);clearTimeout(closeTimer)})
const title=computed(()=>current.value?.id===route.query.session?current.value.title:sessions.value.find(item=>item.id===route.query.session)?.title||'创作会话')
// 触发器由 UPopover 管理点击、外点及 Esc，悬停延迟和业务菜单保持状态在此统一协调。
watch(()=>[route.fullPath,auth.session.user?.id,props.navigationOpen],()=>{clearTimeout(openTimer);clearTimeout(closeTimer);interaction.value=false;historyOpen.value=false})
</script>
<template>
<nav class="session-workspace-nav" aria-label="会话工作区导航">
<UTooltip :text="navigationOpen?'收起导航':'展开导航'"><UButton :icon="navigationOpen?'i-lucide-panel-left-close':'i-lucide-panel-left-open'" variant="ghost" color="neutral" square :aria-label="navigationOpen?'收起导航':'展开导航'" :aria-expanded="!!navigationOpen" @click="emit('navigation')"/></UTooltip>
<span class="session-nav-title" :title="title">{{title}}</span>
<UPopover v-if="!navigationOpen" :open="historyOpen" @update:open="!interaction && (historyOpen=$event)" :content="{side:'bottom',align:'start',sideOffset:8,onOpenAutoFocus:preventHoverFocus}" :ui="{content:'session-recent-popover'}">
<UButton icon="i-lucide-history" variant="ghost" color="neutral" square aria-label="最近项目" :aria-expanded="historyOpen" @pointerdown="pointerOpen=false" @keydown="pointerOpen=false" @pointerenter="$event.pointerType!=='touch' && enterHistory()" @pointerleave="leaveHistory"/>
<template #content><section aria-label="最近项目" @pointerenter="inside=true;keepHistory()" @pointerleave="leaveHistory" @focusin="keepHistory" @focusout="leaveHistory"><slot name="history" :hold="hold"/></section></template>
</UPopover>
<UTooltip text="新建创作"><UButton to="/dashboard?entry=free&new=1" icon="i-lucide-square-pen" variant="ghost" color="neutral" square aria-label="新建创作"/></UTooltip>
</nav>
</template>
