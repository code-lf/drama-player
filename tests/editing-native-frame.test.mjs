import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {nativeProject,nativeChanges} from '../features/editing/native-projection.mjs'
import {createNativeFrameDocument} from '../features/editing/native-frame-document.mjs'
const ref={type:'task',task_id:'10000000-0000-0000-0000-000000000001',result_id:'r1'}
const draft={schema_version:3,revision:1,aspect:'16:9',visuals:[
  {id:'v1',kind:'video',source:ref,trim_start_ms:0,trim_end_ms:4000,original_volume:1},
  {id:'i1',kind:'image',source:ref,duration_ms:4000}],audio_tracks:[]}
test('原生秒投影保持帧边界与唯一来源，拒绝临时网络链接',()=>{
  const p=nativeProject(draft)
  assert.deepEqual(p.clips.map(c=>[c.id,c.start,c.duration]),[['v1',0,4],['i1',4,4]])
  assert.equal(p.panSchema,1)
  assert.throws(()=>nativeProject(draft,{v1:'https://private.test/secret'}),/隔离/)
  const audio=nativeProject({...draft,audio_tracks:[{id:'bgm',role:'bgm',source:{type:'library',item_id:ref.task_id,version_id:ref.task_id},
    trim_start_ms:0,trim_end_ms:3000,start_ms:0,volume:.2,repeat_mode:'loop',play_duration_ms:8000}]})
  assert.deepEqual(audio.clips.filter(c=>c.kind==='audio').map(c=>[c.start,c.duration,c.props.volume]),[[0,3,.2],[3,3,.2],[6,2,.2]])
})
test('原生排序/裁切/图片时长编译为同一白名单命令，不发送整项目',()=>{
  const p=nativeProject(draft),c=structuredClone(p)
  c.clips[0].start=5;c.clips[0].in=.4;c.clips[0].duration=3.6
  c.clips[1].start=0;c.clips[1].duration=2
  assert.deepEqual(nativeChanges(draft,p,c),[
    {type:'set_image_duration',clip_id:'i1',duration_ms:2000},
    {type:'trim_video',clip_id:'v1',trim_start_ms:400,trim_end_ms:4000},
    {type:'move_visual',clip_id:'i1',before_id:'v1'}])
  assert.equal(p.clips[0].start,0)
})
test('高级属性/身份/轨道修改、重复身份和非法时间拒绝，不静默丢弃修改',()=>{
  const p=nativeProject(draft)
  for(const mutate of [c=>c.clips[0].props.opacity=.5,c=>c.clips[0].track='V2',c=>c.clips[0].id='other',
    c=>c.clips[0].start=Infinity,c=>c.clips[1].id='v1',c=>c.width=900,c=>c.clips.pop()]){
    const c=structuredClone(p);mutate(c);assert.throws(()=>nativeChanges(draft,p,c))
  }
})
test('第二段拖到首段同一起点时读取移动意图，规范化连续主轨',()=>{
  const p=nativeProject(draft),c=structuredClone(p)
  c.clips[1].start=0
  assert.deepEqual(nativeChanges(draft,p,c),[{type:'move_visual',clip_id:'i1',before_id:'v1'}])
})

test('解码及波形补齐元数据不误拒绝普通裁切，素材身份变化仍拒绝',()=>{
  const p=nativeProject(draft),c=structuredClone(p)
  Object.assign(c.media[0],{width:864,height:496,duration:4.041,channels:2})
  c.clips[0].duration=3.6
  assert.deepEqual(nativeChanges(draft,p,c),[{type:'trim_video',clip_id:'v1',trim_start_ms:0,trim_end_ms:3600}])
  c.media[0].src='blob:null/other'
  assert.throws(()=>nativeChanges(draft,p,c),/素材属性/)
})
test('固定浏览器包无独立保存函数，脚本可解析，srcdoc限制网络且不留外链脚本',()=>{
  const bundle=JSON.parse(readFileSync(new URL('../third-party/fablecut/browser/bundle.json',import.meta.url)))
  assert.equal(Object.keys(bundle.files).length,20)
  for(const [name,source]of Object.entries(bundle.files))new vm.Script(source,{filename:name})
  assert.match(bundle.files['app.js'],/async function saveNow\(\) \{ return false; \}/)
  assert.equal(/\blocalStorage\s*\./.test(bundle.files['app.js']),false)
  const html=createNativeFrameDocument(bundle,'a'.repeat(32),'b'.repeat(32))
  assert.doesNotMatch(html,/<script src=/)
  assert.match(html,/connect-src blob:/)
  assert.match(html,/e.source!==parent/)
  for(const match of html.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g))new vm.Script(match[1])
})

test('画面变换坐标按画幅归一，重新打开投影并保留其他片段',()=>{
  const before=nativeProject(draft),after=structuredClone(before)
  Object.assign(after.clips[0].props,{x:320,y:-72,scale:1.5,rotation:270})
  const operations=nativeChanges(draft,before,after)
  assert.deepEqual(operations,[{type:'set_visual_transform',clip_id:'v1',transform:{x:.25,y:-.1,scale:1.5,rotation:-90}}])
  const updated={...draft,visuals:[{...draft.visuals[0],transform:operations[0].transform},draft.visuals[1]]}
  const projected=nativeProject(updated)
  assert.equal(projected.clips[0].props.x,320)
  assert.equal(projected.clips[0].props.y,-72)
  assert.equal(projected.clips[1].props.rotation,undefined)
})

