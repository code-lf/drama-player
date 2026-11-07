<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeLabel?: string
  flush?: boolean
  /** 创作弹层独立深色，不修改账号页面和全局主题偏好。 */
  dark?: boolean
  /** 设置弹窗共用排版令牌；旧业务弹窗保持原布局。 */
  settings?: boolean
  /** 分区设置布局：左对齐标题和说明，底部并排操作，不影响普通设置弹窗。 */
  sectioned?: boolean
  /** 宽版只读参考表例外，复用同一弹窗交互，不改变普通设置560px规格。 */
  reference?: boolean
  /** 普通公告遵守运营配置的可关闭状态；其他弹窗默认保持可关闭。 */
  dismissible?: boolean
}>(), {
  description: '',
  width: 'md',
  closeLabel: '关闭弹窗',
  flush: false,
  dismissible: true
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

// 宽度沿用原业务弹窗分级，交互壳、遮罩、焦点锁定和关闭行为由 UModal 提供。
const contentClass = computed(() => ({
  sm: 'max-w-[480px]',
  md: 'max-w-[720px]',
  lg: 'max-w-[900px]',
  xl: 'max-w-[1120px]',
  full: 'h-[min(900px,calc(100vh-32px))] max-w-[min(1520px,calc(100vw-32px))]'
}[props.width]))
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :close="dismissible"
    :dismissible="dismissible"
    :ui="{
      overlay: settings ? 'bg-black/70 backdrop-blur-sm' : undefined,
      content: `${contentClass} liv-dialog-size-${width} ${dark ? 'creation-dark-dialog' : ''} ${settings ? 'liv-settings-dialog' : 'rounded-lg'} ${sectioned ? 'liv-settings-sectioned' : ''} ${reference ? 'liv-faq-dialog' : ''} ring-1 ring-default shadow-2xl`,
      header: settings ? 'liv-settings-header min-h-0' : 'min-h-0 border-b border-default px-5 py-4 sm:px-6',
      title: settings ? 'liv-settings-title' : 'text-lg font-bold tracking-normal text-highlighted',
      description: 'mt-1 text-sm leading-5 text-muted',
      body: settings ? 'liv-settings-body min-h-0 overflow-auto' : flush ? 'min-h-0 overflow-hidden p-0' : 'min-h-0 overflow-auto px-5 py-4 sm:px-6',
      footer: settings ? 'liv-settings-footer liv-dialog-actions' : 'justify-end gap-2 border-t border-default px-5 py-3 sm:px-6'
    }"
    @update:open="emit('update:open', $event)"
  >
    <!-- 原生 aria-label 放在实际按钮上，避免当作 Nuxt UI 配置字段导致类型错误。 -->
    <template v-if="dismissible" #close><UButton icon="i-lucide-x" color="neutral" variant="ghost" square :class="{'liv-settings-close':settings}" :aria-label="closeLabel" /></template>
    <!-- 图文标题放入组件库标题槽，保留 DialogTitle 的可访问名称与默认关闭行为。 -->
    <template v-if="$slots.icon" #title>
      <span class="liv-dialog-header-copy">
        <span class="liv-dialog-icon"><slot name="icon" /></span>
        <span class="min-w-0 flex-1">{{ title }}</span>
      </span>
    </template>
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </UModal>
</template>

<style scoped>
/* 操作底栏统一并排和足够点击区，覆盖旧display:block造成的按钮挤压。 */
:global(.liv-settings-footer.liv-dialog-actions){display:flex!important;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:12px!important}
:global(.liv-dialog-actions>.liv-settings-button){min-width:112px;padding-inline:24px!important;height:44px!important;min-height:44px!important}
.liv-dialog-header-copy{display:flex;width:100%;align-items:flex-start;gap:12px}
.liv-dialog-icon{display:flex;width:40px;height:40px;flex:0 0 40px;align-items:center;justify-content:center;border-radius:8px;background:#1768ff;color:#fff;box-shadow:0 8px 18px rgba(23,104,255,.2)}
</style>
