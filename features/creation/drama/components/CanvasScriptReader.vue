<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import CreationWorkspaceNotice from '../../components/CreationWorkspaceNotice.vue'
import { request } from '~/shared/api/adapters/httpAdapter'
import { dramaService } from '~/shared/api/services/dramaService'
import type { DramaOptimizationSuggestion } from '~/entities/drama/types'
import { locateReviewText } from '../reviewLocation'
import type { CanvasScriptDocument, CanvasScriptHistoryEntry, CanvasScriptHistoryPage, CanvasScriptState } from '../scriptDocument'

const props = defineProps<{ state: CanvasScriptState; busy: boolean; error: string; disabled?: boolean; initialRevision?:number }>()
const emit = defineEmits<{ close: []; save: [document: Omit<CanvasScriptDocument, 'id'>]; discuss: [description: string] }>()
const editing = ref(false), closeAfterDiscard = ref(false), discard = ref(false), production = ref(false)
const historyOpen = ref(false), historyBusy = ref(false), versionBusy = ref(false)
const entries = ref<CanvasScriptHistoryEntry[]>([]), cursor = ref<number | null>(null), historyError = ref(''), versionError = ref('')
const previous = ref<CanvasScriptState | null>(null), scroll = ref<HTMLElement | null>(null), historyPanel = ref<HTMLElement | null>(null)
const draft = ref<Omit<CanvasScriptDocument, 'id'>>({ title: '', source_text: '', requirements: '' })
// 对话文件卡固定到点击的版本；读取失败时不能悄悄显示较新的文稿。
const selectedRevision=ref(props.initialRevision)
const displayed = computed(() => !selectedRevision.value||selectedRevision.value===props.state.revision
  ? props.state.document : previous.value?.revision===selectedRevision.value?previous.value.document:null)
const dirty = computed(() => editing.value && !!props.state.document && (
  draft.value.title !== props.state.document.title || draft.value.source_text !== props.state.document.source_text ||
  draft.value.requirements !== props.state.document.requirements))
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
const notice = ref(''), copyFailed = ref(false)
const modification = ref('')
const reviewOpen=ref(false),reviewBusy=ref(false),reviewError=ref(''),reviewHint=ref('')
const suggestions=ref<DramaOptimizationSuggestion[]>([]),highlight=ref<{start:number;end:number}|null>(null)
let reviewRequest=0
/** 只读已有正式项目报告，不触发质检、模型调用或采购；历史文稿不套当前建议。 */
async function toggleReview(){
  reviewOpen.value=!reviewOpen.value
  if(!reviewOpen.value)return
  historyOpen.value=false;reviewBusy.value=true;reviewError.value='';reviewHint.value='';suggestions.value=[];highlight.value=null
  const seq=++reviewRequest,revision=props.state.revision
  try{
    const link=await request<{project_id?:string;binding?:{project_id?:string}}>(`/creation/sessions/${props.state.session_id}/production-workspace`)
    const id=link.project_id||link.binding?.project_id
    if(!id){reviewHint.value='尚未关联正式制作项目，暂无剧本检查建议。';return}
    const project=await dramaService.getProject(id)
    if(seq!==reviewRequest||revision!==props.state.revision)return
    if(project.sourceScriptText!==displayed.value?.source_text){reviewHint.value='当前文稿与正式报告原文不同，请先核对版本。';return}
    suggestions.value=project.optimizationSuggestions.filter(item=>!item.historyReadonly&&item.sourceVersion===project.currentScriptVersion)
    reviewHint.value=project.scriptReviewsStale?'现有报告已过期，仅供参考。':suggestions.value.length?'普通建议不会阻止继续制作。':'当前没有可展示的检查建议；不代表已通过全部检查。'
  }catch{if(seq===reviewRequest)reviewError.value='检查建议读取失败，请重试。'}
  finally{if(seq===reviewRequest)reviewBusy.value=false}
}
/** 证据只能精确匹配当前全文一次，否则明确不定位。 */
async function locateSuggestion(item:DramaOptimizationSuggestion){
  highlight.value=locateReviewText(displayed.value?.source_text||'',item.sourceLocator?.sourceTextSnapshot||item.originalText||'')
  if(!highlight.value){reviewHint.value='这条建议没有唯一原文位置，可查看说明后手动核对。';return}
  await nextTick();scroll.value?.querySelector('mark')?.scrollIntoView({block:'center',behavior:'smooth'})
}
let timer: ReturnType<typeof setTimeout> | undefined
let historyRequest = 0, versionRequest = 0
onBeforeUnmount(() => { historyRequest++; versionRequest++; reviewRequest++; clearTimeout(timer) })
onMounted(()=>{if(selectedRevision.value&&selectedRevision.value!==props.state.revision)void showVersion(selectedRevision.value)})

