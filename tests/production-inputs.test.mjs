// 运行纯输入逻辑与真实 Vue 模板编译；不创建收费媒体任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import * as vue from 'vue'
import {createRequire} from 'node:module'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const require=createRequire(import.meta.url)
const {renderToString}=createRequire(require.resolve('vue'))('@vue/server-renderer')
const helper=ts.transpileModule(read('features/creation/submittedReferences.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {remainingReferences,mergeRoundReferences,submittedTextSegments}=await import(`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`)
test('接收响应只移走本次对象，不清理新增或同版本替换',()=>{
  const sent={version_id:'a'},replacement={version_id:'a'},newer={version_id:'b'}
  assert.deepEqual(remainingReferences([sent,replacement,newer],[sent]),[replacement,newer])
  assert.deepEqual(mergeRoundReferences([sent],[replacement,newer]),[replacement,newer])
  assert.deepEqual(submittedTextSegments([{type:'reference',version_id:'a',label:'@原图'}],[]),[{type:'text',text:'@原图'}])
})
for(const path of ['features/creation/components/CreationStudio.vue','features/creation/components/CreationComposer.vue','features/creation/components/CreationRunAttachments.vue'])test(`${path} 初始化与模板编译`,()=>{
  const {descriptor,errors}=parse(read(path));assert.deepEqual(errors,[])
  const script=compileScript(descriptor,{id:path})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
test('多图真实组件渲染缩略图按钮，点击只调用工作台预览事件',async()=>{
  const {descriptor}=parse(read('features/creation/components/CreationRunAttachments.vue'))
  const script=compileScript(descriptor,{id:'attachment-runtime',inlineTemplate:true})
  const code=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(name=>name==='vue'?vue:{libraryService:{previewUrl:value=>value}},module,module.exports)
  const props={draft:{references:[{version_id:'one'},{version_id:'two'}],reference_names:{}},previews:{one:{available:true,media_type:'image',name:'第一张',preview_url:'/one.png'},two:{available:true,media_type:'image',name:'第二张',preview_url:'/two.png'}}}
  const html=await renderToString(vue.createSSRApp(module.exports.default,props))
  assert.match(html,/is-multiple/)
  assert.equal((html.match(/<button/g)||[]).length,2)
  assert.doesNotMatch(html,/<a |target="_blank"/)
  assert.match(html,/预览 第一张/)
})

test('文字续聊气泡不重复带出沿用图片，显式重新附图仍正常展示',async()=>{
  const {descriptor}=parse(read('features/creation/components/CreationRunAttachments.vue'))
  const script=compileScript(descriptor,{id:'message-attachment-source',inlineTemplate:true})
  const code=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(name=>name==='vue'?vue:{libraryService:{previewUrl:value=>value}},module,module.exports)
  const draft={references:[{version_id:'old'},{version_id:'new'}],reference_names:{old:'沿用素材',new:'本次新图'}}
  const previews={old:{available:true,media_type:'image',name:'沿用素材',preview_url:'/old.png'},new:{available:true,media_type:'image',name:'本次新图',preview_url:'/new.png'}}
  const render=versions=>renderToString(vue.createSSRApp(module.exports.default,{run:{draft,reference_previews:previews,message_reference_versions:versions}}))
  assert.doesNotMatch(await render([]),/<button|<img/)
  const one=await render(['new'])
  assert.match(one,/new.png/);assert.doesNotMatch(one,/old.png/)
  assert.match(await render(['old']),/old.png/) // 用户明确重附同图，不因版本相同吞附件。
  assert.equal(draft.references.length,2) // 展示过滤不清除实际执行引用。
  assert.equal((await render(undefined)).match(/<button/g).length,2)
})
