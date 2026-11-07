// 菜单几何使用真实工具函数；不以此代替浏览器光标位置验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const exports={}
new Function('exports',ts.transpileModule(readFileSync('features/creation/referenceMentionPlacement.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports)
const place=exports.referenceMentionPlacement
test('@菜单贴近真实光标，下方足够时向下，窄屏不越界',()=>{
  const p=place({left:600,top:100,bottom:120},{width:700,height:800},200)
  assert.equal(p.side,'bottom');assert.equal(p.style.top,'126px');assert.equal(p.style.left,'348px');assert.equal(p.style.width,'340px')
  const mobile=place({left:10,top:100,bottom:120},{width:320,height:640},200)
  assert.equal(mobile.style.width,'296px');assert.equal(mobile.style.left,'12px')
})
test('下方不足时向上，按实际高度贴边，异步结果不反转方向',()=>{
  const p=place({left:30,top:600,bottom:620},{width:1000,height:700},120)
  assert.equal(p.side,'top');assert.equal(p.style.top,'474px')
  const shorter=place({left:30,top:600,bottom:620},{width:1000,height:700},60,p.side)
  assert.equal(shorter.style.top,'534px');assert.equal(shorter.side,'top')
})
test('引用列表保留名称与缩略图，移除常驻版本和快捷键脚注',()=>{
  const menu=readFileSync('features/library/components/ReferenceMentionMenu.vue','utf8')
  assert.ok(menu.includes('background:var(--liv-workspace-surface)'))
  assert.ok(menu.includes('background:var(--liv-question-option)'))
  assert.ok(!menu.includes('已加入素材优先'));assert.ok(!menu.includes('← → 分类'))
})
