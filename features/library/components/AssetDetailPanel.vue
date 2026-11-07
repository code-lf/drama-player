<script setup lang="ts">
import type {LibraryItem} from '~/entities/library/types'
import {libraryService} from '~/shared/api/services/libraryService'
import LivButton from '~/components/liv-ui/LivButton.vue'
const props=defineProps<{item:LibraryItem}>()
const emit=defineEmits<{back:[]}>()
const selected=ref(props.item.versions[0]?.id||''),prompt=ref(''),loading=ref(false),error=ref('')
const version=computed(()=>props.item.versions.find(row=>row.id===selected.value))
const {auth}=useWorkbenchAuth()
let revision=0
/** 切版本只读原提示词，旧请求不可覆盖新版本；上传素材明确无原生成提示词。 */
watch(selected,async id=>{const current=++revision;prompt.value='';error.value='';if(!id)return;loading.value=true;try{const result=await libraryService.creationContext(props.item.id,id);if(current===revision)prompt.value=result.prompt}catch{if(current===revision)error.value='原提示词暂时无法读取，可先预览素材。'}finally{if(current===revision)loading.value=false}},{immediate:true})
onBeforeUnmount(()=>revision++)
/** 带入新草稿而非原任务重做，签名地址和提示词不放入URL；采购仍由工作台核价确认。 */
async function useOnCanvas(){
 if(!version.value||loading.value)return
 useState('library-canvas-handoff',()=>null as null|{owner:string;itemId:string;versionId:string;prompt:string}).value={owner:auth.session.user?.id||'',itemId:props.item.id,versionId:version.value.id,prompt:prompt.value}
 await navigateTo({path:'/dashboard',query:{entry:'free',asset:props.item.id,assetVersion:version.value.id}})
}
</script>
<template>
 <section class="asset-detail">
  <header><LivButton icon-only variant="ghost" icon="i-lucide-arrow-left" aria-label="返回资产" @click="emit('back')"/><h1>资产详情</h1></header>
  <div class="asset-detail-surface"><h2>{{item.name}}</h2>
   <img v-if="item.media_type==='image'" :src="libraryService.previewUrl(version?.preview_url||'')" :alt="item.name"/>
   <video v-else-if="item.media_type==='video'" :src="libraryService.previewUrl(version?.preview_url||'')" controls preload="metadata"/>
   <audio v-else-if="item.media_type==='audio'" :src="libraryService.previewUrl(version?.preview_url||'')" controls preload="metadata"/>
   <p v-else>此文件请在文档与版本管理中查看。</p>
   <div class="asset-version-list"><UButton v-for="row in item.versions" :key="row.id" color="neutral" :variant="selected===row.id?'solid':'ghost'" @click="selected=row.id">版本 {{row.version_no}}</UButton></div>
   <label for="asset-original-prompt">创作提示词</label><USkeleton v-if="loading" class="h-24"/>
   <UTextarea v-else id="asset-original-prompt" v-model="prompt" :rows="4" class="w-full" placeholder="此素材没有可读取的原生成提示词。可填写新的创作要求，例如：保持主体，改为柔和晨光背景。"/>
   <p v-if="error" role="alert">{{error}}</p><p class="asset-detail-note">修改只用于新的创作，不覆盖原素材。生成前仍需确认方案与积分。</p>
   <LivButton variant="primary" :disabled="loading||!version" @click="useOnCanvas">用于画布</LivButton>
  </div>
 </section>
</template>
<style scoped>
.asset-detail{color:var(--liv-project-text)}.asset-detail header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.asset-detail h1{font-size:24px}.asset-detail h2{font-size:18px;margin-bottom:20px}.asset-detail-surface{background:var(--liv-project-card-surface);border-radius:24px;padding:28px}.asset-detail img,.asset-detail video{display:block;max-height:380px;width:100%;object-fit:contain;border-radius:16px;background:var(--liv-project-cover-surface)}.asset-detail audio{width:100%}.asset-version-list{display:flex;gap:8px;margin:18px 0}.asset-detail label{display:block;margin-bottom:10px;font-size:14px}.asset-detail-note{font-size:13px;color:var(--liv-project-muted);margin:12px 0 18px}
</style>
