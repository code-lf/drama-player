import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const module={exports:{}}
new Function('exports',ts.transpileModule(readFileSync('features/creation/canvasGroups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module.exports)
const {groupBounds,groupMembers,moveGroup,arrangeGroup}=module.exports
const boxes=[{id:'a',x:10,y:20,width:280,height:300},{id:'b',x:450,y:100,width:480,height:240}]

test('固定资产、分镜和成片按展开宽高避让，重复恢复不改已修复布局',()=>{
  const {placeFixedDramaBlocks,PRODUCTION_GROUP_SIZE}=module.exports
  const block=(id,x,y,width,height,sources=[])=>({id,x,y,width,height,sources,members:[{id,x,y,width,height}]})
  const {width,height}=PRODUCTION_GROUP_SIZE
  const blocks=[block('script',80,80,528,860),block('assets',200,80,width,height,['script']),
    block('shots',430,80,width,height,['assets']),block('render',900,80,280,300,['shots'])]
  const obstacles=[block('manual',710,150,280,300)]
  const moved=placeFixedDramaBlocks(blocks,obstacles)
  assert.deepEqual(Object.keys(moved),['assets','shots','render'])
  assert.equal(moved.assets.x,1070)
  assert.equal(moved.shots.x,1070+width+80)
  assert.equal(moved.render.x,1070+2*(width+80))
  const repaired=blocks.map(row=>moved[row.id]?{...row,...moved[row.id],members:row.members.map(member=>({...member,...moved[row.id]}))}:row)
  assert.deepEqual(placeFixedDramaBlocks(repaired,obstacles),{})
})

test('资产组到每集分镜及成片只绘制一条真实来源线',()=>{
  const edges=[['script','role'],['script','scene'],['role','shot1'],['scene','shot1'],['scene','shot2'],['shot1','final'],['shot2','final']]
    .map(([source,target])=>({source,target,data:{lineage:true}}))
  edges.push({source:'role',target:'fake',data:{lineage:false}})
  const groups=[{id:'assets',members:['role','scene'],collapsed:true},{id:'shots',members:['shot1','shot2']}]
  assert.deepEqual(module.exports.productionBoundaryLinks(edges,groups).map(({source,target})=>[source,target]),
    [['script','assets'],['assets','shots'],['shots','final']])
})

test('同一项目的分镜按集固定归组，单镜头也保留分镜组',()=>{
  const layout={}
  const nodes=[1,1,2].map((episodeNo,index)=>({id:`shot:${index}`,data:{productionShot:{projectId:'p',episodeNo}}}))
  assert.equal(module.exports.syncAssetDefinitionGroup(layout,nodes),true)
  assert.deepEqual(layout.groups.map(group=>[group.title,group.members]),[['第 1 集 · 分镜',['shot:0','shot:1']],['第 2 集 · 分镜',['shot:2']]])
  assert.equal(module.exports.syncAssetDefinitionGroup(layout,nodes),false)
})

test('真实资产设定进入同一组，重读不重复、解组不复活，不抢手工组成员',()=>{
  const nodes=['role','scene','prop'].map((category,index)=>({id:`asset:${index}`,data:{productionAsset:{extractionId:'extract-one',category}}}))
  const layout={groups:[{id:'group:manual',title:'人工分组',members:['asset:2']}],auto_group_keys:[]}
  assert.equal(module.exports.syncAssetDefinitionGroup(layout,nodes),true)
  assert.deepEqual(layout.groups[1].members,['asset:0','asset:1'])
  assert.equal(module.exports.syncAssetDefinitionGroup(layout,nodes),false)
  layout.groups=layout.groups.slice(0,1)
  assert.equal(module.exports.syncAssetDefinitionGroup(layout,nodes),false)
})

test('折叠仅隐藏实际成员，保留原布局与真实业务身份',()=>{
  const layout={groups:[{id:'group:a',members:['a','b'],collapsed:true},{id:'group:c',members:['c']}]}
  const before=structuredClone(layout)
  assert.deepEqual([...module.exports.collapsedGroupMembers(layout)],['a','b'])
  assert.deepEqual(layout,before)
  layout.groups[0].collapsed=false
  assert.equal(module.exports.collapsedGroupMembers(layout).size,0)
})

test('拖出自动组保留另一成员且刷新不吸回，拖入目标后边界容纳完整节点',()=>{
  const {dropGroupMembers,syncAutomaticGroups}=module.exports
  const layout={groups:[{id:'group:auto-one',title:'分镜视频',members:['a','b']},{id:'group:target',title:'素材',members:['c']}]}
  const frames=[{id:'group:auto-one',x:0,y:0,width:400,height:400},{id:'group:target',x:600,y:0,width:300,height:400}]
  // 中心进入目标框即可加入，卡片右侧超出时按真实尺寸扩框。
  assert.deepEqual(dropGroupMembers(layout,[{id:'b',x:740,y:80,width:280,height:160}],frames),{changed:true,rejected:[]})
  assert.deepEqual(layout.groups[0].members,['a'])
  assert.deepEqual(layout.groups[0].excluded_members,['b'])
  assert.deepEqual(layout.groups[1].members,['c','b'])
  const enlarged=groupBounds([{id:'c',x:640,y:30,width:100,height:100},{id:'b',x:740,y:80,width:280,height:160}])
  assert.ok(enlarged.x+enlarged.width>1020)
  // 服务端JSON持久化后重新投影同一批任务，明确拖出仍优先。
  const restored=JSON.parse(JSON.stringify(layout))
  syncAutomaticGroups(restored,['a','b'].map(id=>({id,data:{runId:'one',kind:'video'}})),[])
  assert.deepEqual(restored.groups[0].members,['a'])
  // 拖到组外不删除作品、引用或其他布局字段。
  restored.edges=[{source:'a',target:'b'}]
  dropGroupMembers(restored,[{id:'b',x:1200,y:800,width:280,height:160}],frames)
  assert.deepEqual(restored.groups[1].members,['c'])
  assert.deepEqual(restored.edges,[{source:'a',target:'b'}])
})

test('组内移动不改归属，多选逐项落组，满组不抢占原成员，空组移除',()=>{
  const {dropGroupMembers}=module.exports
  const frames=[{id:'group:a',x:0,y:0,width:400,height:400},{id:'group:b',x:600,y:0,width:400,height:400}]
  const value={groups:[{id:'group:a',title:'原组',members:['a']},{id:'group:b',title:'目标',members:['b']}]}
  assert.equal(dropGroupMembers(value,[{id:'a',x:50,y:50,width:100,height:100}],frames).changed,false)
  dropGroupMembers(value,[{id:'a',x:700,y:50,width:100,height:100}],frames)
  assert.equal(value.groups.length,1)
  assert.deepEqual(value.groups[0].members,['b','a'])
  const full={groups:[{id:'group:a',title:'原组',members:['a']},{id:'group:b',title:'满组',members:Array.from({length:200},(_,i)=>`n${i}`)}]}
  assert.deepEqual(dropGroupMembers(full,[{id:'a',x:700,y:50,width:100,height:100}],frames),{changed:false,rejected:['a']})
  assert.deepEqual(full.groups[0].members,['a'])
})

test('业务批次自动归组含真实成片，刷新幂等且解组不会复活，不移动原位置',()=>{
 const {syncAutomaticGroups}=module.exports
 const nodes=['a','b'].map(id=>({id,data:{runId:'batch-real',kind:'video'}}))
 nodes.push({id:'film',data:{kind:'video',source:{kind:'composition',id:'job'}}})
 const edges=['a','b'].map(source=>({source,target:'film'}))
 const layout={positions:{a:{x:30,y:40}},groups:[]}
 assert.equal(syncAutomaticGroups(layout,nodes,edges),true)
 assert.deepEqual(layout.groups[0].members,['a','b','film'])
 assert.equal(syncAutomaticGroups(layout,nodes,edges),false)
 layout.groups=[]
 assert.equal(syncAutomaticGroups(layout,nodes,edges),false)
 assert.deepEqual(layout.positions,{a:{x:30,y:40}})
})

test('自动归组不抢占手动组成员，不混入文本策划或其他批次',()=>{
 const {syncAutomaticGroups}=module.exports
 const layout={groups:[{id:'group:manual',title:'手动',members:['a','b']}]}
 const nodes=['a','b','c','d'].map(id=>({id,data:{runId:id<'c'?'one':'two',kind:'image'}}))
 nodes.push({id:'text',data:{runId:'two',kind:'text'}})
 syncAutomaticGroups(layout,nodes,[])
 assert.equal(layout.groups.length,2)
 assert.deepEqual(layout.groups[0].members,['a','b'])
 assert.deepEqual(layout.groups[1].members,['c','d'])
})

test('分组工具保持屏幕单排尺寸，不受缩远后的组框宽度挤压',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  const header=css.match(/\.creative-group-frame>header\{([^}]+)\}/)?.[1]
  assert.match(header,/width:max-content/)
  assert.ok(!header.includes('max-width:calc(100%'))
  assert.match(css,/\.creative-group-frame>header>button\{[^}]*flex:none;min-height:32px/)
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.match(canvas,/label:'解组'[^\n]*creative-group-menu/)
  assert.match(canvas,/trailing-icon="i-lucide-chevron-down">排序/)
})

test('组框包含真实节点边界与标题空间，不改变节点坐标',()=>{
  const before=structuredClone(boxes)
  assert.deepEqual(groupBounds(boxes),{x:-14,y:-36,width:968,height:400})
  assert.equal(groupBounds([]),undefined);assert.deepEqual(boxes,before)
})
test('移组使用同一位移，极限坐标钳制仍保持组内间距',()=>{
  assert.deepEqual(moveGroup(boxes,100,50),{a:{x:110,y:70},b:{x:550,y:150}})
  const moved=moveGroup(boxes,200000,-200000)
  assert.equal(moved.b.x,100000);assert.equal(moved.a.y,-100000)
  assert.equal(moved.b.x-moved.a.x,440);assert.equal(moved.b.y-moved.a.y,80)
  assert.deepEqual(moveGroup(boxes,Infinity,0),{})
})
test('重新打组不交叉或嵌套，旧组不足两项解散，不触碰费用和引用',()=>{
  const value={groups:[{id:'old',title:'旧组',members:['a','c']}],edges:[{source:'a',target:'b'}],positions:{},permission:{untouched:true}}
  groupMembers(value,['a','a','b'],'new','新组')
  assert.deepEqual(value.groups,[{id:'new',title:'新组',members:['a','b']}])
  assert.deepEqual(value.edges,[{source:'a',target:'b'}]);assert.deepEqual(value.permission,{untouched:true})
  assert.equal(groupMembers(value,['a'],'invalid','不成组'),false)
})
test('水平垂直排版按实际尺寸留间距，不移动其他节点，拒绝越界排版',()=>{
  assert.deepEqual(arrangeGroup(boxes,'horizontal'),{a:{x:10,y:20},b:{x:362,y:20}})
  assert.deepEqual(arrangeGroup(boxes,'vertical'),{a:{x:10,y:20},b:{x:10,y:392}})
  assert.deepEqual(arrangeGroup(boxes.map(n=>({...n,x:99999})),'horizontal'),{})
})
