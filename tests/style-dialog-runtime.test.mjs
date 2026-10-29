// 执行风格弹窗真实过滤、接口及上传逻辑，模型生成不在本测试范围。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{renderToString}=createRequire(require.resolve('vue'))('@vue/server-renderer')
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const filename='features/creation/components/CreationStyleDialog.vue'
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
async function setup(){
  const {descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:'style-dialog-test'}),module={exports:{}}
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'style-dialog-test',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const calls=[],auth=vue.reactive({session:{loggedIn:true,user:{id:'one'}}}),item={id:'own',name:'自定义风格',category:'style',media_type:'image',versions:[{id:'v1',preview_url:'/test.png'}]}
  const service={list:async filters=>{calls.push(['list',filters]);return {items:[item],total:1}},configuration:async()=>({max_upload_bytes:1000,categories:[{code:'style'}]}),upload:async(file,category)=>{calls.push(['upload',file.name,category]);return item},favorite:async(...args)=>calls.push(['favorite',...args]),previewUrl:p=>p}
  const stylesModule={};new Function('exports',transpile(read('shared/constants/dramaVisualStyles.ts')))(stylesModule)
  new Function('require','module','exports','useWorkbenchAuth',transpile(script.content))(name=>name==='vue'?vue:name.includes('dramaVisualStyles')?stylesModule:{libraryService:service},module,module.exports,()=>({auth,requireLogin:()=>auth.session.loggedIn}))
  let b;const component=module.exports.default,original=component.setup
  component.setup=(p,c)=>{b=original(p,c);return b};component.render=()=>vue.h('div')
  const events=[],props={open:true,styles:[{style_id:'a',display_name:'3D喜剧',render_medium:'3D',cover_url:'/public.png'},{style_id:'b',display_name:'电影写实',render_medium:'写实'}],recent:['b'],selected:'',referenceAllowed:true,onReference:item=>events.push(item)}
  await renderToString(vue.createSSRApp(component,props))
  return {b,calls,auth,item,events}
}
test('真实范围、分类与搜索，打开不选择或调用模型',async()=>{
  const {b,events}=await setup()
  assert.equal(b.platform.value.length,2);b.scope.value='recent';assert.equal(b.platform.value[0].style_id,'b')
  b.scope.value='mine';assert.equal(b.platform.value.length,0)
  b.scope.value='all';b.category.value='3D';assert.equal(b.platform.value[0].style_id,'a')
  b.query.value='不存在';assert.equal(b.platform.value.length,0)
  assert.deepEqual(events,[]);assert.deepEqual(b.covers.value,['/public.png'])
})
test('收藏请求真实接口，筛选在服务器分页前处理',async()=>{
  const {b,calls,item}=await setup();b.scope.value='favorite';await b.load()
  assert.equal(calls[0][1].favorite,true);assert.equal(calls[0][1].category,'style');assert.equal(calls[0][1].group,'files')
  await b.favorite(item);assert.equal(item.is_favorite,true);assert.deepEqual(calls.at(-1),['favorite','item','own',true])
})
test('多图片上传沿用资料库style分类，只在显式点击时引用固定版本',async()=>{
  const {b,calls,events}=await setup();await b.configure()
  await b.uploadFiles({target:{files:[{name:'a.png',size:200},{name:'b.webp',size:300}],value:'files'}})
  assert.equal(calls.filter(row=>row[0]==='upload').length,2);assert.equal(b.scope.value,'mine');assert.equal(events.length,0)
  b.selectPersonal(b.rows.value[0]);assert.equal(events[0].versions[0].id,'v1')
})
test('不支持格式与超限图片不发送上传请求',async()=>{
  const {b,calls}=await setup();await b.configure()
  await b.uploadFiles({target:{files:[{name:'script.svg',size:20},{name:'large.png',size:1001}],value:''}})
  assert.equal(calls.filter(row=>row[0]==='upload').length,0);assert.match(b.error.value,/大小限制/)
})
