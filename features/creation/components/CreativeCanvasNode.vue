<script setup lang="ts">
import {Handle,Position} from '@vue-flow/core'
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import type {CreativeNodeData} from '../agentCanvas'
import MusicPlayer from '../../music/components/MusicPlayer.vue'
const props=defineProps<{id:string;data:CreativeNodeData;selected?:boolean;playbackEnabled?:boolean;busy?:boolean;editing?:boolean;creationItems?:Array<{label:string;icon?:string;disabled?:boolean;description?:string;onSelect:()=>unknown}>}>()
const emit=defineEmits<{uploadAudio:[file:File];tools:[id:string];focus:[id:string];toggleSelection:[id:string,event:MouseEvent];retry:[id:string];refreshFile:[id:string]}>()
// 菜单展开后保持加号可见，鼠标移入传送层不会让触发入口消失；键盘/触屏使用同一菜单。
const creationOpen=ref(false)
const audioPicker=ref<HTMLInputElement|null>(null)
/** 上传走现有资产入口，失败任务的原记录不被覆盖。 */
function pickAudio(event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(file)emit('uploadAudio',file)
  input.value=''
}
const creationHovered=ref(false),creationAnchor=ref<{left:number;top:number}|null>(null)
let creationLeaveTimer:ReturnType<typeof setTimeout>|undefined
/** 加号仅在素材右侧中部64×104热区内移动，图标仍32px；菜单展开/拖动时冻结。 */
function moveCreationEntry(event:PointerEvent){
  if(creationOpen.value||event.buttons||event.pointerType==='touch')return
  const node=event.currentTarget as HTMLElement,rect=node.getBoundingClientRect(),scale=rect.width/node.offsetWidth
  if(!scale||rect.height/scale<=32)return
  const regionHeight=Math.min(104,rect.height/scale-32),regionTop=rect.height/scale/2+16-regionHeight/2
  creationAnchor.value={left:Math.max(8,Math.min(24,(event.clientX-rect.right)/scale-16)),top:Math.max(16,Math.min(regionHeight-16,(event.clientY-rect.top)/scale-regionTop))/regionHeight*100}
}
/** 离开后短暂保留，覆盖跨越边缘/连线端口的鼠标误差；重新进入立即取消关闭。 */
function enterCreationRegion(){clearTimeout(creationLeaveTimer);creationHovered.value=true}
function leaveCreationRegion(){clearTimeout(creationLeaveTimer);creationLeaveTimer=setTimeout(()=>{creationHovered.value=false},180)}
// 仅整理阶段失败/停止允许原技能重整；媒体/合成失败保留各自任务重试语义。
const canRetry=computed(()=>props.data.phase==='planning'&&!!props.data.runId&&!props.data.itemId&&['failed','cancelled'].includes(props.data.status))
const failed=ref(false),ratio=ref(1),reload=ref(0)
const dimensions=ref('')
const imageElement=ref<HTMLImageElement|null>(null),mediaElement=ref<HTMLMediaElement|null>(null)
/** 仅当前节点可手动播放；切走、换文件、隐藏页面和销毁时停止解码，不自动续播。 */
function pauseMedia(){mediaElement.value?.pause()}
// 选择保留不代表画布可见；工具弹窗及窄屏对话页签同样暂停背景媒体。
const canPlay=computed(()=>!!props.selected&&props.playbackEnabled!==false)
watch(canPlay,allowed=>{if(!allowed)pauseMedia()},{flush:'sync'})
watch(()=>props.data.url,()=>{pauseMedia();failed.value=false;ratio.value=1;dimensions.value='';reload.value++},{flush:'sync'})
function visibilityChanged(){if(document.hidden)pauseMedia()}
onMounted(()=>document.addEventListener('visibilitychange',visibilityChanged))
onBeforeUnmount(()=>{clearTimeout(creationLeaveTimer);pauseMedia();document.removeEventListener('visibilitychange',visibilityChanged)})
/** 迟到的旧文件事件不能改变新文件状态；浏览器异步play同样遵守选中和页面可见性。 */
function played(event:Event){const media=event.target as HTMLMediaElement;if(media!==mediaElement.value||!canPlay.value||document.hidden||failed.value)media.pause()}
function fileFailed(event:Event){if(event.target!==imageElement.value&&event.target!==mediaElement.value)return;pauseMedia();failed.value=true}
/** 重新加载只重建同一媒体文件的播放器，不发送需求、创建任务或扣点。 */
function retryFile(){pauseMedia();failed.value=false;ratio.value=1;reload.value++;emit('refreshFile',props.id)}
const isDocument=computed(()=>props.data.reference?.media_type==='document')
const icon=computed(()=>isDocument.value?'i-lucide-file-text':({text:'i-lucide-type',image:'i-lucide-image',video:'i-lucide-film',audio:'i-lucide-music',compose:'i-lucide-clapperboard'}[props.data.kind]))
const pending=computed(()=>['planning','queued','pending','submitting','running','rendering','in_progress','processing','result_pending'].includes(props.data.status))
// 待确认是已经存在的方案，不计入生成中；动画仅提示等待用户确认。
const awaitingConfirmation=computed(()=>props.data.status==='ready'&&props.data.kind!=='text'&&!props.data.url)
const status=computed(()=>props.data.inherited?'原片 · 待重新生成':props.data.phase==='planning'&&props.data.status==='failed'?'整理未完成':props.data.phase==='planning'&&props.data.status==='cancelled'?'已停止整理':props.data.phase==='composition'&&props.data.status==='failed'?'合成失败':({ready:'待确认',replied:'已回复',draft:'草案',waiting:'等待补充',planning:'正在整理',queued:'排队中',pending:'排队中',submitting:'正在提交',running:'生成中',rendering:'合成中',in_progress:'生成中',processing:'生成中',result_pending:'正在读取结果',result_error:'结果待核对',succeeded:'已完成',completed:'已完成',failed:'生成失败',needs_review:'待核对',status_unavailable:'状态待同步',reference:'参考素材',unavailable:'素材不可用',cancelled:'已停止'}[props.data.status]||'待核对'))
/** 只使用文件元数据决定展示比例，不把规划画幅当成真实结果尺寸。 */
function imageMetadata(event:Event){
  const image=event.target as HTMLImageElement
  if(image===imageElement.value&&image.naturalWidth&&image.naturalHeight)dimensions.value=`${image.naturalWidth} × ${image.naturalHeight}`
}
function metadata(event:Event){
  const media=event.target as HTMLVideoElement
  if(media!==mediaElement.value)return
  ratio.value=media.videoWidth/media.videoHeight||1
  if(media.videoWidth&&media.videoHeight)dimensions.value=`${media.videoWidth} × ${media.videoHeight}`
  // 部分流媒体在metadata阶段不可定位；失败不妨碍后续用户手动播放。
  if(media.paused&&Number.isFinite(media.duration)&&media.duration>0)try{media.currentTime=Math.min(.1,media.duration/2)}catch{/* 保留真实播放器，不拿参考图冒充首帧。 */}
}
/** 自定义节点直接接收双击，避免图形库的拖拽/选择转发吞掉事件；媒体控件不抢焦点。 */
function doubleClick(event:MouseEvent){
  // 批注、裁剪和媒体控件保留自身手势；普通图片与内联编辑器的图片可继续两级双击。
  if((event.target as HTMLElement).closest('button,input,textarea,audio,video,[role=button],.annotation-surface,.crop-overlay'))return
  event.stopPropagation();emit('focus',props.id)
}
/** 修饰键选择在节点捕获阶段统一接收，避免内嵌工具吞掉Shift/Ctrl点击；实际编辑控件仍独立操作。 */
function modifierClick(event:MouseEvent){
  if(!(event.shiftKey||event.ctrlKey||event.metaKey))return
  if((event.target as HTMLElement).closest('button,input,textarea,select,a,audio,video,[role=button],[contenteditable=true],.annotation-surface,.crop-overlay'))return
  // 本次交由父画布的同一多选方法处理，停止冒泡以免Vue Flow再反选一次。
  event.preventDefault();event.stopPropagation();emit('toggleSelection',props.id,event)
}
/** Vue Flow使用mousedown/touchstart启动拖动，不能只阻止pointerdown而误拖真实控件。 */
function protectInlineControls(event:Event){
  if((event.target as HTMLElement).closest('button,a,input,textarea,select,audio,video,[role=button],[role=slider],[contenteditable=true],.nodrag,.annotation-surface,.crop-overlay'))event.stopPropagation()
}
</script>
<template>
  <article class="creative-node" :class="{'is-selected':selected,'is-pending':pending,'is-creation-hovered':creationHovered,'is-editing':editing}" :aria-label="`${data.title} · ${status}`" @click.capture="modifierClick" @dblclick="doubleClick" @pointerenter="enterCreationRegion" @pointerleave="leaveCreationRegion" @pointermove="moveCreationEntry">
    <header v-if="data.kind!=='audio'||!data.url||failed" class="creative-node-heading"><UIcon :name="icon"/><span class="creative-node-title" :title="data.title">{{data.title}}</span><span v-if="dimensions&&!failed" class="creative-node-dimensions">{{dimensions}}</span><span v-else-if="!data.url||failed" class="creative-node-state">{{status}}</span></header>
    <Handle type="target" :position="Position.Left" :is-connectable="!!data.manual"/>
    <div class="creative-node-body" :class="{'is-text':data.kind==='text','is-audio':data.kind==='audio'&&!!data.url&&!failed}">
      <!-- 图片普通预览仍由Vue Flow拖动整个节点；批注/裁剪等实际控件由内联编辑器自行隔离。 -->
      <div v-if="editing" class="creative-node-inline-tools" :class="{'nodrag nopan nowheel':data.kind!=='audio'&&data.kind!=='image'}" @pointerdown="event=>{if(data.kind!=='audio'&&data.kind!=='image')event.stopPropagation()}" @mousedown="protectInlineControls" @touchstart="protectInlineControls" @click.stop @dblclick.stop="doubleClick"><slot name="media-editor"/></div>
      <div v-else-if="data.kind==='audio'&&!data.url&&(data.manual&&data.status==='draft'||data.status==='failed'&&data.phase!=='planning'&&data.phase!=='composition')" class="creative-audio-upload">
        <UIcon name="i-lucide-audio-lines" aria-hidden="true"/>
        <input ref="audioPicker" hidden type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" @change="pickAudio">
        <UButton class="nodrag nopan" color="neutral" variant="soft" icon="i-lucide-upload" :disabled="busy" @click.stop="audioPicker?.click()">上传</UButton>
        <small v-if="data.status==='failed'" :title="data.detail">生成失败 · 可上传新音频</small>
      </div>
      <div v-else-if="isDocument" class="creative-node-placeholder"><UIcon :name="icon"/><span>{{data.status==='unavailable'?'文档不可用':data.detail}}</span><span v-if="data.reference?.start!=null&&data.reference?.end!=null">已选 {{data.reference.end-data.reference.start}} 字原文</span></div>
      <p v-else-if="data.kind==='text'" class="creative-node-text" :class="{'is-placeholder':!data.prompt?.trim()}">{{data.prompt?.trim()?data.prompt:'选择节点，填写文本内容'}}</p>
      <img v-else-if="data.kind==='image'&&data.url&&!failed" :key="reload" ref="imageElement" :src="data.url" :alt="data.title" draggable="false" @load="imageMetadata" @error="fileFailed"/>
      <video v-else-if="(data.kind==='video'||data.kind==='compose')&&data.url&&!failed" :key="reload" ref="mediaElement" :class="canPlay?'nodrag nopan nowheel':'creative-static-video'" :src="data.url" :poster="data.cover" :style="{aspectRatio:ratio}" :controls="canPlay" :muted="!canPlay" playsinline preload="metadata" @play="played" @loadedmetadata="metadata" @error="fileFailed"/>
      <!-- 音乐节点复用共享播放器的紧凑外观，不再使用原生音频控制条或大封面。 -->
      <MusicPlayer v-else-if="data.kind==='audio'&&data.url&&!failed" :key="reload" canvas-mini :url="data.url" :title="data.title" :waveform-task-id="data.source?.kind==='music'?data.source.id:undefined" :track-number="data.source?.audio_index" :playback-enabled="playbackEnabled!==false"/>
      <div v-else class="creative-node-placeholder"><!-- 确认等待与真正执行共用双球动画，文字仍区分待确认、排队及生成，不把排队伪装成模型执行。 --><span v-if="awaitingConfirmation||pending" class="workspace-loading-dots" aria-hidden="true"><i/><i/></span><UIcon v-else :name="icon"/><span>{{failed?'文件暂不可用':status}}</span><UButton v-if="failed&&data.url" class="nodrag nopan" icon="i-lucide-refresh-cw" color="neutral" variant="soft" @click.stop="retryFile">重新加载文件</UButton><!-- 任务未完成时不以100%冒充媒体已就绪；失败说明仅展示服务端真实业务消息。 --><span v-if="pending&&data.progress!=null&&data.progress<100">{{data.progress}}%</span><span v-if="['failed','needs_review','status_unavailable','result_error'].includes(data.status)&&data.detail" class="creative-node-detail">{{data.detail}}</span></div>
      <!-- 文本节点也需要展示真实整理错误，不能只让媒体占位分支显示失败原因。 -->
      <p v-if="data.kind==='text'&&!isDocument&&['failed','needs_review','status_unavailable','result_error'].includes(data.status)&&data.detail" class="creative-node-detail" role="status">{{data.detail}}</p>
    </div>
    <Handle type="source" :position="Position.Right"/>
    <!-- 加号与拖线端口分开：保留原端口连线能力，点击菜单只创建相连草案，不执行采购。 -->
    <div v-if="creationItems?.length" class="creative-node-create nodrag nopan" :class="{'is-open':creationOpen}" @pointerdown.stop @click.stop>
      <UDropdownMenu v-model:open="creationOpen" :items="[{label:'生成',type:'label'},...creationItems.filter(item=>item.label!=='派生')]" :modal="false" :content="{side:'right',align:'center',sideOffset:8}" :ui="{content:'creative-node-create-menu'}">
        <UTooltip text="基于此节点继续创作"><UButton icon="i-lucide-plus" square color="neutral" variant="soft" class="creative-node-create-trigger" :style="{left:`${creationAnchor?.left??12}px`,top:creationAnchor?`${creationAnchor.top}%`:'50%'}" :aria-label="`基于${data.title}添加节点`" :disabled="busy"/></UTooltip>
      </UDropdownMenu>
    </div>
    <div v-if="selected&&!editing&&(canRetry||(data.source&&data.status!=='unavailable'&&!isDocument))" class="creative-node-actions nodrag nopan">
      <UButton v-if="canRetry" icon="i-lucide-refresh-cw" color="neutral" variant="soft" :disabled="busy" @click.stop="emit('retry',id)">重新整理</UButton>
      <!-- 图片选中后直接显示原工具条；其他媒体保留现有显式工具入口。 -->
      <UButton v-if="data.kind==='audio'&&data.source&&data.status!=='unavailable'&&!isDocument" icon="i-lucide-sliders-horizontal" color="neutral" variant="ghost" @click.stop="emit('tools',id)">工具</UButton>
    </div>
  </article>
</template>
<style src="../../../assets/css/liv-loading-dots.css"></style>
