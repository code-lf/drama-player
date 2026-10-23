// 案例呈现回归：不请求生成、不改分类数据，滚动提示可往返恢复。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const studio=read('features/creation/components/CreationStudio.vue')
test('案例到达视口上半屏隐藏提示，返回上方恢复',()=>{
  const source=studio.match(/function caseBrowseHintVisible\([^}]+\}/)[0]
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const visible=new Function(`${code};return caseBrowseHintVisible`)()
  assert.equal(visible(600,100,800),true)
  assert.equal(visible(500,100,800),false)
  assert.equal(visible(100,100,800),false)
  assert.equal(visible(600,100,800),true)
  assert.equal(visible(600,100,0),false)
  assert.match(studio,/v-show="showCaseBrowseHint"/)
  assert.ok(!studio.includes('<span class="creation-muted">{{item.category_label'))
  assert.match(studio,/aria-label="技能内容分类"/)
})
test('封面放大不改变卡片布局，减少动态效果关闭动画',()=>{
  const css=read('assets/css/creation.css')
  assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)/)
  assert.match(css,/button:hover \.creation-case-cover>img\{transform:scale\(var\(--liv-case-hover-scale\)\)/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.creation-cases \.creation-case-cover>img\{transition:none!important;transform:none!important/)
})
