<script setup lang="ts">
import {computed,nextTick,ref,watch,useId,onMounted,onBeforeUnmount} from 'vue'
import MusicShareDialog from './MusicShareDialog.vue'
import {plainLyricLines,timedLyrics,toLrc} from '../utils/lyricsTimeline'
const props=defineProps<{url:string;title:string;cover?:string;lyrics?:string;alignment?:unknown;style?:string;standalone?:boolean;compact?:boolean;playbackEnabled?:boolean;controlsTarget?:string;tracks?:Array<{key:string;title:string;cover?:string}>;selected?:string;taskId?:string;trackNumber?:number;downloadable?:boolean}>()
const emit=defineEmits<{select:[key:string];download:[]}>()
const audio=ref<HTMLAudioElement|null>(null),root=ref<HTMLElement|null>(null),lyricRoot=ref<HTMLElement|null>(null)
const position=ref(0),duration=ref(0),playing=ref(false),volume=ref(1),immersive=ref(false),error=ref(''),following=ref(true)
const detailId=useId()
const shareOpen=ref(false),tab=ref<'lyrics'|'info'>('lyrics'),repeat=ref(false),shuffle=ref(false)
const progress=computed(()=>duration.value>0?Math.min(100,Math.max(0,position.value/duration.value*100)):0)
const timeline=computed(()=>timedLyrics(props.alignment||props.lyrics||''))
const lines=computed(()=>plainLyricLines(props.lyrics||''))
const active=computed(()=>{for(let i=timeline.value.length-1;i>=0;i--)if(position.value>=timeline.value[i]!.start)return i;return -1})
const trackIndex=computed(()=>props.tracks?.findIndex(track=>track.key===props.selected)??-1)
/** 节点可能只传一首歌；展示原任务曲目序号，不把局部播放列表第一项误称原第一首。 */
const displayTrackNumber=computed(()=>Number.isInteger(props.trackNumber)&&(props.trackNumber??-1)>=0?props.trackNumber!+1:trackIndex.value>=0?trackIndex.value+1:undefined)
/** 复用同画布的屏幕坐标工具宿主，只有控件移动，audio始终留在同一播放器实例。 */
const dockControls=computed(()=>!!props.compact&&!immersive.value&&!!props.controlsTarget)
/** 只在歌词容器内跟随真实时间轴；用户浏览时不抢夺滚动位置。 */
async function follow(){await nextTick();const el=lyricRoot.value,line=el?.querySelector<HTMLElement>(`[data-line="${active.value}"]`);if(el&&line)el.scrollTo({top:line.offsetTop-el.clientHeight/2+line.clientHeight/2,behavior:'smooth'})}
watch(active,()=>{if(following.value)void follow()})
watch(tab,()=>{if(tab.value==='lyrics'&&following.value)void follow()})
/** 标签页支持左右键，焦点留在当前音乐区域，不与别的播放器重复 ID。 */
function tabKey(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();tab.value=event.key==='Home'?'lyrics':event.key==='End'?'info':tab.value==='lyrics'?'info':'lyrics';nextTick(()=>root.value?.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')?.focus())}
let resumeOnLoad=false
/** 隐藏画布/打开业务弹窗/离开页面均清除续播意图，仅暂停原音频，不清空进度。 */
function pausePlayback(){resumeOnLoad=false;audio.value?.pause();playing.value=false}
watch(()=>props.playbackEnabled,allowed=>{if(allowed===false)pausePlayback()},{flush:'sync'})
function visibilityChanged(){if(document.hidden)pausePlayback()}
onMounted(()=>document.addEventListener('visibilitychange',visibilityChanged))
onBeforeUnmount(()=>{pausePlayback();document.removeEventListener('visibilitychange',visibilityChanged)})
/** 异步play完成时仍检查当前可见性，防止隐藏后迟到的播放事件重新出声。 */
function played(){if(props.playbackEnabled===false||document.hidden){pausePlayback();return}playing.value=true;error.value=''}
/** 切换曲目沿用播放意图；切换布局不会换音频节点或重置音量。 */
watch(()=>props.url,()=>{resumeOnLoad=resumeOnLoad||playing.value;position.value=0;duration.value=0;playing.value=false;error.value='';following.value=true;shareOpen.value=false})
function loaded(){duration.value=audio.value?.duration||0;if(audio.value)audio.value.volume=volume.value;if(resumeOnLoad){resumeOnLoad=false;void toggle()}}
/** 顺序、随机和单曲循环均驱动真实播放，不用动画模拟音频进度。 */
function ended(){playing.value=false;if(props.playbackEnabled===false||document.hidden){pausePlayback();return}if(!props.tracks?.length)return;if(shuffle.value&&props.tracks.length>1){const choices=props.tracks.filter(item=>item.key!==props.selected);emit('select',choices[Math.floor(Math.random()*choices.length)]!.key);resumeOnLoad=true}else if(trackIndex.value<props.tracks.length-1){changeTrack(1);resumeOnLoad=true}}
function clock(value:number){if(!Number.isFinite(value))return'0:00';return`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`}
/** 播放错误转换为用户提示，避免暴露资源请求地址。 */
async function toggle(){if(!audio.value||props.playbackEnabled===false||document.hidden)return;try{if(audio.value.paused)await audio.value.play();else audio.value.pause()}catch{error.value='音频暂时无法播放，请重试或下载。'}}
function seek(value:number){if(audio.value&&Number.isFinite(value)){audio.value.currentTime=value;position.value=value}}
function setVolume(event:Event){volume.value=Number((event.target as HTMLInputElement).value);if(audio.value)audio.value.volume=volume.value}
/** 沉浸视图复用同一个 audio 元素，不重新加载曲目或丢失播放位置。 */
function fullscreen(){immersive.value=!immersive.value;nextTick(()=>{root.value?.focus();if(following.value)void follow()})}
function changeTrack(offset:number){const item=props.tracks?.[trackIndex.value+offset];if(item)emit('select',item.key)}
/** 导出只使用现有歌词；LRC 没有真实时间轴时不可下载，也不会创建分析任务。 */
function exportLyrics(format:'txt'|'lrc'){
  const content=format==='lrc'?toLrc(timeline.value,props.title):(props.lyrics||timeline.value.map(line=>line.text).join('\n'))
  if(!content||(format==='lrc'&&!timeline.value.length))return
  const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/plain;charset=utf-8'})),link=document.createElement('a')
  link.href=url;link.download=`${props.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,80)||'歌词'}.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>
<template>
  <!-- 只移动同一棵 DOM，避免画布的容器查询／裁切限制全屏；不另建音频节点。 -->
  <Teleport to="body" :disabled="!immersive">
  <section ref="root" class="liv-music-player" :class="{'is-immersive':immersive,'is-standalone':standalone,'is-playing':playing,'is-compact':compact&&!immersive}" aria-label="音乐播放器" tabindex="0" @keydown.esc.stop.prevent="immersive=false">
    <!-- 氛围图只来自当前真实封面；唱片与光晕是装饰，不冒充实时频谱。 -->
    <div class="music-ambient" aria-hidden="true"><img v-if="cover" :src="cover" alt=""><div class="music-aurora"/></div>
    <header class="music-player-heading"><div><span>LIVLIV MUSIC</span><p>用 AI 创造属于你的音乐</p></div><UButton :icon="immersive?'i-lucide-minimize':'i-lucide-expand'" color="neutral" variant="ghost" :aria-label="immersive?'退出沉浸播放':'沉浸播放'" @click="fullscreen">{{immersive?'退出沉浸':'沉浸播放'}}</UButton></header>
    <div class="music-player-layout">
      <section class="music-player-info">
        <div class="music-record-stage">
          <div class="music-vinyl" aria-hidden="true"><span/><i/></div>
          <div class="music-player-art"><img v-if="cover" :src="cover" :alt="`${title} 封面`"><UIcon v-else name="i-lucide-disc-3"/></div>
        </div>
        <div class="music-player-metadata"><h2>{{title}}</h2><p class="music-player-kicker">{{playing?'正在播放':'音乐作品'}}<template v-if="displayTrackNumber!=null"> · 第 {{displayTrackNumber}} 首</template></p><p v-if="style" class="music-player-style">{{style}}</p></div>
        <div class="music-business-actions">
          <slot name="actions"/>
          <UButton v-if="downloadable" icon="i-lucide-download" color="neutral" variant="outline" @click="emit('download')">下载</UButton>
          <UButton v-if="taskId" icon="i-lucide-share-2" color="neutral" variant="outline" @click="shareOpen=true">分享音乐</UButton>
        </div>
        <audio ref="audio" :src="url" :loop="repeat" preload="metadata" @loadedmetadata="loaded" @timeupdate="position=audio?.currentTime||0" @durationchange="duration=audio?.duration||0" @play="played" @pause="playing=false" @ended="ended" @error="error='音频暂时无法播放，请稍后重试。'"/>
        <div class="music-player-seek"><input aria-label="音乐播放进度" type="range" min="0" :max="Number.isFinite(duration)&&duration>0?duration:1" step="0.1" :value="position" :style="{'--music-fill':progress+'%'}" @input="seek(Number(($event.target as HTMLInputElement).value))"><div><span>{{clock(position)}}</span><span>{{clock(duration)}}</span></div></div>
        <Teleport :to="controlsTarget||'body'" :disabled="!dockControls">
        <div class="music-player-controls" :class="{'is-canvas-controls':dockControls}">
          <UTooltip text="随机播放"><UButton icon="i-lucide-shuffle" square variant="ghost" color="neutral" aria-label="随机播放" :aria-pressed="shuffle" :disabled="!tracks||tracks.length<2" :class="{'is-active':shuffle}" @click="shuffle=!shuffle"/></UTooltip>
          <UTooltip text="上一首"><UButton icon="i-lucide-skip-back" square variant="ghost" color="neutral" aria-label="上一首" :disabled="!tracks||trackIndex<=0" @click="changeTrack(-1)"/></UTooltip>
          <UButton :icon="playing?'i-lucide-pause':'i-lucide-play'" :aria-label="playing?'暂停音乐':'播放音乐'" color="primary" variant="solid" square class="music-player-play" @click="toggle"/>
          <UTooltip text="下一首"><UButton icon="i-lucide-skip-forward" square variant="ghost" color="neutral" aria-label="下一首" :disabled="!tracks||trackIndex<0||trackIndex>=tracks.length-1" @click="changeTrack(1)"/></UTooltip>
          <UTooltip text="单曲循环"><UButton icon="i-lucide-repeat-1" square variant="ghost" color="neutral" aria-label="单曲循环" :aria-pressed="repeat" :class="{'is-active':repeat}" @click="repeat=!repeat"/></UTooltip>
        </div>
        </Teleport>
        <label class="music-player-volume"><UIcon name="i-lucide-volume-2"/><span>音量</span><input aria-label="音乐音量" type="range" min="0" max="1" step="0.01" :value="volume" :style="{'--music-fill':volume*100+'%'}" @input="setVolume"></label>
        <p v-if="error" role="alert" class="music-player-note">{{error}}</p>
      </section>
      <section class="music-player-card music-player-words">
        <div class="music-lyrics-scene" aria-hidden="true"><img v-if="cover" :src="cover" alt=""/></div>
        <header class="music-lyrics-heading"><div class="music-tabs" role="tablist" aria-label="音乐详情" @keydown="tabKey"><UButton :id="detailId+'-lyrics'" role="tab" :tabindex="tab==='lyrics'?0:-1" :aria-selected="tab==='lyrics'" :aria-controls="detailId+'-panel'" variant="ghost" color="neutral" :class="{'is-active':tab==='lyrics'}" @click="tab='lyrics'">歌词</UButton><UButton :id="detailId+'-info'" role="tab" :tabindex="tab==='info'?0:-1" :aria-selected="tab==='info'" :aria-controls="detailId+'-panel'" variant="ghost" color="neutral" :class="{'is-active':tab==='info'}" @click="tab='info'">相关信息</UButton></div><div class="music-lyrics-actions"><UButton size="sm" color="neutral" variant="outline" :disabled="!lines.length&&!timeline.length" @click="exportLyrics('txt')">下载 TXT</UButton><UButton size="sm" color="neutral" variant="outline" :disabled="!timeline.length" @click="exportLyrics('lrc')">下载 LRC</UButton></div></header>
        <div :id="detailId+'-panel'" class="music-detail-panel" role="tabpanel" :aria-labelledby="detailId+(tab==='lyrics'?'-lyrics':'-info')">
          <template v-if="tab==='lyrics'">
            <p class="music-player-note music-timeline-note">{{timeline.length?'逐句时间轴 · 随播放自动滚动':lines.length?'歌词原文 · 暂无同步时间轴':'暂无歌词，先享受音乐。'}}</p>
            <div ref="lyricRoot" class="music-player-lyrics" aria-label="歌曲歌词" tabindex="0" @wheel.passive="following=false" @touchstart.passive="following=false" @pointerdown="following=false" @keydown="following=false"><template v-if="timeline.length"><button v-for="(line,index) in timeline" :key="`${line.start}-${index}`" :data-line="index" :class="{active:index===active}" :aria-current="index===active?'true':undefined" @click="seek(line.start)">{{line.text}}</button></template><template v-else-if="lines.length"><p v-for="(line,index) in lines" :key="index">{{line}}</p></template><p v-else>纯粹聆听，感受此刻</p></div>
            <UButton v-if="timeline.length&&!following" class="music-follow" variant="soft" @click="following=true;follow()">恢复歌词跟随</UButton>
          </template>
          <dl v-else class="music-track-info"><dt>曲名</dt><dd>{{title}}</dd><dt>时长</dt><dd>{{duration>0?clock(duration):'读取音频后显示'}}</dd><template v-if="style"><dt>音乐风格</dt><dd>{{style}}</dd></template><dt>歌词时间轴</dt><dd>{{timeline.length?'已有同步时间轴':'暂无同步时间轴'}}</dd></dl>
        </div>
        <div class="music-light-ribbon" aria-hidden="true"/>
        <nav v-if="tracks&&tracks.length" class="music-player-tracks" aria-label="候选曲目">
          <header><h3><UIcon name="i-lucide-list-music"/>播放列表</h3><span>共 {{tracks.length}} 首作品</span></header>
          <UButton v-for="(track,index) in tracks" :key="track.key" color="neutral" variant="ghost" :class="{'is-current':selected===track.key}" :aria-current="selected===track.key?'true':undefined" @click="emit('select',track.key)">
            <span class="music-track-number">{{String(index+1).padStart(2,'0')}}</span><img v-if="track.cover||selected===track.key&&cover" :src="track.cover||(selected===track.key?cover:'')" alt=""/><UIcon v-else name="i-lucide-disc-3"/>
            <span class="music-track-copy"><strong>{{track.title}}</strong><small>{{selected===track.key?(playing?'正在播放':'当前曲目'):'音乐作品'}}</small></span>
            <UIcon :name="selected===track.key&&playing?'i-lucide-audio-lines':'i-lucide-play'"/>
          </UButton>
        </nav>
      </section>
    </div>
    <MusicShareDialog v-if="taskId" v-model:open="shareOpen" :task-id="taskId" :track="trackNumber??0"/>
  </section>
  </Teleport>
</template>
<style scoped>
/* 固定深色音乐舞台：颜色复用媒体令牌，背景只从当前封面提取，不引入假作品。 */
.liv-music-player{--music-title:24px;--music-lyric:20px;--music-active:22px;container-type:inline-size;isolation:isolate;position:relative;width:100%;max-width:none;min-width:0;margin:auto;padding:24px;color:var(--liv-music-text);background:var(--liv-music-stage);border:1px solid var(--liv-music-border);border-radius:var(--liv-music-radius);outline:none;box-sizing:border-box;overflow:hidden}
.music-ambient{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}.music-ambient>img{width:100%;height:100%;object-fit:cover;filter:blur(60px) saturate(.7);opacity:.2;transform:scale(1.15)}
.music-aurora{position:absolute;inset:0;background:radial-gradient(ellipse at 80% 0%,var(--liv-music-glow),transparent 55%),radial-gradient(ellipse at 10% 60%,var(--liv-music-glow),transparent 55%),linear-gradient(150deg,transparent,var(--liv-music-stage) 85%);opacity:.65}
.music-player-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px}.music-player-heading span{color:var(--liv-music-highlight);font-size:13px;font-weight:600;letter-spacing:.18em}.music-player-heading p{margin:4px 0 0;font-size:12px;color:var(--liv-music-muted);letter-spacing:.12em}
.music-player-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:32px;min-width:0}.music-player-info{display:flex;flex-direction:column;gap:20px;min-width:0;padding:8px 16px 16px}
/* 黑胶凹槽与封面错位叠放；动画始终运行但暂停，继续播放时不跳回初始角度。 */
.music-record-stage{position:relative;width:min(100%,480px);margin:12px auto 8px;padding-right:18%;box-sizing:border-box}.music-player-art{position:relative;z-index:1;aspect-ratio:1;display:grid;place-items:center;width:100%;overflow:hidden;border-radius:20px;background:var(--liv-music-panel);border:1px solid var(--liv-music-highlight);box-shadow:0 0 0 4px var(--liv-music-glow),0 24px 64px var(--liv-music-stage)}
.music-player-art img{width:100%;height:100%;object-fit:cover}.music-player-art>.iconify{width:80px;height:80px;color:var(--liv-music-highlight)}
.music-vinyl{position:absolute;right:0;top:6%;height:88%;aspect-ratio:1;border-radius:50%;border:1px solid var(--liv-music-border);background:repeating-radial-gradient(circle at center,#0b0c12 0 2px,#252630 3px,#111219 4px 6px);box-shadow:12px 16px 32px #0008;animation:music-disc-turn 20s linear infinite;animation-play-state:paused;overflow:hidden}.music-vinyl:before{content:'';position:absolute;inset:0;border-radius:inherit;background:conic-gradient(transparent 12%,#ffffff30 17%,transparent 24%,transparent 60%,#ffffff25 65%,transparent 72%)}.music-vinyl span{position:absolute;inset:32%;border-radius:50%;background:linear-gradient(140deg,var(--liv-ui-primary-foreground),var(--liv-ui-primary),var(--liv-music-stage));box-shadow:0 0 24px var(--liv-music-glow)}.music-vinyl i{position:absolute;inset:48%;border-radius:50%;background:var(--liv-music-stage)}.is-playing .music-vinyl{animation-play-state:running}
.music-player-metadata h2{font-size:var(--music-title);font-weight:600;line-height:1.4;margin:0 0 8px;overflow-wrap:anywhere}.music-player-kicker,.music-player-style,.music-player-note{font-size:12px;line-height:1.7;margin:0;color:var(--liv-music-muted)}.music-player-style{margin-top:4px}.music-business-actions{display:flex;gap:12px;flex-wrap:wrap}.music-business-actions:empty{display:none}
.liv-music-player .music-business-actions button,.liv-music-player .music-lyrics-actions button{height:40px;min-height:40px;padding:0 14px;border:1px solid var(--liv-music-border);border-radius:12px;background:var(--liv-music-panel);color:var(--liv-music-text);font-size:14px}
.music-player-seek>div{display:flex;justify-content:space-between;font-size:12px;color:var(--liv-music-muted);margin-top:12px}
.liv-music-player input[type=range]{appearance:none;display:block;width:100%;min-width:0;height:6px;padding:0;border:0;border-radius:999px;background:linear-gradient(to right,var(--liv-ui-primary) 0 var(--music-fill,0%),var(--liv-music-border) var(--music-fill,0%) 100%);cursor:pointer}.liv-music-player input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:var(--liv-music-text);box-shadow:0 0 12px var(--liv-music-glow)}.liv-music-player input[type=range]::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:var(--liv-music-text)}
.music-player-controls{display:flex;align-items:center;justify-content:space-between;gap:8px}.liv-music-player .music-player-controls button{width:40px;height:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0;flex:none;color:var(--liv-music-text);border-radius:50%}.liv-music-player .music-player-controls .music-player-play{width:var(--liv-music-play-size);height:var(--liv-music-play-size);min-height:var(--liv-music-play-size);background:linear-gradient(145deg,var(--liv-ui-primary-foreground),var(--liv-ui-primary) 65%);color:var(--liv-music-current-text);border:1px solid var(--liv-music-highlight);box-shadow:0 0 32px var(--liv-music-glow),inset 0 2px 12px #ffffff35;transition:box-shadow .2s,transform .2s}.music-player-play:hover{transform:scale(1.04)}.liv-music-player .music-player-controls .music-player-play :deep(.iconify){width:32px;height:32px}.music-player-controls .is-active{background:var(--liv-music-glow);color:var(--liv-music-highlight)}
.music-player-volume{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--liv-music-muted);margin-top:8px}.music-player-volume input{max-width:180px}.music-player-volume>.iconify{width:18px;height:18px}
/* 右侧歌词以原封面的柔化场景衬底；前景使用足够暗的玻璃蒙层保证对比。 */
.music-player-card{position:relative;isolation:isolate;min-width:0;overflow:hidden;border:1px solid var(--liv-music-border);border-radius:var(--liv-music-radius);background:var(--liv-music-panel);box-shadow:inset 0 1px 0 #ffffff14,0 16px 40px #0003;backdrop-filter:blur(24px)}.music-lyrics-scene{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}.music-lyrics-scene img{width:100%;height:100%;object-fit:cover;opacity:.18;filter:blur(3px) saturate(.6)}.music-lyrics-scene:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,var(--liv-music-glow),transparent 30%,var(--liv-music-stage) 80%)}
.music-lyrics-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid var(--liv-music-border)}.music-tabs{display:flex;align-self:stretch;gap:16px;flex:none}.liv-music-player .music-tabs button{position:relative;min-height:40px;padding:0 4px;border-radius:0;background:transparent;color:var(--liv-music-muted);font-size:14px}.liv-music-player .music-tabs .is-active{color:var(--liv-music-text)}.music-tabs .is-active:after{content:'';position:absolute;bottom:-17px;height:3px;left:0;right:0;background:var(--liv-ui-primary-foreground);box-shadow:0 0 16px var(--liv-music-glow)}.music-lyrics-actions{display:flex;gap:8px;flex-wrap:wrap}.music-timeline-note{text-align:center;padding:16px 16px 0}
.music-detail-panel{position:relative;display:flex;flex-direction:column;min-height:300px}.music-player-lyrics{position:relative;min-height:240px;height:clamp(260px,calc(100dvh - 480px),480px);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;padding:48px 24px;text-align:center;overscroll-behavior:contain;mask-image:linear-gradient(transparent,#000 8%,#000 92%,transparent);scroll-padding:48px}
.liv-music-player .music-player-lyrics p,.liv-music-player .music-player-lyrics button{display:block;width:100%;height:auto;min-height:0;margin:0;padding:12px 4px;border:0;background:transparent;white-space:normal;overflow-wrap:anywhere;text-align:center;font-size:var(--music-lyric);font-weight:400;line-height:1.7;color:var(--liv-music-muted);transition:color .3s,text-shadow .3s}.liv-music-player .music-player-lyrics button.active{font-size:var(--music-active);font-weight:600;color:var(--liv-music-current-text);text-shadow:0 0 24px var(--liv-ui-primary-foreground),0 0 8px var(--liv-ui-primary)}.music-follow{align-self:center;margin:0 12px 12px}.music-track-info{display:grid;grid-template-columns:auto minmax(0,1fr);align-content:center;gap:16px 24px;padding:32px;min-height:300px;font-size:14px;line-height:1.7}.music-track-info dt{color:var(--liv-music-muted)}.music-track-info dd{margin:0;overflow-wrap:anywhere}
.music-light-ribbon{height:1px;background:linear-gradient(90deg,transparent,var(--liv-ui-primary-foreground),transparent);box-shadow:0 0 24px 2px var(--liv-music-glow);pointer-events:none}
.music-player-tracks{padding:16px 24px 20px;background:var(--liv-music-panel);max-height:320px;overflow:auto;scrollbar-width:thin}.music-player-tracks header{display:flex;align-items:center;gap:16px;margin-bottom:16px}.music-player-tracks h3{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;margin:0}.music-player-tracks header>span{font-size:12px;color:var(--liv-music-muted)}.liv-music-player .music-player-tracks button{display:flex;align-items:center;justify-content:flex-start;gap:12px;width:100%;height:auto;min-height:72px;padding:8px 12px;border:1px solid transparent;border-radius:12px;text-align:left;color:var(--liv-music-text);white-space:normal;background:transparent}.liv-music-player .music-player-tracks button+button{border-top-color:var(--liv-music-border)}.liv-music-player .music-player-tracks .is-current{border-color:var(--liv-music-border);background:linear-gradient(100deg,var(--liv-music-glow),transparent)}.music-player-tracks button>img{width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none}.music-track-number{font-size:12px;color:var(--liv-music-muted);flex:none}.music-track-copy{display:flex;flex-direction:column;min-width:0;flex:1;gap:4px}.music-track-copy strong{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.music-track-copy small{font-size:12px;color:var(--liv-music-muted)}.music-player-tracks button>.iconify:last-child{color:var(--liv-music-highlight);flex:none}
.liv-music-player button:focus-visible,.liv-music-player input:focus-visible,.liv-music-player [tabindex]:focus-visible{outline:2px solid var(--liv-music-highlight);outline-offset:3px}.liv-music-player button:disabled{opacity:.4;cursor:not-allowed}.liv-music-player button:not(:disabled):hover{filter:brightness(1.15)}
/* 原 audio 保持在 DOM，沉浸只改变同一播放器布局。 */
.liv-music-player.is-immersive{position:fixed;inset:0;z-index:580;width:100vw;max-width:none;height:100dvh;border-radius:0;padding:32px max(24px,calc((100vw - 1600px)/2));overflow:auto}.is-immersive,.is-standalone{--music-title:30px;--music-lyric:24px;--music-active:26px}
@container (min-width:760px){.music-player-layout{grid-template-columns:minmax(0,.9fr) minmax(0,1.25fr)}.music-record-stage{width:min(100%,clamp(240px,calc(100dvh - 470px),500px))}}
@container (max-width:759px){.music-player-info{max-width:560px;width:100%;margin:auto}.music-record-stage{width:min(100%,340px)}.music-player-lyrics{height:320px}}
@container (max-width:460px){.music-player-info{padding:0;gap:16px}.music-player-layout{gap:24px}.music-lyrics-heading{padding:16px;flex-wrap:wrap}.music-tabs .is-active:after{bottom:-4px}.music-player-tracks{padding:16px}.music-player-lyrics{padding-inline:16px}.music-player-art{border-radius:16px}.music-player-heading button{font-size:12px}.music-track-info{padding:24px;gap:12px}.music-record-stage{width:min(100%,280px)}}
@media(max-width:600px){.liv-music-player{padding:16px}.liv-music-player.is-immersive{padding:16px}}
/* 画布节点复用同一播放器与audio，先呈现播放控制；业务操作、歌词和导出仍保留在纵向内容中。 */
.liv-music-player.is-compact{padding:12px;--music-title:16px}
.is-compact .music-player-heading{margin-bottom:8px;gap:8px}.is-compact .music-player-heading p{display:none}
.is-compact .music-player-heading span{font-size:12px;letter-spacing:0}
.is-compact .music-player-layout{gap:12px}
.is-compact .music-player-info{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px;padding:0;max-width:none}
.is-compact .music-record-stage{width:56px;margin:0;padding:0}.is-compact .music-player-art{border-radius:8px}.is-compact .music-vinyl{display:none}
.is-compact .music-player-metadata{align-self:center}.is-compact .music-player-metadata h2{margin-bottom:4px}
.is-compact .music-business-actions,.is-compact .music-player-seek,.is-compact .music-player-controls,.is-compact .music-player-volume,.is-compact .music-player-info>.music-player-note{grid-column:1/-1}
.is-compact .music-business-actions{order:5;gap:8px}
.is-compact .music-player-seek>div{margin-top:8px}
.is-compact .music-player-volume{margin-top:0}
.is-compact .music-player-controls{gap:4px}
.liv-music-player.is-compact .music-player-controls button{width:32px;height:32px;min-height:32px}
.liv-music-player.is-compact .music-player-controls .music-player-play{width:48px;height:48px;min-height:48px}
@media(max-height:650px){.is-compact .music-record-stage{display:none}.is-compact .music-player-metadata{grid-column:1/-1}.is-compact .music-player-heading>div{display:none}.is-compact .music-player-heading{justify-content:flex-end}}
/* 传送后的原控件不再继承媒体缩放，保持32px命中；减少动态效果及原禁用语义不变。 */
.music-player-controls.is-canvas-controls{gap:8px;padding:4px;justify-content:center;color:var(--liv-music-text)}
.music-player-controls.is-canvas-controls button{width:32px;height:32px;min-height:32px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:50%}
.music-player-controls.is-canvas-controls .music-player-play{width:40px;height:40px;min-height:40px;background:var(--ui-primary);color:var(--liv-control-on-primary)}
.music-player-controls.is-canvas-controls .is-active{background:var(--liv-music-glow);color:var(--liv-music-highlight)}
.music-player-controls.is-canvas-controls button:focus-visible{outline:2px solid var(--liv-music-highlight);outline-offset:2px}
@keyframes music-disc-turn{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.music-vinyl{animation:none}.liv-music-player *{transition:none!important;scroll-behavior:auto!important}}
</style>
