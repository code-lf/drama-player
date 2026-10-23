<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount,watch} from 'vue'
const props=defineProps<{cover:string;video?:string;alt:string;autoplay?:boolean;hoverOnly?:boolean;focused?:boolean}>()
const host=ref<HTMLElement|null>(null),player=ref<HTMLVideoElement|null>(null),visible=ref(false),hovered=ref(false),failed=ref(false)
let observer:IntersectionObserver|undefined
/** 模板可见后静音播放，案例只悬停播放；离屏暂停，避免瀑布流同时下载全部视频。 */
function syncPlayback(){
  const element=player.value
  if(!element)return
  element.muted=true
  // 技能卡片在触屏不自动播放；模板与案例维持原有播放契约。
  if(props.hoverOnly&&!window.matchMedia('(hover:hover) and (pointer:fine)').matches){element.pause();return}
  if(visible.value&&(props.autoplay||hovered.value||props.focused)&&!failed.value)void element.play().catch(()=>{/* 浏览器拒绝自动播放时保留真实封面。 */})
  else element.pause()
}
watch([visible,hovered,()=>props.autoplay,()=>props.focused],syncPlayback)
watch(()=>props.video,()=>{failed.value=false})
onMounted(()=>{
  observer=new IntersectionObserver(entries=>{visible.value=!!entries[0]?.isIntersecting},{threshold:.05})
  if(host.value)observer.observe(host.value)
})
onBeforeUnmount(()=>{observer?.disconnect();player.value?.pause()})
</script>
<template>
  <div ref="host" class="creation-preview-media" @pointerenter="hovered=true" @pointerleave="hovered=false" @focusin="hovered=true" @focusout="hovered=false">
    <img :src="cover" :alt="alt" loading="lazy">
    <video v-if="video&&visible&&!failed" ref="player" :src="video" :poster="cover" muted loop playsinline preload="metadata" aria-hidden="true" @loadeddata="syncPlayback" @error="failed=true"/>
  </div>
</template>
