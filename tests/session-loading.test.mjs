// 真实编译公共加载组件，普通会话不再渲染旧分栏；首页/短剧占位合同保留。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript} from 'vue/compiler-sfc'
import * as vue from 'vue'
import {renderToString} from 'vue/server-renderer'
import ts from 'typescript'
const source=readFileSync('components/DashboardSkeleton.vue','utf8')
const compiled=compileScript(parse(source).descriptor,{id:'session-loading',inlineTemplate:true})
const output=ts.transpileModule(compiled.content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const module={exports:{}}
new Function('require','module','exports',output)(()=>vue,module,module.exports)
async function render(props){
 const app=vue.createSSRApp(module.exports.default,props)
 app.component('USkeleton',{setup:(_,{attrs})=>()=>vue.h('div',{'data-skeleton':'true',...attrs})})
 return renderToString(app)
}
test('普通会话未知/媒体布局均只显示双点，不出现旧骨架与价格占位',async()=>{
 for(const layout of ['unknown','conversation','media']){
  const html=await render({variant:'conversation',simple:true,layout})
  assert.match(html,/workspace-loading-dots/)
  assert.match(html,/正在加载会话/)
  assert.doesNotMatch(html,/data-skeleton|dashboard-skeleton-chat|dashboard-skeleton-canvas/)
 }
 assert.ok(source.includes('prefers-reduced-motion:reduce'))
})
test('首页和原非简洁会话仍使用原骨架，不扩大到短剧/后台工具',async()=>{
 assert.match(await render({variant:'home'}),/home-skeleton-composer/)
 assert.match(await render({variant:'conversation',layout:'media'}),/dashboard-skeleton-chat/)
 const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
 assert.ok(studio.includes(':simple="entry!==\'drama\'"'))
 assert.match(studio, /#fallback><DashboardSkeleton variant="conversation" :simple="entry!=='drama'" layout="media"/)
 const page=readFileSync('pages/dashboard.vue','utf8')
 assert.ok(page.includes(':simple="activeWorkspaceView===\'console\'&&!!route.query.session"'))
})
