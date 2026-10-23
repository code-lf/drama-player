<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {CreationTemplate} from '../types'
import CreationPreviewMedia from './CreationPreviewMedia.vue'
const props=defineProps<{open:boolean;templates:CreationTemplate[];recent:string[]}>()
const emit=defineEmits<{'update:open':[value:boolean];select:[item:CreationTemplate]}>()
const query=ref(''),category=ref('全部'),scope=ref('all')
/** 只筛选接口已返回的真实模板，不添加没有个人模板接口支持的空入口。 */
const categories=computed(()=>['全部',...new Set(props.templates.map(item=>item.category).filter(Boolean))])
const filtered=computed(()=>props.templates.filter(item=>(scope.value!=='recent'||props.recent.includes(item.id))&&(category.value==='全部'||item.category===category.value)&&(!query.value.trim()||`${item.name}${item.prompt}${item.category}`.toLowerCase().includes(query.value.trim().toLowerCase()))))
// 背景仅复用目录中已公开的封面，不使用用户私人附件，不另行生成图片。
const backgroundCovers=computed(()=>[...new Set(props.templates.map(item=>item.cover).filter(Boolean))].slice(0,4))
watch(()=>props.open,value=>{if(value){query.value='';category.value='全部'}})
</script>
<template>
  <Teleport to="body"><div v-if="open" class="creation-template-atmosphere" aria-hidden="true"><img v-for="cover in backgroundCovers" :key="cover" :src="cover" alt=""/></div></Teleport>
  <UModal :open="open" title="创作模板" description="搜索和选择创作模板，仅套用到草稿，不自动生成作品。" :ui="{overlay:'creation-template-overlay',content:'creation-template-dialog',header:'creation-template-dialog-header',body:'creation-template-dialog-body',title:'sr-only',description:'sr-only',close:'creation-template-close'}" @update:open="emit('update:open',$event)">
    <template #title><span class="sr-only">创作模板</span></template>
    <template #actions>
      <div class="creation-template-heading">
        <div class="creation-template-tabs" role="tablist" aria-label="模板范围"><UButton role="tab" :aria-selected="scope==='all'" :class="{active:scope==='all'}" color="neutral" variant="ghost" @click="scope='all'">全部模板</UButton><UButton role="tab" :aria-selected="scope==='recent'" :class="{active:scope==='recent'}" color="neutral" variant="ghost" @click="scope='recent'">最近使用</UButton></div>
        <UInput v-model="query" class="creation-template-search" icon="i-lucide-search" placeholder="搜索模板" aria-label="搜索模板"/>
      </div>
    </template>
    <template #close><UButton class="creation-template-close" icon="i-lucide-x" color="neutral" variant="ghost" square aria-label="关闭模板"/></template>
    <template #body>
      <nav class="creation-template-categories" aria-label="模板分类"><UButton v-for="name in categories" :key="name" color="neutral" :variant="category===name?'soft':'outline'" :aria-pressed="category===name" @click="category=name">{{name}}</UButton></nav>
      <div class="creation-template-results">
        <div v-if="filtered.length" class="creation-template-masonry"><button v-for="item in filtered" :key="item.id" class="creation-template-tile" :aria-label="`套用模板：${item.name}`" @click="emit('select',item)"><CreationPreviewMedia :cover="item.cover" :video="item.preview_clip||item.preview_video" :alt="item.name" autoplay/><span>{{item.name}}</span></button></div>
        <p v-else class="creation-template-empty" role="status">{{scope==='recent'?'暂无符合条件的最近模板。':'没有符合条件的模板。'}}</p>
      </div>
    </template>
  </UModal>
</template>
