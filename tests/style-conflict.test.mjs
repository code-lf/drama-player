// 续作风格冲突只检查明确方向，不靠品类猜测。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref} from 'vue'
const exports={}
test('轮次列表阶段卡用函数引用，避免发送读取到 ref 数组',()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.match(studio,/:ref="instance=>stageCard=instance/)
  assert.doesNotMatch(studio,/<CreationStageCard[^>]*\sref="stageCard"/)
})
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/styleConflict.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports)
test('普通续作沿用摄影要求时拦截残留卡通，最新明确方向优先',()=>{
  const f=exports.continuationStyleConflict
  assert.equal(f('3D 卡通喜剧','再做一张','高端商业摄影'),true)
  assert.equal(f('3D 卡通喜剧','改成卡通','高端商业摄影'),false)
  assert.equal(f('产品摄影','改成卡通','高端商业摄影'),true)
  assert.equal(f('清新','再做一张','高端商业摄影'),false)
  assert.equal(f('','高端商业摄影',''),false)
})

test('手动风格确认取消保留草稿；等待时修改规格、素材、技能或轮次则不继续发送',async()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  const start=studio.indexOf('async function planDemand(')
  assert.ok(start>=0,'应能定位带可选模式参数的真实发送方法')
  const method=studio.slice(start,studio.indexOf('  scrollHistoryBottom(true)',start))+"return 'continue'\n}"
  const js=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  for(const scenario of ['cancel','accept','parameters','references','skill','run','prompt','account']){
    const patches=[],deps={requireLogin:()=>true,planning:ref({id:'run',status:'ready',draft:{prompt:'商业摄影'}}),explicitSkillBoundary:ref(false),styleConflictBusy:ref(false),safetyDirectBusy:ref(false),pendingSafetySource:'',planningBusy:ref(false),stoppingAssistant:ref(false),prompt:ref('再做一张'),uploads:ref([]),error:ref(''),continuationStyleConflict:exports.continuationStyleConflict,parameters:ref({style:'3D卡通',styleId:'cartoon',quality:'high',extra:{user_parameter_keys:['style']}}),auth:{session:{user:{id:'owner'}}},session:ref({id:'session'}),assistantEpoch:0,assistantHistory:ref([]),skill:ref('product'),entry:ref('commerce'),patchParameters:patch=>patches.push(patch)}
    deps.confirmHomeAction=async()=>{
      if(scenario==='parameters')deps.parameters.value.quality='low'
      if(scenario==='references')deps.references.value.push({version_id:'new'})
      if(scenario==='skill')deps.skill.value='poster'
      if(scenario==='run')deps.planning.value.id='new-run'
      if(scenario==='prompt')deps.prompt.value='新需求'
      if(scenario==='account')deps.auth.session.user.id='another'
      return scenario!=='cancel'
    }
    deps.references=ref([])
    const run=new Function(...Object.keys(deps),js+';return planDemand')(...Object.values(deps))
    const result=await run()
    assert.equal(result,scenario==='accept'?'continue':undefined,scenario)
    assert.equal(patches.length,scenario==='accept'?1:0,scenario)
    assert.equal(deps.styleConflictBusy.value,false)
    assert.equal(deps.prompt.value,scenario==='prompt'?'新需求':'再做一张')
  }
})
