<script setup lang="ts">
import MusicPlayer from '~/features/music/components/MusicPlayer.vue'
import type {PublicMusicSong} from '~/shared/api/services/musicService'
const route=useRoute(),config=useRuntimeConfig()
// 匿名分享故意不使用携带账号 token 的请求适配器；失效链接也不能唤起登录弹窗。
const {data:song,status,error,refresh}=await useAsyncData(
  ()=>`public-music:${String(route.params.token)}`,
  ()=>$fetch<PublicMusicSong>(`${config.public.apiBase}/music/shared/${encodeURIComponent(String(route.params.token))}`,{retry:0,credentials:'omit',cache:'no-store'}),
)
useHead(()=>({title:`${song.value?.title||'音乐分享'} · Livliv Music`,meta:[{name:'robots',content:'noindex, nofollow, noarchive'},{name:'referrer',content:'no-referrer'}]}))
const unavailable=computed(()=>[404,409].includes(Number((error.value as {statusCode?:number}|null)?.statusCode)))
</script>
<template>
  <main class="music-public-page">
    <header><NuxtLink to="/dashboard?entry=free" class="music-public-brand">Livliv<span>MUSIC</span></NuxtLink><span>音乐分享 · 免登录聆听</span><UButton to="/dashboard?entry=free" icon="i-lucide-sparkles" color="primary">创作我的音乐</UButton></header>
    <section v-if="status==='pending'" class="music-public-skeleton" aria-busy="true" aria-label="正在读取分享音乐"><USkeleton class="h-96 w-full"/><USkeleton class="h-96 w-full"/></section>
    <section v-else-if="error||!song" class="music-public-empty" role="status"><UIcon name="i-lucide-disc-3"/><h1>{{unavailable?'分享不存在或已关闭':'音乐暂时无法加载'}}</h1><p>{{unavailable?'作品主人可能已关闭分享，或音频暂不可用。':'请检查网络后重试，不会发起新的生成任务。'}}</p><UButton v-if="!unavailable" icon="i-lucide-refresh-cw" @click="refresh()">重新读取</UButton></section>
    <!-- 公开页没有任务输入、账号查询、收费按钮或自动生成／分析入口。 -->
    <MusicPlayer v-else standalone :url="song.audio_url" :title="song.title" :cover="song.cover" :lyrics="song.lyrics" :alignment="song.alignment" :style="song.style" :tracks="[{key:'shared',title:song.title,cover:song.cover}]" selected="shared"/>
    <footer>AI 创作音乐 · 请尊重作品权利，未经授权请勿另作使用</footer>
  </main>
</template>
<style scoped>
.music-public-page{min-height:100dvh;background:var(--liv-music-stage);color:var(--liv-music-text);padding:24px clamp(16px,3vw,48px);box-sizing:border-box}.music-public-page>header{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1800px;margin:0 auto 24px}.music-public-page>header>span{font-size:12px;color:var(--liv-music-muted)}.music-public-brand{display:flex;align-items:center;gap:12px;font-size:24px;font-weight:600;color:var(--liv-music-highlight)}.music-public-brand span{font-size:12px;letter-spacing:.18em}.music-public-page:deep(.liv-music-player){max-width:1800px}.music-public-page>footer{text-align:center;font-size:12px;line-height:1.7;color:var(--liv-music-muted);margin:24px auto 0}.music-public-empty{display:grid;justify-items:center;align-content:center;gap:16px;min-height:60dvh;text-align:center}.music-public-empty>.iconify{width:64px;height:64px;color:var(--liv-music-highlight)}.music-public-empty h1{font-size:24px;margin:0}.music-public-empty p{font-size:14px;color:var(--liv-music-muted);margin:0}.music-public-skeleton{display:grid;grid-template-columns:1fr 1.2fr;gap:24px}@media(max-width:760px){.music-public-page>header>span{display:none}.music-public-skeleton{grid-template-columns:1fr}}
</style>
