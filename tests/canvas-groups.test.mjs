import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const module={exports:{}}
new Function('exports',ts.transpileModule(readFileSync('features/creation/canvasGroups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module.exports)
const {groupBounds,groupMembers,moveGroup,arrangeGroup}=module.exports
const boxes=[{id:'a',x:10,y:20,width:280,height:300},{id:'b',x:450,y:100,width:480,height:240}]

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
