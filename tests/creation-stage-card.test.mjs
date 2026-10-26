// 执行阶段卡真实方法，不请求模型或生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref,watch,nextTick} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/components/CreationStageCard.vue',import.meta.url),'utf8')
const merge={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/stageMerge.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(merge)
function create(save,extra={}){
  const script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
  const js=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const props={stage:{revision:0,answers:{subject:'面霜'},definition:{fields:[{id:'subject',label:'商品',kind:'text',required:true}]}},busy:false,references:[],save,...extra}
  return new Function('defineProps','defineEmits','computed','ref','watch','nextTick','defineExpose','mergeStageAnswers',js+';return {move,page,answers,localError,receive,selectImages,removeImage,chosen,replacing,recover,resolveConflict,conflicts}')(()=>props,()=>()=>{},computed,ref,watch,nextTick,()=>{},merge.mergeStageAnswers)
}

test('三方合并保留独立修改，同字段不同值与素材移除须核对',()=>{
  const base={subject:'杯子',platform:'淘宝',source:[image('a')]}
  const value=merge.mergeStageAnswers(base,{...base,platform:'京东',source:[]},{...base,subject:'耳机',source:[image('b')]})
  assert.equal(value.answers.subject,'耳机');assert.equal(value.answers.platform,'京东')
  assert.equal(value.conflicts.source.local.length,0);assert.equal(value.conflicts.source.remote.length,1)
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
test('翻页只保存，汇总点击才整组提交',async()=>{
  const calls=[],card=create(async(...args)=>{calls.push(args);return true})
  await card.move(1);assert.equal(card.page.value,1);assert.equal(calls[0][1],false)
  await card.move(1);assert.equal(calls[1][1],true)
  assert.equal(calls[0][0].subject,'面霜')
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
  let finish;const calls=[],card=create((...args)=>{calls.push(args);return new Promise(resolve=>{finish=resolve})})
  const first=card.move(1);await card.move(1)
  assert.equal(calls.length,1);assert.equal(calls[0][3],1)
  finish(true);await first;assert.equal(card.page.value,1)
})
const image=id=>({item_id:`item-${id}`,version_id:`version-${id}`,purpose:'reference',media_type:'image',name:`图片${id}`,preview_url:'/test.png'})
const materialStage=(refs=[])=>({revision:0,cursor:0,answers:{source:refs},definition:{fields:[{id:'source',label:'参考图片',kind:'reference',required:false}]}})
test('取消资料库及取消文件选择不保存，不生成假素材',async()=>{
  let calls=0;const card=create(async()=>{calls++;return true},{stage:materialStage(),selectImages:async()=>[]})
  await card.selectImages();await card.receive(null)
  assert.equal(calls,0);assert.equal(card.chosen.value.length,0)
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
