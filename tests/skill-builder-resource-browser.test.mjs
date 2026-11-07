// 执行真实组件脚本，核对搜索、编辑和固定版本选择，不能仅凭模板编译认定交互通过。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse} from 'vue/compiler-sfc'

function setup(name,initial,bindings){
  const source=readFileSync(`features/creation/components/${name}.vue`,'utf8')
  const {descriptor}=parse(source),props=vue.reactive(initial),events=[]
  const emit=(event,...args)=>{
    events.push([event,...args])
    if(event==='update:modelValue')props.modelValue=args[0]
    if(event==='toggle')props.references=[...props.references,{item_id:args[0].id,version_id:args[1].id,purpose:'reference'}]
    if(event==='remove')props.references=props.references.filter(row=>row.version_id!==args[0])
  }
  const code=ts.transpileModule(descriptor.scriptSetup.content+`;return {${bindings}}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const api=new Function('require','exports','defineProps','defineEmits',code)(name=>name==='vue'?vue:{default:{}},{},()=>props,()=>emit)
  return {api,props,events,source}
}

test('资源搜索不改列表、选择与正文；改名和正文沿原更新事件保存',()=>{
  const r=setup('SkillTextResources',{modelValue:[{name:'guide.md',content:'原文'},{name:'方法.txt',content:'指南'}],busy:false},'query,filtered,current,selected,update,add')
  r.api.query.value='方法';assert.equal(r.api.filtered.value.length,1);assert.equal(r.api.current.value.content,'原文');assert.equal(r.props.modelValue.length,2)
  r.api.selected.value=1;r.api.update({content:'修改后的指南'});assert.equal(r.props.modelValue[1].content,'修改后的指南');assert.equal(r.props.modelValue[0].content,'原文')
  r.api.add();assert.equal(r.api.query.value,'');assert.equal(r.props.modelValue[2].name,'guide_3.md')
})

test('资源移除必须确认，确认时被替换的资源不误删；忙碌时不可写',()=>{
  const r=setup('SkillTextResources',{modelValue:[{name:'guide.md',content:'原文'}],busy:false},'requestRemove,remove,removeOpen,error,update,add')
  r.api.requestRemove();assert.equal(r.api.removeOpen.value,true);r.props.modelValue=[{name:'guide.md',content:'助手新稿'}];r.api.remove()
  assert.equal(r.props.modelValue[0].content,'助手新稿');assert.match(r.api.error.value,/已更新/)
  r.props.busy=true;r.api.update({content:'不应保存'});r.api.add();assert.equal(r.props.modelValue.length,1);assert.equal(r.props.modelValue[0].content,'助手新稿')
  r.props.busy=false;r.api.requestRemove();r.api.remove();assert.equal(r.props.modelValue.length,0)
})

test('引用资产批量选择保持12项上限，再次点击可取消；不丢目录外固定引用',()=>{
  const items=Array.from({length:20},(_,i)=>({id:`asset-${i}`,versions:[{id:`version-${i}`,version_no:1}]}))
  const r=setup('SkillReferenceAssets',{items,references:[{item_id:'missing',version_id:'fixed'}],busy:false},'toggleAll,missing,total,allSelected')
  assert.equal(r.api.total.value,21);assert.equal(r.api.missing.value.length,1)
  r.api.toggleAll(true);assert.equal(r.props.references.length,12);assert.equal(r.props.references[0].version_id,'fixed');assert.equal(r.api.allSelected.value,false)
  r.api.toggleAll(true);assert.equal(r.props.references.length,0)
  r.props.busy=true;r.api.toggleAll(true);assert.equal(r.props.references.length,0)
})

test('空资源与空引用保留居中空态，复用组件而非原生勾选和原始JSON',()=>{
  const r=setup('SkillReferenceAssets',{items:[],references:[],busy:false},'total,allSelected')
  assert.equal(r.api.total.value,0);assert.equal(r.api.allSelected.value,false)
  assert.match(r.source,/当前 Skill 没有可引用的资产/);assert.match(r.source,/UCheckbox/);assert.doesNotMatch(r.source,/type="checkbox"|JSON.stringify/)
})

test('图片视频附件只切换真实固定预览，搜索不改正文，不自动播放或改写素材',async()=>{
  const r=setup('SkillTextResources',{modelValue:[{name:'guide.md',content:'原指南'}],busy:false,mediaResources:[{id:'image-v1',name:'参考图',kind:'image',url:'/private/image'},{id:'video-v2',name:'原视频',kind:'video',url:'/private/video'}]},'selectedMedia,currentMedia,filteredMedia,query,selectMedia,failedMedia,add')
  r.api.selectMedia('video-v2');assert.equal(r.api.currentMedia.value.url,'/private/video')
  r.api.query.value='图';assert.equal(r.api.filteredMedia.value.length,1);assert.equal(r.api.currentMedia.value.id,'video-v2')
  assert.equal(r.props.modelValue[0].content,'原指南');assert.equal(r.events.length,0)
  assert.match(r.source,/<video v-else :src="currentMedia.url" controls preload="metadata"/)
  assert.doesNotMatch(r.source,/autoplay|v-html/)
  r.props.mediaResources=[];await vue.nextTick();assert.equal(r.api.selectedMedia.value,'')
  r.api.add();assert.equal(r.props.modelValue.length,2)
})

test('附件解析仅匹配已绑定版本，缺版本不替换最新，其他目录图片不混入',()=>{
  const source=readFileSync('features/creation/skillMediaResources.ts','utf8')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const exports={};new Function('exports',code)(exports)
  const items=[{id:'a',media_type:'image',name:'图',versions:[{id:'old',preview_url:'/old'},{id:'new',preview_url:'/new'}]},{id:'b',media_type:'video',name:'视频',versions:[{id:'video',preview_url:'/video'}]},{id:'other',media_type:'image',name:'其他',versions:[{id:'other',preview_url:'/other'}]}]
  assert.deepEqual(exports.skillMediaResources(items,[{item_id:'a',version_id:'old'}]),[{id:'old',name:'图',kind:'image',url:'/old'}])
  assert.deepEqual(exports.skillMediaResources(items,[{item_id:'a',version_id:'missing'}]),[])
  assert.equal(exports.skillMediaResources(items,[{item_id:'b',version_id:'video'}])[0].kind,'video')
})
