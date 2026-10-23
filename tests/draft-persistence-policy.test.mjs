// 首页文字不落盘，会话草稿不受影响；不连接账号或提交任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const output=ts.transpileModule(read('features/creation/draftPersistence.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {persistentDraft}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
test('首页存取均忽略文字，保留偏好素材且不修改原草稿',()=>{
  const original={prompt:'未发送文字',segments:[{type:'text',text:'未发送文字'}],references:[{version_id:'own'}],parameters:{model:'chosen'}}
  for(const entry of ['free','commerce','marketing','drama','music','image']){
    const result=persistentDraft(original,'entry:'+entry)
    assert.equal(result.prompt,'');assert.deepEqual(result.segments,[])
    assert.equal(result.parameters,original.parameters);assert.equal(result.references,original.references)
  }
  assert.equal(original.prompt,'未发送文字')
})
test('会话草稿完整保留',()=>{
  const original={prompt:'会话草稿',segments:[{type:'text',text:'文字'}]}
  assert.equal(persistentDraft(original,'session:example'),original)
})
test('真实存取路径应用政策，游客不读写旧文字缓存',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),workspace=read('features/creation/useCreationWorkspace.ts')
  assert.match(studio,/\(\)=>persistentDraft\(draft\(\),draftScope.value\)/)
  assert.match(studio,/value=persistentDraft\(value,draftScope.value\)/)
  assert.match(studio,/if\(!draftScope.value.startsWith\('entry:'\)\)setText/)
  assert.doesNotMatch(workspace,/localStorage\.(?:getItem|setItem)\('liv-workbench-guest-draft'/)
})
