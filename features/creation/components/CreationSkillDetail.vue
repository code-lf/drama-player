<script setup lang="ts">
import type {SystemSkill} from '../types'
import {skillGuide} from '../skillPresentation'
import {skillCenterService} from '~/shared/api/services/skillCenterService'
const props=defineProps<{skill:SystemSkill|null;busy?:boolean}>()
const emit=defineEmits<{close:[];closed:[];try:[row:SystemSkill];favorite:[id:string,enabled:boolean]}>()
const {auth,requireLogin}=useWorkbenchAuth(),toast=useToast()
const saving=ref(false),favorite=ref(false)
watch(()=>props.skill,row=>favorite.value=!!row?.is_favorite,{immediate:true})
/** 收藏使用原接口；跨账号或切换详情后的迟到结果不污染当前技能。 */
async function toggleFavorite(){const row=props.skill,owner=auth.session.user?.id;if(!row||saving.value||!requireLogin())return;saving.value=true;try{await skillCenterService.favorite(row.id,!favorite.value);if(owner!==auth.session.user?.id||props.skill?.id!==row.id)return;favorite.value=!favorite.value;emit('favorite',row.id,favorite.value)}catch{toast.add({title:'收藏未保存，请重试',color:'error'})}finally{saving.value=false}}
/** 只分享平台公开技能预览链接，不携带草稿、私人技能或素材地址。 */
async function share(){const row=props.skill;if(!row||row.kind==='user')return;try{const link=new URL('/dashboard',window.location.origin);link.searchParams.set('entry',row.entries.includes('commerce')?'commerce':row.entries[0]||'free');link.searchParams.set('skillPreview',row.id);await navigator.clipboard.writeText(link.href);toast.add({title:'分享链接已复制'})}catch{toast.add({title:'复制失败，请重试',color:'error'})}}
</script>
<template>
  <UModal :open="!!skill" title="技能详情" :ui="{overlay:'liv-skill-detail-overlay',content:'liv-skill-detail-dialog',header:'liv-skill-detail-header',body:'liv-skill-detail-body'}" @update:open="!$event&&emit('close')" @after:leave="emit('closed')">
    <template #header><div v-if="skill" class="liv-skill-detail-title"><h2>{{skill.label}}</h2><div class="liv-skill-detail-actions"><UDropdownMenu v-if="skill.kind!=='user'" :items="[{label:'分享',icon:'i-lucide-share-2',onSelect:share}]"><UButton icon="i-lucide-ellipsis" color="neutral" variant="soft" square aria-label="更多技能操作"/></UDropdownMenu><UButton :icon="favorite?'i-lucide-star-off':'i-lucide-star'" :aria-label="favorite?'取消收藏技能':'收藏技能'" :aria-pressed="favorite" :loading="saving" color="neutral" variant="soft" square @click="toggleFavorite"/><UButton color="neutral" class="liv-skill-try" :disabled="busy||skill.is_active===false" @click="emit('try',skill)">试一试</UButton><UButton icon="i-lucide-x" color="neutral" variant="ghost" square aria-label="关闭技能详情" @click="emit('close')"/></div></div></template>
    <template #body><div v-if="skill"><div class="liv-skill-detail-media"><video v-if="skill.home_showcase?.video||skill.home_showcase?.preview_clip" :src="skill.home_showcase.video||skill.home_showcase.preview_clip" :poster="skill.home_showcase.cover||skill.cover" controls playsinline preload="metadata"/><img v-else-if="skill.home_showcase?.cover||skill.cover" :src="skill.home_showcase?.cover||skill.cover" :alt="skill.label"/></div><p v-if="skill.home_showcase?.temporary_reference" class="liv-skill-media-source">临时参考媒体 · 来源：<a :href="skill.home_showcase.source_url" target="_blank" rel="noopener noreferrer">{{skill.home_showcase.source_name}}</a>，非本站生成作品。视频为最多十秒静音预览，不作为生成素材或商业授权。</p><section v-for="section in skillGuide(skill)" :key="section.title" class="liv-skill-guide-section"><h3>{{section.title}}</h3><p>{{section.text}}</p></section><slot name="manage"/></div></template>
  </UModal>
</template>
<style>
/* 业务详情复用 UModal；媒体自然比例，正文可滚动，标题和操作保持在顶部。 */
.liv-skill-detail-overlay{background:rgba(0,0,0,.65)!important;backdrop-filter:blur(3px)}
.liv-skill-detail-actions button{background:var(--liv-account-raised);color:var(--liv-account-text)}
.liv-skill-detail-dialog{width:calc(100vw - 32px);max-width:800px!important;max-height:calc(100dvh - 64px);background:var(--liv-workspace-surface);color:var(--liv-account-text);border-radius:24px;overflow:hidden}
.liv-skill-detail-header{padding:20px 24px!important;flex:none}.liv-skill-detail-title{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-width:0}.liv-skill-detail-title h2{font-size:18px;line-height:26px;font-weight:700;margin:0;min-width:0;overflow-wrap:anywhere}.liv-skill-detail-actions{display:flex;gap:8px;align-items:center;flex:none}.liv-skill-detail-actions button{height:36px;min-height:36px;border-radius:999px;font-size:13px}.liv-skill-detail-actions .liv-skill-try{background:var(--liv-control-on-primary);color:var(--liv-page-background)}
.liv-skill-detail-body{padding:0 24px 24px!important;overflow-y:auto}.liv-skill-detail-media{display:flex;justify-content:center;margin-bottom:24px}.liv-skill-detail-media img{display:block;max-width:100%;max-height:420px;width:auto;height:auto;border-radius:12px}.liv-skill-detail-media video{display:block;width:100%;height:auto;max-height:480px;border-radius:12px}
.liv-skill-guide-section{margin:20px 0 0}.liv-skill-guide-section h3{font-size:14px;line-height:22px;color:var(--liv-account-muted);font-weight:600;margin:0 0 6px}.liv-skill-guide-section p{font-size:14px;line-height:1.75;white-space:pre-wrap;margin:0;color:var(--liv-account-text);overflow-wrap:anywhere}
.liv-skill-media-source{font-size:14px;line-height:1.7;color:var(--liv-account-muted)}.liv-skill-media-source a{color:inherit;text-decoration:underline;cursor:pointer}
@media(max-width:600px){.liv-skill-detail-dialog{max-height:calc(100dvh - 32px)}.liv-skill-detail-title{align-items:flex-start;flex-direction:column;gap:12px}.liv-skill-detail-header{padding:16px!important}.liv-skill-detail-body{padding:0 16px 16px!important}}
</style>
