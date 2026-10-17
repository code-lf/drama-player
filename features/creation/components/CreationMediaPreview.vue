<script setup lang="ts">
/** 视频预览仅定位首帧，不播放、不显示控制条，也不重新生成媒体。 */
defineProps<{kind:string;url:string;cover?:string}>()
function seekFrame(event:Event){const video=event.target as HTMLVideoElement;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(.1,video.duration/2)}
</script>
<template>
  <span class="liv-media-preview">
    <img v-if="cover" :src="cover" alt="" loading="lazy" decoding="async">
    <video v-else-if="kind==='video'&&url" :src="url" muted playsinline preload="metadata" aria-hidden="true" tabindex="-1" @loadedmetadata="seekFrame"/>
    <UIcon v-else :name="kind==='video'?'i-lucide-film':'i-lucide-music'"/>
  </span>
</template>
<style scoped>
.liv-media-preview{display:grid;place-items:center;overflow:hidden;min-width:0;min-height:0;width:100%;height:100%;pointer-events:none}
.liv-media-preview>img,.liv-media-preview>video{width:100%;height:100%;object-fit:cover}
</style>