test('媒体字节和解码迟到都不覆盖拖动，裁切仍提交真实候选',async()=>{
  const bundle=JSON.parse(readFileSync(new URL('../third-party/fablecut/browser/bundle.json',import.meta.url)))
  const html=createNativeFrameDocument(bundle,'a'.repeat(32),'b'.repeat(32))
  const attach=[...html.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)].at(-1)[1]
  const listeners={},messages=[],timers=[];let finish
  const probe=new Promise(resolve=>{finish=resolve})
  // 执行真实隔离接线，仅媒体解码和父窗口消息用夹具，不写实际草稿。
  const context={structuredClone,console,livPending:false,livDragging:false,livChannel:'a'.repeat(32),parent:{},project:null,state:{time:0},
    window:{addEventListener:(type,fn)=>{listeners[type]=fn}},document:{querySelectorAll:()=>[]},URL,ArrayBuffer,Blob,
    setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},
    livSend:(type,payload)=>messages.push({type,payload}),play:()=>{},pause:()=>{},ensureWave:()=>{},grabThumb:async()=>{},rebuildClips:()=>{},
    loadMediaMetadata:()=>probe,applyProject:p=>{context.project=p},projectJSON:()=>structuredClone(context.project)}
  vm.createContext(context);vm.runInContext(attach,context)
  // vm具有独立Array原型；纯JSON的投影由窗口消息接收后再复制。
  const send=(type,payload)=>listeners.message({source:context.parent,data:{version:1,channel:context.livChannel,type,payload}})
  send('projection',draft)
  listeners.pointerdown({button:0,target:{closest:()=>true}})
  context.project.clips[0].duration=3.6
  send('media_bytes',{clip_id:'v1',mime:'video/mp4',bytes:new ArrayBuffer(16)})
  assert.equal(context.project.clips[0].duration,3.6,'拖动途中收到媒体不能重建轨道')
  context.window.__livChanged()
  listeners.pointerup()
  send('media_bytes',{clip_id:'i1',mime:'image/png',bytes:new ArrayBuffer(16)})
  assert.equal(context.project.clips[0].duration,3.6,'松手后等待候选期间也不能重建')
  finish();await Promise.resolve();await Promise.resolve()
  timers[0]()
  const candidate=messages.find(m=>m.type==='edit_candidate')
  assert.ok(candidate,'解码回调不得吞掉当前裁切')
  assert.deepEqual(JSON.parse(JSON.stringify(candidate.payload.operations)),[{type:'trim_video',clip_id:'v1',trim_start_ms:0,trim_end_ms:3600}])
  listeners.pagehide()
})

test('一个片段解码失败仍刷新另一片段，并且错误带精确片段身份',async()=>{
  const bundle=JSON.parse(readFileSync(new URL('../third-party/fablecut/browser/bundle.json',import.meta.url)))
  const html=createNativeFrameDocument(bundle,'a'.repeat(32),'b'.repeat(32))
  const attach=[...html.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)].at(-1)[1]
  const messages=[],listeners={}
  let updated=0,serial=0
  // 使用真实隔离脚本，替换浏览器解码为单坏单好的受控样本。
  const context={structuredClone,console,livPending:false,livDragging:false,livChannel:'a'.repeat(32),parent:{},project:null,state:{time:0},
    window:{addEventListener:(type,fn)=>{listeners[type]=fn}},document:{querySelectorAll:()=>[]},ArrayBuffer,Blob,
    URL:{createObjectURL:()=>`blob:null/test-${++serial}`,revokeObjectURL:()=>{}},
    setTimeout,clearTimeout,livSend:(type,payload)=>messages.push({type,payload}),play:()=>{},pause:()=>{},ensureWave:()=>{},
    grabThumb:async()=>{},rebuildClips:()=>{updated++},loadMediaMetadata:async m=>{if(m.id==='v1')throw new Error('bad video')},
    applyProject:p=>{context.project=p},projectJSON:()=>structuredClone(context.project)}
  vm.createContext(context);vm.runInContext(attach,context)
  const send=(type,payload)=>listeners.message({source:context.parent,data:{version:1,channel:context.livChannel,type,payload}})
  send('projection',draft)
  send('media_bytes',{clip_id:'v1',mime:'video/mp4',bytes:new ArrayBuffer(16)})
  send('media_bytes',{clip_id:'i1',mime:'image/png',bytes:new ArrayBuffer(16)})
  await new Promise(resolve=>setImmediate(resolve))
  assert.ok(updated>0,'图片仍完成刷新')
  assert.equal(messages.find(message=>message.type==='media_decode_failed')?.payload.clip_id,'v1')
  send('media_remove',{clip_id:'v1'})
  assert.equal(context.project.media.find(m=>m.id==='v1').src,'')
  listeners.pagehide()
})
