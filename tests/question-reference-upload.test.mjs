// 执行真实问题动作方法；不上传真实文件、不调用模型、不创建收费任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ref,computed,watch,reactive,effectScope,nextTick} from 'vue'
import {runInNewContext} from 'node:vm'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
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
const file='features/creation/components/CreationReferenceQuestion.vue',source=read(file)
function create(upload,storage=new Map()){
  const props=reactive({questionKey:'owner:run:1',text:'上传参考图',busy:false,upload}),events=[],scope=effectScope(),module={exports:{}}
  const script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
  scope.run(()=>runInNewContext(compile(script+';module.exports={receive,confirm,remove,selected,uploading,progress,canConfirm,error,failedFile}'),{
    module,ref,computed,watch,defineProps:()=>props,defineEmits:()=>((...args)=>events.push(args)),defineExpose:()=>{},onBeforeUnmount:()=>{},
    sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},URL:{createObjectURL:()=> 'blob:local-preview',revokeObjectURL:()=>{}},libraryErrorMessage:(_cause,fallback)=>fallback,
  }))
  return {...module.exports,props,events,storage,stop:()=>scope.stop()}
}
const asset={item_id:'item-a',version_id:'version-a',purpose:'reference',media_type:'image',name:'商品.png',preview_url:'private-preview'}

test('本题上传按真实进度显示，成功不自动答题，只有确认才提交',async()=>{
  let finish
  const form=create((_file,progress)=>{progress(35);return new Promise(resolve=>{finish=resolve})})
  const pending=form.receive({name:'商品.png'})
  assert.equal(form.uploading.value,true);assert.equal(form.progress.value,35);assert.equal(form.canConfirm.value,false)
  form.confirm();assert.equal(form.events.length,0)
  finish(asset);await pending
  assert.equal(form.canConfirm.value,true);assert.equal(form.events.length,0)
  form.confirm();assert.equal(form.events.length,1);assert.equal(form.events[0][1][0].version_id,'version-a')
  assert.doesNotMatch([...form.storage.values()].join(''),/private-preview|blob:/)
  form.stop()
})
test('取消文件选择不提交，上传失败禁用确认，可移除并重试',async()=>{
  let calls=0
  const form=create(async()=>{calls++;if(calls===1)throw Error('network');return asset})
  await form.receive(undefined);assert.equal(calls,0)
  await form.receive({name:'商品.png'});form.confirm()
  assert.equal(form.canConfirm.value,false);assert.equal(form.events.length,0);assert.ok(form.failedFile.value)
  await form.receive(form.failedFile.value);assert.equal(form.canConfirm.value,true)
  form.remove();assert.equal(form.canConfirm.value,false);form.stop()
})
test('切换问题后迟到上传不回填，刷新只恢复固定版本，忙碌禁止重复提交',async()=>{
  let finish
  const form=create(()=>new Promise(resolve=>{finish=resolve}))
  const pending=form.receive({name:'图.png'});form.props.questionKey='owner:run:2';await nextTick();finish(asset);await pending
  assert.equal(form.selected.value,null);assert.equal(form.canConfirm.value,false);form.stop()
  const saved=create(async()=>asset);await saved.receive({name:'图.png'})
  const restored=create(async()=>asset,saved.storage);assert.equal(restored.selected.value.version_id,'version-a')
  restored.props.busy=true;restored.confirm();assert.equal(restored.events.length,0);restored.stop();saved.stop()
})
test('参考图题独立显示，不与旧选项并列、不调用底部上传或自动回答',()=>{
  assert.ok(studio.includes('!knownFormatQuestion && !questionNeedsReference(planning.question)" class="liv-question-options"'))
  assert.ok(studio.includes(':references="composerReferences"'))
  assert.doesNotMatch(studio,/await upload\(\[file\]\)|uploadQuestionReference|questionFileInput/)
  assert.ok(studio.includes('questionReferences:ComposerReference[]=[]'))
  assert.doesNotMatch(source,/从资料库|emit\('submit'.*await props.upload/)
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'reference-question'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:'reference-question',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
