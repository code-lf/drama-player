// 执行真实问题动作方法；不上传真实文件、不调用模型、不创建收费任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ref} from 'vue'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const helpers={};new Function('exports',ts.transpileModule(read('features/creation/questionInteraction.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helpers)
const studio=read('features/creation/components/CreationStudio.vue')
test('上传选项不包含否定、稍后或无参考图回答；旧缺图问题补入口',()=>{
  for(const value of ['上传参考图','上传商品参考图','我选择上传图片'])assert.equal(helpers.isQuestionUploadOption(value),true)
  for(const value of ['稍后上传，先确认其他细节','无参考图，由AI直接生成商品画面','不上传图片'])assert.equal(helpers.isQuestionUploadOption(value),false)
  assert.equal(helpers.questionNeedsReference({kind:'single',text:'目前尚未收到您上传的商品参考图。请实际上传图片。'}),true)
  assert.equal(helpers.questionNeedsReference({kind:'single',text:'希望什么风格？'}),false)
})
test('点击已提供的上传选项只打开选择框，不提交文字答案',()=>{
  const calls=[]
  const deps={planningBusy:ref(false),stoppingAssistant:ref(false),planning:ref({question:{options:['上传参考图']}}),isQuestionUploadOption:helpers.isQuestionUploadOption,chooseQuestionFile:()=>calls.push('file'),catalog:ref(null),answerPlanning:()=>calls.push('answer')}
  const method=studio.slice(studio.indexOf('function chooseAnswer('),studio.indexOf('/** 专项跨媒体'))
  const run=new Function(...Object.keys(deps),compile(method)+';return chooseAnswer')(...Object.values(deps))
  run('上传参考图');assert.deepEqual(calls,['file'])
})
test('上传成功才携带真实引用回答；失败、取消和切换问题不推进',async()=>{
  for(const scenario of ['success','failed','cancel','switch']){
    const replies=[],planning=ref({id:'run-a',status:'waiting',calls:2,question_revision:1}),references=ref([])
    const deps={ref,planning,references,auth:{session:{user:{id:'owner'}}},planningBusy:ref(false),busy:ref(false),upload:async()=>{if(scenario!=='failed')references.value.push({version_id:'uploaded-version',media_type:'image'});if(scenario==='switch')planning.value={id:'run-b',status:'waiting',calls:0}},answerPlanning:async text=>replies.push({text,refs:[...references.value]})}
    const method=studio.slice(studio.indexOf('const questionFileInput='),studio.indexOf('const selectedAnswers='))
    const run=new Function(...Object.keys(deps),compile(method)+';return uploadQuestionReference')(...Object.values(deps))
    await run(scenario==='cancel'?null:{name:'商品.png'})
    assert.equal(replies.length,scenario==='success'?1:0)
    if(replies.length)assert.equal(replies[0].refs[0].version_id,'uploaded-version')
  }
})
