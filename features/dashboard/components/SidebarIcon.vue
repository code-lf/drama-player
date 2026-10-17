<script setup lang="ts">
import { computed } from 'vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import { PanelsTopLeft, FolderOpen, Zap, Folder, MessagesSquare, ChevronRight, CircleHelp, FileText, QrCode } from '@lucide/vue'
const props=defineProps<{name:string}>()
// 使用真实 SVG 调整描边；原 UIcon 的 CSS mask 无法通过 stroke-width 加粗。
const icons={
  'i-lucide-panels-top-left':PanelsTopLeft,'i-lucide-folder-open':FolderOpen,
  'i-lucide-zap':Zap,'i-lucide-folder':Folder,'i-lucide-messages-square':MessagesSquare,
  'i-lucide-chevron-right':ChevronRight,'i-lucide-circle-help':CircleHelp,
  'i-lucide-file-text':FileText,'i-lucide-qr-code':QrCode,
}
const icon=computed(()=>icons[props.name as keyof typeof icons])
</script>
<template>
  <!-- 仅侧栏使用 2.4 的轻微加粗描边，圆端点和圆连接保留 Lucide 原形状。 -->
  <CreditIcon v-if="name==='i-lucide-coins'" size="xs"/>
  <component :is="icon" v-else-if="icon" class="iconify" style="background:transparent;mask:none;-webkit-mask:none" :size="16" :stroke-width="2.4" aria-hidden="true"/>
  <UIcon v-else :name="name"/>
</template>
