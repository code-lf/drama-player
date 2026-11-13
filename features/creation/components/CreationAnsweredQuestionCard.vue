<script setup lang="ts">
import {computed} from 'vue'
import {answeredQuestionItems,type StoredQuestionAnswer} from '../answeredQuestions'
import {fallbackDramaVisualStyleOptions} from '~/shared/constants/dramaVisualStyles'

/** 仅在服务端已接收答案后显示；“已回答”不代表媒体完成或费用已确认。 */
const props=defineProps<{answer:StoredQuestionAnswer}>()
defineEmits<{browse:[]}>()
const items=computed(()=>answeredQuestionItems(props.answer))
const styleName=computed(()=>props.answer.visual_style?.display_name||props.answer.personal_style?.name)
// 历史卡只按已保存的目录身份取封面，个人素材不使用未经核权的地址。
const styleCover=computed(()=>fallbackDramaVisualStyleOptions.find(item=>item.styleId===props.answer.visual_style?.style_id)?.image)
</script>

<template>
  <section v-if="styleName" class="creation-answered-style" :aria-label="'已选风格：'+styleName">
    <header><strong>{{answer.question}}</strong><small>已回答</small></header>
    <div class="answered-style-value"><img v-if="styleCover" :src="styleCover" alt="" loading="lazy"><UIcon v-else name="i-lucide-palette"/>
    <div><strong>{{styleName}}</strong><small>{{answer.visual_style?'已选风格 · V'+answer.visual_style.style_version:'已选个人风格参考'}}</small></div></div>
  </section>
  <section v-else class="creation-answered-question" :aria-label="'已回答：'+answer.question">
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
.creation-answered-style{min-width:0;margin:12px 0;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface)}
.answered-style-value{display:flex;align-items:center;gap:10px;border-top:1px solid var(--color-border-soft);padding-top:12px}
.creation-answered-style img{width:38px;height:48px;object-fit:cover;border-radius:6px}
.creation-answered-style small{display:block;color:var(--color-text-muted)}
.creation-answered-question{min-width:0;margin:12px 0;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);color:var(--liv-chat-assistant-text)}
header{display:flex;gap:8px;align-items:center;margin-bottom:12px}header :deep(svg),header :deep(.iconify){width:16px;height:16px;flex:none}strong{font-weight:600}
dl,dd,p{margin:0}dl{border-top:1px solid var(--color-border-soft);padding-top:12px}.answered-question-item{min-width:0}.answered-question-item+.answered-question-item{margin-top:6px}
/* 多题答案在同一只读卡内连贯展示，保留原题与原回答，不补造模型说明。 */
dt,dd{display:inline;white-space:pre-wrap;overflow-wrap:anywhere}dt{font-weight:500}dd{color:var(--liv-chat-assistant-text)}.is-skipped{color:var(--color-text-muted)}
</style>
