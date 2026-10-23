// 示例引用的纯业务回归：不读取外站图片、不创建生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref} from 'vue'
const source=readFileSync(new URL('../features/creation/skillTrial.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {skillTrialReferences,trialImageCount}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('图片张数从明确输出要求同步，手动冲突和超限不静默覆盖或截断',()=>{
  assert.equal(trialImageCount('输出数量：4张。',1,false),4)
  assert.equal(trialImageCount('目标生成图片数量：3 张。',1,false),3)
  assert.equal(trialImageCount('商品数量：3张，镜头数：2',1,false),1)
  assert.equal(trialImageCount('输出数量：2张',2,true),2)
  assert.throws(()=>trialImageCount('输出数量：4张',1,true),/已选择1张/)
  assert.throws(()=>trialImageCount('输出数量：8张',1,false),/分批计划/)
  assert.throws(()=>trialImageCount('输出数量：0张',1,false),/单批上限/)
})
const sample=(version,available=true)=>({item_id:'item-'+version,version_id:version,available,name:'商品示例',media_type:'image',preview_url:'/preview/'+version})
test('试用带入真实参考，不拿封面当图片；保留用户素材并替换旧示例',()=>{
  const own={...sample('own')},old={...sample('old')}
  const row={cover:'/cover.png',example_references:[sample('new')]}
  const value=skillTrialReferences(row,[own,old],['old'])
  assert.deepEqual(value.references.map(ref=>ref.version_id),['own','new'])
  assert.deepEqual(value.exampleIds,['new'])
  assert.equal(value.references[1].preview_url,'/preview/new')
  assert.equal(skillTrialReferences({cover:'/cover.png'},[],[]).references.length,0)
})
test('重复试用不重复图片，与用户原有同版本不标记为可替换示例',()=>{
  const row={example_references:[sample('new')]}
  const once=skillTrialReferences(row,[],[])
  assert.deepEqual(skillTrialReferences(row,once.references,once.exampleIds),once)
  assert.deepEqual(skillTrialReferences(row,[sample('new')],[]).exampleIds,[])
})
test('失效、非图和超过总数先拒绝，不截断草稿',()=>{
  const own=[sample('own')]
  assert.throws(()=>skillTrialReferences({example_references:[sample('bad',false)]},own,[]),/失效/)
  assert.throws(()=>skillTrialReferences({example_references:[{...sample('video'),media_type:'video'}]},own,[]),/失效/)
  assert.throws(()=>skillTrialReferences({example_references:[sample('new')]},Array.from({length:12},(_,i)=>sample(String(i))),[]),/超过12/)
  assert.equal(own.length,1)
})
test('所有技能试用路径调用素材预检与示例填入，撤销包含引用快照',()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.equal((studio.match(/await validateSkillTrial\(spec\)/g)||[]).length,2)
  assert.equal((studio.match(/applySkillPrompt\(spec\)/g)||[]).length,2)
  assert.match(studio,/references\.value=state\.beforeReferences/)
  assert.match(studio,/user_parameter_keys/)
})
test('详情试用先解除详情焦点锁再确认风格，取消恢复原预览',()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  const home=studio.slice(studio.indexOf('async function useHomeSkill('),studio.indexOf('async function makeSame('))
  assert.ok(home.indexOf('if(preview)selectedSkillPreview.value=null')<home.indexOf('await creationService.publicCatalog'))
  assert.ok(home.indexOf('homeComposerExpanded.value=true')<home.indexOf('await creationService.publicCatalog'))
  assert.match(home,/if\(!accepted\)\{if\(preview\)selectedSkillPreview\.value=preview;return\}/)
})
test('运行实际首页选择逻辑：确认时详情已关闭，取消无草稿副作用',async()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  const method=studio.slice(studio.indexOf('async function useHomeSkill('),studio.indexOf('/** 先读取全部固定公共素材'))
  for(const accepted of [false,true]){
    const preview={id:'product'},calls=[],selectedSkillPreview=ref(preview)
    const deps={workInProgress:ref(false),loading:ref(false),cloudDraft:{restoring:ref(false)},directoryTrialBusy:ref(false),homeDockVisible:ref(false),previewDockScroll:ref(null),entry:ref('commerce'),auth:{session:{user:{id:'owner'}}},active:ref(false),creationService:{publicCatalog:async()=>({skills:[{id:'product',entries:['commerce']}]})},selectedSkillPreview,nextTick:async()=>calls.push('tick'),validateSkillTrial:async()=>{assert.equal(selectedSkillPreview.value,null);return accepted},catalog:ref({skills:[]}),parameters:ref({extra:{}}),skill:ref('poster'),director:ref(null),directorAccepted:ref(false),patchParameters:()=>calls.push('patch'),setSkill:()=>calls.push('skill'),selectedSkillWorkflow:()=>null,applySkillPrompt:()=>calls.push('apply'),pendingSkillFocus:ref(false),pendingSkillScroll:ref(null),homeScrollRoot:null,finishHomeSkillSelection:async()=>calls.push('focus'),notice:ref('')}
    deps.homeComposerExpanded=ref(false)
    const js=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
    const run=new Function(...Object.keys(deps),'let caseRevision=0,directoryTrialRevision=0;'+js+';return useHomeSkill')(...Object.values(deps))
    await run('product')
    assert.equal(deps.notice.value,'')
    assert.equal(deps.directoryTrialBusy.value,false)
    assert.equal(deps.homeComposerExpanded.value,true)
    if(accepted){assert.equal(selectedSkillPreview.value,null);assert.ok(calls.includes('apply'))}
    else {assert.equal(selectedSkillPreview.value.id,'product');assert.deepEqual(calls,['tick'])}
  }
})
test('切换动画不改变布局，减少动态效果时关闭；准备状态不能误报新技能已选定',()=>{
  const source=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8')
  assert.match(source,/skillPulse>0&&!trialPending/)
  assert.match(source,/transform:scale\(1\.12\)/)
  assert.match(source,/prefers-reduced-motion:reduce/)
  assert.match(source,/trialPending\?'正在准备…'/)
})
