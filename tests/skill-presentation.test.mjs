// 实际执行公开说明、模板分段与 Tab 处理，不调用收费服务或真实收藏接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const template={};new Function('exports',compile(read('features/creation/templateSyntax.ts')))(template)
const helper={};new Function('exports','require',compile(read('features/creation/skillPresentation.ts')))(helper,key=>key==='./catalog'?{skillExamples:{}}:template)
test('公开说明四节有序，旧版兼容不泄露内部执行文档',()=>{
  const row={id:'test',target:'image',description:'公开简介',requirement:'上传商品图片',instructions:'内部执行规则',document:'系统提示词'}
  const sections=helper.skillGuide(row)
  assert.deepEqual(sections.map(x=>x.title),['技能简介','适用场景','使用方法','输出内容'])
  assert.equal(sections[0].text,'公开简介');assert.equal(sections[2].text,'上传商品图片');assert.equal(sections[3].text,'图片')
  assert.doesNotMatch(JSON.stringify(sections),/内部执行规则|系统提示词/)
  row.public_guide={introduction:'新介绍',scenarios:'网店',usage:'按步骤编辑',output:'商品主图',example:'为{{商品:香水}}设计主图'}
  assert.equal(helper.skillGuide(row)[0].text,'新介绍');assert.equal(helper.skillExampleParts(row)[1].field,'商品')
})
test('空草稿按Tab填可编辑字段，输入法、ShiftTab、已有草稿或忙碌时不覆盖',()=>{
  const source=read('features/creation/components/CreationComposer.vue'),method=source.slice(source.indexOf('function keydown('),source.indexOf('const dragDepth ='))
  for(const scenario of [{},{prompt:'已有草稿'},{shiftKey:true},{busy:true},{working:true},{isComposing:true}]){
    const calls=[],props={prompt:'',busy:false,working:false,...scenario},selectedSkill={value:{public_guide:{example:'制作{{商品:香水}}主图'}}}
    const deps={props,composing:{value:false},mentionOpen:{value:false},selectedSkill,skillExample:helper.skillExample,skillExampleParts:helper.skillExampleParts,emit:(...args)=>calls.push(args),nextTick:()=>{},renderText:()=>{}}
    const run=new Function(...Object.keys(deps),compile(method)+';return keydown')(...Object.values(deps)),event={key:'Tab',preventDefault:()=>{},...scenario}
    run(event)
    if(Object.keys(scenario).length)assert.deepEqual(calls,[])
    else{assert.equal(calls[0][1],'制作香水主图');assert.equal(calls[0][2][1].field,'商品')}
  }
})
for(const path of ['CreationSkillCards','CreationSkillDetail','CreationSkillShowcase','SkillCenterPanel','CreationComposer'])test(`${path} 真实组件编译`,()=>{
  const filename=`features/creation/components/${path}.vue`,{descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:path})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:path,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
test('技能卡预览不试用，独立试用按钮、真实收藏及公开分享入口',()=>{
  const card=read('features/creation/components/CreationSkillCards.vue'),detail=read('features/creation/components/CreationSkillDetail.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.match(card,/@click="emit\('preview',row\)"/);assert.match(card,/@click="emit\('try',row\)"/)
  assert.match(card,/columns:5/);assert.match(card,/columns:2/)
  assert.match(detail,/skillCenterService.favorite/);assert.match(detail,/link.searchParams.set\('skillPreview',row.id\)/)
  assert.doesNotMatch(detail,/instructions|\.document|prompt_prefix/)
  assert.match(studio,/await expandHomeComposer\(\)/)
  assert.match(studio,/@closed="finishHomeSkillSelection"/)
  assert.match(studio,/homeScrollRoot.scrollTop=scroll;trackHomeDock\(\)/)
  assert.match(read('features/creation/components/CreationComposer.vue'),/focus\(\{preventScroll:true\}\)/)
})
test('停靠试用在弹窗关闭后恢复原滚动位置并展开，不滚回原输入占位',async()=>{
  const source=read('features/creation/components/CreationStudio.vue'),line=source.split('\n').find(line=>line.startsWith('async function finishHomeSkillSelection()'))
  const calls=[],deps={active:{value:false},pendingSkillFocus:{value:true},pendingSkillScroll:{value:543},previewDockScroll:{value:543},homeScrollRoot:{scrollTop:250},trackHomeDock:()=>calls.push('dock'),expandHomeComposer:async()=>calls.push('expand'),homeComposerSlot:{value:{scrollIntoView:()=>calls.push('scrollToInput')}}}
  const run=new Function(...Object.keys(deps),compile(line)+';return finishHomeSkillSelection')(...Object.values(deps))
  await run();assert.equal(deps.homeScrollRoot.scrollTop,543);assert.deepEqual(calls,['dock','expand']);assert.equal(deps.pendingSkillFocus.value,false)
})
