<script setup lang="ts">
import type {SessionResult} from '../resultCatalog'
import {compositionErrors,compositionStatus,moveCompositionClip} from '../compositionState'
import {videoCompositionService as api,type CompositionClip,type CompositionPlan,type CompositionJob} from '~/shared/api/services/videoCompositionService'
import LibraryPicker from '~/features/library/components/LibraryPicker.vue'
import {libraryService} from '~/shared/api/services/libraryService'
import type {LibraryItem,LibraryVersion,LibraryReference} from '~/entities/library/types'
const props=defineProps<{sources:SessionResult[];sessionId:string;ownerId?:string;outputId?:string;linkedOnly?:boolean}>()
const emit=defineEmits<{changed:[]}>()
const plan=ref<CompositionPlan>({schema_version:1,revision:1,clips:[],output:{width:720,height:1280,fps:25,fit:'contain',transition:'cut'}})
const lengths=ref<Record<string,number>>({}),jobs=ref<CompositionJob[]>([]),busy=ref(false),error=ref(''),offset=ref(0),more=ref(true)
const preset=ref('portrait')
const panelElement=ref<HTMLElement|null>(null)
// 音轨选择仅修改本成片草稿，不复用聊天音频或旧生成授权。
const audioRole=ref<'narration'|'bgm'|null>(null)
const audioSelectionBusy=ref(false)
const audioPreviews=ref<Record<string,{name:string;url:string}>>({})
const totalDuration=computed(()=>plan.value.clips.reduce((sum,clip)=>sum+clip.trim_end_ms-clip.trim_start_ms,0))
/** 复用资料库真实开放状态；入口关闭或读取失败不展示可用的音频选择器。 */
async function openAudio(role:'narration'|'bgm'){
  if(busy.value||audioSelectionBusy.value||!draftReady.value||totalDuration.value<=0)return
  audioSelectionBusy.value=true;error.value=''
  try{
    const capability=await libraryService.capabilities()
    if(!alive)return
    if(!capability.video_picker){error.value='音频资料库入口尚未开放，可先保留片段原声。';return}
    audioRole.value=role
  }catch(cause){if(alive)error.value=(cause as Error).message||'音频资料库暂不可用。'}
  finally{if(alive)audioSelectionBusy.value=false}
}
/** 以真实素材时长初始化可编辑切点；未知长度不得按目标成片时长伪造。 */
function chooseAudio(values:Array<{item:LibraryItem;version:LibraryVersion;reference:LibraryReference}>){
  const selected=values[0],role=audioRole.value
  if(!selected||!role||busy.value||!draftReady.value)return
  const duration=Math.floor(Number(selected.version.media.duration_sec)*1000)
  if(!Number.isFinite(duration)||duration<=0||totalDuration.value<=0){error.value='请先添加视频片段，并选择有真实时长的音频。';return}
  const chosen={id:crypto.randomUUID(),role,reference:{...selected.reference,purpose:role},trim_start_ms:0,
    trim_end_ms:Math.min(duration,totalDuration.value),start_ms:0,volume:role==='bgm'?.2:1}
  plan.value.audio_tracks=[...(plan.value.audio_tracks||[]).filter(track=>track.role!==role),chosen]
  audioPreviews.value[chosen.id]={name:selected.item.name,url:libraryService.previewUrl(selected.version.preview_url)}
  error.value='';audioRole.value=null
}
/** 刷新仅恢复固定版本的试听地址；旧请求不能给新选择回填别的音频。 */
watch(()=>plan.value.audio_tracks,async tracks=>{
  for(const track of tracks||[]){
    if(audioPreviews.value[track.id])continue
    try{
      const item=await libraryService.detail(track.reference.item_id)
      const version=item.versions.find(value=>value.id===track.reference.version_id)
      if(alive&&version&&plan.value.audio_tracks?.some(value=>value.id===track.id&&value.reference.version_id===version.id))
        audioPreviews.value[track.id]={name:item.name,url:libraryService.previewUrl(version.preview_url)}
    }catch{/* 试听失败不丢弃原固定引用，提交仍由服务端重验。 */}
  }
},{deep:true})
/** 同一片段面板只试听一个声音，切换或销毁不自动续播。 */
function previewAudio(event:Event){const audio=event.target as HTMLMediaElement;panelElement.value?.querySelectorAll('audio,video').forEach(media=>{if(media!==audio)(media as HTMLMediaElement).pause()})}
// 断开来源只改变候选素材，不偷偷改写已保存切点；明确移除失联片段后才能保存或执行。
const disconnected=computed(()=>props.linkedOnly&&plan.value.clips.some(clip=>!props.sources.some(source=>source.source.id===clip.task_id&&source.source.result_id===clip.result_id)))
/** 按任务和结果双重身份显示片段来源；缺失时不借用其他视频的名称。 */
function clipSourceTitle(clip:CompositionClip){return props.sources.find(source=>source.source.id===clip.task_id&&source.source.result_id===clip.result_id)?.title||'来源未在当前列表中'}
const errors=computed(()=>[...compositionErrors(plan.value),...(disconnected.value?['存在已断开来源的片段，请重新连接来源，或移除相应片段后保存。']:[])])
const historyBusy=ref(false),mediaErrors=ref<Record<string,boolean>>({})
// 实际解码宽高驱动卡片，不用页面宽度或提示词中的比例冒充媒体尺寸。
const mediaRatios=ref<Record<string,number>>({})
function mediaRatio(key:string,event:Event){const video=event.target as HTMLVideoElement;if(video.videoWidth>0&&video.videoHeight>0)mediaRatios.value[key]=video.videoWidth/video.videoHeight}
function ratioStyle(key:string,fallback=1){return {'--liv-media-ratio':mediaRatios.value[key]||fallback}}
const draftReady=ref(false),draftRevision=ref(0),savedPlanHash=ref('')
const localConflict=ref<{base_revision:number;plan:CompositionPlan}|null>(null)
/** 画布片段编辑备份按账号/会话/成片隔离；只保存素材编号和切点，不保存媒体地址或许可。 */
const backupKey=()=>props.linkedOnly&&props.ownerId&&props.outputId?`liv-canvas-composition-v1:${props.ownerId}:${props.sessionId}:${props.outputId}`:''
function backup(){
  const key=backupKey();if(!key||!draftReady.value)return
  if(localConflict.value)return
  const content=JSON.stringify({base_revision:draftRevision.value,plan:plan.value})
  const saved=savedPlanHash.value===JSON.stringify(plan.value)
  // 标签页备份优先，避免另一页面的编辑或保存覆盖本页未保存切点。
  // 已保存时留下本页干净标记，避免下次刷新误读其他标签页的共享草稿。
  try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(key,saved?JSON.stringify({clean:true}):content)}catch{/* 隐私模式下保留内存草稿。 */}
  // 共享备份用于关闭标签后的兼容恢复；只清理内容一致的备份，不删除别页草稿。
  try{if(saved){const previous=JSON.parse(localStorage.getItem(key)||'null');if(previous&&JSON.stringify(previous.plan)===savedPlanHash.value)localStorage.removeItem(key)}else localStorage.setItem(key,content)}catch{/* 本机存储不可用时仍按服务端修订保存。 */}
}
watch(plan,backup,{deep:true,flush:'sync'})
/** 云端修订发生变化时必须显式选择，不能自动覆盖另一页面的片段计划。 */
function resolveBackup(useLocal:boolean){const retained=localConflict.value;localConflict.value=null;if(useLocal&&retained)plan.value=retained.plan;error.value='';backup()}
const draftSaved=computed(()=>draftRevision.value>0&&savedPlanHash.value===JSON.stringify(plan.value))
// 父层切换成片前核对未保存编辑/正在执行的写入，不让片段跨成片混用。
defineExpose({isDirty:()=>draftReady.value&&savedPlanHash.value!==JSON.stringify(plan.value),isBusy:()=>busy.value})
let historyEpoch=0
let alive=true,timer:ReturnType<typeof setTimeout>|undefined,receipt:{key:string;id:string}|null=null
/** 实际媒体元数据对齐到25fps帧边界，目标生成秒数不冒充真实文件容量。 */
function metadata(key:string,event:Event){mediaRatio(key,event);const value=(event.target as HTMLVideoElement).duration;if(Number.isFinite(value))lengths.value[key]=Math.floor(value*25)*40}
/** 添加前读取真正可裁切的画面容量；浏览器音轨尾部不进入默认视频切点。 */
async function add(source:SessionResult){
  if(busy.value||!draftReady.value||!source.source.result_id||plan.value.clips.length>=24)return
  busy.value=true;error.value=''
  try{
    const capacity=await api.inspect(source.source.id,source.source.result_id)
    if(!alive)return
    lengths.value[source.key]=capacity.duration_ms
    plan.value.clips.push({id:crypto.randomUUID(),task_id:source.source.id,result_id:source.source.result_id,trim_start_ms:0,trim_end_ms:capacity.duration_ms,keep_audio:true})
  }catch(cause){if(alive)error.value=(cause as Error).message||'画面容量读取失败。'}
  finally{if(alive)busy.value=false}
}
watch(preset,value=>{if(value!=='custom')plan.value.output={...plan.value.output,...(value==='portrait'?{width:720,height:1280}:value==='landscape'?{width:1280,height:720}:{width:720,height:720})}})
/** 草稿与输入框文字隔离，读失败不允许把默认空计划写回服务端。 */
async function loadDraft(){
  busy.value=true
  try{const saved=await (props.outputId?api.outputDraft(props.sessionId,props.outputId):api.draft(props.sessionId));if(!alive)return;draftRevision.value=saved.revision;if(saved.plan){plan.value=saved.plan;const {width,height}=saved.plan.output;preset.value=width===720&&height===1280?'portrait':width===1280&&height===720?'landscape':width===720&&height===720?'square':'custom'}await nextTick();savedPlanHash.value=JSON.stringify(plan.value);draftReady.value=true
    const key=backupKey()
    if(key)try{let retained=null;try{if(typeof sessionStorage!=='undefined')retained=JSON.parse(sessionStorage.getItem(key)||'null')}catch{/* 私有备份不可读时检查共享备份。 */}if(!retained)retained=JSON.parse(localStorage.getItem(key)||'null');if(retained?.plan?.schema_version===1&&Array.isArray(retained.plan.clips)&&JSON.stringify(retained.plan)!==savedPlanHash.value){if(retained.base_revision===saved.revision){plan.value=retained.plan;error.value='已恢复本机未保存片段计划，请核对后保存。'}else{localConflict.value=retained;error.value='云端片段计划已更新，本机编辑仍保留，请选择要使用的版本。'}}}catch{/* 忽略损坏备份，不影响云端原计划。 */}
  }
  catch(cause){if(alive)error.value=(cause as Error).message}
  finally{if(alive)busy.value=false}
}
/** 明确保存不执行合成；修订冲突保留本地稿，不覆盖其他页面新计划。 */
async function saveDraft(){
  if(busy.value||!draftReady.value||disconnected.value||localConflict.value)return
  busy.value=true;error.value=''
  try{const saved=await (props.outputId?api.saveOutputDraft(props.sessionId,props.outputId,draftRevision.value,plan.value):api.saveDraft(props.sessionId,draftRevision.value,plan.value));if(alive){draftRevision.value=saved.revision;plan.value=saved.plan;savedPlanHash.value=JSON.stringify(saved.plan);backup();emit('changed')}}
  catch(cause){if(alive)error.value=(cause as Error).message}
  finally{if(alive)busy.value=false}
}
/** 所有自动恢复仅GET；跨组件销毁的响应丢弃，隐藏标签页暂停轮询。 */
async function history(reset=false){
  if(historyBusy.value)return
  historyBusy.value=true;const epoch=++historyEpoch
  try{const page=await (props.outputId?api.outputJobs(props.sessionId,props.outputId):api.list(reset?0:offset.value));if(!alive||epoch!==historyEpoch)return;const ids=new Set(props.sources.map(s=>s.source.id));const matching=props.outputId?page:page.filter(j=>j.plan.clips.every(c=>ids.has(c.task_id)));jobs.value=reset?matching:[...jobs.value,...matching.filter(j=>!jobs.value.some(old=>old.id===j.id))];offset.value=(reset?0:offset.value)+page.length;more.value=!props.outputId&&page.length===20}
  catch(cause){if(alive&&epoch===historyEpoch)error.value=(cause as Error).message}
  finally{if(alive)historyBusy.value=false}
}
async function poll(){if(!alive)return;if(!document.hidden)for(const job of jobs.value.filter(j=>['queued','rendering'].includes(j.status))){try{const next=await api.read(job.id);if(alive)jobs.value=jobs.value.map(j=>j.id===next.id?next:j)}catch(cause){if(alive)error.value=(cause as Error).message}}if(alive)timer=setTimeout(poll,4000)}
/** 相同内容请求失败沿用编号，只在明确确认或重试按钮点击时POST。 */
async function submit(retry?:CompositionJob){if(busy.value||localConflict.value||(!retry&&(errors.value.length||(props.outputId&&!draftSaved.value))))return;historyEpoch++;busy.value=true;error.value='';try{const key=JSON.stringify(plan.value);if(receipt?.key!==key)receipt={key,id:crypto.randomUUID()};const job=retry?await api.retry(retry.id):props.outputId?await api.createOutputJob(props.sessionId,props.outputId,draftRevision.value):await api.create(receipt.id,plan.value);if(alive){jobs.value=[job,...jobs.value.filter(j=>j.id!==job.id)];emit('changed')}}catch(cause){if(alive)error.value=(cause as Error).message}finally{if(alive)busy.value=false}}
onMounted(async()=>{await Promise.all([history(true),loadDraft()]);if(alive)timer=setTimeout(poll,4000)})
onBeforeUnmount(()=>{backup();alive=false;clearTimeout(timer)})
</script>
<template>
  <section ref="panelElement" class="space-y-4 text-sm" aria-label="短片片段列表">
    <LibraryPicker v-if="audioRole" :open="!!audioRole" kind="composition" media-type="audio" :remaining="1" dark @select="chooseAudio" @update:open="value=>{if(!value)audioRole=null}"/>
    <p>选择本会话已完成的视频，按顺序合成一个短片。原视频保留，本地直切合成不新增扣点。</p>
    <div class="liv-composition-media-list" :class="{'is-canvas-sources':linkedOnly}">
      <div v-for="source in sources" :key="source.key" class="liv-composition-media-card rounded-xl border border-default space-y-2" :style="ratioStyle(source.key)">
        <video v-if="!linkedOnly" :src="source.url" controls playsinline preload="metadata" class="liv-composition-video" @loadedmetadata="mediaErrors[source.key]=false;metadata(source.key,$event)" @error="mediaErrors[source.key]=true;delete lengths[source.key]"/>
        <p class="text-muted">{{source.title}} · {{mediaErrors[source.key]?'预览读取失败':lengths[source.key]?lengths[source.key]!/1000+' 秒':linkedOnly?'已连接':'读取预览中'}}</p>
        <UButton color="neutral" variant="soft" block :disabled="busy||!draftReady||plan.clips.length>=24" @click="add(source)">添加片段</UButton>
      </div>
    </div>
    <ol class="space-y-3">
      <li v-for="(clip,index) in plan.clips" :key="clip.id" class="rounded-xl border border-default p-3 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-semibold mr-auto min-w-0">片段 {{index+1}} · <span :title="clipSourceTitle(clip)">{{clipSourceTitle(clip)}}</span> <span class="text-muted font-normal">· {{(clip.trim_end_ms-clip.trim_start_ms)/1000}}秒</span></p>
          <UTooltip text="上移"><UButton icon="i-lucide-chevron-up" square color="neutral" variant="ghost" :aria-label="`片段${index+1}上移`" :disabled="busy||index===0" @click="plan.clips=moveCompositionClip(plan.clips,clip.id,-1)"/></UTooltip>
          <UTooltip text="下移"><UButton icon="i-lucide-chevron-down" square color="neutral" variant="ghost" :aria-label="`片段${index+1}下移`" :disabled="busy||index===plan.clips.length-1" @click="plan.clips=moveCompositionClip(plan.clips,clip.id,1)"/></UTooltip>
          <UTooltip text="移出本次合成"><UButton icon="i-lucide-x" square color="neutral" variant="ghost" :aria-label="`移出片段${index+1}`" :disabled="busy" @click="plan.clips=plan.clips.filter(c=>c.id!==clip.id)"/></UTooltip>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>起点（毫秒）<UInputNumber v-model="clip.trim_start_ms" :min="0" :step="40" :disabled="busy||!draftReady" :aria-label="`片段${index+1}起点毫秒`"/></label>
          <label>终点（毫秒）<UInputNumber v-model="clip.trim_end_ms" :min="40" :step="40" :disabled="busy||!draftReady" :aria-label="`片段${index+1}终点毫秒`"/></label>
        </div>
        <UCheckbox v-model="clip.keep_audio" label="保留此片段原声" :disabled="busy||!draftReady"/>
      </li>
    </ol>
    <section class="rounded-xl border border-default p-3 space-y-3" aria-label="旁白与背景音乐">
      <h3 class="font-semibold">声音选择</h3>
      <p class="text-muted">可保留片段原声，也可从资料库选择已有旁白或背景音乐。不选择就不添加，不会自动生成或扣点。</p>
      <div class="flex flex-wrap gap-2"><UButton color="neutral" variant="soft" :disabled="busy||audioSelectionBusy||!draftReady||totalDuration<=0" @click="openAudio('narration')">选择旁白音频</UButton><UButton color="neutral" variant="soft" :disabled="busy||audioSelectionBusy||!draftReady||totalDuration<=0" @click="openAudio('bgm')">选择背景音乐</UButton></div>
      <article v-for="track in plan.audio_tracks||[]" :key="track.id" class="space-y-3">
        <div class="flex items-center gap-2"><strong>{{track.role==='narration'?'旁白':'背景音乐'}}</strong><span class="text-muted">{{audioPreviews[track.id]?.name||'固定版本音频'}}</span><UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`移除${track.role==='narration'?'旁白':'背景音乐'}`" :disabled="busy" @click="plan.audio_tracks=plan.audio_tracks?.filter(value=>value.id!==track.id)"/></div>
        <audio v-if="audioPreviews[track.id]?.url" :src="audioPreviews[track.id]!.url" controls preload="none" class="w-full" @play="previewAudio"/>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>成片入点（毫秒）<UInputNumber v-model="track.start_ms" :min="0" :max="totalDuration" :step="100" :disabled="busy"/></label>
          <label>音量（0–100%）<UInputNumber :model-value="Math.round(track.volume*100)" :min="0" :max="100" :step="5" :disabled="busy" @update:model-value="track.volume=Number($event)/100"/></label>
          <label>音频起点（毫秒）<UInputNumber v-model="track.trim_start_ms" :min="0" :step="100" :disabled="busy"/></label>
          <label>音频终点（毫秒）<UInputNumber v-model="track.trim_end_ms" :min="1" :max="180000" :step="100" :disabled="busy"/></label>
        </div>
      </article>
    </section>
    <USelect v-model="preset" :items="[{label:'竖屏 720×1280',value:'portrait'},{label:'横屏 1280×720',value:'landscape'},{label:'方形 720×720',value:'square'}]" aria-label="合成规格" :disabled="busy"/>
    <p>{{plan.clips.length}} 个片段 · 合计 {{plan.clips.reduce((n,c)=>n+c.trim_end_ms-c.trim_start_ms,0)/1000}} 秒 · 25fps直切，画幅不一致时留边。切点按40毫秒对齐，最长三分钟。</p>
    <p v-for="item in errors" :key="item" class="text-muted">{{item}}</p>
    <div class="flex flex-wrap items-center gap-2">
      <UButton v-if="!draftReady" color="neutral" variant="outline" :disabled="busy" @click="loadDraft">重试读取片段计划</UButton>
      <UButton color="neutral" variant="outline" :disabled="busy||!draftReady" @click="saveDraft">保存片段计划</UButton>
      <span v-if="draftSaved" role="status">片段计划已保存，刷新可恢复。</span>
      <UButton :loading="busy" :disabled="busy||!draftReady||!!errors.length||!!outputId&&!draftSaved" @click="submit()">确认合成当前短片</UButton>
    </div>
    <p v-if="outputId&&!draftSaved" class="text-muted">请先保存当前成片的片段计划，再确认合成；其他成片不会一起提交。</p>
    <p v-if="error" role="alert">{{error}}</p>
    <div v-if="localConflict" class="flex flex-wrap gap-2"><UButton color="neutral" variant="outline" :disabled="busy" @click="resolveBackup(false)">使用云端片段计划</UButton><UButton :disabled="busy" @click="resolveBackup(true)">保留本机片段计划</UButton></div>
    <header class="flex flex-wrap gap-2"><h3 class="font-semibold">相关合成记录</h3><UButton variant="outline" color="neutral" :disabled="busy" @click="history(true)">刷新记录</UButton></header>
    <div class="liv-composition-media-list">
    <article v-for="job in jobs" :key="job.id" class="liv-composition-media-card is-result rounded-xl border border-default space-y-2" :style="ratioStyle(job.id,job.plan.output.width/job.plan.output.height)">
      <p>{{job.plan.clips.length}} 个片段 · {{compositionStatus(job)}}</p>
      <video v-if="!linkedOnly&&job.status==='succeeded'&&job.output.public_url" :src="job.output.public_url" controls playsinline preload="metadata" class="liv-composition-video" @loadedmetadata="mediaRatio(job.id,$event)"/>
      <p v-if="job.error_message" role="alert">{{job.error_message}}</p>
      <UButton v-if="job.status==='failed'" color="neutral" variant="outline" :disabled="busy" @click="submit(job)">只重试合成</UButton>
    </article>
    </div>
    <UButton v-if="more" variant="outline" color="neutral" :disabled="busy" @click="history()">读取更多记录</UButton>
  </section>
</template>
