<script setup lang="ts">
import type {LibraryItem,LibraryReference,LibraryVersion} from '~/entities/library/types'
import {computed} from 'vue'
/** 只展示已鉴权目录中的信息；固定引用保留版本，不把缺失目录信息猜成授权。 */
const props=defineProps<{items:LibraryItem[];references:LibraryReference[];busy:boolean}>()
const emit=defineEmits<{refresh:[];toggle:[item:LibraryItem,version:LibraryVersion];remove:[versionId:string]}>()
/** 版本是选择单位；缺失目录的已固定引用仍保留，不能因分页或重新读取而丢失。 */
const versions=computed(()=>props.items.flatMap(item=>item.versions.map(version=>({item,version}))))
const missing=computed(()=>props.references.filter(reference=>!versions.value.some(row=>row.version.id===reference.version_id)))
const total=computed(()=>versions.value.length+missing.value.length)
const allSelected=computed(()=>total.value>0&&props.references.length===total.value)
/** 批量选择沿用原单项事件和十二项上限，不扩大授权或默默移除目录之外的引用。 */
function toggleAll(value:boolean|'indeterminate'){
  if(props.busy)return
  if(!value||props.references.length>=Math.min(12,total.value)){for(const reference of [...props.references])emit('remove',reference.version_id);return}
  let remaining=12-props.references.length
  for(const {item,version} of versions.value){if(remaining<=0)break;if(!selected(version.id)){emit('toggle',item,version);remaining--}}
}
function selected(versionId:string){return props.references.some(reference=>reference.version_id===versionId)}
function detail(reference:LibraryReference){
  const item=props.items.find(item=>item.id===reference.item_id)
  const version=item?.versions.find(version=>version.id===reference.version_id)
  return {name:item?.name||'已固定素材',version:version?`v${version.version_no}`:'固定版本 · 信息待核对'}
}
</script>
<template>
  <section class="skill-reference-assets" aria-label="技能引用资产">
    <header class="reference-heading"><div><h3>引用资产</h3><p>已选资产将以固定版本关联技能，仅自己可见，不会自动公开。</p></div><div class="reference-actions"><UTooltip text="选择本次已读取素材，最多12项；达到上限后再次点击清空选择"><UCheckbox :model-value="references.length&&!allSelected?'indeterminate':allSelected" :label="`已选择 ${references.length} / ${total}`" :aria-label="`已选择 ${references.length} / ${total}`" :disabled="busy||!total" @update:model-value="toggleAll"/></UTooltip><UTooltip text="重新读取本人素材"><UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" square aria-label="刷新引用资产" :disabled="busy" @click="$emit('refresh')"/></UTooltip></div></header>
    <div v-if="total" class="reference-catalog" aria-label="可引用的固定版本">
      <article v-for="{item,version} in versions" :key="version.id" class="reference-card" :class="{selected:selected(version.id)}">
        <div class="reference-preview"><img v-if="item.media_type==='image'&&version.preview_url" :src="version.preview_url" :alt="item.name" loading="lazy"/><UIcon v-else :name="item.media_type==='video'?'i-lucide-video':item.media_type==='audio'?'i-lucide-audio-lines':'i-lucide-file'"/></div>
        <div class="reference-card-copy"><strong :title="item.name">{{item.name}}</strong><small>固定版本 · v{{version.version_no}}</small></div>
        <UCheckbox :model-value="selected(version.id)" :aria-label="`${item.name} · v${version.version_no}`" :disabled="busy||(!selected(version.id)&&references.length>=12)" @update:model-value="$emit('toggle',item,version)"/>
      </article>
      <article v-for="reference in missing" :key="reference.version_id" class="reference-card selected"><div class="reference-preview"><UIcon name="i-lucide-file-check-2"/></div><div class="reference-card-copy"><strong>{{detail(reference).name}}</strong><small>{{detail(reference).version}}</small></div><UButton color="neutral" variant="ghost" icon="i-lucide-x" square :aria-label="`移除引用：${detail(reference).name}`" :disabled="busy" @click="$emit('remove',reference.version_id)"/></article>
    </div>
    <div v-else class="reference-empty"><p>当前 Skill 没有可引用的资产</p></div>
  </section>
</template>
<style scoped>
/* 顶部摘要固定；空态居于内容区中央，真实资产目录独立滚动。 */
.skill-reference-assets{display:flex;flex-direction:column;flex:1;min-height:0;gap:24px;font-size:14px;color:var(--liv-account-text)}
.reference-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:none}.reference-actions{display:flex;align-items:center;gap:8px;flex:none}
.skill-reference-assets h3,.skill-reference-assets p{margin:0}.skill-reference-assets h3{font-size:18px;line-height:28px;font-weight:700}.skill-reference-assets p,.reference-card small{font-size:13px;line-height:1.7;color:var(--liv-account-muted)}
.reference-catalog{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));align-content:start;gap:12px;min-height:0;overflow:auto;padding:2px}.reference-card{display:flex;align-items:center;gap:12px;min-width:0;padding:12px;border:1px solid var(--liv-account-border);border-radius:16px;background:var(--liv-skill-card-selected)}.reference-card.selected{border-color:var(--liv-builder-resource-selected-border)}
.reference-preview{display:flex;align-items:center;justify-content:center;flex:none;width:56px;height:56px;overflow:hidden;border-radius:8px;background:var(--liv-account-raised);color:var(--liv-account-muted)}.reference-preview img{width:100%;height:100%;object-fit:contain}.reference-preview>.iconify{width:24px;height:24px}.reference-card-copy{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}.reference-card strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600}.reference-card :deep([role=checkbox]){flex:none}
.reference-empty{display:flex;align-items:center;justify-content:center;flex:1;min-height:240px;text-align:center}.reference-empty p{font-size:14px;font-weight:500}
@media(max-width:767px){.reference-heading{flex-direction:column;gap:12px}.reference-actions{align-self:flex-end}.reference-catalog{grid-template-columns:1fr}}
</style>
