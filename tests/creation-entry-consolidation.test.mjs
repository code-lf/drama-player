// 执行真实选技能策略，验证新入口不重写历史广告工作流。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const compiled=p=>ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const selection={};new Function('exports',compiled('features/creation/skillSelection.ts'))(selection)
const catalog={};new Function('exports',compiled('features/creation/catalog.ts'))(catalog)

test('图片导航隐藏，不增加快捷入口，完整旧路由定义保留',()=>{
  assert.equal(catalog.creationEntries.find(item=>item.id==='image').label,'图片创作')
  assert.deepEqual(catalog.visibleCreationEntries.map(item=>item.id),['free','drama','commerce','marketing','music'])
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.equal((studio.match(/v-for="item in visibleCreationEntries"/g)||[]).length,2)
  assert.match(studio,/creationEntries.find\(item => item.id === entry.value\)/)
})
test('显式广告短片为直接流程，广告创意短剧只用导演，私人及旧多流程不强改',()=>{
  const select=selection.selectedSkillWorkflow
  assert.equal(select({id:'ad',workflows:['direct','director']}),'direct')
  assert.equal(select({id:'custom-ad-director',base_code:'ad',workflows:['director']}),'director')
  assert.equal(select({id:'user:1',base_code:'ad',kind:'user',workflows:['direct','director']}),undefined)
  assert.equal(select(undefined),undefined)
  assert.doesNotMatch(read('features/creation/useCreationWorkspace.ts'),/selectedSkillWorkflow/)
})
test('旧广告导演草稿显式重选广告短片时撤销旧执行上下文，不携带导演许可',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),method=studio.slice(studio.indexOf('function selectUserSkill('),studio.indexOf('async function routerRun('))
  const state={parameters:{value:{workflow:'director',extra:{director_run_id:'old',creation_run_id:'old',custom:'keep'}}},skill:{value:'ad'},director:{value:{old:true}},directorAccepted:{value:true},confirmation:{value:{old:true}},roundReferences:{value:[]},references:{value:[]},entry:{value:'commerce'},explicitSkillBoundary:{value:false}}
  const deps={...state,workInProgress:{value:false},catalog:{value:{skills:[{id:'ad',workflows:['direct','director']}]}},selectedSkillWorkflow:selection.selectedSkillWorkflow,stopCountdown:()=>{},patchParameters:value=>Object.assign(state.parameters.value,value),setSkill:id=>state.skill.value=id,conversationEntry:entry=>entry}
  const source=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  new Function(...Object.keys(deps),source+';return selectUserSkill')(...Object.values(deps))('ad')
  assert.equal(state.parameters.value.workflow,'direct');assert.equal(state.director.value,null)
  assert.deepEqual(state.parameters.value.extra,{custom:'keep',requirement_boundary:true});assert.equal(state.confirmation.value,null)
})
test('短剧使用真实三项互斥页签，切换保留文字，广告不再有输入框流程按钮',()=>{
  const source=read('features/creation/components/CreationComposer.vue')
  assert.match(source,/<UTabs v-if="entry==='drama'"/)
  assert.match(source,/value:'file',label:'上传剧本'/);assert.match(source,/value:'script',label:'粘贴剧本'/);assert.match(source,/value:'idea',label:'描述想法'/)
  assert.match(source,/disabled:busy/)
  // 故事也取消旧流程按钮，仍由技能与受控生产动作提供原能力。
  assert.doesNotMatch(source,/class="creation-workflow"/)
  assert.doesNotMatch(source,/广告导演制作/)
})
test('模板高亮文字与底色至少达到 WCAG 正文对比度',()=>{
  const tokens=read('assets/css/tokens.css'),color=name=>tokens.match(new RegExp('--liv-template-field-'+name+': (#[a-f0-9]+)'))[1]
  const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]}
  assert.ok((luminance(color('text'))+.05)/(luminance(color('surface'))+.05)>=4.5)
})
