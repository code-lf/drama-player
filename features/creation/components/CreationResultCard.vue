<script setup lang="ts">
import type {SessionResult} from '../resultCatalog'
import CreationMediaPreview from './CreationMediaPreview.vue'
defineProps<{item:SessionResult;selected?:boolean;disabled?:boolean}>()
defineEmits<{select:[key:string]}>()
</script>
<template><button class="liv-result-card" :class="{selected}" :disabled="disabled" @click.stop="$emit('select',item.key)"><CreationMediaPreview class="liv-result-card-cover" :kind="item.kind" :url="item.url" :cover="item.cover"/><span class="liv-result-card-copy"><span class="liv-result-card-heading"><strong>{{ {image:'图片',video:'视频',audio:'音频'}[item.kind] }}生成完成</strong><small>点击查看与编辑</small></span><span class="liv-result-card-summary">{{item.summary}}</span></span><UIcon name="i-lucide-chevron-right"/></button></template>
<style scoped>
.liv-result-card{display:flex!important;align-items:center;gap:12px;width:100%;min-width:0;padding:12px!important;text-align:left;background:var(--liv-number-surface)!important;border:1px solid var(--color-border-soft);border-radius:12px;color:var(--liv-chat-assistant-text)!important;margin-top:12px;cursor:pointer}
.liv-result-card.selected{border-color:var(--liv-ui-primary)}.liv-result-card>img,.liv-result-card-icon{flex:none;width:64px;height:48px;border-radius:8px;object-fit:cover;display:grid;place-items:center}.liv-result-card-copy{display:grid!important;gap:4px;min-width:0;flex:1}.liv-result-card-copy strong{font-size:14px;font-weight:500}.liv-result-card-summary{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.liv-result-card-copy small{font-size:12px;color:var(--liv-settings-muted)}.liv-result-card>.iconify{flex:none;width:16px;height:16px}
/* 提示与标题同排靠右，正常布局预留空间，窄栏允许标题换行而不覆盖摘要。 */
.liv-result-card-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px;min-width:0}
.liv-result-card-heading small{white-space:nowrap;text-align:right}
.liv-result-card-cover{flex:none;width:64px;height:48px;border-radius:8px}
</style>
