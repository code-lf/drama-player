// 执行真实删除提示回调；隔离请求，确认撤销和回收站均为真实动作而非纯文案。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('删除成功才提示，可点击撤销与回收站，换号后不恢复原账号',async()=>{
  const source=read('composables/useProjectRecycleBin.ts')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}},calls=[],toasts=[],destinations=[],revision={value:0},auth={session:{user:{id:'one'}}}
  new Function('require','module','exports','useToast','useRouter','useWorkbenchAuth','useState',code)(()=>({creationProjectService:{archive:async item=>calls.push(['archive',item.id]),restore:async item=>calls.push(['restore',item.id])}}),module,module.exports,()=>({add:item=>toasts.push(item)}),()=>({push:path=>destinations.push(path)}),()=>({auth}),()=>revision)
  const api=module.exports.useProjectRecycleBin()
  await api.remove({id:'creation:one'})
  assert.deepEqual(calls,[['archive','creation:one']]);assert.equal(revision.value,1)
  const actions=toasts[0].actions
  assert.deepEqual(actions.map(item=>item.label),['撤销','回收站'])
  actions[1].onClick();assert.deepEqual(destinations,['/dashboard-projects?view=trash'])
  await actions[0].onClick();assert.deepEqual(calls.at(-1),['restore','creation:one']);assert.equal(revision.value,2)
  await api.remove({id:'drama:two'});auth.session.user.id='other'
  await toasts.at(-1).actions[0].onClick();assert.deepEqual(calls.at(-1),['archive','drama:two'])
})
