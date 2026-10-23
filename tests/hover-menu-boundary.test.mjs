// 真实执行边界处理：触发器到传送菜单、子节点切换不能触发关闭，真正离开才延迟关闭。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../features/dashboard/hoverMenuBoundary.ts',import.meta.url),'utf8')
const exports={}
class Node {constructor(inside){this.inside=inside}closest(){return this.inside?this:null}}
new Function('exports','Element',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,Node)
test('悬停从触发器进入菜单与子节点保持打开，离开和空目标才收起，触屏不介入',()=>{
  let keep=0,leave=0
  const handler=exports.hoverMenuBoundary('.trigger,.menu',()=>keep++,()=>leave++)
  handler({type:'pointerout',relatedTarget:new Node(true),pointerType:'mouse'})
  handler({type:'pointerover',target:new Node(true),pointerType:'mouse'})
  assert.equal(keep,2);assert.equal(leave,0)
  handler({type:'pointerout',relatedTarget:new Node(false),pointerType:'mouse'})
  handler({type:'pointerout',relatedTarget:null,pointerType:'mouse'})
  assert.equal(leave,2)
  handler({type:'pointerover',target:new Node(false),pointerType:'touch'})
  assert.equal(leave,2)
})
test('左上角只保留四个创作导航，账单与展开导航不混入',()=>{
  const nav=readFileSync(new URL('../features/creation/components/SessionWorkspaceNav.vue',import.meta.url),'utf8')
  const items=nav.slice(nav.indexOf('const brandItems='),nav.indexOf('// 触发器由'))
  assert.deepEqual([...items.matchAll(/label:'([^']+)'/g)].map(x=>x[1]),['首页','我的项目','资料库','技能'])
  assert.ok(!items.includes('accountBillingLinks'))
})