/** 保存成功后回到阅读模式；保存失败不清空本地改稿。 */
watch(() => props.state.revision, () => {
  reviewRequest++;reviewOpen.value=false;reviewBusy.value=false;suggestions.value=[];highlight.value=null
  editing.value = false; previous.value = null; versionRequest++; versionBusy.value = false; discard.value = false
  if(selectedRevision.value)void showVersion(selectedRevision.value)
  if (historyOpen.value) void loadHistory(false)
})

/** 仅在用户展开历史时读取，分页追加摘要，不预取历史全文。 */
async function loadHistory(append: boolean) {
  if (append && (!cursor.value || historyBusy.value)) return
  const seq = ++historyRequest
  const suffix = append ? `?before_revision=${cursor.value}` : ''
  historyBusy.value = true; historyError.value = ''
  try {
    const result = await request<CanvasScriptHistoryPage>(`/creation/sessions/${props.state.session_id}/script-document/history${suffix}`)
    if (seq !== historyRequest) return
    entries.value = append ? [...entries.value, ...result.items] : result.items
    cursor.value = result.next_before_revision
  } catch { if (seq === historyRequest) historyError.value = '历史记录暂不可读。' }
  finally { if (seq === historyRequest) historyBusy.value = false }
}

async function toggleHistory() {
  if (editing.value) return
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) { production.value = false; void loadHistory(false); await nextTick(); historyPanel.value?.querySelector('button')?.focus() }
}

/** 历史版本始终只读；切回当前版本不会覆盖任何稿件。 */
async function showVersion(revision?: number) {
  reviewRequest++;reviewOpen.value=false;reviewBusy.value=false;highlight.value=null
  const seq = ++versionRequest
  selectedRevision.value=revision;previous.value=null
  // 窄屏历史独占一屏，选中后返回正文以显示读取状态和结果。
  if (window.matchMedia('(max-width: 640px)').matches) historyOpen.value = false
  versionError.value = ''
  if (!revision||revision===props.state.revision) { versionBusy.value = false; scroll.value?.scrollTo(0, 0); return }
  versionBusy.value = true
  try {
    const result = await request<CanvasScriptState>(`/creation/sessions/${props.state.session_id}/script-document/history/${revision}`)
    if (seq === versionRequest && result.document) { previous.value = result; scroll.value?.scrollTo(0, 0) }
  } catch { if (seq === versionRequest) versionError.value = '该版本暂不可读，请重试。' }
  finally { if (seq === versionRequest) versionBusy.value = false }
}

/** 点击铅笔才允许修改；阅读和历史页不提交任何保存。 */
async function edit() {
  const doc = props.state.document
  if (!doc || selectedRevision.value || props.disabled) return
  historyOpen.value = false; production.value = false
  draft.value = { title: doc.title, source_text: doc.source_text, requirements: doc.requirements }
  editing.value = true
  await nextTick()
  scroll.value?.querySelector('textarea')?.focus({ preventScroll: true })
}

function finish(close: boolean) {
  if (props.busy) return
  if (dirty.value) { closeAfterDiscard.value = close; discard.value = true; return }
  if (close) emit('close')
  else editing.value = false
}

function discardChanges() {
  discard.value = false; editing.value = false
  if (closeAfterDiscard.value) emit('close')
}

