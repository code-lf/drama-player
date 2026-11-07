<script setup lang="ts">
import type {SessionResult} from '../resultCatalog'
import CreationDeliveryPanel from './CreationDeliveryPanel.vue'
import CreationMediaPreview from './CreationMediaPreview.vue'

type Asset = Pick<SessionResult,'key'|'title'|'kind'|'url'|'cover'>
const props=defineProps<{sessionId:string;sources:SessionResult[];musicSources:SessionResult[];assets:Asset[];initialAssetKey?:string}>()
const emit=defineEmits<{close:[];openRun:[id:string]}>()
const delivery=ref<InstanceType<typeof CreationDeliveryPanel>|null>(null)
// 从视频工具进入时先预览所点击作品；只选中素材，不自动添加轨道、创建计划或提交导出。
const selected=ref(props.initialAssetKey||'')
// 素材预览不把素材自动插入合成计划，保存与导出仍走原编辑器。
const current=computed(()=>props.assets.find(item=>item.key===selected.value)||props.assets.find(item=>item.kind==='video')||props.assets[0])
async function close(){if(!delivery.value||await delivery.value.canLeave())emit('close')}
</script>

<template>
  <Teleport to="body">
    <section class="editing-workspace" role="dialog" aria-label="AI 剪辑工作台">
      <header><strong>AI 剪辑工作台</strong><UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="关闭剪辑工作台" @click="close"/></header>
      <div class="editing-preview" aria-label="素材预览">
        <video v-if="current?.kind==='video'" :key="current.key" :src="current.url" :poster="current.cover" controls playsinline preload="metadata"/>
        <img v-else-if="current?.kind==='image'" :src="current.url" :alt="current.title">
        <audio v-else-if="current?.kind==='audio'" :key="current.key" :src="current.url" controls preload="metadata"/>
        <p v-else>暂无可预览素材</p>
      </div>
      <aside aria-label="当前会话素材">
        <strong>素材 <small>{{assets.length}}</small></strong>
        <div class="editing-assets">
          <button v-for="item in assets" :key="item.key" type="button" :aria-pressed="current?.key===item.key" :title="item.title" @click="selected=item.key">
            <CreationMediaPreview :kind="item.kind" :url="item.url" :cover="item.cover"/>
            <span>{{item.title}}</span>
          </button>
        </div>
      </aside>
      <div class="editing-plan" aria-label="片段与音轨">
        <CreationDeliveryPanel ref="delivery" :session-id="sessionId" :sources="sources" :music-sources="musicSources" @open-run="emit('openRun',$event)"/>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
/* 桌面预览与素材并列，原剪辑计划在下方；窄屏切为纵向滚动。 */
.editing-workspace{position:fixed;inset:0;z-index:200;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,32%);grid-template-rows:auto minmax(180px,1fr) minmax(220px,40%);gap:12px;padding:16px;background:var(--liv-graph-background);color:var(--liv-account-text)}
.editing-workspace>header{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center}
.editing-preview{display:grid;place-items:center;min-width:0;min-height:0}
.editing-preview>img,.editing-preview>video{max-width:100%;max-height:100%;object-fit:contain}
.editing-workspace>aside,.editing-plan{overflow:auto;min-height:0;padding:14px;border:1px solid var(--liv-account-border);border-radius:16px;background:var(--liv-account-surface)}
.editing-plan{grid-column:1/-1}
.editing-assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:12px}
.editing-assets button{display:grid;gap:4px;min-width:0;text-align:left;padding:4px;border:1px solid transparent;border-radius:8px}
.editing-assets button[aria-pressed=true]{border-color:var(--liv-ui-primary)}
.editing-assets button>.liv-media-preview{height:auto;aspect-ratio:16/9;background:var(--liv-account-raised);border-radius:6px}
.editing-assets button>span:last-child{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
@media(max-width:767px){.editing-workspace{display:flex;flex-direction:column;overflow:auto}.editing-preview{min-height:200px}.editing-workspace>aside,.editing-plan{min-height:160px;flex:none}}
</style>
