<script setup lang="ts">
// 读取页面资料时展示布局占位；生成、上传和支付等业务进度仍使用真实任务状态。
withDefaults(defineProps<{ layout?: 'unknown' | 'conversation' | 'media'; variant?: 'projects' | 'home' | 'workspace' | 'cards' | 'rows' | 'conversation' | 'toolbar'; rows?: number; heading?: boolean; simple?:boolean }>(), { layout: 'unknown', variant: 'rows', rows: 3, heading: true, simple:false })
</script>
<template>
  <div class="dashboard-skeleton" :class="[`dashboard-skeleton--${variant}`,{'creation-studio':variant==='home','is-conversation-only':variant==='conversation'&&layout==='conversation','is-simple-loading':variant==='conversation'&&simple}]" role="status" aria-label="正在载入页面" aria-busy="true">
    <!-- 普通画布恢复仅展示中性加载点，不再预设旧左右分栏、媒体大小或价格占位。 -->
    <div v-if="variant==='projects'" class="project-loading-layout">
      <!-- 复用同一项目网格，封面16:9及64px信息区与真实卡片完全一致。 -->
      <!-- 回收站已呈现真实标题及页签时只复用卡片骨架，避免重复占位导航。 -->
      <div v-if="heading" class="project-loading-heading"><USkeleton class="project-loading-title"/></div>
      <div v-if="heading" class="project-loading-controls"><USkeleton class="project-loading-tabs"/><USkeleton class="project-loading-search"/></div>
      <div class="project-loading-grid"><div v-for="index in rows" :key="index" class="project-loading-card"><USkeleton class="project-loading-cover"/><div class="project-loading-body"><USkeleton class="project-loading-name"/><USkeleton class="project-loading-time"/></div></div></div>
    </div>
    <div v-else-if="variant==='conversation'&&simple" class="workspace-loading"><span class="sr-only">正在加载会话</span><span class="workspace-loading-dots" aria-hidden="true"><i/><i/></span></div>
    <!-- 占位均复用 Nuxt UI；会话恢复保持消息区、编辑器、工具栏和画布的位置。 -->
    <!-- 首页占位复用实际标题位置、800px输入区及案例区域，不能套项目列表布局。 -->
    <template v-else-if="variant==='home'">
      <div class="creation-hero home-skeleton-hero"><USkeleton class="home-skeleton-title"/><USkeleton class="home-skeleton-subtitle"/></div>
      <div class="creation-home">
        <div class="home-skeleton-composer"><USkeleton class="home-skeleton-upload"/><USkeleton class="skeleton-line"/><div class="skeleton-tools"><USkeleton v-for="index in 4" :key="index" class="skeleton-tool"/><USkeleton class="skeleton-send"/></div></div>
        <div class="home-skeleton-shortcuts"><USkeleton v-for="index in 4" :key="index" class="home-skeleton-shortcut"/></div>
      </div>
      <div class="creation-cases home-skeleton-cases"><USkeleton class="skeleton-tool-label"/><div class="home-skeleton-grid"><div v-for="index in rows" :key="index"><USkeleton class="skeleton-cover"/><USkeleton class="skeleton-line"/></div></div></div>
    </template>
    <div v-else-if="variant==='conversation' && layout==='unknown'" class="dashboard-skeleton-neutral"><USkeleton class="skeleton-title"/><USkeleton class="skeleton-line"/><USkeleton class="skeleton-line short"/></div>
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
<style src="../assets/css/liv-loading-dots.css"></style>
<style scoped>
/* 项目读取只使用中性骨架；外层启动与接口加载共享此分支，避免两套蓝灰大块。 */
.dashboard-skeleton--projects{padding:0;container:project-directory / inline-size;box-sizing:border-box}
.project-loading-heading{height:36px;display:flex;align-items:center}.project-loading-title{width:180px;height:28px}.project-loading-controls{height:36px;margin:34px 0 22px;display:flex;align-items:center;justify-content:space-between;gap:16px}.project-loading-tabs{width:180px;height:20px}.project-loading-search{width:240px;height:36px}.project-loading-card{min-width:0;border:1px solid var(--color-border-soft);border-radius:16px;overflow:hidden}.project-loading-cover{width:100%;aspect-ratio:16/9;border-radius:0!important}.project-loading-body{height:64px;box-sizing:border-box;padding:10px 12px;display:flex;flex-direction:column;gap:8px}.project-loading-name{height:18px;width:80%}.project-loading-time{height:12px;width:35%}.project-loading-layout :deep([data-slot=root]){background:var(--liv-skeleton-surface)!important}.project-loading-layout :deep(.animate-pulse){background:var(--liv-skeleton-surface)!important}@media(max-width:767px){.dashboard-skeleton--projects{padding-inline:0}.project-loading-controls{margin-top:24px}}
.dashboard-skeleton{width:100%;padding:20px 0;color-scheme:dark}
/* 复用原工作区高度，双点只表达读取中，不显示伪进度；减少动态效果时保持静止。 */
.dashboard-skeleton--conversation.is-simple-loading{height:var(--liv-workspace-height);display:grid;place-items:center}
/* 保留宽屏最大尺寸；两个球沿椭圆错开半圈，前景球变大，后景球缩回 8px。 */
.workspace-loading{width:100%;container-type:inline-size}
/* 首页与真实内容共享外边距及容器令牌，移动端快捷入口同样换行。 */
.dashboard-skeleton--home{padding:0}
.home-skeleton-hero{flex-direction:column}
.home-skeleton-title{width:min(300px,75%);height:32px}
.home-skeleton-subtitle{width:min(400px,85%);height:20px}
.home-skeleton-composer{height:clamp(190px,30cqi,240px);border:1px solid var(--liv-home-composer-border);border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:16px}
.home-skeleton-upload{width:48px;height:48px;flex:none}
.home-skeleton-composer>.skeleton-tools{margin-top:auto}
.home-skeleton-shortcuts{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:17px}
.home-skeleton-shortcut{width:120px;height:40px}
.home-skeleton-cases{margin:32px auto 0;display:grid;gap:16px}
.home-skeleton-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.home-skeleton-grid>div{display:grid;gap:12px;min-width:0}
@media(max-width:1023.98px){.home-skeleton-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:600px){.home-skeleton-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-skeleton-title{height:28px}.home-skeleton-composer{padding:12px;border-radius:19px}}
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
<style src="~/assets/css/project-directory-grid.css"></style>
