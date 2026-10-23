<script setup lang="ts">
// 显式导入全局功能协议弹窗，避免 components/system 目录前缀导致自动组件名不一致。
import FeatureLegalConsentDialog from '~/components/system/FeatureLegalConsentDialog.vue'
import ActionConfirmDialog from '~/components/system/ActionConfirmDialog.vue'
import SystemMaintenanceGate from '~/components/system/SystemMaintenanceGate.vue'
import BillingAccountDialog from '~/features/billing/components/BillingAccountDialog.vue'
import CreationFaqDialog from '~/features/support/components/CreationFaqDialog.vue'
const {open:faqOpen}=useCreationFaq()
// 维护遮罩出现时禁用背景页面键盘与鼠标交互，不能只遮住画面。
const maintenanceBlocked = useState<boolean>('maintenance:full-blocked', () => false)
</script>

<template>
  <!-- Nuxt UI 的浮层、提示和全局交互状态都由 UApp 统一承载。 -->
  <!-- 全站提示固定右上角，并通过进度条提示自动关闭倒计时。 -->
  <UApp :toaster="{ position: 'top-right', duration: 4500, progress: true, max: 4 }">
    <div :inert="maintenanceBlocked || undefined"><NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <FeatureLegalConsentDialog />
    <ActionConfirmDialog />
    <!-- 全站仅一个账户宿主，首页与创作共用独立充值弹窗。 -->
    <BillingAccountDialog />
    <!-- FAQ位于账单宿主之后，充值中打开时关闭FAQ可继续原套餐与支付流程。 -->
    <CreationFaqDialog v-model:open="faqOpen" />
    </div>
    <SystemMaintenanceGate />
  </UApp>
</template>
