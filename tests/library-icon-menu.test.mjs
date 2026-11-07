import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
test('生成星芒使用统一实心SVG而不改变积分图标',()=>{
 const svg=read('public/icons/liv-generate.svg')
 assert.match(svg,/viewBox="0 0 24 24"/)
 assert.match(svg,/fill="currentColor"/)
 assert.doesNotMatch(svg,/stroke=/)
 assert.match(read('assets/css/liv-icon-menu.css'),/lucide.*sparkles/)
 assert.match(read('nuxt.config.ts'),/liv-icon-menu.css/)
})
test('资料库传送菜单明确约束中性背景及同色图标',()=>{
 const css=read('assets/css/liv-icon-menu.css')
 assert.match(css,/\.asset-library-menu/)
 assert.match(css,/min-width:176px/)
 assert.match(css,/background:var\(--liv-project-hover\)/)
 assert.match(css,/color:inherit!important/)
 assert.match(css,/color:var\(--color-state-danger\)/)
})
