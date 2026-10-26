<script setup lang="ts">
import {ref,watch} from 'vue'
/** 视频预览仅定位首帧，不播放、不显示控制条，也不重新生成媒体。 */
const props=defineProps<{kind:string;url:string;cover?:string}>()
// 封面失效时回退真实视频首帧，媒体也失效才显示类型图标，不留下破图或替换为参考图。
const coverFailed=ref(false),videoFailed=ref(false),imageFailed=ref(false)
// 同一位置切换媒体/版本时清除各自失败态；图片失败只显示图片占位，不冒充音频或旧参考图。
watch(()=>[props.kind,props.cover,props.url],()=>{coverFailed.value=false;videoFailed.value=false;imageFailed.value=false})
function seekFrame(event:Event){const video=event.target as HTMLVideoElement;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(.1,video.duration/2)}
</script>
<template>
  <span class="liv-media-preview">
    <img v-if="kind==='image'&&url&&!imageFailed" :src="url" alt="" loading="lazy" decoding="async" @error="imageFailed=true">
    <img v-else-if="kind!=='image'&&cover&&!coverFailed" :src="cover" alt="" loading="lazy" decoding="async" @error="coverFailed=true">
    <video v-else-if="kind==='video'&&url&&!videoFailed" :src="url" muted playsinline preload="metadata" aria-hidden="true" tabindex="-1" @loadedmetadata="seekFrame" @error="videoFailed=true"/>
    <UIcon v-else :name="kind==='image'?'i-lucide-image':kind==='video'?'i-lucide-film':'i-lucide-music'"/>
  </span>
</template>
<style scoped>
.liv-media-preview{display:grid;place-items:center;overflow:hidden;min-width:0;min-height:0;width:100%;height:100%;pointer-events:none}
.liv-media-preview>img,.liv-media-preview>video{width:100%;height:100%;object-fit:cover}
</style>
