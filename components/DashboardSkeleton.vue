<script setup lang="ts">
// 读取页面资料时展示布局占位；生成、上传和支付等业务进度仍使用真实任务状态。
withDefaults(defineProps<{ layout?: 'unknown' | 'conversation' | 'media'; variant?: 'workspace' | 'cards' | 'rows' | 'conversation' | 'toolbar'; rows?: number; heading?: boolean }>(), { layout: 'unknown', variant: 'rows', rows: 3, heading: true })
</script>
<template>
  <div class="dashboard-skeleton" :class="[`dashboard-skeleton--${variant}`,{'is-conversation-only':variant==='conversation'&&layout==='conversation'}]" role="status" aria-label="正在载入页面" aria-busy="true">
    <!-- 占位均复用 Nuxt UI；会话恢复保持消息区、编辑器、工具栏和画布的位置。 -->
    <div v-if="variant==='conversation' && layout==='unknown'" class="dashboard-skeleton-neutral"><USkeleton class="skeleton-title"/><USkeleton class="skeleton-line"/><USkeleton class="skeleton-line short"/></div>
    <div v-else-if="variant === 'conversation'" class="dashboard-skeleton-conversation">
      <div class="dashboard-skeleton-chat"><USkeleton class="skeleton-title"/><div class="skeleton-user"><USkeleton class="skeleton-line"/></div><div v-for="index in 2" :key="index" class="skeleton-message"><USkeleton class="skeleton-avatar"/><USkeleton class="skeleton-line"/><USkeleton class="skeleton-line short"/></div><div class="skeleton-editor"><USkeleton class="skeleton-line"/><div class="skeleton-tools"><USkeleton v-for="index in 4" :key="index" class="skeleton-tool"/><USkeleton class="skeleton-send"/></div></div></div>
      <USkeleton v-if="layout==='media'" class="dashboard-skeleton-canvas"/>
    </div>
    <div v-else-if="variant === 'toolbar'" class="skeleton-tools"><USkeleton v-for="index in 4" :key="index" class="skeleton-tool"/><USkeleton class="skeleton-tool-label"/><USkeleton class="skeleton-send"/></div>
    <template v-else>
    <div v-if="heading && variant !== 'rows'" class="dashboard-skeleton-heading"><USkeleton class="skeleton-title" /><USkeleton class="skeleton-subtitle" /></div>
    <div class="dashboard-skeleton-content">
      <div v-for="index in rows" :key="index" class="dashboard-skeleton-item">
        <USkeleton v-if="variant !== 'rows'" class="skeleton-cover" />
        <USkeleton class="skeleton-line" /><USkeleton class="skeleton-line short" />
      </div>
    </div>
    </template>
  </div>
</template>
<style scoped>
.dashboard-skeleton{width:100%;padding:20px 0;color-scheme:dark}
.dashboard-skeleton-heading{display:grid;gap:14px;margin-bottom:28px}
.dashboard-skeleton :deep([aria-busy='true']){background:var(--liv-skeleton-surface);border-radius:8px}
.skeleton-title{width:210px;height:28px}.skeleton-subtitle{width:36%;height:14px}
.dashboard-skeleton-content{display:grid;gap:18px}.dashboard-skeleton--workspace .dashboard-skeleton-content,.dashboard-skeleton--cards .dashboard-skeleton-content{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.dashboard-skeleton-item{display:grid;gap:12px;padding:16px;border:1px solid #ffffff14;border-radius:14px}
.skeleton-cover{aspect-ratio:16/9}.skeleton-line{height:16px;width:85%}.skeleton-line.short{width:55%;height:12px}
/* 工具栏占位与真实图标同高，保留发送键右对齐，加载结束不跳位。 */
.dashboard-skeleton--toolbar{padding:8px 0 0}
.skeleton-tools{display:flex;align-items:center;gap:8px;min-width:0}
.skeleton-tool,.skeleton-send{width:32px;height:32px;flex:none}.skeleton-send{margin-left:auto;border-radius:50%!important}.skeleton-tool-label{width:72px;height:20px}
.dashboard-skeleton-conversation{display:grid;grid-template-columns:minmax(320px,min(var(--creation-chat-width,var(--liv-workspace-chat-width)),calc(100% - 340px))) minmax(0,1fr);gap:var(--liv-workspace-divider-width);min-height:0;height:var(--liv-workspace-height)}
/* 两层恢复骨架与真实会话都铺满主体，不再沿用 1500px 居中上限。 */
.dashboard-skeleton--conversation{width:100%;max-width:none;margin:0;padding:0}
.dashboard-skeleton-chat{display:flex;flex-direction:column;gap:24px;min-width:0;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px}
.skeleton-user{align-self:flex-end;width:65%;padding:12px 0}.skeleton-message{display:grid;gap:12px}.skeleton-avatar{height:24px;width:24px;border-radius:50%!important}
.skeleton-editor{margin-top:auto;display:grid;gap:40px;padding:16px;border:1px solid var(--color-border-soft);border-radius:24px}
.dashboard-skeleton-canvas{min-height:280px;border-radius:16px}
@media(max-width:1023.98px){.dashboard-skeleton-conversation{grid-template-columns:minmax(0,1fr);min-height:400px}.dashboard-skeleton-canvas{display:none}}
/* 首次未知只占中性外壳，已知纯对话不预留空画布。 */
.dashboard-skeleton-neutral{height:var(--liv-workspace-height);display:flex;flex-direction:column;gap:24px;padding:24px}
.is-conversation-only .dashboard-skeleton-conversation{max-width:var(--liv-workspace-conversation-width);margin-inline:auto;grid-template-columns:minmax(0,1fr)}
@media(prefers-reduced-motion:reduce){.dashboard-skeleton :deep(*){animation:none}}
</style>
