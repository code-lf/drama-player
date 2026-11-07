<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {multipleQuestionAnswer,preferredQuestionOption} from '../questionInteraction'
import {creationInputExample} from '../inputExamples'

/** 业务问卷组件：复用原回答接口，分页浏览本身不请求模型，也不提交任务。 */
const props=defineProps<{fields:Array<{id:string;text:string;kind:'text'|'single'|'multiple';options:string[];requires_input:boolean;required?:boolean}>;questionKey:string;busy:boolean;title?:string;singleAnswer?:boolean;allowCustom?:boolean}>()
const emit=defineEmits<{submit:[answer:string,fieldAnswers:Record<string,string>]}>()
const page=ref(0)
const selected=ref<Record<string,string[]>>({})
const text=ref<Record<string,string>>({})
// 旧单题保留自行填写入口，不把自由文字伪造成服务端提供的选项。
const customInput=ref(false)
const current=computed(()=>props.fields[page.value])
/** 每题保留独立答案，返回上一步或切换勾选不会覆盖补充文字。 */
function answer(id:string){return multipleQuestionAnswer(selected.value[id]||[],text.value[id]||'')}
// 未带required的历史问题仍必答；新选填问题可留空，不以requires_input推断必填性。
const isRequired=computed(()=>current.value?.required!==false)
const canContinue=computed(()=>!!current.value&&(!isRequired.value||!!answer(current.value.id)))
const needsText=computed(()=>customInput.value||current.value?.kind==='text'||current.value?.requires_input||!current.value?.options.length)
function choose(option:string,checked?:boolean){
  const item=current.value
  if(!item||props.busy)return
  if(item.kind==='multiple'){
    const before=selected.value[item.id]||[]
    selected.value[item.id]=checked?Array.from(new Set([...before,option])):before.filter(value=>value!==option)
  }else selected.value[item.id]=[option]
}
function next(){
  if(props.busy||!canContinue.value)return
  if(page.value<props.fields.length-1){page.value++;return}
  // 最终一次性按原字段顺序提交全部答案；不会逐页触发模型或费用授权。
  if(props.fields.some(item=>item.required!==false&&!answer(item.id)))return
  // 显式记录跳过，不能把空答案伪装成“无素材”或授权；全部选填留空也只提交一次原回答命令。
  emit('submit',props.singleAnswer?answer(props.fields[0].id):props.fields.map(item=>`${item.text}：${answer(item.id)||'本次暂不补充（选填）'}`).join('\n'),
    Object.fromEntries(props.fields.map(item=>[item.id,answer(item.id)])))
}
/** 会话内按账号/运行/修订隔离临时答案；刷新恢复，不写入共享历史或授予素材权限。 */
watch(()=>props.questionKey,(key,previous)=>{
  page.value=0;selected.value={};text.value={};customInput.value=false
  for(const item of props.fields){const preferred=preferredQuestionOption(item);selected.value[item.id]=preferred?[preferred]:[]}
  if(typeof sessionStorage==='undefined')return
  try{
    if(previous&&previous!==key)sessionStorage.removeItem('question-pages:'+previous)
    const saved=JSON.parse(sessionStorage.getItem('question-pages:'+key)||'null')
    for(const item of props.fields){
      const preferred=preferredQuestionOption(item)
      const restored=saved?.selected?.[item.id]
      selected.value[item.id]=Array.isArray(restored)?restored.filter((value:unknown)=>typeof value==='string'&&item.options.includes(value)):preferred?[preferred]:[]
      text.value[item.id]=typeof saved?.text?.[item.id]==='string'?saved.text[item.id]:''
    }
    page.value=Math.min(Math.max(Number(saved?.page)||0,0),props.fields.length-1)
  }catch{/* 浏览器禁用存储或旧草稿损坏时保留可用问卷，不阻断回答。 */}
},{immediate:true})
watch([page,selected,text],()=>{
  try{sessionStorage.setItem('question-pages:'+props.questionKey,JSON.stringify({page:page.value,selected:selected.value,text:text.value}))}catch{/* 存储不可用不触发网络重试。 */}
},{deep:true})
</script>

