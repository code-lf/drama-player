import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

// 执行隔离的正式分组适配，不调用旧短剧服务、真实模型或媒体采购。
const code=ts.transpileModule(readFileSync('features/creation/drama/projection/productionGroups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exports={};new Function('exports',code)(exports)
const {groupProductionGraph}=exports
const node=(id,kind,step)=>({id,position:{x:10,y:20},data:{kind,step,title:id,state:'待制作',detail:''}})
const graph=()=>({nodes:[node('script','剧本','script'),node('r','角色','setting'),node('p','道具','setting'),node('s','场景','setting'),
  node('episode','分镜组','storyboard'),node('scene','场次分镜组','storyboard'),node('shot','分镜','storyboard'),node('video','镜头视频','storyboard'),node('final','成片','video')],
  edges:[['script','episode'],['episode','scene'],['scene','shot'],['r','shot'],['shot','video'],['video','final']].map(([source,target])=>({id:`${source}-${target}`,source,target}))})

test('资产使用一个组框分类，分镜与镜头视频归组，成片独立保留',()=>{
  const input=graph(),before=structuredClone(input),result=groupProductionGraph('p',1,input)
  assert.deepEqual(result.groups[0].members,['r','p','s'])
  assert.deepEqual(result.groups[0].sections.map(value=>[value.title,value.members]),[['角色',['r']],['道具',['p']],['场景',['s']]])
  assert.deepEqual(result.groups[1].members,['shot','video'])
  assert.ok(result.nodes.some(value=>value.id==='final'))
  assert.ok(!result.nodes.some(value=>['分镜组','场次分镜组'].includes(value.data.kind)))
  assert.deepEqual(input,before)
})
test('容器还原真实来源线，不创造资产与成片的直接关系',()=>{
  const result=groupProductionGraph('p',1,graph())
  assert.ok(result.edges.some(value=>value.source==='script'&&value.target==='shot'))
  assert.ok(result.edges.some(value=>value.source==='video'&&value.target==='final'))
  assert.ok(!result.edges.some(value=>value.source==='r'&&value.target==='final'))
})
test('空阶段没有假组，异常身份及重复成员明确拒绝',()=>{
  assert.deepEqual(groupProductionGraph('p',1,{nodes:[],edges:[]}).groups,[])
  assert.throws(()=>groupProductionGraph('p',0,graph()),/身份与集数/)
  const input=graph();input.nodes.push(input.nodes[0])
  assert.throws(()=>groupProductionGraph('p',1,input),/重复节点/)
})
test('异常分组环不会挂起，也不会跨越真实节点串接业务来源',()=>{
  const input=graph();input.edges.push({id:'cycle',source:'scene',target:'episode'})
  const result=groupProductionGraph('p',1,input)
  assert.equal(result.edges.filter(value=>value.source==='script'&&value.target==='shot').length,1)
  assert.ok(!result.edges.some(value=>value.source==='script'&&value.target==='final'))
})
test('原界面式短剧不能重新挂载独立画布或导入新画布模块',()=>{
  const original=readFileSync('pages/drama/[projectId].vue','utf8')
  assert.doesNotMatch(original,/DramaStoryCanvas|features\/creation\/drama|Teleport/)
})