function save() {
  if (!dirty.value || props.busy || props.disabled || !draft.value.title.trim() || !draft.value.source_text.trim()) return
  emit('save', { ...draft.value })
}

/** 将描述交给已有对话输入器待用户确认；不在阅读层调用模型或写入剧本。 */
function discuss() {
  const description = modification.value.trim()
  if (!description || editing.value || selectedRevision.value) return
  emit('discuss', description)
}

/** 只复制当前可见版本的原文，不把制作要求混入正文。 */
async function copy() {
  const source = editing.value ? draft.value.source_text : displayed.value?.source_text
  if (!source) return
  try { await navigator.clipboard.writeText(source); copyFailed.value = false; notice.value = '剧本已复制到剪贴板' }
  catch { copyFailed.value = true; notice.value = '复制失败，可选中原文手动复制。' }
  clearTimeout(timer); timer = setTimeout(() => { notice.value = '' }, 2400)
}
</script>

<template>
  <UModal :open="true" fullscreen :close="false" :dismissible="!busy" title="剧本阅读" description="查看、复制或编辑画布剧本" :ui="{content:'liv-script-reader-modal',header:'sr-only',body:'liv-script-reader-body'}" @update:open="value=>{if(!value)finish(true)}">
    <template #body>
      <section class="script-reader" :class="{'has-history':historyOpen}">
        <aside v-if="historyOpen" ref="historyPanel" class="script-history" aria-label="历史记录">
          <header><strong>历史记录</strong><UButton square color="neutral" variant="soft" icon="i-lucide-chevron-left" aria-label="收起历史记录" @click="toggleHistory"/></header>
          <UButton class="script-history-item" color="neutral" :variant="!selectedRevision||selectedRevision===state.revision?'soft':'ghost'" :aria-pressed="!selectedRevision||selectedRevision===state.revision" @click="showVersion()">
            <span>{{state.updated_at?dateFormat.format(new Date(state.updated_at)):`V${state.revision}`}} <small>当前</small></span>
            <strong>{{state.document?.source_text.slice(0,160)}}</strong>
          </UButton>
          <UButton v-for="entry in entries" :key="entry.revision" class="script-history-item" color="neutral" :variant="selectedRevision===entry.revision?'soft':'ghost'" :aria-pressed="selectedRevision===entry.revision" @click="showVersion(entry.revision)">
            <span>{{dateFormat.format(new Date(entry.updated_at))}} · V{{entry.revision}}</span><strong>{{entry.excerpt||entry.title}}</strong>
          </UButton>
          <p v-if="historyBusy" role="status">正在读取历史记录…</p>
          <div v-if="historyError" role="alert">{{historyError}} <UButton color="neutral" variant="link" @click="loadHistory(false)">重试</UButton></div>
          <UButton v-else-if="cursor" :loading="historyBusy" color="neutral" variant="ghost" @click="loadHistory(true)">加载更多</UButton>
          <p v-else-if="!entries.length&&!historyBusy">还没有更早的版本</p>
        </aside>
        <div class="script-reader-main" :class="{'has-review':reviewOpen&&!editing}">
          <header class="script-reader-toolbar">
            <UTooltip text="历史记录" :ui="{content:'liv-script-reader-tooltip'}"><UButton class="script-reader-icon script-reader-history-trigger" color="neutral" variant="soft" icon="i-lucide-clock-3" square aria-label="历史记录" :aria-expanded="historyOpen" :disabled="editing" @click="toggleHistory"/></UTooltip>
            <div class="script-reader-actions script-reader-top-actions">
              <UButton v-if="!editing&&!selectedRevision" color="neutral" variant="soft" :aria-expanded="reviewOpen" @click="toggleReview">检查建议</UButton>
              <UTooltip text="复制原文" :ui="{content:'liv-script-reader-tooltip'}"><UButton class="script-reader-icon" color="neutral" variant="soft" icon="i-lucide-copy" square aria-label="复制剧本原文" @click="copy"/></UTooltip>
              <template v-if="editing"><UButton class="script-reader-edit-action" color="neutral" variant="soft" :disabled="busy" @click="finish(false)">取消编辑</UButton><UButton class="script-reader-edit-action" color="neutral" variant="soft" :loading="busy" :disabled="!dirty||disabled||!draft.title.trim()||!draft.source_text.trim()" @click="save">保存</UButton></template>
              <div v-else-if="!selectedRevision" class="script-reader-tool-group">
                <UPopover v-model:open="production" :content="{side:'bottom',align:'end',sideOffset:8,collisionPadding:12}" :ui="{content:'liv-script-reader-popover'}">
                  <UButton class="script-reader-icon" color="neutral" variant="ghost" icon="i-lucide-ellipsis" square aria-label="剧本信息与制作操作"/>
                  <template #content>
                    <section class="script-reader-production" aria-label="剧本信息与制作操作">
                      <div v-if="displayed?.requirements" class="script-reader-meta"><strong>制作要求</strong><p>{{displayed.requirements}}</p></div>
                      <slot name="production"/>
                    </section>
                  </template>
                </UPopover>
                <UTooltip text="编辑剧本" :ui="{content:'liv-script-reader-tooltip'}"><UButton class="script-reader-icon" color="neutral" variant="ghost" icon="i-lucide-pencil" square aria-label="编辑剧本" :disabled="disabled" @click="edit"/></UTooltip>
              </div>
              <UTooltip text="关闭剧本" :ui="{content:'liv-script-reader-tooltip'}"><UButton class="script-reader-icon script-reader-close" color="neutral" variant="soft" icon="i-lucide-x" square aria-label="关闭剧本" :disabled="busy" @click="finish(true)"/></UTooltip>
            </div>
          </header>
          <div ref="scroll" class="script-reader-scroll">
            <div class="script-reader-text">
              <p v-if="versionBusy" role="status">正在读取所选版本…</p><p v-if="versionError" role="alert">{{versionError}} <UButton color="neutral" variant="link" @click="showVersion(selectedRevision)">重试</UButton></p>
              <template v-if="editing">
                <UTextarea v-model="draft.source_text" autoresize :rows="10" :maxlength="200000" aria-label="剧本原文" variant="none" :disabled="busy" class="script-reader-editor" :ui="{base:'script-reader-editor-input'}"/>
                <div class="script-reader-meta"><label>剧本名称<UInput v-model="draft.title" :maxlength="100" :disabled="busy" aria-label="剧本名称"/></label><label>制作要求<UTextarea v-model="draft.requirements" :rows="3" :maxlength="10000" :disabled="busy" aria-label="制作要求"/></label></div>
              </template>
              <article v-else class="script-reader-original" :aria-label="displayed?.title || '剧本原文'"><template v-if="highlight">{{displayed?.source_text.slice(0,highlight.start)}}<mark>{{displayed?.source_text.slice(highlight.start,highlight.end)}}</mark>{{displayed?.source_text.slice(highlight.end)}}</template><template v-else>{{displayed?.source_text}}</template></article>
            </div>
          </div>
          <aside v-if="reviewOpen&&!editing" class="script-review" aria-label="检查建议">
            <header><strong>检查建议</strong><UButton color="neutral" variant="ghost" icon="i-lucide-x" square aria-label="关闭检查建议" @click="reviewOpen=false"/></header>
            <p v-if="reviewBusy" role="status">正在读取检查建议…</p>
            <p v-if="reviewError" role="alert">{{reviewError}}<UButton color="neutral" variant="link" @click="reviewOpen=false;toggleReview()">重试</UButton></p>
            <p>{{reviewHint}}</p>
            <section v-for="item in suggestions" :key="item.id"><strong>{{item.title}}</strong><p>{{item.problem}}</p><p v-if="item.impact">影响：{{item.impact}}</p><p>建议：{{item.advice}}</p><UButton color="neutral" variant="soft" @click="locateSuggestion(item)">定位原文</UButton></section>
          </aside>
          <footer v-if="discard||(editing&&error)||(!editing&&!selectedRevision&&!historyOpen)" class="script-reader-footer">
            <div v-if="discard" class="script-reader-actions" role="alert"><span>尚未保存修改。</span><UButton color="neutral" variant="soft" @click="discard=false">继续编辑</UButton><UButton color="error" variant="soft" @click="discardChanges">放弃修改</UButton></div>
            <p v-else-if="editing&&error" role="alert">{{error}}</p>
            <form v-else class="script-reader-composer" @submit.prevent="discuss">
              <UInput v-model="modification" variant="none" :maxlength="3000" aria-label="描述你想要的修改" placeholder="描述你想要的修改..." class="script-reader-composer-input"/>
              <UTooltip text="带到对话" :ui="{content:'liv-script-reader-tooltip'}"><UButton type="submit" class="script-reader-send" color="neutral" variant="soft" square icon="i-lucide-arrow-up" aria-label="将修改说明带到对话" :disabled="!modification.trim()"/></UTooltip>
            </form>
          </footer>
          <CreationWorkspaceNotice :text="notice" :error="copyFailed"/>
        </div>
      </section>
    </template>
  </UModal>
