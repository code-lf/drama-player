// 执行真实试用处理器，确认不经过正式保存或完成表单，并拒绝迟到响应覆盖新稿。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const panel=readFileSync(new URL('../features/creation/components/SkillCenterPanel.vue',import.meta.url),'utf8')
const method=panel.slice(panel.indexOf('async function trialDraft('),panel.indexOf('/** 上传仅加入助手'))
function setup(blocked=false){
  let resolve;const navigation=[],calls=[]
  const state={recipe:{value:{config:{label:'测试'}}},busy:{value:false},requireLogin:()=>true,blankSkillDocument:()=>false,auth:{session:{user:{id:'one'}}},persistDraft:async()=>{},pendingDraft:null,savedDraftText:'saved',editorSnapshot:()=> 'saved',draftId:{value:'draft'},draftRevision:{value:3},error:{value:''},crypto:{randomUUID:()=> 'request'},router:{push:async value=>navigation.push(value)},report:e=>{throw e},skillCenterService:{trialDraft:(...args)=>{calls.push(args);return new Promise(r=>resolve=r)},finishDraft:()=>{throw new Error('不应完成技能')}}}
  if(blocked)state.pendingDraft={}
  const run=new Function(...Object.keys(state),ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return trialDraft')(...Object.values(state))
  return {state,run,navigation,calls,finish:()=>resolve({session:{id:'trial-session'}})}
}
test('试用冻结草稿并跳空画布，不创建正式版本',async()=>{const r=setup(),p=r.run();await Promise.resolve();r.finish();await p;assert.deepEqual(r.calls[0],['draft',{expected_revision:3,request_id:'request'}]);assert.deepEqual(r.navigation,[{path:'/dashboard',query:{session:'trial-session'}}]);assert.match(panel,/@trial="trialDraft"/)})
test('保存失败不试用，期间切换草稿不被迟到跳转吞掉',async()=>{const blocked=setup(true);await blocked.run();assert.equal(blocked.calls.length,0);const r=setup(),p=r.run();await Promise.resolve();r.state.recipe.value={config:{label:'另一稿'}};r.finish();await p;assert.equal(r.navigation.length,0)})
test('画布目录读取携带本人会话，刷新不会将试用技能当成自由创作',()=>{const workspace=readFileSync(new URL('../features/creation/useCreationWorkspace.ts',import.meta.url),'utf8');assert.match(workspace,/creationService.catalog\(entry.value,session.value\?\.id\)/)})
