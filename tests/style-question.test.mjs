import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{renderToString}=createRequire(require.resolve('vue'))('@vue/server-renderer')
const file='features/creation/components/CreationStyleQuestion.vue'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText

test('风格入口真实编译，开关不选择，明确选中才发出同一目录对象',async()=>{
  const {descriptor}=parse(read(file)),script=compileScript(descriptor,{id:'style-question'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:'style-question',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const module={exports:{}},events=[],style={style_id:'real',style_version:2,display_name:'真实风格',cover_url:'/cover.jpg'}
  new Function('require','module','exports','ref','computed',transpile(script.content))(name=>name==='vue'?vue:name.includes('dramaVisualStyles')?{fallbackDramaVisualStyleOptions:[]}:{},module,module.exports,vue.ref,vue.computed)
  const component=module.exports.default,setup=component.setup;let bindings
  component.setup=(p,c)=>{bindings=setup(p,c);return bindings};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,{styles:[style],recommendations:[
    {style_id:'real',style_version:1,reason:'旧版本'},
    {style_id:'missing',style_version:2,reason:'未知项'},
    {style_id:'real',style_version:2,reason:'适合雨夜'},
  ],busy:false,title:'请选择',onSelect:value=>events.push(value),onDescribe:value=>events.push(value)}))
  assert.deepEqual(bindings.recommendations.value,[{style,reason:'适合雨夜',cover:'/cover.jpg'}])
  bindings.open.value=true;bindings.open.value=false
  assert.deepEqual(events,[]);assert.deepEqual(bindings.covers.value,['/cover.jpg'])
  bindings.choose(style);assert.equal(events[0],style)
  bindings.description.value='  暖光和淡彩  ';bindings.submitDescription()
  assert.deepEqual(events,[style,'暖光和淡彩'])
})
