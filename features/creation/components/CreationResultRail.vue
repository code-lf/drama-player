<script setup lang="ts">
import type {SessionResult} from '../resultCatalog'
import CreationMediaPreview from './CreationMediaPreview.vue'
defineProps<{items:SessionResult[];selected:string;unread:string[];disabled?:boolean}>()
defineEmits<{select:[key:string]}>()
</script>
<template>
  <nav v-if="items.length" class="liv-result-rail" aria-label="本会话产物">
    <!-- 去掉可见标题和计数，仅保留读屏通知与每张缩略图的新作品标记。 -->
    <span v-if="unread.length" class="sr-only" role="status" aria-live="polite">有 {{unread.length}} 个新作品</span>
    <div class="liv-result-rail-items">
      <!-- 图片预览使用真实内容高度，覆盖工具提示默认的 24px 高度，避免浮层测量错误压住缩略图。 -->
      <UTooltip v-for="item in items" :key="item.key" :delay-duration="150" :content="{side:'top',align:'center',sideOffset:8,collisionPadding:12}" :ui="{content:'h-auto p-2'}">
        <button type="button" :data-result-key="item.key" :aria-label="`${item.title}：${item.summary}`" :aria-pressed="selected===item.key" :disabled="disabled" @click="$emit('select',item.key)">
          <CreationMediaPreview :kind="item.kind" :url="item.url" :cover="item.cover"/>
          <i v-if="unread.includes(item.key)" aria-label="新产物"/>
        </button>
        <template #content><div class="liv-result-preview"><CreationMediaPreview :kind="item.kind" :url="item.url" :cover="item.cover"/><span>{{item.title}} · {{item.summary}}</span></div></template>
      </UTooltip>
    </div>
  </nav>
</template>
<style scoped>
.liv-result-rail{flex:none;display:flex;align-items:center;gap:12px;padding:8px 16px;border-top:1px solid var(--color-border-soft);background:var(--liv-workspace-surface);min-width:0}
.liv-result-rail-items{display:flex;gap:8px;overflow-x:auto;padding:4px;min-width:0;scrollbar-width:thin}
.liv-result-rail-items button{position:relative;flex:none;width:var(--liv-result-thumb-width);height:var(--liv-result-thumb-height);min-height:var(--liv-result-thumb-height)!important;padding:0!important;border-radius:8px;overflow:hidden;background:var(--liv-number-surface);border:2px solid transparent;display:grid;place-items:center}
.liv-result-rail-items button[aria-pressed=true]{border-color:var(--liv-ui-primary)}.liv-result-rail-items button:focus-visible{outline:2px solid var(--liv-ui-primary-foreground);outline-offset:2px}.liv-result-rail-items img{width:100%;height:100%;object-fit:cover}.liv-result-rail-items i{position:absolute;right:2px;top:2px;width:6px;height:6px;background:var(--liv-ui-primary-foreground);border-radius:50%}
.liv-result-preview{width:160px;display:grid;gap:8px;font-size:12px}.liv-result-preview img{width:160px;height:104px;object-fit:contain}.liv-result-preview span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.liv-result-preview>.liv-media-preview{height:104px}
</style>
