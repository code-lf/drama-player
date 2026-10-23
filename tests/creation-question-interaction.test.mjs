// 隔离验证问题展示规则，不调用模型或提交收费任务。
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const module={exports:{}}
runInNewContext(ts.transpileModule(read('features/creation/questionInteraction.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports})
const {questionNeedsText}=module.exports
test('只有选项时无输入框，明确编辑或纯文字问题才展示',()=>{
  assert.equal(questionNeedsText({options:['生成视频','生成图片'],kind:'text'}),false)
  assert.equal(questionNeedsText({options:['建议一'],requires_input:true}),true)
  assert.equal(questionNeedsText({options:[],kind:'text'}),true)
  assert.equal(questionNeedsText({options:[],kind:'reference'}),false)
  assert.equal(questionNeedsText(null),false)
})
test('灰色选项无外层卡片，单选直接回答，多选仍显式发送',()=>{
  const source=read('features/creation/components/CreationStudio.vue')
  const handler=source.slice(source.indexOf('function chooseAnswer'),source.indexOf('async function previousQuestion'))
  assert.ok(handler.includes('else void answerPlanning(option)'))
  assert.ok(handler.includes("kind==='multiple'"))
  assert.ok(source.includes('class="liv-question-options"'))
  assert.ok(source.includes('v-if="questionNeedsInput" v-model="answerText"'))
  assert.ok(source.includes("v-if=\"questionNeedsInput || planning.question?.kind==='multiple'\""))
})

test('选项具备悬停键盘反馈和按需展开的手动回答出口',()=>{
  const source=read('features/creation/components/CreationStudio.vue')
  assert.ok(source.includes('.liv-question-options>button:not(:disabled):hover'))
  assert.ok(source.includes('.liv-question-options>button:not(:disabled):focus-visible'))
  assert.ok(source.includes('其他／自行输入'))
  assert.ok(source.includes('questionInputExpanded=true;answerText='))
  assert.ok(source.includes('questionInputExpanded.value=false'))
})

test('卡片免确认按媒体类型保存同会话规则，不触发提交；弹窗取消隔离草稿',()=>{
  const source=read('features/creation/components/CreationStudio.vue'),card=read('features/creation/components/CreationConfirmationCard.vue')
  assert.ok(card.includes('<UCheckbox'))
  assert.ok(card.includes("$emit('rule',$event===true)"))
  assert.ok(source.includes("target==='music'?'audio'"))
  const save=source.slice(source.indexOf('async function changeConfirmationRule'),source.indexOf('function executionPayload'))
  assert.ok(save.includes('creationService.saveRules(id,rulesRevision.value,next)'))
  assert.ok(!save.includes('submit()'))
  assert.ok(save.indexOf('await creationService.saveRules')<save.indexOf('rules.value=next'))
  assert.ok(source.includes('const rulesDraft=ref({...rules.value})'))
  assert.ok(source.includes('next={...rulesDraft.value}'))
  assert.ok(source.includes('settings sectioned dark title="二次确认设置"'))
  assert.ok(source.includes('variant="secondary" :disabled="rulesBusy" @click="rulesOpen=false"'))
  assert.ok(source.includes(':max="100000" :step="1"'))
})

test('仅待答阶段可修改上一答案，问题编辑不污染底部草稿或执行长文',()=>{
  const source=read('features/creation/components/CreationStudio.vue')
  assert.ok(source.includes("planning.value?.status==='waiting'&&!!planning.value.answers.length&&!proposalSubmitted.value"))
  assert.ok(source.includes('<LivButton v-if="canReviseQuestion" variant="secondary"'))
  const back=source.slice(source.indexOf('async function previousQuestion'),source.indexOf('const historyElement'))
  assert.ok(back.includes('answerText.value=value.restored_answer'))
  assert.ok(!back.includes('setText('))
  assert.ok(back.includes("confirmation.value=null;quotedProposalKey='';proposalQuoteError.value='';error.value=''"))
  assert.ok(source.includes("assistantDraft=JSON.stringify({...answerDraft,prompt:answerDraft.prompt===answer?'':answerDraft.prompt})"))
})

test('失败通知阻止点击冒泡，失败消息不得替换右侧作品',()=>{
  assert.ok(read('features/creation/components/CreationTaskNotice.vue').includes('tabindex="0" @click.stop'))
  const source=read('features/creation/components/CreationStudio.vue')
  const method=source.slice(source.indexOf('async function chooseHistory'),source.indexOf('function chooseCanvas'))
  assert.ok(method.includes("['failed','needs_review','result_error'].includes(taskData[id]?.status||'')"))
  assert.ok(method.indexOf("includes(taskData[id]")<method.indexOf('await focusMessage(id)'))
})

test('视频缩略图暂停定位首帧，风格模板保留输入工具栏且通知复用深色组件',()=>{
  const preview=read('features/creation/components/CreationMediaPreview.vue'),composer=read('features/creation/components/CreationComposer.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(preview.includes('muted playsinline preload="metadata"'))
  assert.ok(preview.includes('video.currentTime=Math.min(.1'))
  assert.ok(!preview.includes('autoplay')&&!preview.includes('.play('))
  assert.ok(read('features/creation/components/CreationResultCard.vue').includes('<CreationMediaPreview'))
  assert.ok(read('features/creation/components/CreationResultRail.vue').includes('<CreationMediaPreview'))
  const menu=composer.slice(composer.indexOf('<template v-if="popover === \'add\'">'),composer.indexOf('<template v-if="popover === \'add\'">')+500)
  assert.ok(!menu.includes("popover='style'")&&!menu.includes("popover='templates'"))
  assert.ok(!composer.includes('[aria-label="选择风格"],.is-compact'))
  assert.ok(studio.includes('workspaceToast.add'))
  assert.ok(!studio.includes('<p v-if="notice"'))
  assert.ok(studio.includes('margin-top:12px'))
})

test('同值参数和弹层操作不撤销报价，真实改动自动核价，视频审核建议有读取入口',()=>{
  const workspace=read('features/creation/useCreationWorkspace.ts'),studio=read('features/creation/components/CreationStudio.vue')
  // 模型目录也是现有监听依赖，校验保留草稿／文件监听，不限制后续附加依赖。
  assert.match(workspace,/watch\(\[\(\)=>canonical\(draft\(\)\), scriptFile, models, \(\)=>auth.session.loggedIn, \(\)=>auth.session.user\?\.id\]/)
  assert.ok(workspace.includes('if(before!==canonical(draft()))confirmation.value = null'))
  assert.ok(studio.includes('proposalParametersKey,planningBusy'))
  assert.ok(studio.includes('taskData[item.id]?.video?.safetyRepair'))
  assert.ok(studio.includes('extra.safety_repair_kind=pendingSafetyKind'))
})

test('资产入口只在添加素材菜单，已选风格具有独立清除按钮且仅清空风格',()=>{
  const source=read('features/creation/components/CreationComposer.vue')
  assert.ok(!source.includes('aria-label="引用资产"'))
  assert.ok(source.includes("@click=\"emit('assets'); popover = ''\""))
  assert.ok(source.includes('从资料库选择'))
  assert.ok(source.includes('v-if="hasActiveStyle" class="creation-selected-style"'))
  assert.ok(source.includes('activeStyle?.cover_url'))
  assert.ok(source.includes('aria-label="清除风格"'))
  assert.ok(source.includes('@click.stop="clearStyle"'))
  const clear=source.slice(source.indexOf('function clearStyle'),source.indexOf('function clearStyle')+180)
  assert.ok(clear.includes("isParameterLocked('style')"))
  assert.ok(clear.includes("update({style:'',styleId:''})"))
  assert.ok(!clear.includes('prompt:')&&!clear.includes('references:'))
})

test('紧凑风格只显示缩略图和叉号，大输入框与悬停保留名称',()=>{
  const source=read('features/creation/components/CreationComposer.vue')
  assert.ok(source.includes('.is-compact .creation-selected-style{flex:0 0 32px;width:32px;max-width:32px}'))
  assert.ok(source.includes('.is-compact .creation-selected-style-label{display:none}'))
  assert.ok(source.includes('<span class="creation-selected-style-label">{{activeStyleLabel}}</span>'))
  assert.ok(source.includes('<UTooltip :text="activeStyleLabel"'))
  assert.ok(source.includes('aria-label="清除风格"'))
  // 标签由实际名称决定宽度，不能再次恢复固定字数占位。
  assert.ok(source.includes('flex:0 1 auto;width:max-content;min-width:32px;max-width:100%'))
  assert.ok(!source.includes('calc(13em + 46px)'))
})
