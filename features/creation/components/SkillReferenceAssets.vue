<script setup lang="ts">
import type {LibraryItem,LibraryReference,LibraryVersion} from '~/entities/library/types'
/** 只展示已鉴权目录中的信息；固定引用保留版本，不把缺失目录信息猜成授权。 */
const props=defineProps<{items:LibraryItem[];references:LibraryReference[];busy:boolean}>()
defineEmits<{refresh:[];toggle:[item:LibraryItem,version:LibraryVersion];remove:[versionId:string]}>()
function selected(versionId:string){return props.references.some(reference=>reference.version_id===versionId)}
function detail(reference:LibraryReference){
  const item=props.items.find(item=>item.id===reference.item_id)
  const version=item?.versions.find(version=>version.id===reference.version_id)
  return {name:item?.name||'已固定素材',version:version?`v${version.version_no}`:'固定版本 · 信息待核对'}
}
</script>
<template>
  <section class="skill-reference-assets" aria-label="技能引用资产">
    <header><div><h3>引用资产</h3><p>已选择 {{references.length}} / 12，固定版本。关联技能不会公开素材。</p></div><UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :disabled="busy" @click="$emit('refresh')">刷新</UButton></header>
    <ul v-if="references.length" class="reference-selected" aria-label="已选固定素材">
      <li v-for="reference in references" :key="reference.version_id"><UIcon name="i-lucide-file-check-2"/><div><strong>{{detail(reference).name}}</strong><small>{{detail(reference).version}}</small></div><UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`移除引用：${detail(reference).name}`" :disabled="busy" @click="$emit('remove',reference.version_id)"/></li>
    </ul>
    <p v-else class="reference-empty">尚未选择引用资产，可从下面的本人素材中选择。</p>
    <div class="reference-catalog">
      <article v-for="item in items" :key="item.id"><header><UIcon :name="item.media_type==='image'?'i-lucide-image':item.media_type==='video'?'i-lucide-video':'i-lucide-file'"/><strong>{{item.name}}</strong></header><div class="reference-versions"><UButton v-for="version in item.versions" :key="version.id" color="neutral" :variant="selected(version.id)?'solid':'soft'" :icon="selected(version.id)?'i-lucide-check':undefined" :aria-pressed="selected(version.id)" :aria-label="`${item.name} · v${version.version_no}`" :disabled="busy||(!selected(version.id)&&references.length>=12)" @click="$emit('toggle',item,version)">v{{version.version_no}}</UButton></div></article>
    </div>
    <p v-if="!items.length" class="reference-empty">当前目录没有可选素材。可在资料库上传后刷新。</p>
  </section>
</template>
<style scoped>
.skill-reference-assets{display:grid;gap:16px;font-size:14px;color:var(--liv-account-text)}
.skill-reference-assets>header,.reference-selected li,.reference-catalog article>header{display:flex;align-items:center;gap:12px}
.skill-reference-assets>header{justify-content:space-between}.skill-reference-assets h3,.skill-reference-assets p{margin:0}.skill-reference-assets h3{font-size:16px}.skill-reference-assets p,.reference-selected small{font-size:12px;line-height:1.7;color:var(--liv-account-muted)}
.reference-selected{display:grid;gap:8px;margin:0;padding:0;list-style:none}.reference-selected li,.reference-catalog article{min-width:0;padding:12px;border:1px solid var(--liv-account-border);border-radius:14px;background:var(--liv-skill-card-selected)}
.reference-selected li>div{display:grid;flex:1;min-width:0}.reference-selected strong,.reference-catalog strong{overflow-wrap:anywhere}.reference-selected li>span,.reference-catalog header>span{flex:none;width:18px;height:18px}
.reference-catalog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.reference-versions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.reference-empty{padding:16px 0}
@media(max-width:767px){.reference-catalog{grid-template-columns:1fr}}
</style>
