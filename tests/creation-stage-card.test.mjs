// 执行阶段卡真实方法，不请求模型或生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref,watch} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/components/CreationStageCard.vue',import.meta.url),'utf8')
function create(save){
  const script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
  const js=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const props={stage:{revision:0,answers:{subject:'面霜'},definition:{fields:[{id:'subject',label:'商品',kind:'text',required:true}]}},busy:false,references:[],save}
  return new Function('defineProps','defineEmits','computed','ref','watch',js+';return {move,page,answers,localError}')(()=>props,()=>()=>{},computed,ref,watch)
}
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
