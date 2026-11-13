<script setup lang="ts">
import {computed,ref} from 'vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import type {AssetCategory,CanvasAssetExtraction} from '../scriptDocument'
const props=defineProps<{extraction?:CanvasAssetExtraction|null;busy?:boolean;error?:string}>()
const emit=defineEmits<{extract:[categories:AssetCategory[]]}>()
const selected=ref<AssetCategory[]>(['role','scene','prop'])
const choices:Array<{key:AssetCategory;label:string}>=[{key:'role',label:'角色'},{key:'scene',label:'场景'},{key:'prop',label:'道具'}]
const pending=computed(()=>props.busy||['queued','running'].includes(props.extraction?.status||''))
function toggle(key:AssetCategory,value:boolean|'indeterminate'){
  if(pending.value)return
  selected.value=value===true?[...new Set([...selected.value,key])]:selected.value.filter(item=>item!==key)
}
</script>
<template>
  <section class="canvas-asset-extraction nodrag nopan nowheel" aria-label="剧本资产提取" @pointerdown.stop @mousedown.stop @click.stop @dblclick.stop>
    <div class="canvas-asset-extraction-actions"><UCheckbox v-for="item in choices" :key="item.key" :model-value="selected.includes(item.key)" :label="item.label" :disabled="pending" @update:model-value="toggle(item.key,$event)"/><LivButton settings variant="primary" :loading="pending" :disabled="pending||!selected.length" @click="emit('extract',[...selected])">{{pending?'正在提取':'一键提取'}}</LivButton></div>
    <p v-if="error||extraction?.error_message" role="alert">{{error||extraction?.error_message}}</p>
    <p v-else-if="extraction?.status==='succeeded'">{{extraction.summary}}</p>
    <p v-else-if="extraction?.status==='running'" role="status">正在根据完整剧本提取设定与出处，不生成图片。</p>
    <p v-else-if="extraction?.status==='queued'" role="status">已接收文本提取请求，等待开始。</p>
    <p v-else>只提取原文设定，不生成图片、视频或音乐。</p>
  </section>
</template>
<style scoped>
.canvas-asset-extraction{display:grid;gap:8px;padding:12px;color:var(--ui-text-muted);border-top:1px solid var(--ui-border);font-size:var(--liv-canvas-group-label-size)}
.canvas-asset-extraction-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.canvas-asset-extraction p{margin:0;line-height:1.6}
.canvas-asset-extraction p[role=alert]{color:var(--ui-error)}
</style>
