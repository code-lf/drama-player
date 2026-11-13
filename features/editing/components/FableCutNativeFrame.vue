<script setup lang="ts">
import type {EditingDraft} from '../types'
import {createEditingBridge} from '../editing-bridge.mjs'
import LivButton from '~/components/liv-ui/LivButton.vue'

const props = defineProps<{draft: EditingDraft; insetRight?:number; paused?:boolean; compact?:boolean; editable?:boolean; media?: Array<{clip_id: string; mime: string; bytes: ArrayBuffer}>}>()
const emit = defineEmits<{ready:[];candidate: [value: {expected_revision: number; operations: unknown[]}]; selection: [id: string | null]; playback:[playing:boolean];playhead:[position:number];failure: [code: string];decode:[id:string]}>()

const frame = ref<HTMLIFrameElement>()
const documentUrl = ref('')
const frameState=ref<'loading'|'ready'|'failed'>('loading')
let bridge: ReturnType<typeof createEditingBridge> | undefined
let ready = false
let disposed = false
let projection = 0
let channel = ''
let handshakeTimer:ReturnType<typeof setTimeout>|undefined
const sentMedia = new Map<string, ArrayBuffer>()
/** 只有本组件挂载才加载原生大包；普通首页/侧栏不触发读取。 */
onMounted(loadFrame)
/** 加载只重建隔离预览，不重建平台草稿、不采购、不重放编辑命令。 */
async function loadFrame(){
  if(disposed)return
  clearTimeout(handshakeTimer);ready=false;frameState.value='loading';sentMedia.clear()
  bridge?.dispose();window.removeEventListener('message',receive)
  documentUrl.value=''
  try {
    if (disposed || !frame.value?.contentWindow) return
    const token = () => [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('')
    channel = token()
    bridge = createEditingBridge({targetWindow: frame.value.contentWindow, channel, receive(message: any) {
      if (message.type === 'ready') {ready = true;frameState.value='ready';clearTimeout(handshakeTimer);project();emit('ready')}
      else if (message.type === 'edit_candidate') emit('candidate', message.payload)
      else if (message.type === 'selection') emit('selection', message.payload.clip_id)
      else if (message.type === 'playhead') emit('playhead',message.payload.position_ms)
      else if (message.type === 'playback') emit('playback',message.payload.playing)
      else if (message.type === 'runtime_error') emit('failure', message.payload.code)
      else if (message.type === 'media_decode_failed') emit('decode', message.payload.clip_id)
    }})
    window.addEventListener('message', receive)
    // 大型离线文档由独立本地页面加载，不进入首页客户端依赖或巨型srcdoc属性。
    // URL只携带随机握手身份，绝不包含用户凭据、草稿或素材；子页仍是null来源。
    documentUrl.value=`/editing-native-frame?channel=${channel}&nonce=${token()}`
    // 初始空文档或热更新导航没有完成时，不让用户一直面对无说明的白屏。
    handshakeTimer=setTimeout(()=>{if(!disposed&&!ready){frameState.value='failed';emit('failure','native_handshake_failed')}},12000)
  } catch {frameState.value='failed';emit('failure', 'native_bundle_failed')}
}
function receive(event: MessageEvent) {bridge?.handle(event)}
function project() {
  if (!ready || disposed) return
  configure()
  // Vue响应式代理不能直接structuredClone；发送纯JSON合同而非组件代理。
  bridge?.project(JSON.parse(JSON.stringify(props.draft)), `projection_${++projection}`)
  sendMedia()
}
/** 素材到达不重发草稿投影，避免解码回填把时间轴拖动重置。 */
function sendMedia() {
  if (!ready || disposed) return
  const active=new Set((props.media||[]).map(item=>item.clip_id))
  // 引用移除或显式重读时释放旧媒体，不让过期字节继续冒充重试成功。
  for(const id of sentMedia.keys())if(!active.has(id)){
    frame.value?.contentWindow?.postMessage({version:1,channel,type:'media_remove',payload:{clip_id:id}},'*')
    sentMedia.delete(id)
  }
  // 父壳只传已授权字节，不把登录凭据/临时链接交给iframe；复制后转移不破坏调用方缓存。
  for (const media of props.media || []) {
    if (sentMedia.get(media.clip_id) === media.bytes) continue
    const bytes = media.bytes.slice(0)
    frame.value?.contentWindow?.postMessage({version: 1, channel, type: 'media_bytes', payload: {...media, bytes}}, '*', [bytes])
    sentMedia.set(media.clip_id, media.bytes)
  }
}
/** 素材试听开始时只暂停成片，不自动恢复，避免两个播放器同时发声。 */
function configure(){
  if(!ready||disposed)return
  frame.value?.contentWindow?.postMessage({version:1,channel,type:'viewport',payload:{right:Math.max(0,Math.min(440,props.insetRight||0)),paused:!!props.paused,compact:!!props.compact,editable:props.editable!==false}},'*')
}
watch(()=>[props.insetRight,props.paused,props.compact,props.editable],configure)
watch(() => props.draft, project, {deep: true})
watch(() => props.media, sendMedia)
onBeforeUnmount(() => {
  disposed = true; ready = false; bridge?.dispose()
  clearTimeout(handshakeTimer)
  sentMedia.clear()
  window.removeEventListener('message', receive)
  // 移除文档会释放该隔离域的媒体元素与blob；不保留跨账号播放器。
  if (frame.value) frame.value.src = 'about:blank'
})
</script>

<template>
  <div class="liv-native-editor">
    <iframe ref="frame" :src="documentUrl||'about:blank'" sandbox="allow-scripts" referrerpolicy="no-referrer" title="剪辑预览与时间轴" />
    <div v-if="frameState!=='ready'" class="native-loading" role="status">
      <template v-if="frameState==='loading'"><UIcon name="i-lucide-loader-circle" class="native-spinner"/><span>正在加载剪辑预览…</span></template>
      <LivButton v-else variant="secondary" @click="loadFrame">重新加载预览</LivButton>
    </div>
  </div>
</template>

<style scoped>
.liv-native-editor{position:relative;flex:1;min-height:0;width:100%;height:100%;background:var(--liv-account-surface);color-scheme:dark}
.liv-native-editor>iframe{display:block;width:100%;height:100%;border:0}
.native-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--liv-account-surface);color:var(--liv-account-muted);font-size:14px}
.native-spinner{width:18px;height:18px;animation:native-spin 1s linear infinite}@keyframes native-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.native-spinner{animation:none}}
</style>
