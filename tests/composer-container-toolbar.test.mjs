// 容器断点与组件编译回归；真实浏览器布局验收另行报告。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileStyle} from 'vue/compiler-sfc'
const source=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8')
test('会话工具文字跟随输入框容器宽度，分级恢复工具和参数',()=>{
  assert.match(source,/container-name:creation-composer/)
  assert.match(source,/@container creation-composer \(min-width:640px\)/)
  assert.match(source,/@container creation-composer \(min-width:820px\)/)
  assert.match(source,/creation-tool-label\{display:block!important;overflow:hidden;text-overflow:ellipsis/)
  const {descriptor}=parse(source)
  for(const style of descriptor.styles){
    assert.deepEqual(compileStyle({source:style.content,filename:'CreationComposer.vue',id:'toolbar',scoped:style.scoped}).errors,[])
  }
})
