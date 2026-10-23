// 执行 Logo 的悬停状态方法和延迟清理，保留 Nuxt UI 菜单原有键盘及点击处理。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref} from 'vue'
const source=readFileSync(new URL('../features/creation/components/SessionWorkspaceNav.vue',import.meta.url),'utf8')
test('Logo 悬停立即打开，跨间隙进入菜单取消收起，离开延迟关闭',()=>{
  const code=ts.transpileModule(source.slice(source.indexOf('const brandOpen='),source.indexOf('// Nuxt 菜单内容')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  let next=0,hovered=false;const timers=new Map(),historyOpen=ref(true)
  const menu=new Function('ref','historyOpen','setTimeout','clearTimeout','document',`${code};return {brandOpen,brandPointer,enterBrand,leaveBrand,keepBrand,clearBrand}`)(ref,historyOpen,fn=>{timers.set(++next,fn);return next},id=>timers.delete(id),{querySelector:()=>hovered?{}:null})
  menu.enterBrand();assert.equal(menu.brandOpen.value,true);assert.equal(historyOpen.value,false)
  menu.leaveBrand();assert.equal(menu.brandOpen.value,true);assert.equal(timers.size,1)
  menu.keepBrand();assert.equal(timers.size,0)
  hovered=true;menu.leaveBrand();for(const action of timers.values())action();assert.equal(menu.brandOpen.value,true)
  hovered=false
  menu.leaveBrand();for(const action of timers.values())action();assert.equal(menu.brandOpen.value,false)
  menu.enterBrand();menu.leaveBrand();menu.clearBrand();assert.equal(menu.brandOpen.value,false);assert.equal(timers.size,0)
})
