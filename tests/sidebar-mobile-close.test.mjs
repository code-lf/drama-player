// 侧栏关闭键跟随侧栏自身右边缘，不能再次使用左上角展开按钮覆盖品牌图。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
// 跟随仓库 Vue 依赖解析编译器，不额外安装或要求提升间接依赖。
const require=createRequire(import.meta.url)
const {parse,compileScript,compileTemplate}=createRequire(require.resolve('vue'))('@vue/compiler-sfc')
const filename='features/dashboard/components/DashboardSidebar.vue'
const source=readFileSync(new URL('../'+filename,import.meta.url),'utf8')
test('移动导航展开入口与关闭键分离，关闭键在侧栏内且支持焦点和Escape恢复',()=>{
  assert.match(source,/v-show="!mobileOpen" ref="mobileMenuTrigger"/)
  assert.ok(source.indexOf('aria-label="关闭创作导航"')>source.indexOf('<aside ref="mobileSidebar"'))
  assert.match(source,/\.creation-sidebar-close\{position:absolute;top:13px;right:12px/)
  assert.ok(source.includes('@keydown.esc="mobileOpen=false"'))
  assert.ok(source.includes('mobileMenuTrigger.value?.focus()'))
})
test('侧栏脚本和模板编译通过',()=>{
  const {descriptor}=parse(source,{filename})
  const script=compileScript(descriptor,{id:'sidebar-close-test'})
  const result=compileTemplate({source:descriptor.template.content,filename,id:'sidebar-close-test',compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(result.errors,[])
})
