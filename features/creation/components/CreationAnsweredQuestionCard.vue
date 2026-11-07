<script setup lang="ts">
import {computed} from 'vue'
import {answeredQuestionItems,type StoredQuestionAnswer} from '../answeredQuestions'

/** 仅在服务端已接收答案后显示；“已回答”不代表媒体完成或费用已确认。 */
const props=defineProps<{answer:StoredQuestionAnswer}>()
defineEmits<{browse:[]}>()
const items=computed(()=>answeredQuestionItems(props.answer))
</script>

<template>
  <section class="creation-answered-question" :aria-label="'已回答：'+answer.question">
    <header><strong>{{answer.question}}</strong></header>
    <dl>
      <div v-for="item in items" :key="item.id" class="answered-question-item">
        <!-- 已回答问题直接展示完整题干，不要求用户再展开核对。 -->
        <dt>{{item.question}}：</dt>
        <dd :class="{'is-skipped':item.skipped}">{{item.value}}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.creation-answered-question{min-width:0;margin:12px 0;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);color:var(--liv-chat-assistant-text)}
header{display:flex;gap:8px;align-items:center;margin-bottom:12px}header :deep(svg),header :deep(.iconify){width:16px;height:16px;flex:none}strong{font-weight:600}
dl,dd,p{margin:0}dl{border-top:1px solid var(--color-border-soft);padding-top:12px}.answered-question-item{min-width:0}.answered-question-item+.answered-question-item{margin-top:6px}
/* 多题答案在同一只读卡内连贯展示，保留原题与原回答，不补造模型说明。 */
dt,dd{display:inline;white-space:pre-wrap;overflow-wrap:anywhere}dt{font-weight:500}dd{color:var(--liv-chat-assistant-text)}.is-skipped{color:var(--color-text-muted)}
</style>
