<script setup lang="ts">
import type {SessionResult} from '../resultCatalog'
import CreationMediaPreview from './CreationMediaPreview.vue'
defineProps<{item:SessionResult;selected?:boolean;disabled?:boolean;ariaLabel?:string}>()
defineEmits<{select:[key:string]}>()
</script>
<!-- 两首候选不能删除或合并；序号独占固定列，不随长曲名省略而消失。 -->
<template><button type="button" class="liv-result-card" :class="{selected,'is-audio':item.kind==='audio'}" :disabled="disabled" :aria-label="ariaLabel||`查看${item.title}`" @click.stop="$emit('select',item.key)"><CreationMediaPreview class="liv-result-card-cover" :kind="item.kind" :url="item.url" :cover="item.cover"/><span class="liv-result-card-copy"><span class="liv-result-card-heading"><strong :title="item.title">{{ item.kind==='audio'?item.title:`1 个${{image:'图片',video:'视频'}[item.kind]}` }}</strong><small>{{item.kind==='audio'?`第 ${(item.source.audio_index??0)+1} 首`:'细节'}}</small></span></span><UIcon name="i-lucide-chevron-right"/></button></template>
<style scoped>
.liv-result-card{display:flex!important;align-items:center;gap:12px;width:100%;min-width:0;padding:12px!important;text-align:left;background:var(--liv-number-surface)!important;border:1px solid var(--color-border-soft);border-radius:12px;color:var(--liv-chat-assistant-text)!important;margin-top:12px;cursor:pointer}
.liv-result-card.selected{border-color:var(--liv-ui-primary)}.liv-result-card>img,.liv-result-card-icon{flex:none;width:64px;height:48px;border-radius:8px;object-fit:cover;display:grid;place-items:center}.liv-result-card-copy{display:grid!important;gap:4px;min-width:0;flex:1}.liv-result-card-copy strong{font-size:14px;font-weight:500}.liv-result-card-summary{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.liv-result-card-copy small{font-size:12px;color:var(--liv-settings-muted)}.liv-result-card>.iconify{flex:none;width:16px;height:16px}
/* 提示与标题同排靠右，正常布局预留空间，窄栏允许标题换行而不覆盖摘要。 */
.liv-result-card-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px;min-width:0}
.liv-result-card-heading small{white-space:nowrap;text-align:right}
.liv-result-card-heading strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 成果缩略图略高于卡体；保留真实预览与点击定位，不复制费用或原方案摘要。 */
.liv-result-card{position:relative;min-height:64px;margin-top:20px;padding:8px 14px!important;overflow:visible}
.liv-result-card-cover{flex:none;width:72px;height:72px;border-radius:12px;margin-top:-16px;margin-bottom:-4px}
/* 音乐没有封面时也与标题垂直居中，不沿用图片上浮的排版。 */
.liv-result-card.is-audio .liv-result-card-cover{width:48px;height:48px;margin-block:0}
.liv-result-card.is-audio .liv-result-card-cover :deep(.iconify){width:24px;height:24px}
</style>
