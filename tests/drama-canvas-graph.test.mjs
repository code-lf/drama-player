import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

// 执行正式投影模块，不伪造端到端生成任务。
const source = readFileSync(new URL('../features/creation/drama/projection/dramaCanvasGraph.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {buildDramaCanvas} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const project = {
  projectId: 'p', title: '短剧', sourceScriptText: '原稿', analysisRun: {status:'running'},
  analysis: {episodeDetails:[], scriptScenes:[{episodeNo:1,sceneId:'s1',title:'夜晚',content:'剧本'}],
    confirmedScriptVersionId:'script-v2', roles:[],scenes:[],props:[]},
  storyboards:[{episodeNo:1,id:'r1',sortIndex:1,shotNo:1,sourceSceneIds:['s1'],roleKeys:['a'],sceneKeys:[],propKeys:[],
    selectedTakeId:'new',takes:[{id:'old',versionNo:1,status:'completed',videoUrl:'/v1.mp4'},{id:'new',versionNo:2,status:'completed',videoUrl:'/v2.mp4'}]},
    {episodeNo:2,id:'r2',sortIndex:1,shotNo:1,sourceSceneIds:[],roleKeys:[],sceneKeys:[],propKeys:[],takes:[]}],
}

test('画布从正式资产、剧本场次与冻结镜头建立真实关系，不串集', () => {
  const assets = {project_id:'p',assets:[{asset_type:'role',asset_key:'a',name:'角色A',source_script_version:'script-v2',
    production_status:'locked', selected_asset_id:'v2',versions:[{id:'v1',image_url:'/a1.jpg'},{id:'v2',image_url:'/a2.jpg'}]}]}
  const exports = [{id:'job',projectId:'p',episodeNo:1,taskType:'render',status:'completed',outputUrl:'/final.mp4',
    renderSources:[{rowId:'r1',takeId:'old'}]},
    {id:'other',projectId:'other',episodeNo:1,taskType:'render',status:'completed'},
    {id:'ep2',projectId:'p',episodeNo:2,taskType:'render',status:'completed'}]
  const graph = buildDramaCanvas(project,1,exports,assets)
  const nodes = new Map(graph.nodes.map(node=>[node.id,node.data]))
  const linked = (source,target) => graph.edges.some(edge=>edge.source===source&&edge.target===target)
  assert.equal(nodes.get('asset:role:a').image,'/a2.jpg')
  assert.equal(nodes.get('render:job').video,'/final.mp4')
  assert.ok(linked('script','asset:role:a'))
  assert.ok(linked('script-scene:s1','shot-group:1:s1'))
  assert.ok(linked('shot-group:1:s1','shot:r1'))
  assert.ok(linked('asset:role:a','shot:r1'))
  assert.ok(linked('video:r1:old','render:job'))
  assert.ok(!linked('video:r1:new','render:job'))
  for (const id of ['shot:r2','render:other','render:ep2']) assert.ok(!nodes.has(id))
})

test('预演入口只开放未提交镜头，处理中与已有结果不重复确认', () => {
  for (const [state,url,video,allowed] of [['not_started','','',true],['queued','','',false],
    ['running','','',false],['succeeded','/preview.png','',false],['failed','','',true],['not_started','','/video.mp4',false]]) {
    const row={...project.storyboards[0],previsualizationStatus:state,previsualizationUrl:url,videoUrl:video}
    const graph=buildDramaCanvas({...project,storyboards:[row]},1)
    assert.equal(graph.nodes.find(node=>node.id===`shot:${row.id}`).data.canPrevisualize,allowed)
  }
})

test('失败导出不显示成片，历史缺失选版不连到新视频', () => {
  const graph = buildDramaCanvas(project,1,[{id:'failed',projectId:'p',episodeNo:1,taskType:'render',status:'failed',
    outputUrl:'/temporary.mp4',renderSources:[{rowId:'r1',takeId:'missing'}]}])
  const failed = graph.nodes.find(node=>node.id==='render:failed').data
  assert.equal(failed.state,'失败')
  assert.equal(failed.video,undefined)
  assert.ok(!graph.edges.some(edge=>edge.target==='render:failed'))
})

test('资产节点保留稳定定位及设定出处，补充设计与剧本事实不混写', () => {
  const assets = {project_id:'p',assets:[{asset_type:'role',asset_key:'a',name:'角色A',source_script_version:'script-v2',
    production_status:'planned',versions:[],source_refs:[{scene_id:'s1'}],
    data:{appearance:'灰色外套',personality:'谨慎',prompt:'夜景人物设计',_field_sources:{appearance:'script',personality:'ai_completion'},_private:'不可展示'}}]}
  const card = buildDramaCanvas(project,1,[],assets).nodes.find(node=>node.id==='asset:role:a').data
  assert.equal(card.rowId,'role:a')
  assert.match(card.detail,/外观（剧本）：灰色外套/)
  assert.match(card.detail,/性格（补充设计）：谨慎/)
  assert.equal(card.design,'夜景人物设计')
  assert.equal(card.sourceCount,1)
  assert.ok(!JSON.stringify(card).includes('不可展示'))
})
