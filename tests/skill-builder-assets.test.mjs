// 运行真实目录读取方法：本人素材的迟到响应不得显示到另一技能、账号或更新的列表里。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed} from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const panel=readFileSync(new URL('../features/creation/components/SkillCenterPanel.vue',import.meta.url),'utf8')
function setup(){
  const pending=[],errors=[]
  const state={computed,skillMediaResources:()=>[],recipe:{value:{base_code:'image',references:[]}},auth:{session:{user:{id:'owner'}}},rows:{value:[{id:'image',media_types:['image']}]},assetItems:{value:[]},report:e=>errors.push(e.message),libraryService:{list:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),detail:()=>{throw Error('本例未配置固定附件')}}}
  const source=panel.slice(panel.indexOf('let assetReadRevision='),panel.indexOf('function toggleAsset('))
  const run=new Function(...Object.keys(state),ts.transpileModule(source+';return loadAssets',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(state))
  return {state,pending,errors,run}
}
const image={id:'image',media_type:'image'},video={id:'video',media_type:'video'}
test('目录只接受当前基础能力的素材类型',async()=>{const r=setup(),p=r.run();r.pending[0].resolve({items:[image,video]});await p;assert.deepEqual(r.state.assetItems.value,[image])})
test('旧目录不能覆盖更新读取',async()=>{const r=setup(),old=r.run(),fresh=r.run();r.pending[1].resolve({items:[image]});await fresh;r.pending[0].resolve({items:[]});await old;assert.deepEqual(r.state.assetItems.value,[image])})

test('目录第一页之外的已绑定视频按原条目读取，拒绝使用其他版本替代',async()=>{
  const r=setup(),fixed={...video,versions:[{id:'fixed',preview_url:'/fixed'}]}
  r.state.recipe.value.references=[{item_id:'video',version_id:'fixed'}]
  const reads=[];r.state.libraryService.detail=async id=>{reads.push(id);return fixed}
  const p=r.run();r.pending[0].resolve({items:[image]});await p
  assert.deepEqual(reads,['video']);assert.deepEqual(r.state.assetItems.value,[image,fixed])
})
test('切换草稿或账号后不接收私有目录及错误',async()=>{for(const change of ['draft','owner']){const r=setup(),p=r.run();if(change==='draft')r.state.recipe.value={base_code:'image'};else r.state.auth.session.user.id='another';r.pending[0].resolve({items:[image]});await p;assert.deepEqual(r.state.assetItems.value,[])}const r=setup(),p=r.run();r.state.auth.session.user.id='another';r.pending[0].reject(new Error('旧账号错误'));await p;assert.deepEqual(r.errors,[])})

test('引用资产使用真实版本卡片，不显示原始JSON或把缺失信息猜成授权',()=>{
  const filename='features/creation/components/SkillReferenceAssets.vue',source=readFileSync(new URL('../'+filename,import.meta.url),'utf8')
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'reference-assets'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'reference-assets',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.doesNotMatch(panel,/JSON.stringify\(recipe.references/)
  const methods=source.slice(source.indexOf('function selected('),source.indexOf('</script>'))
  const props={items:[{id:'asset',name:'香水商品图',versions:[{id:'fixed',version_no:2}]}],references:[{item_id:'asset',version_id:'fixed'}]}
  const api=new Function('props',ts.transpileModule(methods+';return {detail,selected}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(props)
  assert.deepEqual(api.detail(props.references[0]),{name:'香水商品图',version:'v2'})
  assert.equal(api.selected('fixed'),true);assert.equal(api.selected('new'),false)
  assert.deepEqual(api.detail({item_id:'missing',version_id:'unknown'}),{name:'已固定素材',version:'固定版本 · 信息待核对'})
})
