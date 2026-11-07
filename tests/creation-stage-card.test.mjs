// 执行阶段卡真实方法，不请求模型或生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref,watch,nextTick} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/components/CreationStageCard.vue',import.meta.url),'utf8')
const merge={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/stageMerge.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(merge)
const interaction={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/questionInteraction.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(interaction)
function create(save,extra={}){
  const script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
  const js=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const props={stage:{revision:0,answers:{subject:'面霜'},definition:{fields:[{id:'subject',label:'商品',kind:'text',required:true}]}},busy:false,references:[],save,...extra}
  return new Function('defineProps','defineEmits','computed','ref','watch','nextTick','defineExpose','mergeStageAnswers','preferredQuestionOption','onBeforeUnmount','libraryErrorMessage',js+';return {move,page,answers,localError,receive,selectImages,removeImage,chosen,replacing,recover,resolveConflict,conflicts,referencePurpose,referenceNote,questionNumber,questionCount,materialBusy,uploadProgress,failedFile,pendingSave,retryUpload,discardUpload,saveImages}')(()=>props,()=>()=>{},computed,ref,watch,nextTick,()=>{},merge.mergeStageAnswers,interaction.preferredQuestionOption,()=>{},(_cause,fallback)=>fallback)
}

test('三方合并保留独立修改，同字段不同值与素材移除须核对',()=>{
  const base={subject:'杯子',platform:'淘宝',source:[image('a')]}
  const value=merge.mergeStageAnswers(base,{...base,platform:'京东',source:[]},{...base,subject:'耳机',source:[image('b')]})
  assert.equal(value.answers.subject,'耳机');assert.equal(value.answers.platform,'京东')
  assert.equal(value.conflicts.source.local.length,0);assert.equal(value.conflicts.source.remote.length,1)
})

test('首题没有上一步，后续按钮等宽；只预填普通偏好，不覆盖既有选择或授权',()=>{
  let calls=0
  const stage={revision:0,answers:{style:'电影'},definition:{fields:[{id:'style',label:'风格',kind:'single',options:['简洁','电影']},{id:'tone',label:'色调',kind:'single',options:['柔和','鲜艳']},{id:'confirm',label:'费用确认',kind:'single',options:['确认','取消']}]}}
  const form=create(async()=>{calls++;return true},{stage})
  assert.equal(form.answers.value.style,'电影');assert.equal(form.answers.value.tone,'柔和');assert.equal(form.answers.value.confirm,undefined);assert.equal(calls,0)
  assert.ok(source.includes('v-if="page>0||referencePurpose" block variant="secondary"'))
  assert.ok(source.includes('grid-template-columns:repeat(2,minmax(0,1fr))'))
})

test('冲突恢复只读并保留本页改动，明确选择后才允许再保存',async()=>{
  let saves=0,reads=0
  const card=create(async()=>{saves++;return true},{stage:{revision:0,answers:{subject:'杯子'},definition:{fields:[{id:'subject',label:'商品',kind:'text',required:true}]}},reload:async()=>{reads++;return {revision:1,answers:{subject:'耳机'}}}})
  card.answers.value.subject='茶壶';await card.recover()
  assert.equal(reads,1);assert.equal(saves,0)
  assert.equal(card.conflicts.value.subject.local,'茶壶')
  await card.move(1);assert.equal(saves,0)
  card.resolveConflict('subject','local');await card.move(1)
  assert.equal(saves,1);assert.equal(card.answers.value.subject,'茶壶')
})

test('读取失败不丢本页草稿，选择最新值不自动发起保存',async()=>{
  let saves=0
  const failed=create(async()=>true,{reload:async()=>null})
  failed.answers.value.subject='保留文字';await failed.recover()
  assert.equal(failed.answers.value.subject,'保留文字')
  const card=create(async()=>{saves++;return true},{reload:async()=>({revision:1,answers:{subject:'远端值'}})})
  card.answers.value.subject='本页值';await card.recover();card.resolveConflict('subject','remote')
  assert.equal(card.answers.value.subject,'远端值');assert.equal(saves,0)
})
test('非末题只保存，最后一题直接整组提交且不进入汇总页',async()=>{
  const calls=[],stage={revision:0,answers:{subject:'面霜'},definition:{fields:[{id:'subject',kind:'text',required:true},{id:'style',kind:'text',required:false}]}},card=create(async(...args)=>{calls.push(args);return true},{stage})
  await card.move(1);assert.equal(card.page.value,1);assert.equal(calls[0][1],false)
  await card.move(1);assert.equal(calls[1][1],true);assert.equal(card.page.value,1)
  assert.equal(calls[0][0].subject,'面霜')
  assert.equal(calls[1][3],2)
  assert.ok(!source.includes('<dl v-else'))
  assert.ok(source.includes("lastQuestion?'提交并继续':'下一步'"))
})

test('历史汇总游标回到末题，不自动提交；单题点击即可提交',async()=>{
  const calls=[],card=create(async(...args)=>{calls.push(args);return true},{stage:{revision:0,cursor:1,answers:{subject:'已保存'},definition:{fields:[{id:'subject',kind:'text',required:true}]}}})
  assert.equal(card.page.value,0);assert.equal(calls.length,0)
  await card.move(1);assert.equal(calls.length,1);assert.equal(calls[0][1],true)
  const refs=create(async()=>true,{stage:{...materialStage([image(1)]),cursor:1}})
  assert.equal(refs.page.value,0);assert.equal(refs.referencePurpose.value,true)
})
test('保存失败不翻页，相同内容重试复用请求号',async()=>{
  const ids=[],card=create(async(a,s,id)=>{ids.push(id);return false})
  await card.move(1);await card.move(1)
  assert.equal(card.page.value,0);assert.equal(ids[0],ids[1])
})
test('必填项缺失不保存',async()=>{
  let calls=0;const card=create(async()=>{calls++;return true})
  card.answers.value.subject='';await card.move(1)
  assert.equal(calls,0);assert.ok(card.localError.value)
})
test('必填空格不能绕过校验',async()=>{
  let calls=0;const card=create(async()=>{calls++;return true})
  card.answers.value.subject='  ';await card.move(1)
  assert.equal(calls,0)
})
test('翻页保存目标页码，连续点击不会并发提交',async()=>{
  let finish;const calls=[],card=create((...args)=>{calls.push(args);return new Promise(resolve=>{finish=resolve})},{stage:{revision:0,answers:{subject:'面霜'},definition:{fields:[{id:'subject',kind:'text',required:true},{id:'style',kind:'text'}]}}})
  const first=card.move(1);await card.move(1)
  assert.equal(calls.length,1);assert.equal(calls[0][3],1)
  finish(true);await first;assert.equal(card.page.value,1)
})
const image=id=>({item_id:`item-${id}`,version_id:`version-${id}`,purpose:'reference',media_type:'image',name:`图片${id}`,preview_url:'/test.png'})
const materialStage=(refs=[])=>({revision:0,cursor:0,answers:{source:refs},definition:{fields:[{id:'source',label:'参考图片',kind:'reference',required:false}]}})

test('真实上传未结束不能翻页，百分比来自上传回调；成功保存后才进入用途题',async()=>{
  let finish;const saves=[]
  const card=create(async(...values)=>{saves.push(values);return true},{stage:materialStage(),upload:async(_file,progress)=>{progress(27);return new Promise(resolve=>finish=resolve)}})
  const pending=card.receive({name:'参考.png'})
  assert.equal(card.materialBusy.value,true);assert.equal(card.uploadProgress.value,27)
  await card.move(1);assert.equal(card.referencePurpose.value,false);assert.equal(saves.length,0)
  finish(image('uploaded'));await pending
  assert.equal(card.materialBusy.value,false);assert.equal(card.pendingSave.value,false);assert.equal(saves.length,1)
  await card.move(1);assert.equal(card.referencePurpose.value,true);assert.equal(card.questionNumber.value,2);assert.equal(card.questionCount.value,2)
})

test('上传失败保留可重试文件并禁止下一步，重试成功不丢原参考图',async()=>{
  let uploads=0;const card=create(async()=>true,{stage:materialStage([image('old')]),upload:async()=>{uploads++;if(uploads===1)throw Error('network');return image('new')}})
  await card.receive({name:'失败重试.png'});assert.ok(card.failedFile.value)
  await card.move(1);assert.equal(card.referencePurpose.value,false)
  await card.retryUpload();assert.equal(uploads,2);assert.equal(card.failedFile.value,null)
  assert.deepEqual(card.chosen.value.map(row=>row.version_id),['version-old','version-new'])
})

test('文件上传成功但引用保存失败，只重试保存不再次上传',async()=>{
  let uploads=0,saves=0
  const card=create(async()=>++saves>1,{stage:materialStage(),upload:async()=>{uploads++;return image('one')}})
  await card.receive({name:'一张.png'});assert.equal(card.pendingSave.value,true)
  await card.move(1);assert.equal(card.referencePurpose.value,false)
  await card.saveImages(card.chosen.value);assert.equal(card.pendingSave.value,false);assert.equal(uploads,1);assert.equal(saves,2)
})

test('一页仅一题：选图后才展示用途，返回保留文字，下一步沿原协议保存说明',async()=>{
  const saves=[],card=create(async(...values)=>{saves.push(values);return true},{stage:materialStage([image(1)])})
  await card.move(1);assert.equal(card.page.value,0);assert.equal(card.referencePurpose.value,true);assert.equal(saves[0][4],undefined)
  card.referenceNote.value='只参考色调，人物保持不变'
  await card.move(-1);assert.equal(card.referencePurpose.value,false);assert.equal(saves.length,1)
  await card.move(1);await card.move(1)
  assert.equal(card.page.value,0);assert.equal(saves.at(-1)[4],'参考图要求：只参考色调，人物保持不变');assert.equal(saves.at(-1)[1],true)
  assert.ok(!source.includes('此步骤不生成作品'))
  assert.ok(source.includes('<template v-if="referencePurpose">'))
})
test('取消资料库及取消文件选择不保存，不生成假素材',async()=>{
  let calls=0;const card=create(async()=>{calls++;return true},{stage:materialStage(),selectImages:async()=>[]})
  await card.selectImages();await card.receive(null)
  assert.equal(calls,0);assert.equal(card.chosen.value.length,0)
})

test('上传框只开放本地图片，资料库选择底层能力保留但不显示入口',()=>{
  assert.ok(source.includes('@click="openLocalUpload"'))
  assert.ok(source.includes('class="stage-reference-source-label">上传图片</span>'))
  assert.ok(!source.includes(':items="uploadItems"'))
  assert.ok(!source.includes('i-lucide-chevron-down'))
  assert.ok(source.includes('async function selectImages()'))
  assert.ok(!source.includes('从资料库选择</'))
})
test('选图直接保存，重复选择不叠加；移除也直接保存',async()=>{
  const saved=[],card=create(async a=>{saved.push(a);return true},{stage:materialStage(),selectImages:async()=>[image(1)]})
  await card.selectImages();await card.selectImages()
  assert.equal(saved[1].source.length,1)
  await card.removeImage('version-1')
  assert.deepEqual(saved.at(-1).source,[])
})
test('替换成功保留位置，上传失败不移除旧图',async()=>{
  const saved=[],card=create(async a=>{saved.push(a);return true},{stage:materialStage([image(1),image(2)]),upload:async()=>image(3)})
  card.replacing.value='version-1';await card.receive({name:'新图.png'})
  assert.deepEqual(saved[0].source.map(item=>item.version_id),['version-3','version-2'])
  let calls=0;const failed=create(async()=>{calls++;return true},{stage:materialStage([image(1)]),upload:async()=>null})
  failed.replacing.value='version-1';await failed.receive({name:'失败.png'})
  assert.equal(failed.chosen.value[0].version_id,'version-1');assert.equal(calls,0)
})