</template>

<style scoped>
/* 建议为按需只读侧栏，不新建画布节点；窄屏独占内容区，关闭恢复正文。 */
.script-review{position:absolute;right:0;top:72px;bottom:0;width:min(340px,100%);overflow:auto;padding:20px;background:var(--liv-script-reader-panel);color:var(--liv-script-reader-ink);border-left:1px solid var(--liv-script-reader-edge);z-index:3;font-size:14px;line-height:1.7}
.script-review header{display:flex;align-items:center;justify-content:space-between}.script-review section{padding:16px 0;border-top:1px solid var(--liv-script-reader-edge)}
@media(min-width:900px){.script-reader-main.has-review .script-reader-scroll{margin-right:340px}}
.script-reader-original mark{background:var(--liv-project-selection-color);color:var(--liv-project-selection-check);border-radius:3px}
/* 阅读层贴齐视口边缘；覆盖通用弹窗内距和蓝灰浮层，但不改其他组件。 */
:global(.liv-script-reader-modal){background:var(--liv-script-reader-bg);color:var(--liv-script-reader-ink);border:0;box-shadow:none}
:global(.liv-script-reader-body){padding:0!important;flex:1;min-height:0;overflow:hidden!important}
:global(.liv-script-reader-tooltip),:global(.liv-script-reader-popover){background:var(--liv-script-reader-panel)!important;color:var(--liv-script-reader-ink)!important;border-color:var(--liv-script-reader-edge)!important;--ui-bg-elevated:var(--liv-script-reader-panel);--ui-bg-accented:var(--liv-script-reader-hover)}
.script-reader{display:grid;grid-template-columns:minmax(0,1fr);height:100%;min-height:0}
.script-reader.has-history{grid-template-columns:280px minmax(0,1fr)}
.script-reader-main{position:relative;display:grid;grid-template-rows:56px minmax(0,1fr);min-width:0;min-height:0;background:radial-gradient(ellipse at 51% 48%,var(--liv-script-reader-light),var(--liv-script-reader-bg) 76%)}
.script-reader-toolbar,.script-reader-actions,.script-history header{display:flex;align-items:center;gap:8px}
.script-reader-toolbar,.script-history header{justify-content:space-between}
.script-reader-toolbar{z-index:2;padding:16px 32px 0 24px}
.script-reader-top-actions{margin-inline-start:auto}
.script-reader-icon,.script-reader-edit-action,.script-reader-send,.script-history header button{background:var(--liv-script-reader-control)!important;color:var(--liv-script-reader-muted)!important;box-shadow:none!important}
.script-reader-icon:hover,.script-reader-edit-action:hover,.script-reader-send:not(:disabled):hover,.script-history header button:hover{background:var(--liv-script-reader-hover)!important;color:var(--liv-script-reader-ink)!important}
.script-reader-icon{width:40px;height:40px;justify-content:center;border-radius:999px}
.script-reader-close{margin-inline-start:8px}
.script-reader-tool-group{display:flex;align-items:center;padding-inline:4px;background:var(--liv-script-reader-control);border-radius:999px}
.script-reader-tool-group .script-reader-icon:not(:hover){background:transparent!important}
.script-reader-edit-action{height:32px;padding-inline:16px;border-radius:12px;font-weight:600}
.script-reader-edit-action:disabled{opacity:.5}
.has-history .script-reader-history-trigger{visibility:hidden}
.script-reader-scroll{min-height:0;overflow:auto;overscroll-behavior:contain}
.script-reader-text{width:min(80%,960px);margin-inline:auto;padding:0 0 120px;font-size:16px;line-height:1.6;font-weight:500;color:var(--liv-script-reader-ink)}
.has-history .script-reader-text{width:min(calc(100% - 80px),960px)}
.script-reader-original,.script-reader-meta p{white-space:pre-wrap;overflow-wrap:anywhere}
.script-reader-editor{display:block}
.script-reader-editor :deep(.script-reader-editor-input){display:block;width:100%;padding:0;resize:none;font:inherit;color:inherit;line-height:inherit}
.script-reader-meta{display:grid;gap:12px;margin-top:24px;color:var(--liv-script-reader-muted);font-size:14px}
.script-reader-meta label{display:grid;gap:6px}
.script-reader-meta p{margin:8px 0}
.script-reader-main::after{content:'';position:absolute;z-index:1;inset:auto 0 0;height:132px;pointer-events:none;background:linear-gradient(transparent,var(--liv-script-reader-bg))}
.script-reader-footer{position:absolute;z-index:2;inset:auto 0 40px;display:grid;justify-items:center;padding:0 12px;text-align:center;pointer-events:none}
.script-reader-footer>*{pointer-events:auto}
.script-reader-footer [role=alert]{color:var(--ui-error)}
.script-reader-composer{display:flex;align-items:center;gap:8px;width:min(370px,100%);height:48px;padding:0 7px 0 14px;border-radius:999px;background:var(--liv-script-reader-control);box-shadow:0 8px 24px #0003}
.script-reader-composer-input{flex:1;min-width:0}
.script-reader-composer-input :deep(input){padding:0;color:var(--liv-script-reader-ink);font-size:14px}
.script-reader-composer-input :deep(input::placeholder){color:var(--liv-script-reader-muted);opacity:.8}
.script-reader-send{width:32px;height:32px;border-radius:999px;background:var(--liv-script-reader-hover)!important;justify-content:center}
.script-reader-production{display:grid;gap:12px;width:min(348px,calc(100vw - 32px));padding:14px;--ui-bg-elevated:var(--liv-script-reader-control);--ui-bg-accented:var(--liv-script-reader-hover)}
.script-reader-production .script-reader-meta{margin:0;gap:0}
.script-history{min-width:0;overflow:auto;overscroll-behavior:contain;padding:40px 8px 16px;background:linear-gradient(var(--liv-script-reader-panel) 74%,var(--liv-script-reader-bg));border-inline-end:1px solid var(--liv-script-reader-edge);font-size:13px;color:var(--liv-script-reader-ink)}
.script-history header{margin-bottom:12px;padding-inline:12px 8px}
.script-history header button{border-radius:999px}
.script-history-item{display:grid;text-align:left;width:100%;gap:4px;margin-bottom:6px;padding:10px;white-space:normal}
.script-history-item[aria-pressed=true],.script-history-item:hover{background:var(--liv-script-reader-hover)!important;color:var(--liv-script-reader-ink)!important}
.script-history-item span{color:var(--liv-script-reader-muted)}
.script-history-item small{margin-inline-start:4px;color:var(--ui-primary)}
.script-history-item strong{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}
@media(max-width:640px){.script-reader.has-history{grid-template-columns:minmax(0,1fr)}.has-history .script-reader-main{display:none}.script-reader-toolbar{padding:10px 12px 0}.script-reader-icon{width:36px;height:36px}.script-reader-text{width:calc(100% - 36px);font-size:15px}.script-reader-footer{bottom:24px}.script-reader-footer .script-reader-actions{flex-wrap:wrap;justify-content:center}}
</style>