<template>
  <section v-if="current" class="creation-question-pages" aria-label="补充创作资料">
    <header><strong>{{title||'补充创作资料'}}</strong><span v-if="fields.length>1" aria-live="polite">{{page+1}}/{{fields.length}}</span></header>
    <p>{{current.text}}<span v-if="isRequired" class="question-page-required" aria-label="必填"> *</span><span v-else class="question-page-optional">（选填）</span></p>
    <div v-if="current.options.length" class="question-page-options">
      <template v-for="option in current.options" :key="option">
        <UCheckbox v-if="current.kind==='multiple'" class="question-page-choice" :label="option" :model-value="(selected[current.id]||[]).includes(option)" :disabled="busy" @update:model-value="choose(option,$event===true)"/>
        <UButton v-else color="neutral" variant="soft" class="question-page-choice" :aria-pressed="(selected[current.id]||[]).includes(option)" :disabled="busy" @click="choose(option)">{{option}}</UButton>
      </template>
      <UButton v-if="allowCustom&&!needsText" color="neutral" variant="soft" class="question-page-choice" :disabled="busy" @click="customInput=true;selected[current.id]=[]">其他／自行填写</UButton>
    </div>
    <UTextarea v-if="needsText" v-model="text[current.id]" :aria-label="current.text" :aria-required="isRequired" :placeholder="creationInputExample(current.text,current.id)+(isRequired?'':'（选填，可直接继续）')" :rows="2" autoresize :disabled="busy"/>
    <footer :class="{'has-previous':page>0}">
      <LivButton v-if="page>0" variant="secondary" block class="question-page-back" :disabled="busy" @click="page--">上一步</LivButton>
      <LivButton variant="primary" block class="question-page-confirm" :disabled="busy||!canContinue" :loading="busy" @click="next">{{busy?'提交中':page===fields.length-1?'确认并继续':'下一步'}}</LivButton>
    </footer>
    <small v-if="busy" role="status">正在提交，请稍候…</small>
  </section>
</template>

<style scoped>
.creation-question-pages{display:grid;gap:16px;min-width:0;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line)}
header{display:flex;align-items:center;justify-content:space-between;gap:12px}header span{color:var(--color-text-muted)}p{margin:0}.question-page-options{display:grid;gap:8px}
.question-page-choice{justify-content:flex-start;min-height:48px;padding:12px 16px;border:1px solid transparent;border-radius:12px;background:var(--liv-question-option);text-align:left;white-space:normal}.question-page-choice:deep(label){font-size:var(--liv-chat-font);line-height:var(--liv-chat-line)}
.question-page-choice[aria-pressed=true]{border-color:var(--liv-chat-assistant-text)}
.question-page-required{color:var(--liv-ui-danger)}.question-page-optional{color:var(--color-text-muted)}
/* 固定比例分配按钮宽度，不让全宽主按钮将“上一步”挤成多行或改变高度。 */
footer{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:12px}footer.has-previous{grid-template-columns:repeat(2,minmax(0,1fr))}
footer :deep(button){width:100%;height:var(--liv-question-action-height);min-height:var(--liv-question-action-height);padding:0 12px;border-radius:999px;justify-content:center!important;font-size:var(--liv-chat-font);line-height:20px;white-space:nowrap!important}
footer :deep(.question-page-back){border:1px solid transparent;background:var(--liv-question-option);color:var(--liv-chat-assistant-text)}
/* 外层聊天选项左对齐规则不能覆盖问卷主操作；不影响真正的单选/多选行。 */
footer :deep(.question-page-confirm){width:100%;justify-content:center!important;background:var(--liv-ui-primary)!important;color:var(--liv-control-on-primary)!important}
</style>
