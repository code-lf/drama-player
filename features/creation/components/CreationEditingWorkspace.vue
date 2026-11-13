<script setup lang="ts">
import type {SessionResult} from '../resultCatalog'
import type {EditingAsset} from '~/features/editing/useEditingWorkspace'
import type {EditingAudio,EditingDraft} from '~/features/editing/types'
import {useEditingWorkspace} from '~/features/editing/useEditingWorkspace'
import CreationDeliveryPanel from './CreationDeliveryPanel.vue'
import CreationMediaPreview from './CreationMediaPreview.vue'
import CreationWorkspaceNotice from './CreationWorkspaceNotice.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import EditingAssistantPanel from '~/features/editing/components/EditingAssistantPanel.vue'
import EditingRangeForm from '~/features/editing/components/EditingRangeForm.vue'
const NativeFrame=defineAsyncComponent(()=>import('~/features/editing/components/FableCutNativeFrame.vue'))
const props=defineProps<{sessionId:string;sources:SessionResult[];musicSources:SessionResult[];assets:EditingAsset[];initialAssetKey?:string;entryCompositionId?:string}>()
const emit=defineEmits<{close:[];openRun:[id:string]}>()
const w=useEditingWorkspace(props)
// 解构ref供Vue模板正常解包，不向第三方子页传响应式代理。
const {state,draft,selected,position,activeAsset,previewAsset,query,category,notice,loading,busy,outputs,outputId,job,media,logs,assets,visibleAssets,current,selectedClip,total,savedLabel,canEdit,canExport,conflictSummary,mediaIssues,mediaLoading,auditionId,auditionUrl}=w
const {confirm}=useActionDialog()
const advanced=ref(false),agentOpen=ref(true),assetsOpen=ref(true)
const narrow=ref(false),audioChoice=ref<EditingAsset|null>(null)
let viewport:MediaQueryList|undefined
/** 窄屏只打开一个面板；转向时重新计算，不改草稿。 */
function updateViewport(){
  const value=!!viewport?.matches
  if(value!==narrow.value){narrow.value=value;agentOpen.value=!value;assetsOpen.value=!value}
  measureMaterialInset()
}
const assetTab=ref<'assets'|'details'>('assets')
const upload=ref<HTMLInputElement>(),delivery=ref<InstanceType<typeof CreationDeliveryPanel>>()
const stage=ref<HTMLElement>(),assetPane=ref<HTMLElement>(),rightInset=ref(300),dragging=ref(false)
let resizeObserver:ResizeObserver|undefined
/** 从真实面板宽度投影预览留白；底部时间轴仍横跨预览和素材区。 */
function measureMaterialInset(){rightInset.value=window.innerWidth<768?0:assetsOpen.value?(assetPane.value?.getBoundingClientRect().width||0):0}
onMounted(()=>{viewport=window.matchMedia('(max-width:767px)');viewport.addEventListener('change',updateViewport);updateViewport();resizeObserver=new ResizeObserver(measureMaterialInset);if(stage.value)resizeObserver.observe(stage.value)})
watch(assetsOpen,async()=>{await nextTick();measureMaterialInset()})
onBeforeUnmount(()=>{viewport?.removeEventListener('change',updateViewport);resizeObserver?.disconnect()})
/** 冲突摘要保留在工作台，只有明确同意才切换到最新版。 */
async function loadLatest(){if(await confirm('将放弃本次未保存的本地修改，且不会自动重放。可先复制修改摘要。','加载云端最新版'))await w.reloadConflict()}
async function copyConflict(){
  try{await navigator.clipboard.writeText(conflictSummary.value);notice.value='已复制本地修改摘要。'}
  catch{notice.value='无法访问剪贴板，可直接选择下方摘要复制。'}
}
function showDetails(){assetsOpen.value=true;assetTab.value='details';if(narrow.value)agentOpen.value=false}
function showAssets(){assetsOpen.value=!assetsOpen.value;if(narrow.value&&assetsOpen.value)agentOpen.value=false}
function showAgent(){agentOpen.value=!agentOpen.value;if(narrow.value&&agentOpen.value)assetsOpen.value=false}
async function close(){
  if(advanced.value&&delivery.value&&!await delivery.value.canLeave())return
  if(state.value.state==='saving'){notice.value='正在保存，请完成后再关闭。';return}
  if(['failed','conflict'].includes(state.value.state)&&!await confirm('仍有未保存修改，关闭将放弃本次本地候选，已保存作品不受影响。','关闭剪辑'))return
  emit('close')
}
async function toggleAdvanced(){
  if(w.agentBusy.value||w.exporting.value){notice.value='请等待当前剪辑指令或导出提交返回。';return}
  if(state.value.state!=='saved'){notice.value='请先处理未保存修改。';return}
  if(advanced.value&&delivery.value&&!await delivery.value.canLeave())return
  advanced.value=!advanced.value
  if(!advanced.value&&outputId.value)await w.switchDraft(outputId.value)
}
async function importLocal(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(file)await w.importLocal(file);if(upload.value)upload.value.value=''}
function remove(){if(selectedClip.value)w.submit([{type:'remove_visual',clip_id:selectedClip.value.id}])}
function imageLength(value:number){if(selectedClip.value)w.submit([{type:'set_image_duration',clip_id:selectedClip.value.id,duration_ms:Math.round(value*25)*40}])}
function volume(value:number){if(selectedClip.value)w.submit([{type:'set_original_volume',clip_id:selectedClip.value.id,volume:value/100}])}
const clipIndex=computed(()=>draft.value.visuals.findIndex(clip=>clip.id===selected.value))
/** 窄屏的前后移动仍走同一命令，而不是模拟鼠标。 */
function moveClip(direction:-1|1){
  const index=clipIndex.value,clips=draft.value.visuals
  if(!canEdit.value||index<0||index+direction<0||index+direction>=clips.length)return
  w.submit([{type:'move_visual',clip_id:clips[index]!.id,before_id:clips[direction<0?index-1:index+2]?.id??null}])
}
function trimVisual(range:{start:number;end:number}){
  if(selectedClip.value?.kind==='video')w.submit([{type:'trim_video',clip_id:selectedClip.value.id,trim_start_ms:range.start,trim_end_ms:range.end}])
}
function trimNarration(range:{start:number;end:number;offset?:number}){
  w.setAudio('narration',{trim_start_ms:range.start,trim_end_ms:range.end,start_ms:range.offset??0})
}
/** 加号和拖入共用音频用途选择；异步确认后再核对当前版本和轨道。 */
function addMaterial(item:EditingAsset){
  if(!canEdit.value)return
  if(item.kind==='audio'){
    if(!total.value){notice.value='请先添加画面片段。';return}
    audioChoice.value=item
  }else void w.addAsset(item)
}
async function chooseAudio(role:EditingAudio['role']){
  const item=audioChoice.value,revision=draft.value.revision,output=outputId.value
  if(!item||!canEdit.value)return
  audioChoice.value=null
  if(draft.value.audio_tracks.some(track=>track.role===role)&&!await confirm('原音轨将被替换，可通过撤销恢复。','替换'+(role==='bgm'?'配乐':'旁白')))return
  if(canEdit.value&&revision===draft.value.revision&&output===outputId.value)await w.addAsset(item,role)
}
function audition(id:string){if(narrow.value)assetsOpen.value=false;w.auditionTrack(id)}
function previewMaterial(item:EditingAsset){w.stopAudition();activeAsset.value=item.key;previewAsset.value=true;if(narrow.value)assetsOpen.value=false}
const failedMedia=computed(()=>[...draft.value.visuals.map((clip,index)=>({id:clip.id,label:`画面第 ${index+1} 段`})),...draft.value.audio_tracks.map(track=>({id:track.id,label:track.role==='bgm'?'背景音乐':'旁白'}))].filter(item=>mediaIssues.value[item.id]))
const mediaLabels={retry:'读取失败，可重试',unavailable:'文件或权限不可用',decode:'当前浏览器无法解码'}
/** 成片开始播放时卸载源素材试听，保证声音互斥。 */
function programPlayback(playing:boolean){if(playing)previewAsset.value=false}
let previewFailureNotice=''
/** 预览恢复只清理自己的旧错误，不吞掉并发保存失败或草稿冲突通知。 */
function nativeReady(){if(notice.value===previewFailureNotice)notice.value='';previewFailureNotice=''}
/** 分类说明可恢复路径；不能把受限编辑和解码异常都说成素材失效。 */
function nativeFailure(code:string){
  const messages:Record<string,string>={
    audio_edit_restricted:'音轨暂不支持直接拖动，请在右侧「详情」调整音量与循环；此次拖动未保存。',
    unsupported_native_change:'此次操作超出当前剪辑范围，已恢复已保存轨道；可使用排序、裁切或上方分割按钮。',
    media_decode_failed:'部分素材预览解码失败，已保存剪辑稿仍保留；请重新打开工作台后重试。',
    native_bundle_failed:'剪辑器加载失败，请关闭工作台后重试；已保存剪辑稿不受影响。',
    native_handshake_failed:'剪辑预览未能载入，请点击重新加载预览；已保存剪辑稿仍保留。',
    native_runtime_failed:'剪辑预览发生异常，请重新打开工作台；已保存内容仍保留。',
  }
  previewFailureNotice=messages[code]||'剪辑预览暂不可用，请重新打开工作台。'
  notice.value=previewFailureNotice
}
const exportStatus=computed(()=>job.value?({queued:'等待合成',rendering:'合成中',failed:'失败',succeeded:'已完成'}[job.value.status]):'')
/** 只转交素材身份，drop不会接受任意URL或外部文件路径。 */
function drop(event:DragEvent){event.preventDefault();dragging.value=false;const key=event.dataTransfer?.getData('application/x-liv-editing-asset');const item=assets.value.find(a=>a.key===key);if(item)addMaterial(item)}
function drag(event:DragEvent,key:string){event.dataTransfer?.setData('application/x-liv-editing-asset',key);dragging.value=true}
</script>

