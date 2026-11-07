// 绑定与恢复结构回归不替代浏览器实测；确保后续调整不再重新引入默认规格覆盖。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/runParameterSnapshot.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {runParameterSnapshot}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('未生成媒体的会话也从运行快照恢复参数，云草稿保留显式修改',()=>{
  const workspace=read('features/creation/useCreationWorkspace.ts')
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(workspace.includes('conversationParameters'))
  assert.ok(workspace.includes('runParameterSnapshot(latest!)'))
  assert.ok(studio.includes('user_parameter_keys'))
  assert.ok(studio.includes('restoredParameters'))
  assert.ok(studio.includes('quality:selectedParameters.quality'))
})

test('恢复确认方案采用完整执行参数，不让早期入口默认模型画幅替换真实报价来源',()=>{
  const draft={parameters:{model:'default-model',aspectRatio:'1:1',resolution:'1K',quality:'medium',count:1,workflow:'direct',extra:{keep:'original'}}}
  const run={draft,task_input:{parameters:{model:'gpt-image-2-vip',aspectRatio:'16:9',resolution:'1K',quality:'medium',count:1,extra:{source:'fixed'}}}}
  const restored=runParameterSnapshot(run)
  assert.equal(restored.model,'gpt-image-2-vip');assert.equal(restored.aspectRatio,'16:9')
  assert.equal(restored.workflow,'direct');assert.equal(restored.extra.keep,'original');assert.equal(restored.extra.source,'fixed')
  assert.equal(draft.parameters.model,'default-model');assert.equal(run.task_input.parameters.extra.keep,undefined)
  assert.equal(runParameterSnapshot({draft}),draft.parameters)
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.match(studio,/const snapshot=runParameterSnapshot\(run\)[\s\S]*?patchParameters\(\{\.\.\.snapshot,extra:/)
})

test('云草稿恢复保留用户显式修改，其余规格采用执行快照；不购买也不覆盖存储原值',async()=>{
  const source=read('features/creation/components/CreationStudio.vue')
  const body=source.slice(source.indexOf('async function applyCloudDraft('),source.indexOf('const cloudDraft=useWorkspaceDraft'))
  const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const original={entry:'free',skill:'fixed-skill',prompt:'',segments:[],references:[],parameters:{model:'default-model',aspectRatio:'1:1',resolution:'2K',quality:'high',count:1,extra:{user_parameter_keys:['quality','resolution']}}}
  const snapshot={draft:{parameters:{model:'default-model',aspectRatio:'1:1'}},task_input:{parameters:{model:'gpt-image-2-vip',aspectRatio:'16:9',resolution:'1K',quality:'medium',count:1}},status:'ready'}
  const state={draftScope:{value:'session:mine'},draftOwner:{value:'owner'},session:{value:{id:'mine'}},messages:{value:[]},notice:{value:''},entry:{value:'free'},references:{value:[]},calls:[]}
  const deps={...state,route:{query:{}},persistentDraft:value=>value,creationService:{runs:async()=>[snapshot]},runParameterSnapshot,
    setSkill:value=>state.calls.push(['skill',value]),patchParameters:value=>state.calls.push(['parameters',value]),setText:()=>{},
    hasUnsubmittedVideoPlan:()=>false,hasSubmittedVideoPlan:()=>false,hasSubmittedImagePlan:()=>false,hasUnsubmittedImagePlan:()=>false}
  const apply=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${code};return applyCloudDraft`)(deps)
  await apply(original)
  const parameters=state.calls.find(row=>row[0]==='parameters')[1]
  assert.equal(parameters.model,'gpt-image-2-vip');assert.equal(parameters.aspectRatio,'16:9')
  assert.equal(parameters.resolution,'2K');assert.equal(parameters.quality,'high')
  assert.equal(original.parameters.model,'default-model');assert.equal(original.parameters.aspectRatio,'1:1')
})

test('指定方案深链恢复不被会话其他轮次取代，跨会话不携带旧深链',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),workspace=read('features/creation/useCreationWorkspace.ts')
  assert.ok(studio.includes("rows.find(row=>row.id===route.query.run)"))
  assert.ok(workspace.includes("route.query.session===id&&typeof route.query.run==='string'?{run:route.query.run}:{}"))
})

test('普通助手回复不再继承导演卡片，问题才有表面和独立按钮',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(!studio.includes('class="creation-director-preview creation-assistant-card"'))
  assert.ok(!studio.includes('creation-assistant-card>div:not(.liv-user-message)'))
  assert.ok(studio.includes('class="liv-question-card"'))
  assert.ok(studio.includes('placeholder="自由补充…"'))
  assert.ok(studio.includes('<CreationThinkingIndicator :run="planning"/>'))
})

test('工具浮层使用同一 Nuxt UI 关闭行为，规格统一展示质量等级',()=>{
  const composer=read('features/creation/components/CreationComposer.vue')
  // 禁止的是用户可见的旧标签，不应因中文方法注释提到同名概念而误报。
  const template=composer.slice(composer.indexOf('<template>'),composer.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g,'')
  assert.ok(composer.includes('<UPopover'))
  assert.ok(composer.includes(':reference="popoverAnchor"'))
  assert.ok(!composer.includes('搜索技能'))
  assert.ok(!composer.includes('内置技能'))
  assert.ok(!template.includes('普通聊天'))
  assert.ok(!composer.includes('Enter 发送，Shift+Enter 换行'))
  assert.ok(composer.includes("low:'低',medium:'中',high:'高'"))
  const studio=read('features/creation/components/CreationStudio.vue')
  const product=read('features/product-image/components/ProductImageWorkspacePanel.vue')
  assert.ok(studio.includes("low:'低',medium:'中',high:'高'"))
  assert.ok(product.includes("{ label: '低', value: 'low' }"))
  assert.ok(composer.includes('.is-compact .creation-param .creation-tool-label{display:none!important}'))
  assert.ok(composer.includes('.creation-composer.is-compact .creation-toolbar .creation-param{width:32px!important'))
  assert.ok(composer.includes(':text="`创作参数：${parameterLabel}`"'))
})
