<script setup lang="ts">
import {supportService} from '~/shared/api/services/supportService'
import type {LegalDocument} from '~/entities/support/types'
import LegalDocumentContent from './LegalDocumentContent.vue'
const props=defineProps<{code?:string;bundle?:boolean}>()
const documents=ref<LegalDocument[]>([]),loading=ref(true),error=ref('')
let revision=0
/** 仅阅读已发布正文；合并版未发布时展示原四份条款，不发布新版本或记录同意。 */
async function load(){const current=++revision;loading.value=true;error.value='';try{
  const all=(await supportService.getLegalDocuments()).filter(item=>item.versions[0]?.status==='published')
  const merged=all.find(item=>item.code==='creator_terms')
  const codes=['ai_content_rules','image_generation_terms','video_generation_terms','drama_creation_terms']
  // 登录的用户协议入口汇总当前要求确认的原文，不创建合并法律版本，不包含独立隐私政策。
  const selected=props.bundle?all.filter(item=>item.code!=='privacy_policy'&&item.versions[0]?.requiresAcceptance):props.code?all.filter(item=>item.code===props.code):merged?[merged]:codes.flatMap(code=>all.filter(item=>item.code===code))
  if(current!==revision)return
  documents.value=selected
  if(!selected.length)error.value='协议尚未发布或暂时不可用。'
}catch{if(current===revision)error.value='协议读取失败，请重试。'}finally{if(current===revision)loading.value=false}}
watch(()=>[props.code,props.bundle],load,{immediate:true})
onBeforeUnmount(()=>revision++)
useHead({title:()=>`${props.bundle?'用户协议':props.code?documents.value[0]?.versions[0]?.title||'平台协议':'创作者协议'} - Livliv`})
</script>
<template>
  <main class="legal-reading-page"><div class="legal-reading-wrap">
    <NuxtLink to="/dashboard" class="legal-reading-back">← 返回工作台</NuxtLink>
    <h1>{{bundle?'Livliv 用户协议':code?documents[0]?.versions[0]?.title||'平台协议':'Livliv 创作者协议'}}</h1>
    <DashboardSkeleton v-if="loading" :rows="5"/>
    <div v-else-if="error" role="alert"><p>{{error}}</p><UButton variant="outline" @click="load">重试读取</UButton></div>
    <template v-else>
      <nav v-if="documents.length>1" class="legal-reading-index" aria-label="协议目录"><a v-for="item in documents" :key="item.code" :href="`#${item.code}`">{{item.versions[0]?.title}}</a></nav>
      <section v-for="item in documents" :id="item.code" :key="item.code" class="legal-reading-document">
        <h2 v-if="!code">{{item.versions[0]?.title}}</h2>
        <p class="legal-reading-meta">版本 {{item.versions[0]?.version}}<template v-if="item.versions[0]?.publishedAt"> · 发布日期：{{new Date(item.versions[0].publishedAt).toLocaleDateString('zh-CN')}}</template></p>
        <p v-if="item.versions[0]?.summary" class="legal-reading-summary">{{item.versions[0].summary}}</p>
        <LegalDocumentContent :content="item.versions[0]?.content||''"/>
      </section>
    </template>
  </div></main>
</template>
<style scoped>
/* 协议独立页面沿用明暗主题令牌，不使用固定白底、旧蓝色或签署控件。 */
.legal-reading-page{min-height:100dvh;background:var(--color-bg);color:var(--color-text-main);padding:32px 24px}.legal-reading-wrap{max-width:960px;margin:0 auto}
.legal-reading-back,.legal-reading-index a{color:var(--liv-ui-primary-foreground);font-size:14px}.legal-reading-page h1{font-size:24px;line-height:1.5;margin:24px 0}.legal-reading-page h2{font-size:20px;line-height:1.5;margin:0 0 8px}
.legal-reading-index{display:flex;flex-wrap:wrap;gap:12px 24px;margin-bottom:24px}.legal-reading-document{background:var(--color-panel);border:1px solid var(--color-border-soft);border-radius:16px;padding:24px;margin-bottom:24px;scroll-margin-top:24px}
.legal-reading-meta{color:var(--color-text-muted);font-size:12px;margin:0 0 24px}.legal-reading-summary{font-size:14px;line-height:1.7;color:var(--color-text-muted);margin-bottom:24px}
@media(max-width:640px){.legal-reading-page{padding:16px}.legal-reading-document{padding:16px}}
</style>
