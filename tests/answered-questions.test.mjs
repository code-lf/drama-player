// 已回答卡片只投影真实答案，不重新调用模型或将旧回复改写为新方案。
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const module={exports:{}}
runInNewContext(ts.transpileModule(read('features/creation/answeredQuestions.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports})
const {answeredQuestionItems,repeatsSubmittedQuestion,hasAcceptedAnswerSince}=module.exports
const fields=[{id:'features',text:'请列出核心功能（例如审批、考勤），以及操作方法',required:true},
  {id:'style',text:'视觉风格偏好（留空也可继续）',required:false}]

test('非对话重试草案缺少answers时，引用展示计算不抛错',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('run?.answers?.some('))
  const run={draft:{references:[]}}
  assert.equal(run?.answers?.some(()=>true),undefined)
})
const record={question:'补充产品资料',snapshot:{fields},answer:fields[0].text+'：手动登记：填写后保存\n保留这行换行\n'+fields[1].text+'：本次暂不补充（选填）'}

test('旧问卷按原题干唯一边界恢复字段，保留答案中的冒号和换行，不回写历史',()=>{
  const original=JSON.stringify(record),items=answeredQuestionItems(record)
  assert.equal(items.length,2)
  assert.equal(items[0].value,'手动登记：填写后保存\n保留这行换行')
  assert.equal(items[0].label,'请列出核心功能')
  assert.equal(items[0].question,fields[0].text)
  assert.equal(items[1].value,'未补充（选填）');assert.equal(items[1].skipped,true)
  assert.equal(JSON.stringify(record),original)
})

test('新答案优先使用已保存字段，不从自由文本解析，不推断略过就是同意推荐',()=>{
  const items=answeredQuestionItems({...record,answer:'摘要不可用于覆盖字段',field_answers:{features:'文字含\n'+fields[1].text+'：仍然是原回答',style:''}})
  assert.ok(items[0].value.includes('仍然是原回答'))
  assert.equal(items[1].value,'未补充（选填）')
  assert.equal(items[1].value.includes('推荐'),false)
})

test('不完整、倒序或歧义边界不猜测拆分，原回答完整回退到只读卡片',()=>{
  for(const answer of ['仅回答了功能',fields[1].text+'：偏好\n'+fields[0].text+'：功能',record.answer+'\n'+fields[1].text+'：重复题干']){
    const items=answeredQuestionItems({...record,answer})
    assert.equal(items.length,1);assert.equal(items[0].value,answer)
  }
})

test('旧单题和用户实际填的相同文字不被冒充选填略过',()=>{
  const old={question:'画幅选择',answer:'16:9'}
  assert.equal(answeredQuestionItems(old)[0].value,'16:9')
  const items=answeredQuestionItems({...record,field_answers:{features:'本次暂不补充（选填）',style:'暖色调'}})
  assert.equal(items[0].skipped,false);assert.equal(items[1].value,'暖色调')
})

test('特殊字段编号仍作为普通数据，不改变字典原型或丢失答案',()=>{
  const items=answeredQuestionItems({question:'旧问卷',snapshot:{fields:[{id:'__proto__',text:'功能'}]},answer:'功能：手动登记'})
  assert.equal(items[0].value,'手动登记')
})

test('重复只针对同运行已提交的完整问卷，不隐藏真实闲聊或未知文字',()=>{
  assert.equal(repeatsSubmittedQuestion(record.answer,[record]),true)
  assert.equal(repeatsSubmittedQuestion('你好',[record]),false)
  assert.equal(repeatsSubmittedQuestion(record.answer,[{question:'普通问题',answer:record.answer}]),false)
  assert.equal(repeatsSubmittedQuestion(record.answer,[]),false)
  assert.equal(repeatsSubmittedQuestion('写实',[{question:'风格？',answer:'写实',snapshot:{text:'风格？',options:['写实']}}]),true)
})

test('提交中的临时答案只在服务端新增答案记录后让位给完整问答卡',()=>{
  assert.equal(hasAcceptedAnswerSince(3,3),false)
  assert.equal(hasAcceptedAnswerSince(4,3),true)
  assert.equal(hasAcceptedAnswerSince(4,null),false)
})

test('当前和历史完整问题直接展示，旧回复可展开，提交中不先标成功或重复长气泡',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),card=read('features/creation/components/CreationAnsweredQuestionCard.vue')
  assert.equal((studio.match(/<CreationAnsweredQuestionCard /g)||[]).length,2)
  assert.equal(studio.includes('class="liv-answer-summary"'),false)
  assert.ok(studio.includes('pendingUserAnswer && !pendingQuestionForm && !pendingAnswerAccepted'))
  assert.equal(studio.match(/<template #answer="{answer}"><CreationAnsweredQuestionCard :answer="answer"/g)?.length,2)
  // 当前问答卡必须位于取消/方案分支之前，避免生成图片或视频方案后被 v-else-if 遮住。
  const activeAnswerCard=studio.indexOf('<CreationProcessEvents :events="runProcessEvents(planning)">')
  assert.ok(activeAnswerCard>=0)
  assert.ok(activeAnswerCard<studio.indexOf('<p v-if="planning.status===\'cancelled\'"'))
  assert.ok(activeAnswerCard<studio.indexOf('v-else-if="planning.image_plan"'))
  assert.ok(activeAnswerCard<studio.indexOf('v-else-if="planning.creative_plan'))
  // 转为历史轮后仍显示原问答，不因已有成果或取消状态而丢失。
  const historyAnswerCard=studio.indexOf('<CreationProcessEvents :events="runProcessEvents(row.run)">')
  assert.ok(historyAnswerCard>=0)
  assert.ok(historyAnswerCard<studio.indexOf('<p v-if="row.run.status===\'cancelled\'"'))
  assert.equal(studio.includes('planning.answers.slice(0,-1)'),false)
  assert.ok(studio.includes('repeatsSubmittedQuestion(turn.user,row.run.answers)'))
  assert.ok(studio.includes('repeatsSubmittedQuestion(turn.user,planning.answers)'))
  assert.ok(studio.includes('查看此前回复'))
  assert.equal(card.includes('<UCollapsible'),false)
  assert.equal(card.includes('查看完整问题'),false)
  assert.ok(card.includes('{{item.question}}'))
  assert.equal(card.includes('{{item.label}}'),false)
  assert.ok(card.includes('已回答'))
  assert.equal(card.includes('<strong>已回答</strong>'),false)
  assert.ok(card.includes('background:var(--liv-question-surface)'))
  assert.equal(card.includes('margin-left:auto'),false)
  assert.equal(/v-html|fetch\(|answerRun\(/.test(card),false)
  assert.ok(card.includes("defineEmits<{browse:[]}>"))
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(card),false)
})

test('画布通知使用统一居中胶囊，保留只读重试且不重复右上角提示',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),notice=read('features/creation/components/CreationWorkspaceNotice.vue')
  assert.ok(studio.includes('<CreationWorkspaceNotice :text="canvasNoticeText"'))
  assert.equal(studio.includes('workspaceToast.add'),false)
  assert.equal(studio.includes('重试加载会话</button>'),false)
  assert.ok(notice.includes('left:50%'))
  assert.ok(notice.includes('v-if="busy"'))
  assert.ok(notice.includes("$emit('retry')"))
  assert.ok(!studio.includes('<p v-if="error" class="creation-error"'))
  assert.ok(studio.includes('draftProblemText.value||error.value'))
  assert.ok(studio.includes('resolveDraftConflict(false)')&&studio.includes('resolveDraftConflict(true)'))
  assert.ok(notice.includes('name="actions"')&&notice.includes("dismissLabel||'关闭通知'"))
})
