<script setup lang="ts">
import {ref,watch} from 'vue'
/** 视频预览仅定位首帧，不播放、不显示控制条，也不重新生成媒体。 */
const props=defineProps<{kind:string;url:string;cover?:string;stableThumbnail?:boolean}>()
// 封面失效时回退真实视频首帧，媒体也失效才显示类型图标，不留下破图或替换为参考图。
const coverFailed=ref(false),videoFailed=ref(false),imageFailed=ref(false)
// 同一位置切换媒体/版本时清除各自失败态；图片失败只显示图片占位，不冒充音频或旧参考图。
watch(()=>[props.kind,props.cover,props.url],()=>{coverFailed.value=false;videoFailed.value=false;imageFailed.value=false})
function seekFrame(event:Event){const video=event.target as HTMLVideoElement;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(.1,video.duration/2)}
</script>
<template>
  <span class="liv-media-preview">
    <!-- 固定任务缩略图预留40px尺寸并同步解码，避免大图异步呈现挤动悬浮通知；普通列表仍懒加载。 -->
    <img v-if="kind==='image'&&url&&!imageFailed" :src="url" alt="" :width="stableThumbnail?40:undefined" :height="stableThumbnail?40:undefined" :loading="stableThumbnail?'eager':'lazy'" :decoding="stableThumbnail?'sync':'async'" @error="imageFailed=true">
    <img v-else-if="kind!=='image'&&cover&&!coverFailed" :src="cover" alt="" :width="stableThumbnail?40:undefined" :height="stableThumbnail?40:undefined" :loading="stableThumbnail?'eager':'lazy'" :decoding="stableThumbnail?'sync':'async'" @error="coverFailed=true">
    <video v-else-if="kind==='video'&&url&&!videoFailed" :src="url" muted playsinline preload="metadata" aria-hidden="true" tabindex="-1" @loadedmetadata="seekFrame" @error="videoFailed=true"/>
    <UIcon v-else class="liv-media-preview-icon" :name="kind==='image'?'i-lucide-image':kind==='video'?'i-lucide-film':'i-lucide-music'"/>
  </span>
</template>
<style scoped>
.liv-media-preview{display:grid;place-items:center;overflow:hidden;min-width:0;min-height:0;width:100%;height:100%;pointer-events:none}
.liv-media-preview>img,.liv-media-preview>video{width:100%;height:100%;object-fit:cover}
/* Nuxt图标以span渲染，直接限定图标尺寸，避免依赖并不存在的svg子元素。 */
.liv-media-preview-icon{width:1.5rem;height:1.5rem;flex-shrink:0}
</style>