<template>
  <Teleport to="body">
    <section class="editing-workspace" :class="{'agent-collapsed':!agentOpen,'assets-collapsed':!assetsOpen}" role="dialog" aria-label="AI 剪辑工作台" aria-modal="true">
      <header class="editor-top">
        <LivButton v-if="narrow||!agentOpen" variant="ghost" icon-only icon="i-lucide-panel-left" aria-label="切换剪辑助手" @click="showAgent"/><span class="save-state" role="status">{{loading?'正在读取…':savedLabel}}</span>
        <div class="editor-top-actions">
          <USelect :model-value="outputId||'new'" :items="[{label:'未命名剪辑',value:'new'},...outputs.map(o=>({label:o.title,value:o.id}))]" :disabled="!canEdit||w.agentBusy.value||w.exporting.value" aria-label="剪辑稿" @update:model-value="w.switchDraft($event==='new'?'':String($event))" />
          <USelect :model-value="draft.aspect" :items="['16:9','9:16','1:1']" :disabled="!canEdit" aria-label="画幅" @update:model-value="w.submit([{type:'set_aspect',aspect:$event as EditingDraft['aspect']}])" />
          <UTooltip :text="advanced?'返回时间轴':'高级合成入口'"><LivButton icon-only variant="ghost" :icon="advanced?'i-lucide-list-video':'i-lucide-ellipsis'" aria-label="切换高级合成入口" @click="toggleAdvanced"/></UTooltip>
          <LivButton class="editor-export" variant="primary" icon="i-lucide-download" :disabled="!canExport||advanced" @click="w.exportVideo">导出</LivButton>
          <LivButton variant="ghost" icon-only icon="i-lucide-panel-right" aria-label="切换素材区" @click="showAssets"/>
          <LivButton variant="ghost" icon-only icon="i-lucide-x" aria-label="关闭剪辑工作台" @click="close" />
        </div>
      </header>
      <CreationWorkspaceNotice v-if="notice" :text="notice" :dismissible="state.state!=='failed'" @dismiss="notice=''">
        <template #actions><button v-if="state.state==='failed'" @click="w.retry">重试保存</button></template>
      </CreationWorkspaceNotice>
      <section v-if="state.state==='conflict'" class="editor-conflict" aria-label="保存冲突">
        <strong>草稿版本已变化，本地修改尚未保存</strong>
        <pre>{{conflictSummary}}</pre>
        <div class="editor-action-row"><LivButton @click="copyConflict">复制修改摘要</LivButton><LivButton :loading="loading" @click="loadLatest">加载云端最新版</LivButton></div>
      </section>
      <LivDialog :open="!!audioChoice" title="选择音轨用途" width="sm" dark @update:open="open=>{if(!open)audioChoice=null}">
        <p>{{audioChoice?.title}}</p>
        <template #footer>
          <LivButton :disabled="!canEdit" @click="chooseAudio('bgm')">添加为配乐</LivButton>
          <LivButton :disabled="!canEdit" @click="chooseAudio('narration')">添加为旁白</LivButton>
        </template>
      </LivDialog>
      <div v-if="advanced" class="editor-advanced"><CreationDeliveryPanel ref="delivery" :session-id="sessionId" :sources="sources" :music-sources="musicSources" @open-run="emit('openRun',$event)" /></div>
      <template v-else>
        <!-- 收起只隐藏，保留同一助手输入、消息滚动位置和上下文实例。 -->
        <EditingAssistantPanel v-show="agentOpen" class="editor-agent-shared" :results="logs" :messages="w.agentMessages.value" :thinking="w.agentBusy.value" :disabled-reason="w.agentDisabledReason.value" @send="w.askAgent" @collapse="agentOpen=false"/>
        <div ref="stage" class="editor-stage" :style="{'--editor-material-inset':rightInset+'px'}" @dragover.prevent @drop="drop">
          <div class="editor-toolbar"><LivButton icon-only icon="i-lucide-undo-2" aria-label="撤销" :disabled="!canEdit||!state.undoCount" @click="w.undo"/><LivButton icon-only icon="i-lucide-redo-2" aria-label="重做" :disabled="!canEdit||!state.redoCount" @click="w.redo"/><LivButton icon="i-lucide-scissors" :disabled="!canEdit||!selectedClip" @click="w.split">分割</LivButton><LivButton icon="i-lucide-trash-2" :disabled="!canEdit||!selectedClip" @click="remove">删除片段</LivButton><span>{{(position/1000).toFixed(2)}} / {{(total/1000).toFixed(2)}}s</span><LivButton v-if="narrow||failedMedia.length" @click="showDetails">详情{{failedMedia.length?' · '+failedMedia.length:''}}</LivButton><LivButton v-if="previewAsset" @click="previewAsset=false">成片预览</LivButton></div>
          <ClientOnly><NativeFrame v-if="!loading" :draft="draft" :media="media" :inset-right="rightInset" :paused="previewAsset" :compact="narrow" :editable="canEdit" @candidate="w.candidate" @selection="selected=$event;previewAsset=false" @playback="programPlayback" @playhead="position=$event" @failure="nativeFailure" @decode="w.markDecode" @ready="nativeReady" /></ClientOnly>
          <div v-if="dragging" class="editor-drop-zone" @dragover.prevent @drop="drop">松开添加到时间轴</div>
          <div v-if="previewAsset&&(auditionUrl||current)" class="editor-source-preview"><audio v-if="auditionUrl" :src="auditionUrl" controls autoplay aria-label="音轨试听" @error="w.markDecode(auditionId)"/><video v-else-if="current?.kind==='video'" :src="current.url" :poster="current.cover" controls playsinline preload="metadata"/><img v-else-if="current?.kind==='image'" :src="current.url" :alt="current.title"/><audio v-else :src="current?.url" controls preload="metadata"/></div>
          <div v-if="!draft.visuals.length&&!previewAsset" class="editor-empty">点击右侧素材预览，点击“添加”进入时间轴</div>
        </div>
        <aside v-if="assetsOpen" ref="assetPane" class="editor-assets" aria-label="当前会话素材">
          <div class="section-title"><div class="editor-inspector-tabs"><button :aria-pressed="assetTab==='assets'" @click="assetTab='assets'">素材</button><button disabled title="滤镜正在开发中">滤镜</button><button disabled title="文字轨正在开发中">文字</button><button :aria-pressed="assetTab==='details'" @click="assetTab='details'">详情</button></div><LivButton icon-only icon="i-lucide-panel-right-close" variant="ghost" aria-label="收起素材区" @click="assetsOpen=false"/></div>
          <div v-if="assetTab==='details'" class="editor-details">
            <section v-if="failedMedia.length" class="clip-settings" aria-label="素材预览问题">
              <div v-for="item in failedMedia" :key="item.id" class="editor-action-row">
                <span>{{item.label}}：{{mediaLabels[mediaIssues[item.id]!]}}</span>
                <LivButton size="sm" :loading="mediaLoading.includes(item.id)" @click="w.retryMedia(item.id)">重新读取</LivButton>
              </div>
            </section>
            <div v-if="narrow&&draft.visuals.length" class="clip-settings">
              <USelect :model-value="selectedClip?.id" :items="draft.visuals.map((clip,i)=>({label:'第 '+(i+1)+' 段',value:clip.id}))" placeholder="选择画面片段" aria-label="选择画面片段" @update:model-value="selected=String($event)"/>
              <div v-if="selectedClip" class="editor-action-row"><LivButton :disabled="!canEdit||clipIndex<=0" @click="moveClip(-1)">前移</LivButton><LivButton :disabled="!canEdit||clipIndex>=draft.visuals.length-1" @click="moveClip(1)">后移</LivButton></div>
              <EditingRangeForm v-if="selectedClip?.kind==='video'" :key="selectedClip.id" :start="selectedClip.trim_start_ms" :end="selectedClip.trim_end_ms" :step="40" :disabled="!canEdit" label="应用视频裁切" @apply="trimVisual"/>
            </div>
            <div v-if="selectedClip" class="clip-settings"><strong>选中片段</strong><label v-if="selectedClip.kind==='image'">展示秒数<UInputNumber :model-value="selectedClip.duration_ms/1000" :min=".04" :step=".04" :disabled="!canEdit" @update:model-value="imageLength(Number($event))"/></label><label v-else>原声音量 %<UInputNumber :model-value="selectedClip.original_volume*100" :min="0" :max="100" :disabled="!canEdit" @update:model-value="volume(Number($event))"/></label></div>
            <div v-for="track in draft.audio_tracks" :key="track.id" class="clip-settings"><strong>{{track.role==='bgm'?'背景音乐':'旁白'}}</strong><label>音量 %<UInputNumber :model-value="track.volume*100" :min="0" :max="100" :disabled="!canEdit" @update:model-value="w.setAudio(track.role,{volume:Number($event)/100})"/></label><label v-if="track.role==='bgm'">原速循环铺满<USwitch :model-value="track.repeat_mode==='loop'" :disabled="!canEdit" @update:model-value="w.setAudio('bgm',$event?{repeat_mode:'loop',play_duration_ms:total-track.start_ms}:{repeat_mode:'none',play_duration_ms:null})"/></label><EditingRangeForm v-if="track.role==='narration'" :start="track.trim_start_ms" :end="track.trim_end_ms" :offset="track.start_ms" :step="1" :disabled="!canEdit" label="应用旁白区间" @apply="trimNarration"/><LivButton variant="ghost" size="sm" :disabled="!!mediaIssues[track.id]||!media.some(item=>item.clip_id===track.id)" @click="audition(track.id)">试听源音频</LivButton><LivButton variant="ghost" size="sm" :disabled="!canEdit" @click="w.submit([{type:'set_audio',role:track.role,track:null}])">移除音轨</LivButton></div>
            <p v-if="job">第 {{job.plan.revision}} 版导出：{{exportStatus}}</p><LivButton v-if="job?.status==='failed'" variant="secondary" :loading="w.exporting.value" :disabled="!canEdit" @click="w.retryExport">重试合成</LivButton><a v-if="job?.status==='succeeded'&&job.output.public_url" :href="job.output.public_url" target="_blank" rel="noopener">播放／下载成片</a>
          </div>
          <template v-else>
          <input ref="upload" hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,audio/*" @change="importLocal"/>
          <div class="asset-search"><LivButton size="sm" icon="i-lucide-plus" :loading="busy" :disabled="!canEdit" @click="upload?.click()">导入</LivButton><USelect v-model="category" :items="[{label:'全部',value:'all'},{label:'图片',value:'image'},{label:'视频',value:'video'},{label:'音频',value:'audio'}]" aria-label="素材分类"/><UInput v-model="query" trailing-icon="i-lucide-search" placeholder="搜索素材" aria-label="搜索素材"/></div>
          <div class="editing-assets"><article v-for="item in visibleAssets" :key="item.key" :class="{'asset-selected':activeAsset===item.key}" :draggable="!narrow" @dragstart="drag($event,item.key)" @dragend="dragging=false"><button type="button" :title="item.title" @click="previewMaterial(item)"><CreationMediaPreview :kind="item.kind" :url="item.url" :cover="item.cover"/><span>{{item.title}}</span></button><LivButton size="sm" variant="ghost" :disabled="!canEdit"  :aria-label="'添加 '+item.title" @click="addMaterial(item)">添加</LivButton></article></div>
          </template>
        </aside>
      </template>
    </section>
  </Teleport>
</template>

<style scoped>
/* 工作台尺寸集中定义，折叠不重建草稿；只让右上素材区覆盖预览，时间轴保持横跨。 */
.editing-workspace{
  --editor-agent-width:400px;--editor-assets-width:400px;--editor-timeline-height:340px;
  color-scheme:dark;--ui-bg:var(--liv-account-surface);--ui-bg-elevated:var(--liv-account-surface);
  --ui-bg-muted:var(--liv-account-raised);--ui-bg-accented:var(--liv-account-raised);
  --ui-text:var(--liv-account-text);--ui-text-highlighted:var(--liv-account-text);
  --ui-text-muted:var(--liv-account-muted);--ui-border:var(--liv-account-border);
  position:fixed;inset:0;z-index:200;display:grid;
  grid-template-columns:var(--editor-agent-width) minmax(0,1fr) var(--editor-assets-width);
  grid-template-rows:44px minmax(0,1fr);background:var(--liv-workspace-surface);
  color:var(--liv-account-text);font-family:var(--liv-chat-font-family);font-size:14px;
}
.editing-workspace.agent-collapsed{--editor-agent-width:0px}
.editing-workspace.assets-collapsed{--editor-assets-width:0px}
.editor-agent-shared{grid-column:1;grid-row:1/-1}
.editor-top{grid-column:2/-1;grid-row:1;display:flex;align-items:center;gap:8px;padding:4px 12px}
.save-state{color:var(--liv-account-muted);font-size:12px;white-space:nowrap}
.editor-top-actions{margin-left:auto;display:flex;align-items:center;gap:8px;min-width:0}
.editor-top-actions :deep([role=combobox]){max-width:360px;height:28px;min-height:28px;border-radius:8px}
.editor-top-actions :deep(.liv-button){height:28px;min-height:28px;border-radius:8px;font-size:12px}
.editor-top-actions :deep(.liv-icon-button){width:28px;min-width:28px}
/* 选择器仍由Nuxt UI处理焦点和浮层，仅统一工作台表面，不恢复默认黑蓝描边。 */
.editor-top-actions :deep([role=combobox]),.asset-search :deep([role=combobox]),.asset-search :deep(input){
  border:0;box-shadow:none;background:var(--liv-account-raised);color:var(--liv-account-text);
}
.editor-top-actions :deep(.editor-export){color:var(--liv-account-text);background:var(--liv-ui-primary)}
.editor-stage{grid-column:2/-1;grid-row:2;position:relative;min-width:0;min-height:0;display:flex;flex-direction:column}
.editor-stage :deep(iframe){flex:1;min-height:0}
.editor-toolbar{position:absolute;bottom:var(--editor-timeline-height);left:0;right:0;z-index:3;height:64px;display:flex;align-items:center;gap:8px;padding:8px 12px;pointer-events:none}
.editor-toolbar>.liv-button{pointer-events:auto;border:0;box-shadow:none;background:transparent;color:var(--liv-account-muted);font-size:12px}
.editor-toolbar>.liv-button:hover:not(:disabled){background:var(--liv-account-raised);color:var(--liv-account-text)}
.editor-toolbar>span{display:none}
.editor-source-preview,.editor-empty{position:absolute;inset:0 var(--editor-material-inset,400px) calc(var(--editor-timeline-height) + 64px) 0;display:grid;place-items:center;background:var(--liv-workspace-surface)}
.editor-source-preview>video,.editor-source-preview>img{max-width:100%;max-height:100%;object-fit:contain}
.editor-source-preview>audio{max-width:95%}
.editor-empty{color:var(--liv-account-muted);pointer-events:none}
.editor-drop-zone{position:absolute;inset:auto 0 0;height:var(--editor-timeline-height);z-index:5;display:grid;place-items:center;background:var(--liv-account-surface);outline:2px dashed var(--liv-ui-primary);outline-offset:-8px}
.editor-assets{grid-column:3;grid-row:2;z-index:2;min-height:0;overflow:auto;margin-bottom:calc(var(--editor-timeline-height) + 64px);padding:12px 16px;background:var(--liv-account-surface);border-left:1px solid var(--liv-account-border);border-top:1px solid var(--liv-account-border);border-radius:18px 0 0 0}
.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.editor-inspector-tabs{display:flex;gap:18px;font-size:14px;font-weight:600}
.editor-inspector-tabs button{color:var(--liv-account-muted)}
.editor-inspector-tabs button[aria-pressed=true]{color:var(--liv-account-text)}
.editor-inspector-tabs button:disabled{opacity:.45;cursor:not-allowed}
.asset-search{display:flex;align-items:center;gap:8px}
.asset-search>*{min-width:0}
.asset-search>:first-child{flex:0 0 auto;margin-right:auto;border:0;box-shadow:none;background:var(--liv-account-raised)}
.asset-search>:nth-child(2){flex:0 0 72px}
.asset-search>:last-child{flex:0 1 160px}
.asset-search :deep(input){border-radius:999px;font-size:12px}
.editing-assets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px;margin-top:16px}
.editing-assets article{position:relative;min-width:0;border:1px solid transparent;border-radius:8px}
.editing-assets article.asset-selected{border-color:var(--liv-ui-primary)}
.editing-assets article>button:first-child{width:100%;text-align:left}
.editing-assets :deep(.liv-media-preview){height:auto;aspect-ratio:16/9;border-radius:8px;background:var(--liv-account-raised)}
/* 名称只作用于按钮直属文字；预览和Nuxt图标也用span，不能一起覆盖其grid居中布局。 */
.editing-assets :deep(.liv-media-preview-icon){width:36px;height:36px;color:var(--liv-account-muted)}
.editing-assets article>button:first-child>span:not(.liv-media-preview){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:24px}
.editing-assets article>.liv-button{position:absolute;right:3px;top:3px;font-size:0;width:24px;height:24px;padding:0;background:var(--liv-account-surface);color:var(--liv-account-text);opacity:0}
.editing-assets article>.liv-button:before{content:'+';font-size:18px}
.editing-assets article:hover>.liv-button,.editing-assets article:focus-within>.liv-button{opacity:1}
.clip-settings{display:grid;gap:10px;padding:16px 0;border-top:1px solid var(--liv-account-border)}
.clip-settings label{display:flex;align-items:center;justify-content:space-between;gap:8px}
.clip-settings :deep([data-slot=root]){width:132px;flex:none}
.clip-settings :deep(input){width:100%;min-width:0;text-align:center}
.editor-advanced{grid-column:1/-1;overflow:auto;padding:20px}
.editing-workspace :deep(.creation-workspace-notice){z-index:230;top:70px}
.editor-conflict{position:absolute;z-index:10;top:52px;left:50%;transform:translateX(-50%);width:min(520px,calc(100% - 24px));max-height:min(46vh,360px);overflow:auto;padding:16px;background:var(--liv-account-raised);border:1px solid var(--liv-account-border);border-radius:12px}
.editor-conflict pre{white-space:pre-wrap;font:inherit;margin:8px 0 12px;user-select:text}
.editor-action-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
@media(max-width:1200px){.editing-workspace{--editor-agent-width:320px;--editor-assets-width:320px}}
@media(max-width:767px){
 /* 顶部两行留出保存状态，抽屉只覆盖预览，不遮挡顶部与下方播放控件。 */
 .editing-workspace{--editor-agent-width:0px;--editor-assets-width:0px;--editor-timeline-height:180px;grid-template-rows:80px minmax(0,1fr)}
 .editor-top{grid-column:1/-1;flex-wrap:wrap;gap:4px;padding:4px 8px}
 .editor-top-actions{gap:4px;width:100%;justify-content:flex-end;margin-left:0}
 .editor-top-actions :deep([role=combobox]){max-width:96px}
 .editor-top :deep(.liv-button){min-height:32px}
 .editor-top .save-state{margin-right:auto}
 .editor-agent-shared,.editor-assets{position:absolute;top:80px;bottom:calc(var(--editor-timeline-height) + 64px + 40px);width:min(360px,95vw);margin:0;z-index:5;overflow:auto;box-shadow:var(--liv-shadow-overlay)}
 .editor-assets{right:0}.editor-agent-shared{left:0}
 .editor-toolbar{height:40px;bottom:calc(var(--editor-timeline-height) + 64px);gap:2px;padding:0 4px;background:var(--liv-account-surface)}
 .editor-toolbar>.liv-button{padding-inline:5px}
 .editor-source-preview,.editor-empty{bottom:calc(var(--editor-timeline-height) + 64px + 40px)}
 .editing-assets article>.liv-button{opacity:1;width:32px;height:32px}
 .editor-conflict{top:82px}
}
</style>
