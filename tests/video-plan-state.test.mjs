import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const e={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/videoPlanState.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e)

test('失败项重试只接受明确终态，不重复创建已有草案或误选成功项',()=>{
  const value={status:'submitted',batch_supported:true,items:[{id:'a'},{id:'b'},{id:'c'}],batch:{items:[
    {item_id:'a',status:'succeeded'},{item_id:'b',status:'failed'},{item_id:'c',status:'needs_review'},
  ]}}
  assert.deepEqual(e.retryableVideoItems(value).map(item=>item.item_id),['b'])
  assert.equal(e.retryableVideoItems({...value,batch_supported:false}).length,0)
  assert.equal(e.retryableVideoItems({...value,status:'draft'}).length,0)
  value.batch.items[1].retry_run_id='existing'
  assert.equal(e.retryableVideoItems(value).length,0)
})
const plan={selected_ids:['a','b'],items:[{id:'a',title:'一',prompt:'完整一'},{id:'b',title:'二',prompt:'完整二'}]}
test('选择顺序不改变原计划身份，选择一条保留原两条',()=>{
  assert.equal(e.videoPlanDirty(plan,['b','a'],plan.items),false)
  assert.deepEqual(e.videoPlanChanges(plan,['b'],plan.items),{selected_ids:['b'],items:[]})
  assert.equal(plan.items.length,2)
})
test('修改内容或选择立即失效旧价，仅发送变化条目',()=>{
  const items=[...plan.items.map(item=>({...item}))];items[1].prompt='新分镜'
  assert.equal(e.videoPlanDirty(plan,['a','b'],items),true)
  assert.deepEqual(e.videoPlanChanges(plan,['a','b'],items).items,[items[1]])
  assert.equal(e.videoPlanDirty(plan,['a'],plan.items),true)
})
test('刷新恢复未提交多视频草案，但不复活已替代或已执行的旧计划',()=>{
  const run={status:'replied',creative_plan:{status:'draft',total_count:2}}
  assert.equal(e.hasUnsubmittedVideoPlan(run),true)
  assert.equal(e.hasUnsubmittedVideoPlan({...run,executed_request:'already'}),false)
  assert.equal(e.hasUnsubmittedVideoPlan({...run,superseded_by:'next'}),false)
  assert.equal(e.hasUnsubmittedVideoPlan({...run,status:'cancelled'}),false)
})

function quoted(){return {...plan,status:'draft',revision:3,batch_supported:true,quote:{id:'quote',plan_revision:3,item_ids:['a','b'],items:[{id:'a',credits:12},{id:'b',credits:18}],total_credits:30,sufficient:true,expires_at:200,expired:false,execution_available:true}}}
test('只有正式准备、有效合计和完整选择一致时才允许确认',()=>{
 const value=quoted()
 assert.equal(e.canConfirmVideoBatch(value,100000),true)
 assert.equal(e.canConfirmVideoBatch(value,200000),false)
 assert.equal(e.canConfirmVideoBatch(value,100000,true),false)
 assert.equal(e.canConfirmVideoBatch(value,100000,false,true),false)
 for(const [field,invalid] of [['execution_available',false],['sufficient',false],['expired',true],['plan_revision',2],['total_credits',29]]){
   const copy=quoted();copy.quote[field]=invalid;assert.equal(e.canConfirmVideoBatch(copy,100000),false)
 }
 assert.equal(e.canConfirmVideoBatch({...value,batch_supported:false},100000),false)
 assert.equal(e.canConfirmVideoBatch({...value,batch:{}},100000),false)
})
test('不一致或重复条目不能用总价掩盖，选择一项仍需对应一项报价',()=>{
 const value=quoted();value.quote.item_ids=['b','a']
 assert.equal(e.canConfirmVideoBatch(value,100000),false)
 const single=quoted();single.selected_ids=['a'];single.quote.item_ids=['a'];single.quote.items=[{id:'a',credits:12}];single.quote.total_credits=12
 assert.equal(e.canConfirmVideoBatch(single,100000),true)
 single.quote.items.push({id:'a',credits:0});assert.equal(e.canConfirmVideoBatch(single,100000),false)
})
test('已提交批次刷新可恢复，未知结果不冒充成功',()=>{
 assert.equal(e.hasSubmittedVideoPlan({creative_plan:{status:'submitted',batch:{items:[]}}}),true)
 assert.equal(e.hasSubmittedVideoPlan({creative_plan:{status:'draft'}}),false)
 assert.equal(e.videoBatchStatus('needs_review'),'提交状态待核对')
 assert.equal(e.videoBatchStatus('undefined-state'),'正在同步状态')
 assert.equal(e.videoBatchStatus('succeeded'),'已完成')
})
