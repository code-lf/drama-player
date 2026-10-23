<script setup lang="ts">
import {ref,watch,computed,nextTick} from 'vue'
import type {PublicCreationCase} from '~/shared/api/services/creationCaseService'
const props=defineProps<{item:PublicCreationCase|null;items:PublicCreationCase[];busy:boolean;error:string}>()
const emit=defineEmits<{close:[];replica:[];select:[item:PublicCreationCase]}>()
const media=ref<HTMLVideoElement|HTMLAudioElement|null>(null)
const ratio=ref(16/9),expanded=ref(false),playing=ref(false),muted=ref(false)
const duration=ref(0),current=ref(0),playbackError=ref('')
const position=computed(()=>props.items.findIndex(value=>value.id===props.item?.id))
// 媒体高度随底栏令牌预留，增高操作区后小视口仍不会超出屏幕。
const miniSize=computed(()=>({width:`min(${ratio.value<1?'var(--liv-case-mini-portrait-width)':'var(--liv-case-mini-width)'}, calc(100vw - 32px), calc((100dvh - var(--liv-case-controls-height) - 48px) * ${ratio.value}))`}))
/** 默认带声音播放；浏览器拒绝时等待用户点击，不偷偷改为静音播放。 */
async function autoplay(){
  const element=media.value
  if(!element||props.item?.media_type!=='video')return
  element.muted=muted.value
  element.defaultMuted=muted.value
  try{await element.play();if(element===media.value)playing.value=!element.paused&&!element.ended}catch{if(element===media.value)playing.value=false}
}
watch(()=>props.item?.id,async(id,old)=>{
  if(!old||!id)expanded.value=false
  current.value=0;duration.value=0;playing.value=false;playbackError.value='';ratio.value=16/9
  await nextTick()
  if(id===props.item?.id)void autoplay()
})
/** 使用真实元数据决定横竖比例和进度区间，不估算播放状态。 */
function metadata(event:Event){
  const target=event.target as HTMLVideoElement
  if(target.videoWidth>0&&target.videoHeight>0)ratio.value=target.videoWidth/target.videoHeight
  duration.value=Number.isFinite(target.duration)?target.duration:0
  void autoplay()
}
function imageSize(event:Event){const image=event.target as HTMLImageElement;if(image.naturalWidth&&image.naturalHeight)ratio.value=image.naturalWidth/image.naturalHeight}
function syncTime(){if(media.value)current.value=media.value.currentTime}
/** 自动播放事件可能早于模板属性同步，按当前按钮状态再次同步真实静音属性。 */
function onPlay(event:Event){const element=event.target as HTMLMediaElement;if(element!==media.value)return;element.muted=muted.value;playing.value=!element.paused&&!element.ended}
function seek(value:number|number[]|undefined){
  if(!media.value||typeof value!=='number'||!Number.isFinite(value)||!duration.value)return
  media.value.currentTime=Math.max(0,Math.min(duration.value,value));current.value=media.value.currentTime
}
async function togglePlay(){
  const element=media.value;if(!element)return
  if(!element.paused){element.pause();playing.value=false;return}
  element.muted=muted.value
  try{await element.play();if(element===media.value){playing.value=!element.paused&&!element.ended;playbackError.value=''}}catch{if(element===media.value){playing.value=false;playbackError.value='暂时无法播放，请重试。'}}
}
function toggleMute(){muted.value=!muted.value;if(media.value)media.value.muted=muted.value}
/** 只切换目录真实案例，父层仍重新核验公开详情和关联模板。 */
function adjacent(offset:number){const item=props.items[position.value+offset];if(item)emit('select',item)}
function timeLabel(value:number){const seconds=Math.floor(Number.isFinite(value)?value:0);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function escape(){if(expanded.value)expanded.value=false;else emit('close')}
/** 小窗不抢走页面焦点，避免自动聚焦让悬停控制栏一直亮着。 */
function preventAutoFocus(event:Event){event.preventDefault()}
</script>

<template>
  <!-- 复用同一非模态UModal与媒体节点，小窗不遮挡浏览，放大不重载视频。 -->
  <UModal :open="!!item" :modal="false" :overlay="false" :transition="false" :dismissible="false" :close="false" :title="item?.title||'案例预览'" description="播放案例并复用公开创作配方，不自动生成。" :content="{trapFocus:expanded,onEscapeKeyDown:escape,onOpenAutoFocus:preventAutoFocus}" :ui="{content:`creation-case-window ${expanded?'is-expanded':'is-mini'}`,header:'sr-only',description:'sr-only',body:'creation-case-window-body'}" @update:open="value=>{if(!value)emit('close')}">
    <template #body>
      <section v-if="item" class="case-viewer-layout" :style="expanded?undefined:miniSize">
        <main class="case-viewer-main">
          <UButton v-if="expanded" class="case-viewer-back" icon="i-lucide-arrow-left" color="neutral" variant="soft" @click="expanded=false">返回</UButton>
          <div class="case-viewer-player" tabindex="0" :aria-label="`播放：${item.title}`" @keydown.space.self.prevent="togglePlay">
            <div class="case-viewer-stage">
              <video v-if="item.media_type==='video'" ref="media" :key="item.id" :src="item.media_url" :poster="item.cover" :muted="muted" autoplay playsinline preload="metadata" @loadedmetadata="metadata" @timeupdate="syncTime" @play="onPlay" @pause="playing=false" @ended="playing=false" @error="playbackError='视频加载失败，请重新打开。'" @click="togglePlay" />
              <audio v-else-if="item.media_type==='audio'" ref="media" :key="item.id" :src="item.media_url" :muted="muted" preload="metadata" @loadedmetadata="metadata" @timeupdate="syncTime" @play="onPlay" @pause="playing=false" @ended="playing=false" />
              <img v-else :src="item.media_url" :alt="item.title" @load="imageSize">
              <UButton v-if="item.media_type==='video'&&!playing" class="case-viewer-center-play" icon="i-lucide-play" aria-label="播放视频" square color="neutral" variant="soft" @click="togglePlay"/>
              <div class="case-viewer-top case-viewer-hover-controls">
                <div class="case-viewer-top-left">
                  <UTooltip text="关闭播放"><UButton icon="i-lucide-power" aria-label="关闭案例" square color="neutral" variant="ghost" @click="emit('close')"/></UTooltip>
                  <UTooltip :text="expanded?'缩小播放':'放大查看'"><UButton :icon="expanded?'i-lucide-minimize':'i-lucide-maximize'" :aria-label="expanded?'缩小播放':'放大查看'" square color="neutral" variant="ghost" @click="expanded=!expanded"/></UTooltip>
                </div>
                <UButton class="case-viewer-replica" trailing-icon="i-lucide-arrow-up-right" :disabled="!item.template||busy" :loading="busy" @click="emit('replica')">复刻同款</UButton>
              </div>
            </div>
            <!-- 底部操作常驻，上方按钮继续按悬停显示；时间仅保留无障碍语义。 -->
            <div v-if="item.media_type!=='image'" class="case-viewer-footer">
              <USlider class="case-viewer-progress" :model-value="current" :min="0" :max="duration||1" :step="0.1" :disabled="!duration" aria-label="视频播放进度" :aria-valuetext="`${timeLabel(current)} / ${timeLabel(duration)}`" @update:model-value="seek"/>
              <div class="case-viewer-playback-actions">
                <UTooltip :text="playing?'暂停':'播放'"><UButton :aria-label="playing?'暂停视频':'播放视频'" square color="neutral" variant="ghost" @click="togglePlay"><UIcon :key="playing?'pause':'play'" :name="playing?'i-lucide-pause':'i-lucide-play'"/></UButton></UTooltip>
                <UTooltip :text="muted?'开启声音':'静音'"><UButton :icon="muted?'i-lucide-volume-x':'i-lucide-volume-2'" :aria-label="muted?'开启声音':'静音'" square color="neutral" variant="ghost" @click="toggleMute"/></UTooltip>
                <UTooltip text="上一个案例"><UButton icon="i-lucide-arrow-up" aria-label="上一个案例" square color="neutral" variant="ghost" :disabled="position<=0" @click="adjacent(-1)"/></UTooltip>
                <UTooltip text="下一个案例"><UButton icon="i-lucide-arrow-down" aria-label="下一个案例" square color="neutral" variant="ghost" :disabled="position<0||position>=items.length-1" @click="adjacent(1)"/></UTooltip>
              </div>
            </div>
            <p v-if="error||playbackError" class="case-viewer-error" role="alert">{{error||playbackError}}</p>
          </div>
          <div v-if="expanded" class="case-viewer-description"><h2>{{item.title}}</h2><p>{{item.description}}</p></div>
        </main>
        <aside v-if="expanded" class="case-viewer-recommendations" aria-label="更多案例">
          <UButton v-for="value in items" :key="value.id" color="neutral" variant="ghost" :class="{'is-current':value.id===item.id}" :aria-current="value.id===item.id?'true':undefined" @click="emit('select',value)"><img :src="value.cover" :alt="value.title"><span>{{value.title}}</span></UButton>
        </aside>
      </section>
    </template>
  </UModal>
</template>
