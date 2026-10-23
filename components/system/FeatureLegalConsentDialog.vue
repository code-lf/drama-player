<script setup lang="ts">
import {activeFeatureDocumentCodes,finishFeatureConsent} from '~/shared/legal/featureConsent'
import {supportService} from '~/shared/api/services/supportService'
import type {LegalDocument} from '~/entities/support/types'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
const route=useRoute()
const documents=ref<LegalDocument[]>([]),agreed=ref(false),saving=ref(false),error=ref('')
const creatorCodes=['creator_terms','ai_content_rules','image_generation_terms','video_generation_terms','drama_creation_terms']
/** 创作条款回登录统一确认；支付和上传等独立许可保留既有显式确认，不扩大登录授权范围。 */
watch(()=>activeFeatureDocumentCodes.value.join('|'),async value=>{
  if(!value||!import.meta.client)return
  const codes=[...activeFeatureDocumentCodes.value]
  if(codes.every(code=>creatorCodes.includes(code))){
    const redirect=route.fullPath
    finishFeatureConsent(false)
    await navigateTo({path:'/login',query:{redirect}})
    return
  }
  documents.value=[];agreed.value=false;error.value=''
  try{
    const published=await supportService.getLegalDocuments()
    documents.value=codes.flatMap(code=>published.filter(item=>item.code===code&&item.versions[0]?.status==='published'))
    if(documents.value.length!==codes.length)error.value='条款暂时不可用，请稍后重试。'
  }catch{error.value='条款读取失败，请稍后重试。'}
},{immediate:true})
/** 仅用户明确勾选并点击继续后记录所展示版本；关闭不写入，阅读链接不切换同意状态。 */
async function accept(){
  if(!agreed.value||saving.value||error.value||!documents.value.length)return
  saving.value=true
  try{
    await supportService.acceptFeatureLegalDocuments(documents.value.map(item=>({documentCode:item.code,documentVersionId:item.versions[0]!.id})))
    finishFeatureConsent(true)
  }catch{error.value='确认失败，请关闭后重试。'}finally{saving.value=false}
}
function close(){if(!saving.value)finishFeatureConsent(false)}
</script>
<template>
  <LivDialog :open="!!activeFeatureDocumentCodes.length&&!activeFeatureDocumentCodes.every(code=>creatorCodes.includes(code))" title="使用须知" settings dark @update:open="!$event&&close()">
    <p class="liv-settings-copy">请阅读当前操作涉及的条款。</p>
    <NuxtLink v-for="item in documents" :key="item.code" :to="`/legal/${item.code}`" target="_blank" rel="noopener" class="feature-legal-link">《{{item.versions[0]?.title}}》</NuxtLink>
    <UCheckbox v-model="agreed" class="liv-settings-consent" label="我已阅读并同意上述条款。"/>
    <p v-if="error" role="alert" class="liv-settings-note">{{error}}</p>
    <template #footer><LivButton settings variant="primary" block :disabled="!documents.length||!agreed||saving||!!error" @click="accept">{{saving?'保存中…':'同意并继续'}}</LivButton></template>
  </LivDialog>
</template>
<style scoped>
.feature-legal-link{display:block;color:var(--liv-ui-primary-foreground);font-size:14px;margin-bottom:16px}
</style>
