<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import type {CreativeNode} from '../agentCanvas'
import {zoomAt} from '../canvasNavigation'
import {creationService} from '~/shared/api/services/creationService'

const props=defineProps<{node:CreativeNode}>()
const emit=defineEmits<{close:[]}>()
const url=ref(''),error=ref(''),loading=ref(true),width=ref(0),height=ref(0),bytes=ref(0),format=ref('')
const zoom=ref(100),pan=ref({x:0,y:0}),stage=ref<HTMLElement|null>(null)
let epoch=0,drag:{x:number;y:number;pan:{x:number;y:number}}|undefined
const size=computed(()=>bytes.value>=1048576?`${(bytes.value/1048576).toFixed(2)} MB`:`${(bytes.value/1024).toFixed(1)} KB`)
/** 仅受权读取当前来源原文件；切换/关闭后丢弃迟到响应，不采购或改写图片。 */
watch(()=>[props.node.id,props.node.data.url],async()=>{
  const current=++epoch
  if(url.value)URL.revokeObjectURL(url.value)
  url.value='';loading.value=true;error.value='';width.value=height.value=0;zoom.value=100;pan.value={x:0,y:0}
  try{
    const source=props.node.data.source
    if(!source)throw new Error('图片来源暂不可用。')
    const file=await creationService.sourceMedia(source)
    if(current!==epoch)return
    if(!file.type.startsWith('image/'))throw new Error('该来源没有可预览的图片文件。')
    bytes.value=file.size;format.value=file.type.split('/')[1].toUpperCase();url.value=URL.createObjectURL(file)
  }catch(cause){if(current===epoch){error.value=(cause as Error).message||'原图读取失败，请关闭后重试。';loading.value=false}}
},{immediate:true})
/** 元数据只取实际文件；不根据方案、扩展名或当前节点大小猜测尺寸。 */
function loaded(event:Event){const image=event.target as HTMLImageElement;width.value=image.naturalWidth;height.value=image.naturalHeight;loading.value=false}
/** 图片缩放以鼠标为中心；只读预览内普通滚轮即可使用，不影响底层画布或提示词。 */
function wheel(event:WheelEvent){
  if(!url.value||loading.value)return
  event.preventDefault();event.stopPropagation()
  const rect=stage.value?.getBoundingClientRect();if(!rect)return
  const next=zoomAt(zoom.value,pan.value,{x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2},event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1))
  zoom.value=next.zoom;pan.value=next.pan
}
function reset(){zoom.value=100;pan.value={x:0,y:0}}
/** 放大后可拖动查看细节，平移不涉及任何图片编辑操作。 */
function startPan(event:PointerEvent){if(event.button!==0)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,pan:{...pan.value}};(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}
function movePan(event:PointerEvent){if(drag)pan.value={x:drag.pan.x+event.clientX-drag.x,y:drag.pan.y+event.clientY-drag.y}}
function stopPan(){drag=undefined}
onBeforeUnmount(()=>{epoch++;if(url.value)URL.revokeObjectURL(url.value)})
</script>
<template>
  <UModal :open="true" fullscreen :title="node.data.title" description="只读原图预览，滚轮缩放、拖动查看，Esc关闭。" :ui="{content:'creation-image-lightbox',header:'sr-only',body:'p-0 flex-1 min-h-0'}" @update:open="open=>{if(!open)emit('close')}">
    <template #body>
      <section class="relative flex h-full min-h-0 flex-col" aria-label="原图预览">
        <div ref="stage" class="creation-image-lightbox-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden touch-none" @wheel="wheel" @pointerdown="startPan" @pointermove="movePan" @pointerup="stopPan" @pointercancel="stopPan" @lostpointercapture="stopPan" @dblclick="reset">
          <img v-if="url" :src="url" :alt="node.data.title" class="block max-h-full max-w-full select-none object-contain" :style="{transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom/100})`}" draggable="false" @load="loaded" @error="loading=false;error='图片解码失败，请关闭后重试。'">
          <span v-if="loading" role="status" class="absolute">正在读取原图…</span><p v-if="error" role="alert" class="absolute">{{error}}</p>
        </div>
        <UTooltip text="关闭预览（Esc）"><UButton class="absolute right-4 top-4" icon="i-lucide-x" square color="neutral" variant="soft" aria-label="关闭原图预览" @click="emit('close')"/></UTooltip>
        <dl v-if="width&&height" class="creation-image-lightbox-info pointer-events-none absolute bottom-4 left-4 rounded-xl p-4 text-xs leading-relaxed">
          <div>尺寸：{{width}} × {{height}} px</div><div>格式：{{format}}</div><div>比例（宽/高）：{{(width/height).toFixed(2)}}</div><div>大小：{{size}}</div>
        </dl>
        <div class="creation-image-lightbox-controls absolute bottom-4 right-4 flex items-center gap-2 rounded-full p-2" aria-label="原图缩放工具">
          <UButton icon="i-lucide-minus" square color="neutral" variant="ghost" aria-label="缩小原图" :disabled="zoom<=25" @click="zoom=Math.max(25,zoom-25)"/><span class="text-xs">{{zoom}}%</span><UButton icon="i-lucide-plus" square color="neutral" variant="ghost" aria-label="放大原图" :disabled="zoom>=400" @click="zoom=Math.min(400,zoom+25)"/><UButton icon="i-lucide-scan" square color="neutral" variant="ghost" aria-label="适应窗口" @click="reset"/>
        </div>
      </section>
    </template>
  </UModal>
</template>
<style>
/* 只读媒体舞台使用已有深色工作区令牌；业务表单和主聊天主题不受影响。 */
.creation-image-lightbox{background:var(--liv-workspace-surface);color:var(--liv-account-text)}
.creation-image-lightbox-stage{padding:var(--liv-workspace-media-padding,24px);cursor:grab}
.creation-image-lightbox-stage:active{cursor:grabbing}
.creation-image-lightbox-info,.creation-image-lightbox-controls{background:var(--liv-account-raised);color:var(--liv-account-text)}
</style>
