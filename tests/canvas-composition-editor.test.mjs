import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

// 挂载真实节点合成编辑器和片段组件；API仅隔离业务副作用，不冒充媒体/浏览器验收。
function compile(path,deps){
  const raw=readFileSync(path,'utf8'),source=path.endsWith('.vue')?compileScript(parse(raw).descriptor,{id:'compose-canvas',inlineTemplate:true}).content:raw
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText,module={exports:{}}
  const names=['ref','computed','watch','onMounted','onBeforeUnmount','nextTick']
  new Function('require','exports','module',...names,code)(name=>name==='vue'?vue:deps[name]||{},module.exports,module,...names.map(name=>vue[name]))
  return module.exports
}
const storage=new Map()
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
globalThis.document={hidden:false}
const copy=value=>JSON.parse(JSON.stringify(value))
const flush=async()=>{for(let i=0;i<16;i++)await vue.nextTick()}
function mount({bound=false,saved=null,revision=null,loseSaveResponse=false,libraryEnabled=true,musicSources,saveMusic,pickedVideo}={}){
  const calls=[],state={bound,allowSave:true,revision:revision??(saved?1:0),plan:saved,loseSaveResponse}
  const api={
    canvasBinding:async(_,node,create)=>{calls.push(create?'bind':'read-binding');if(create)state.bound=true;return {node_id:node,output_id:state.bound?'out':null}},
    outputDraft:async()=>{calls.push('read-draft');return {revision:state.revision,plan:state.plan}},
    outputJobs:async()=>{calls.push('read-jobs');return []},
    inspect:async()=>{calls.push('inspect');return {duration_ms:6040}},
    saveOutputDraft:async(_,__,revision,plan)=>{assert.equal(revision,state.revision);calls.push('save');state.plan=copy(plan);state.revision++;if(state.loseSaveResponse)throw new Error('保存响应中断');return {revision:state.revision,plan:copy(plan)}},
    createOutputJob:async()=>{calls.push('compose');return {id:'job',status:'queued',plan:copy(state.plan),output:{}}},
  }
  const helpers=compile('features/creation/compositionState.ts',{})
  const service={'~/shared/api/services/videoCompositionService':{videoCompositionService:api}}
  // 选择器仅隔离资料库请求；真实组件的选音、草稿和确认逻辑仍完整挂载。
  const picker={default:{emits:['select','update:open'],setup:(_,{emit})=>()=>vue.h('button',{onClick:()=>emit('select',[pickedVideo||{item:{id:'audio-item',name:'已有声音'},version:{id:'audio-v1',media:{duration_sec:2},preview_url:'/voice.wav'},reference:{item_id:'audio-item',version_id:'audio-v1',purpose:'reference'}}])},'选中测试音频')}}
  const library={libraryService:{capabilities:async()=>({video_picker:libraryEnabled}),detail:async()=>({name:'已有声音',versions:[{id:'audio-v1',preview_url:'/voice.wav'}]}),previewUrl:url=>url,
    saveResult:async(...args)=>{calls.push(['save-music',...args]);return saveMusic?saveMusic():{id:'owned-music',name:'原曲',status:'active',media_type:'audio',versions:[{id:'new-version',version_no:2,media:{duration_sec:20},preview_url:'/changed.wav'},{id:'original-version',version_no:1,media:{duration_sec:8.4},preview_url:'/original.wav'}]}}}}
  const panel=compile('features/creation/components/CreationCompositionPanel.vue',{...service,'../compositionState':helpers,'~/features/library/components/LibraryPicker.vue':picker,'~/shared/api/services/libraryService':library})
  const editor=compile('features/creation/components/CreativeCompositionEditor.vue',{...service,'./CreationCompositionPanel.vue':panel})
  const node=(type,text='')=>({type,text,children:[],props:{},parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('#text',text),createComment:text=>node('#comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el);el.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(index<0?parent.children.length:index,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const inputs=['a','b'].map(id=>({id,data:{kind:'video',title:id,url:'/'+id,source:{kind:'video',id:'task-'+id,result_id:'result-'+id}}}))
  const app=renderer.createApp(musicSources?panel.default:editor.default,musicSources?{sessionId:'session',outputId:'out',sources:[],musicSources}:{sessionId:'session',ownerId:'owner',nodeId:'draft:compose',inputs,beforeSave:async()=>state.allowSave})
  app.component('UButton',{props:['disabled','loading'],setup:(p,{slots,attrs})=>()=>vue.h('button',{...attrs,disabled:p.disabled},slots.default?.())})
  app.component('UTooltip',{props:['text'],setup:(_,{slots})=>()=>slots.default?.()})
  for(const name of ['USelect','UInputNumber','UCheckbox'])app.component(name,{props:['modelValue'],setup:p=>()=>vue.h('field',{value:p.modelValue})})
  const root=node('root'),instance=app.mount(root)
  const all=()=>{const values=[];function walk(el){values.push(el);el.children.forEach(walk)}walk(root);return values}
  const text=el=>el.text+el.children.map(text).join('')
  const click=async(label,index=0)=>{const button=all().filter(el=>el.type==='button'&&text(el)===label)[index];assert.ok(button,'缺少'+label);assert.ok(!button.props.disabled);await button.props.onClick();await flush()}
  return {app,instance,calls,state,root,text,click,all}
}

test('上传视频固定版本加入第二版草稿，保存刷新不采购，原生成片段保留',async()=>{
  storage.clear()
  const saved={schema_version:1,revision:1,clips:[{id:'one',task_id:'a',result_id:'r',trim_start_ms:0,trim_end_ms:800,keep_audio:true}],output:{width:1280,height:720,fps:25,fit:'contain',transition:'cut'}}
  const pickedVideo={item:{id:'upload',name:'本人上传视频',media_type:'video'},version:{id:'upload-v1',media:{duration_sec:1.037}},reference:{item_id:'upload',version_id:'upload-v1',purpose:'reference_video'}}
  const ui=mount({saved,musicSources:[],pickedVideo});await flush()
  try{
    await ui.click('从资料库添加视频');await ui.click('选中测试音频');await ui.click('保存片段计划')
    assert.equal(ui.state.plan.schema_version,2);assert.equal(ui.state.plan.clips.length,2)
    assert.equal(ui.state.plan.clips[1].reference.version_id,'upload-v1')
    assert.equal(ui.state.plan.clips[1].trim_end_ms,1000)
    assert.equal(ui.state.plan.clips[0].task_id,'a');assert.ok(!ui.calls.includes('compose'))
    const restored=mount({saved:copy(ui.state.plan),musicSources:[]});await flush()
    try{assert.match(restored.text(restored.root),/固定版本/);assert.ok(!restored.calls.includes('compose'))}finally{restored.app.unmount()}
  }finally{ui.app.unmount()}
})

test('采用音乐在途不能提交旧计划、重复采用或保存；卸载后迟到结果不回填',async()=>{
  const saved={schema_version:1,revision:1,clips:[{id:'one',task_id:'a',result_id:'r',trim_start_ms:0,trim_end_ms:4040,keep_audio:true}],output:{width:1280,height:720,fps:25,fit:'contain',transition:'cut'}}
  let resolveMusic
  const music=new Promise(resolve=>{resolveMusic=resolve})
  const ui=mount({saved,musicSources:[{key:'song',title:'原曲',source:{kind:'music',id:'task-music',audio_index:0}}],saveMusic:()=>music});await flush()
  const button=label=>ui.all().find(el=>el.type==='button'&&ui.text(el)===label)
  const pending=button('采用《原曲》作为背景音乐').props.onClick();await flush()
  try{
    assert.equal(ui.instance.isBusy(),true)
    assert.equal(button('确认合成当前短片').props.disabled,true)
    assert.equal(button('保存片段计划').props.disabled,true)
    // 即使残留事件晚到，也必须由方法本身防重，而非只依赖disabled样式。
    await button('确认合成当前短片').props.onClick()
    await button('保存片段计划').props.onClick()
    await button('采用《原曲》作为背景音乐').props.onClick()
    assert.ok(!ui.calls.includes('compose')&&!ui.calls.includes('save'))
    assert.equal(ui.calls.filter(Array.isArray).length,1)
  }finally{ui.app.unmount();resolveMusic({id:'audio',name:'原曲',status:'active',media_type:'audio',versions:[{id:'v1',version_no:1,media:{duration_sec:8.4}}]});await pending}
  assert.equal(ui.state.plan.audio_tracks,undefined)
})

test('本会话生成音乐明确采用原始固定版本，不采购也不自动合成',async()=>{
  const saved={schema_version:1,revision:1,clips:[{id:'one',task_id:'a',result_id:'r',trim_start_ms:0,trim_end_ms:4040,keep_audio:true}],output:{width:1280,height:720,fps:25,fit:'contain',transition:'cut'}}
  const ui=mount({saved,musicSources:[{key:'song',title:'原曲',source:{kind:'music',id:'task-music',audio_index:0}}]});await flush()
  try{
    assert.equal(ui.instance.isDirty(),false)
    await ui.click('采用《原曲》作为背景音乐');await ui.click('保存片段计划')
    assert.deepEqual(ui.calls.filter(Array.isArray),[['save-music','music','task-music','0','music']])
    const track=ui.state.plan.audio_tracks[0]
    assert.equal(track.reference.version_id,'original-version');assert.equal(track.volume,.2)
    assert.equal(track.trim_end_ms,4040);assert.equal(ui.state.plan.clips[0].keep_audio,true)
    assert.ok(!ui.calls.includes('compose'))
  }finally{ui.app.unmount()}
})

test('音乐固定失败保留片段，不加入伪造音轨',async()=>{
  const saved={schema_version:1,revision:1,clips:[{id:'one',task_id:'a',result_id:'r',trim_start_ms:0,trim_end_ms:4040,keep_audio:true}],output:{width:1280,height:720,fps:25,fit:'contain',transition:'cut'}}
  const ui=mount({saved,musicSources:[{key:'song',title:'失败曲',source:{kind:'music',id:'task-music',audio_index:0}}],saveMusic:async()=>{throw new Error('音频转存失败')}});await flush()
  try{await ui.click('采用《失败曲》作为背景音乐');assert.match(ui.text(ui.root),/音频转存失败/);assert.equal(ui.instance.isDirty(),false);assert.ok(!ui.calls.includes('compose'))}finally{ui.app.unmount()}
})

test('合成节点只读恢复；保存绑定和片段计划均不执行，明确确认才派发',async()=>{
  storage.clear();const ui=mount();await flush()
  try{
    assert.deepEqual(ui.calls,['read-binding'])
    ui.state.allowSave=false;await ui.click('创建片段计划');assert.ok(!ui.calls.includes('bind'))
    ui.state.allowSave=true;await ui.click('创建片段计划')
    await ui.click('添加片段',0);await ui.click('添加片段',1)
    assert.equal(ui.instance.isDirty(),true)
    await ui.click('保存片段计划')
    assert.equal(ui.instance.isDirty(),false);assert.equal(ui.state.plan.clips.length,2)
    assert.ok(!ui.calls.includes('compose'))
    await ui.click('确认合成当前短片');assert.equal(ui.calls.filter(value=>value==='compose').length,1)
  }finally{ui.app.unmount()}
})

test('已有旁白和BGM随片段计划保存及刷新恢复，不恢复合成授权',async()=>{
  storage.clear()
  const saved={schema_version:1,revision:1,clips:[{id:'one',task_id:'task-a',result_id:'result-a',trim_start_ms:0,trim_end_ms:4000,keep_audio:false}],output:{width:720,height:1280,fps:25,fit:'contain',transition:'cut'},audio_tracks:['narration','bgm'].map(role=>({id:role,role,reference:{item_id:'item-'+role,version_id:'version-'+role},start_ms:0,trim_start_ms:0,trim_end_ms:4000,volume:role==='bgm'?.2:1}))}
  const ui=mount({bound:true,saved});await flush()
  try{
    assert.match(ui.text(ui.root),/声音选择/)
    assert.match(ui.text(ui.root),/选择旁白音频/)
    assert.match(ui.text(ui.root),/选择背景音乐/)
    await ui.click('保存片段计划')
    assert.deepEqual(ui.state.plan.audio_tracks,saved.audio_tracks)
    assert.ok(!ui.calls.includes('compose'))
  }finally{ui.app.unmount()}
  const restored=mount({bound:true,saved});await flush()
  try{assert.equal(restored.instance.isDirty(),false);assert.ok(!restored.calls.includes('compose'))}finally{restored.app.unmount()}
})

test('声音入点和切点越界阻止合成，改短画面不自动修改声音',()=>{
  const {compositionErrors}=compile('features/creation/compositionState.ts',{})
  const plan={clips:[{id:'a',trim_start_ms:0,trim_end_ms:2000}],output:{width:720,height:1280,fps:25,fit:'contain',transition:'cut'},audio_tracks:[{id:'bgm',role:'bgm',reference:{item_id:'audio',version_id:'v1'},start_ms:1000,trim_start_ms:0,trim_end_ms:2000,volume:.2}]}
  assert.match(compositionErrors(plan).join(''),/超出成片时长/)
  assert.equal(plan.audio_tracks[0].trim_end_ms,2000)
  plan.audio_tracks[0].volume=NaN
  assert.match(compositionErrors(plan).join(''),/音量需为/)
})

test('用户分别选择旁白和BGM，保存固定版本，选择本身不提交合成',async()=>{
  storage.clear();const ui=mount({bound:true});await flush()
  try{
    await ui.click('添加片段')
    await ui.click('选择旁白音频');await ui.click('选中测试音频')
    await ui.click('选择背景音乐');await ui.click('选中测试音频')
    await ui.click('保存片段计划')
    assert.deepEqual(ui.state.plan.audio_tracks.map(track=>track.role),['narration','bgm'])
    assert.deepEqual(ui.state.plan.audio_tracks.map(track=>track.volume),[1,.2])
    assert.ok(ui.state.plan.audio_tracks.every(track=>track.reference.version_id==='audio-v1'&&track.trim_end_ms===2000))
    assert.ok(!ui.calls.includes('compose'))
  }finally{ui.app.unmount()}
})

test('资料库入口关闭时不能伪装可选音频，原有片段计划不受影响',async()=>{
  storage.clear();const ui=mount({bound:true,libraryEnabled:false});await flush()
  try{
    await ui.click('添加片段');await ui.click('选择旁白音频')
    assert.match(ui.text(ui.root),/音频资料库入口尚未开放/)
    assert.doesNotMatch(ui.text(ui.root),/选中测试音频/)
    await ui.click('保存片段计划');assert.equal(ui.state.plan.audio_tracks,undefined)
  }finally{ui.app.unmount()}
})

test('未保存片段按账号隔离备份，刷新恢复但不自动合成',async()=>{
  storage.clear();const ui=mount({bound:true});await flush()
  await ui.click('添加片段');ui.app.unmount()
  const key='liv-canvas-composition-v1:owner:session:out'
  assert.equal(JSON.parse(storage.get(key)).plan.clips.length,1)
  const restored=mount({bound:true});await flush()
  try{assert.equal(restored.instance.isDirty(),true);assert.ok(restored.text(restored.root).includes('恢复本机'));assert.ok(!restored.calls.includes('compose'));await restored.click('保存片段计划');assert.equal(storage.has(key),false)}finally{restored.app.unmount()}
})

test('片段顺序显示匹配的来源名称，缺失结果不冒用同任务其他视频',async()=>{
  storage.clear()
  const clip=(id,task,result)=>({id,task_id:task,result_id:result,trim_start_ms:0,trim_end_ms:4000,keep_audio:true})
  const saved={schema_version:1,revision:1,clips:[clip('one','task-b','result-b'),clip('two','task-a','result-a'),clip('missing','task-a','other')],output:{width:720,height:1280,fps:25,fit:'contain',transition:'cut'}}
  const ui=mount({bound:true,saved});await flush()
  try{
    const rendered=ui.text(ui.root)
    assert.match(rendered,/片段 1 · b · 4秒/);assert.match(rendered,/片段 2 · a · 4秒/);assert.match(rendered,/片段 3 · 来源未在当前列表中 · 4秒/)
    assert.match(rendered,/存在已断开来源的片段/)
    // 断开来源时即使旧计划已保存，显式触发保存也不能覆盖或提交合成。
    await ui.click('保存片段计划');assert.ok(!ui.calls.includes('save'));assert.ok(!ui.calls.includes('compose'))
    assert.equal(ui.instance.isDirty(),false)
  }finally{ui.app.unmount()}
})

test('服务端已保存但响应丢失后刷新：同内容采用新修订，其他页面改稿则提示冲突',async()=>{
  storage.clear();const first=mount({bound:true,loseSaveResponse:true});await flush()
  await first.click('添加片段');await first.click('保存片段计划')
  assert.equal(first.state.revision,1);assert.match(first.text(first.root),/保存响应中断/)
  const committed=copy(first.state.plan);first.app.unmount()
  const same=mount({bound:true,saved:committed,revision:1});await flush()
  try{assert.equal(same.instance.isDirty(),false);assert.doesNotMatch(same.text(same.root),/云端片段计划已更新/);assert.ok(!same.calls.includes('save'));assert.ok(!same.calls.includes('compose'))}finally{same.app.unmount()}
  // 模拟另一页面在已保存版本后提交不同切点；不覆盖本机备份。
  storage.set('liv-canvas-composition-v1:owner:session:out',JSON.stringify({base_revision:0,plan:committed}))
  const other=copy(committed);other.clips[0].trim_end_ms=4000
  const conflict=mount({bound:true,saved:other,revision:2});await flush()
  try{assert.match(conflict.text(conflict.root),/云端片段计划已更新，本机编辑仍保留/);assert.ok(!conflict.calls.includes('save'));assert.ok(!conflict.calls.includes('compose'))}finally{conflict.app.unmount()}
})

test('双页面独立备份：另一页保存不能清空或覆盖本页未保存片段',async()=>{
  storage.clear()
  const tabA=new Map(),tabB=new Map()
  const useTab=map=>{globalThis.sessionStorage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}}
  useTab(tabA);const a=mount({bound:true});await flush();await a.click('添加片段',0)
  const first=copy(JSON.parse(tabA.get('liv-canvas-composition-v1:owner:session:out')).plan)
  // 第一页关闭写入备份后，另一页继续编辑和保存不同来源。
  a.app.unmount();useTab(tabB);const b=mount({bound:true});await flush();await b.click('添加片段',1);await b.click('保存片段计划')
  const remote=copy(b.state.plan),revision=b.state.revision;b.app.unmount()
  useTab(tabA);const restored=mount({bound:true,saved:remote,revision});await flush()
  try{
    assert.match(restored.text(restored.root),/云端片段计划已更新，本机编辑仍保留/)
    assert.equal(JSON.parse(tabA.get('liv-canvas-composition-v1:owner:session:out')).plan.clips[0].task_id,first.clips[0].task_id)
    assert.ok(!restored.calls.includes('save'));assert.ok(!restored.calls.includes('compose'))
  }finally{restored.app.unmount();delete globalThis.sessionStorage}
})

test('本页已保存的干净标记阻止刷新误恢复另一页共享草稿',async()=>{
  storage.clear();const tab=new Map()
  globalThis.sessionStorage={getItem:key=>tab.get(key)||null,setItem:(key,value)=>tab.set(key,value),removeItem:key=>tab.delete(key)}
  const first=mount({bound:true});await flush();await first.click('添加片段',0);await first.click('保存片段计划')
  const committed=copy(first.state.plan),revision=first.state.revision;first.app.unmount()
  const other=copy(committed);other.clips[0].trim_end_ms=4000
  storage.set('liv-canvas-composition-v1:owner:session:out',JSON.stringify({base_revision:revision,plan:other}))
  const restored=mount({bound:true,saved:committed,revision});await flush()
  try{assert.equal(restored.instance.isDirty(),false);assert.doesNotMatch(restored.text(restored.root),/恢复本机未保存片段/);assert.match(restored.text(restored.root),/6.04秒/);assert.ok(!restored.calls.includes('save'))}finally{restored.app.unmount();delete globalThis.sessionStorage}
})
