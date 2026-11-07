<script setup lang="ts">
import type {ProcessEvent} from '../processEvents'
import AssistantReply from './AssistantReply.vue'
const props=defineProps<{events:ProcessEvent[]}>()
// 业务确认在原方案卡内可见，聊天默认只展示模型实际调用；审计事实可按需展开。
const toolEvents=computed(()=>props.events.filter(event=>event.kind!=='business_record'))
const businessEvents=computed(()=>props.events.filter(event=>event.kind==='business_record'))
// 状态仅来自服务端收据；组件不推断进度、不触发业务请求。
const icons={processing:'i-lucide-loader-circle',succeeded:'i-lucide-check-circle-2',failed:'i-lucide-circle-alert',needs_revision:'i-lucide-pencil-line',unknown:'i-lucide-clock-3',stopped:'i-lucide-circle-stop'}
const labels={processing:'处理中',succeeded:'成功',failed:'失败',needs_revision:'方案需修正',unknown:'待核对',stopped:'已停止'}
</script>
<template>
  <div v-if="events.length" class="process-events" aria-label="处理记录">
    <section v-for="event in toolEvents" :key="event.id">
      <!-- 开场和说明按收到的真实顺序显示，不补造模型推理或尚未调用的步骤。 -->
      <p v-if="event.kind==='continuation'" class="process-continuation">{{event.title}}</p>
      <slot v-else-if="event.kind==='answer' && event.answer" name="answer" :answer="event.answer"/>
      <template v-else>
        <AssistantReply v-if="event.description" :text="event.description" variant="skill" class="process-description"/>
        <!-- 纯文本保留完整提示词和换行；折叠仅改变展示，不影响任务内容或报价。 -->
        <div v-for="pair in event.promptPairs" :key="pair.id" class="process-prompt-pair">
          <strong v-if="(event.promptPairs?.length||0)>1">{{pair.title}}</strong>
          <p><strong>中文提示词（{{pair.executionLanguage==='zh'?'用于生成':'对照'}}）</strong></p>
          <p class="process-prompt-copy" lang="zh-CN">{{pair.zh}}</p>
          <UCollapsible>
            <template #default="{open}">
              <UButton color="neutral" variant="ghost" :trailing-icon="open?'i-lucide-chevron-up':'i-lucide-chevron-down'">{{open?'收起':'查看'}}英文提示词（{{pair.executionLanguage==='en'?'用于生成':'对照'}}）</UButton>
            </template>
            <template #content><p class="process-prompt-copy" lang="en">{{pair.en}}</p></template>
          </UCollapsible>
        </div>
        <!-- 进行中由左侧旋转图标表达，不在右侧重复状态文字；异常和待核对仍明确提示。 -->
        <div v-if="!event.kind" class="process-event" :role="event.status==='processing'?'status':undefined"><UIcon :name="icons[event.status]" :class="{'animate-spin':event.status==='processing'}" :aria-label="labels[event.status]"/><span>{{event.title}}</span><small v-if="!['succeeded','processing'].includes(event.status)">{{labels[event.status]}}</small></div>
        <p v-if="event.feedback" class="process-feedback">{{event.feedback}}</p>
      </template>
    </section>
    <!-- 业务操作同样直接展示真实状态，不再藏在折叠记录中。 -->
    <div v-if="businessEvents.length" class="process-business">
      <section v-for="event in businessEvents" :key="event.id">
        <div class="process-event" :role="event.status==='processing'?'status':undefined"><UIcon :name="icons[event.status]" :class="{'animate-spin':event.status==='processing'}" :aria-label="labels[event.status]"/><span>{{event.title}}</span><small v-if="!['succeeded','processing'].includes(event.status)">{{labels[event.status]}}</small></div>
        <p v-if="event.description" class="process-feedback">{{event.description}}</p>
      </section>
    </div>
  </div>
</template>
<style scoped>
/* 工具收据是紧凑单行，不再使用媒体方案的大卡片；处理中和失败仍保留真实图标。 */
.process-events{display:grid;gap:6px;margin:8px 0 12px}.process-event{display:flex;align-items:center;gap:8px;padding:2px 0;border:0;background:none;font-size:var(--liv-chat-font);font-weight:400;line-height:var(--liv-chat-line);color:var(--color-text-muted)}.process-event .iconify{width:16px;height:16px;flex:none}.process-event span{flex:1;min-width:0}.process-event small{color:var(--color-text-muted);font-size:inherit;flex:none}
@media(prefers-reduced-motion:reduce){.animate-spin{animation:none}}
.process-description{margin:0 0 6px;font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);overflow-wrap:anywhere}
.process-prompt-pair{display:grid;gap:var(--liv-chat-copy-gap);margin:var(--liv-chat-section-gap) 0;font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);color:var(--liv-chat-assistant-text)}
.process-prompt-copy{white-space:pre-wrap;overflow-wrap:anywhere}
.process-business{display:grid;gap:6px}
.process-feedback{margin:2px 0 6px;font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);color:var(--liv-chat-assistant-text)}
.process-continuation{margin:12px 0;padding-top:12px;border-top:1px solid var(--liv-account-border);color:var(--color-text-muted);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line)}
</style>
