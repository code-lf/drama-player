<script setup lang="ts">
import {computed} from 'vue'
import type {CanvasActivity} from '../canvasActivity'
const props=defineProps<{item:CanvasActivity;assetAvailable?:boolean}>()
const emit=defineEmits<{viewScript:[revision:number];locateAssets:[id:string]}>()
const labels:Record<string,string>={role:'角色',scene:'场景',prop:'道具'}
// 显示真实 UTF-8 文件大小；正文只在用户打开阅读器时显示。
const size=computed(()=>{
  if(props.item.kind!=='script_file')return ''
  const bytes=props.item.size_bytes
  return bytes<1024?`${bytes} B`:`${(bytes/1024).toFixed(1)} KB`
})
const running=computed(()=>props.item.kind==='asset_extraction'&&['queued','running'].includes(props.item.status))
</script>

<template>
  <article class="canvas-conversation-activity">
    <div :class="item.kind==='script_file'?'canvas-script-attachment':'liv-user-message'">
      <UButton v-if="item.kind==='script_file'" type="button" color="neutral" variant="soft" class="canvas-script-file" :aria-label="`查看剧本文件 ${item.filename}，版本 ${item.document_revision}`" @click="emit('viewScript',item.document_revision)">
        <UIcon name="i-lucide-file-text" class="canvas-script-file-icon"/>
        <span><strong>{{item.filename}}</strong><small>TXT · {{size}} · V{{item.document_revision}}</small></span>
      </UButton>
      <p v-else>提取{{item.categories.map(key=>labels[key]||key).join('、')}}设定</p>
    </div>
    <!-- 用户主动点击提取，只展示实际状态，不冒充 Agent 自主调用。 -->
    <section v-if="item.kind==='asset_extraction'" class="liv-assistant-message">
      <div class="canvas-extraction-status" role="status"><UIcon :name="running?'i-lucide-loader-circle':item.status==='succeeded'?'i-lucide-circle-check':'i-lucide-circle-alert'" :class="{'animate-spin motion-reduce:animate-none':running}"/><span>{{running?'正在提取设定':item.status==='succeeded'?'设定已提取':item.status==='stale'?'剧本已更新，旧提取未应用':'提取未完成'}}</span></div>
      <template v-if="item.status==='succeeded'">
        <p>{{item.summary}}</p>
        <UButton v-if="assetAvailable" color="neutral" variant="soft" trailing-icon="i-lucide-arrow-right" @click="emit('locateAssets',item.id)">查看资产</UButton>
        <span class="canvas-extraction-status">{{Object.entries(item.counts).map(([key,count])=>`${labels[key]||key} ${count}`).join(' · ')}}</span>
      </template>
      <p v-else-if="!running">{{item.error_message}}</p>
    </section>
  </article>
</template>

<style scoped>
.canvas-conversation-activity{display:grid;gap:var(--liv-chat-section-gap)}
.canvas-script-attachment{display:flex;justify-content:flex-end;margin-bottom:var(--liv-chat-gap)}
.canvas-script-file{width:210px;max-width:100%;min-height:54px;gap:10px;padding:8px 12px;border:1px solid var(--liv-graph-frame-border);border-radius:12px;text-align:left}
.canvas-script-file>span:last-child{min-width:0;display:grid;gap:2px}
.canvas-script-file strong{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.canvas-script-file small{font-size:12px;color:var(--ui-text-muted)}
.canvas-script-file-icon{width:22px;height:24px;flex:none;color:var(--ui-text-muted)}
.canvas-extraction-status{display:flex;align-items:center;gap:8px;color:var(--ui-text-muted);font-size:14px}
</style>
