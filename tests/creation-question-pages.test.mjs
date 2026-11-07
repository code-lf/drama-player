// 隔离执行问卷真实setup逻辑，翻页、补充和恢复不接模型或收费服务。
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref,reactive,watch,effectScope,nextTick} from 'vue'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const source=read('features/creation/components/CreationQuestionPages.vue')
const interaction={}
new Function('exports',ts.transpileModule(read('features/creation/questionInteraction.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(interaction)
function setup(saved,storageOverride){
  const fields=[{id:'name',text:'软件名称？',kind:'text',options:[],requires_input:true},
    {id:'audience',text:'面向哪些人员？',kind:'multiple',options:['行政','管理层'],requires_input:true}]
  const props=reactive({fields,questionKey:'owner:run:1',busy:false}),sent=[],sentFields=[],cache=new Map(saved?[['question-pages:owner:run:1',JSON.stringify(saved)]]:[])
  const module={exports:{}},scope=effectScope()
  let script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
  script+='\nmodule.exports={page,selected,text,isRequired,canContinue,choose,next}'
  scope.run(()=>runInNewContext(ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
    module,computed,ref,watch,defineProps:()=>props,defineEmits:()=>((_name,value,fields)=>{sent.push(value);sentFields.push(fields)}),
    multipleQuestionAnswer:(choices,text)=>[...new Set(choices),text.trim()].filter(Boolean).join('、'),
    preferredQuestionOption:interaction.preferredQuestionOption,
    sessionStorage:storageOverride||{getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value),removeItem:key=>cache.delete(key)},
  }))
  return {...module.exports,props,sent,sentFields,cache,stop:()=>scope.stop()}
}
test('独立问题分页，未填写不能继续，最后一次确定提交全部答案',async()=>{
  const form=setup()
  form.next();assert.equal(form.page.value,0);assert.equal(form.sent.length,0)
  form.text.value.name='测试OA';form.next();assert.equal(form.page.value,1);assert.equal(form.sent.length,0)
  form.text.value.audience='仅作界面测试';form.choose('行政',true);form.choose('管理层',true);form.choose('行政',false)
  form.page.value=0;assert.equal(form.text.value.name,'测试OA');form.next();form.next()
  assert.equal(form.sent[0],'软件名称？：测试OA\n面向哪些人员？：管理层、仅作界面测试')
  await nextTick();form.stop()
})

test('旧单题卡只提交原选项值，多选汇总仍走原回答接口，提交中有提示',()=>{
  const form=setup()
  form.props.fields=[{id:'visual',text:'视觉风格？',kind:'single',options:['写实','插画'],requires_input:false}]
  form.props.singleAnswer=true
  form.choose('写实');form.next()
  assert.equal(form.sent[0],'写实')
  assert.ok(source.includes('正在提交，请稍候…'))
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('@submit="submitStandaloneAnswer($event)"'))
  assert.ok(studio.includes("if(planning.value?.question?.kind==='multiple')void answerPlanning(value)"))
  form.stop()
})
test('刷新恢复同运行页码及答案，忙碌期间不能重复提交',async()=>{
  const form=setup({page:1,selected:{audience:['管理层','不在目录的选项']},text:{name:'测试OA',audience:'补充'}})
  assert.equal(form.page.value,1);assert.equal(form.selected.value.audience.join(','),'管理层')
  form.props.busy=true;form.next();assert.equal(form.sent.length,0)
  await nextTick();form.stop()
})

test('选填文字和多选可直接略过，必填仍拦截；不把略过解释成无素材或授权',()=>{
  const form=setup()
  form.props.fields[0].required=false
  assert.equal(form.isRequired.value,false);assert.equal(form.canContinue.value,true)
  form.next();assert.equal(form.page.value,1)
  assert.equal(form.isRequired.value,true);form.next();assert.equal(form.sent.length,0)
  form.props.fields[1].required=false
  form.next()
  assert.equal(form.sent[0],'软件名称？：本次暂不补充（选填）\n面向哪些人员？：本次暂不补充（选填）')
  assert.equal(JSON.stringify(form.sentFields[0]),JSON.stringify({name:'',audience:''}))
  form.stop()
})

test('选填跳过后刷新和返回保留状态，最终确认不能绕过前页必填',()=>{
  const form=setup({page:1,selected:{},text:{}})
  form.props.fields[1].required=false
  assert.equal(form.canContinue.value,true)
  form.next();assert.equal(form.sent.length,0)
  form.page.value=0;form.text.value.name='测试OA';form.next();form.next()
  assert.equal(form.sent.length,1);assert.ok(form.sent[0].includes('测试OA'))
  form.stop()
  assert.ok(source.includes('v-if="isRequired"'))
  assert.ok(source.includes('aria-label="必填"'))
  assert.ok(source.includes(':aria-required="isRequired"'))
  assert.ok(read('features/creation/components/CreationStudio.vue').includes('answerDraft,fieldAnswers,questionReferences.length>0)'))
})
test('存储被禁止不阻断问卷，主按钮使用品牌白字胶囊而非选项左对齐',()=>{
  const form=setup(null,{getItem(){throw Error('disabled')},setItem(){throw Error('disabled')},removeItem(){throw Error('disabled')}})
  assert.equal(form.page.value,0);form.stop()
  assert.ok(source.includes("page===fields.length-1?'确认并继续':'下一步'"))
  assert.ok(source.includes('justify-content:center!important'))
  assert.ok(source.includes('var(--liv-control-on-primary)'))
  assert.ok(source.includes('border-radius:999px'))
  assert.ok(source.includes('footer.has-previous{grid-template-columns:repeat(2,minmax(0,1fr))}'))
  assert.ok(source.includes('height:var(--liv-question-action-height)'))
  assert.ok(source.includes('class="question-page-back"'))
  assert.ok(source.includes('white-space:nowrap!important'))
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.indexOf('<CreationAnsweredQuestionCard v-for="(answer,index) in (pendingUserAnswer')<studio.indexOf('<CreationQuestionPages'))
})

test('普通偏好题推荐优先，预选不自动提交；恢复已清空答案不强行重选',()=>{
  const form=setup()
  assert.equal(interaction.preferredQuestionOption({kind:'single',text:'视觉风格',options:['写实','简洁科技（推荐）']}),'简洁科技（推荐）')
  assert.equal(interaction.preferredQuestionOption({kind:'multiple',label:'画面氛围',options:['明亮','暗调']}),'明亮')
  for(const text of ['是否确认付费生成','授权素材使用','生成失败如何重试','软件实际支持哪些功能'])assert.equal(interaction.preferredQuestionOption({kind:'single',text,options:['是','否']}),undefined)
  assert.equal(form.sent.length,0);form.stop()
})
