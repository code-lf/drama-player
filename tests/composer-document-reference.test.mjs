// 编译共享输入器真实引用模板，验证文本来源展示；不冒充真实页面尺寸验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {compileTemplate} from 'vue/compiler-sfc'
import * as vue from 'vue'
import {renderToString} from 'vue/server-renderer'
import ts from 'typescript'

const source=readFileSync('features/creation/components/CreationComposer.vue','utf8')
const start=source.indexOf('<div v-for="(reference, index) in references"')
const end=source.indexOf('\n      </div>\n      <div class="creation-editor-wrap"',start)
assert.ok(start>=0&&end>start)
const result=compileTemplate({source:source.slice(start,end),filename:'real-reference.vue',id:'reference-proof'})
assert.deepEqual(result.errors,[])
const output=ts.transpileModule(result.code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const module={exports:{}}
new Function('require','module','exports',output)(()=>vue,module,module.exports)

async function renderReference(nodeEditor,media_type='document'){
 const app=vue.createSSRApp({data:()=>({references:[{media_type,name:'来源文本 <原稿>',version_id:'original',preview_url:'/real.png'}],annotation:null,nodeEditor,busy:false,musicSources:[],parameters:{},isMv:false}),render:module.exports.render})
 app.component('UIcon',{props:['name'],setup:p=>()=>vue.h('i',{'data-icon':p.name})})
 app.component('UButton',{setup:(_,{attrs})=>()=>vue.h('button',attrs)})
 return renderToString(app)
}

test('节点文本引用呈现真实名称和序号，不冒充图片/视频，不提供无效移除按钮',async()=>{
 const html=await renderReference(true)
 assert.match(html,/is-document-card/)
 assert.match(html,/i-lucide-file-text/)
 assert.match(html,/来源文本 &lt;原稿&gt;/)
 assert.match(html,/文本引用 · 1/)
 assert.doesNotMatch(html,/<img|i-lucide-film|<button/)
})

test('聊天文档保留原替换/移除命令，普通图片仍用真实缩略图',async()=>{
 const document=await renderReference(false)
 assert.match(document,/aria-label="替换 来源文本 &lt;原稿&gt;"/)
 assert.match(document,/aria-label="移除 来源文本 &lt;原稿&gt;"/)
 const image=await renderReference(true,'image')
 assert.match(image,/<img src="\/real.png"/)
 assert.doesNotMatch(image,/文本引用 ·/)
})
