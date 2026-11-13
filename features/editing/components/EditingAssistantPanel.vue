<script setup lang="ts">
import CreationComposer from '~/features/creation/components/CreationComposer.vue'
import AssistantReply from '~/features/creation/components/AssistantReply.vue'
import CreationConversationPanel from '~/features/creation/components/CreationConversationPanel.vue'
import {defaultParameters} from '~/features/creation/catalog'
import type {ComposerSegment} from '~/features/creation/types'
const props=defineProps<{results:string[];disabledReason:string;thinking?:boolean;messages?:Array<{role:'user'|'assistant';content:string}>}>()
const emit=defineEmits<{collapse:[];send:[message:string]}>()
// 复用画布同一个输入器，编辑草稿与原创作输入隔离，不把剪辑指令误交给媒体采购。
const prompt=ref(''),segments=ref<ComposerSegment[]>([]),parameters=defaultParameters()
/** 发出文字不触发采购；只有编辑候选通过原保存边界后父层才追加完成消息。 */
function send(){if(!prompt.value.trim()||props.disabledReason)return;emit('send',prompt.value);prompt.value='';segments.value=[]}
</script>
<template>
  <aside class="editing-assistant creation-chat liv-chat-v2" aria-label="剪辑助手">
    <CreationConversationPanel>
    <template #heading><UIcon name="i-lucide-clapperboard"/><span>Video Editing</span><span class="editing-assistant-heading-spacer"/><UButton icon="i-lucide-panel-left-close" color="neutral" variant="ghost" square aria-label="收起剪辑助手" @click="emit('collapse')"/></template>
    <template #default>
      <p class="editing-assistant-disclaimer">编辑与操作记录</p>
      <section v-if="results.length" class="liv-assistant-message"><header><UIcon name="i-lucide-history"/><strong>编辑记录</strong></header><AssistantReply v-for="(text,index) in results" :key="index" :text="text" variant="skill"/></section>
      <div v-else-if="!messages?.length" class="editing-assistant-empty"><strong>嗨～导演！</strong><p>添加素材后开始剪辑，也可以告诉我需要怎样调整。</p></div>
      <section v-for="(item,index) in messages||[]" :key="'chat-'+index" :class="item.role==='user'?'editing-user-message':'liv-assistant-message'"><AssistantReply :text="item.content" variant="skill"/></section>
      <p v-if="thinking" class="editing-thinking" role="status"><UIcon name="i-lucide-loader-circle" class="animate-spin"/>正在思考…</p>
    </template>
    <template #composer>
    <div class="editing-assistant-composer">
      <!-- 草稿保存不是AI生成，不能借busy把发送箭头变成“停止生成”。 -->
      <CreationComposer entry="free" skill="" :prompt="prompt" :segments="segments" :references="[]" :parameters="parameters" :catalog="null" :templates="[]" :busy="false" credit-label="" :script-file="null" compact node-editor controls-kind="text" :models="[]" :ratios="[]" :resolutions="[]" :duration-range="{min:0,max:180}" :music-sources="[]" editor-placeholder="例如：第二段放到前面，背景音乐调到20%。" :send-disabled-reason="disabledReason" send-action-label="发送给剪辑助手" @send="send" @text="(text,parts)=>{prompt=text;segments=parts}"><template #text-tools><span/></template></CreationComposer>
      <p class="editing-assistant-availability">AI可调整当前剪辑，支持撤销；导出需手动点击。</p>
    </div>
    </template>
    </CreationConversationPanel>
  </aside>
</template>
<style scoped>
/* 仅安排四区中的空间；消息富文本、输入法、发送门禁和输入外观复用原画布组件。 */
.editing-assistant{display:flex;flex-direction:column;min-height:0;background:var(--liv-account-surface);border-right:1px solid var(--liv-account-border);font-family:var(--liv-chat-font-family);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line)}
.editing-assistant-heading-spacer{flex:1}.editing-assistant-disclaimer{text-align:center;color:var(--liv-account-muted);font-size:13px;margin:0 0 28px}.liv-assistant-message>header{display:flex;align-items:center;gap:8px;margin-bottom:20px}.liv-assistant-message>header strong{font-size:16px}.editing-assistant-empty{display:grid;align-content:center;min-height:200px;padding-bottom:40px}.editing-assistant-empty>strong{font-size:24px}.editing-assistant-empty p{color:var(--liv-account-muted)}.editing-assistant-composer{padding:10px;flex:none}.editing-assistant-composer :deep(.creation-composer){width:100%;margin:0;border-radius:20px;background:transparent}.editing-assistant-composer :deep(.creation-editor){min-height:140px;max-height:180px}.editing-assistant-availability{font-size:12px;color:var(--liv-account-muted);margin:6px 10px 0}
.editing-assistant-composer :deep(.creation-composer){border:1px solid var(--liv-account-border)!important;border-radius:20px!important;padding:14px!important}.editing-assistant-empty{align-content:center;text-align:center}.editing-assistant-composer :deep(.creation-node-kind-label){display:none}
/* 用户与助手继续使用聊天令牌，不新增平行输入器或独立主题。 */
.editing-user-message{margin:20px 0 20px auto;padding:12px 16px;border-radius:20px 20px 4px 20px;background:var(--liv-ui-primary);color:var(--liv-control-on-primary);max-width:90%;width:fit-content}.editing-thinking{display:flex;align-items:center;gap:8px;color:var(--liv-account-muted)}
</style>
