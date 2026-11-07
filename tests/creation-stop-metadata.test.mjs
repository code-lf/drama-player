import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref} from 'vue'

test('停止经真实接口确认，清理流程编号但不重新适配模型参数',async()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const snippet=source.slice(source.indexOf('async function cancelPlanning(){'),source.indexOf('\nasync function confirmVideoSwitch'))
  const parameters=ref({model:'original-model',quality:'medium',extra:{creation_run_id:'run',mv_run_id:'mv',director_run_id:'director',user_parameter_keys:['quality']}})
  const planning=ref({id:'run'}),session=ref({id:'session'}),prompt=ref('保留输入'),director=ref(null),stoppingAssistant=ref(false)
  const route={query:{session:'session',run:'run'}},routes=[],calls=[]
  const body=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const stop=new Function('parameters','planning','session','prompt','director','stoppingAssistant','route','navigateTo','creationService','ref',`
    const countdown=ref(null),directorAccepted=ref(false),planningBusy=ref(false),error=ref('');let assistantEpoch=0;
    const patchParameters=()=>{throw new Error('停止不能重新校验模型')},setText=()=>{throw new Error('不能覆盖已有输入')};
    ${body};return cancelPlanning;
  `)(parameters,planning,session,prompt,director,stoppingAssistant,route,async value=>routes.push(value),{cancelRun:async id=>{calls.push(id);return{id,status:'cancelled',draft:{prompt:'旧需求'}}}},ref)
  await stop()
  assert.deepEqual(calls,['run'])
  assert.equal(planning.value.status,'cancelled')
  assert.equal(prompt.value,'保留输入')
  assert.deepEqual(parameters.value,{model:'original-model',quality:'medium',extra:{user_parameter_keys:['quality']}})
  assert.deepEqual(routes,[{path:'/dashboard',query:{session:'session'}}])
  assert.equal(stoppingAssistant.value,false)
})
