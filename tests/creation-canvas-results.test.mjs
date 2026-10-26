// 使用纯函数验证，不请求文字模型或收费生成接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed} from 'vue'
async function load(file){const source=readFileSync(new URL('../features/creation/'+file,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
const {zoomAt,modelDisplayName}=await load('canvasNavigation.ts')
const {sessionResults,hasRenderableResult,processingResults,processingFileId,playableMusicSong,readyResult}=await load('resultCatalog.ts')

test('多图/视频保留原槽位，第一项无文件或空值不吞掉后续成功产物',()=>{
  for(const kind of ['image','video']){
    const message={id:'m',created_at:'1',task_type:kind,task_id:'task',content:{prompt:'两份独立商品画面'}}
    const key=kind==='image'?'images':'video',urlKey=kind==='image'?'imageUrl':'videoUrl'
    const tasks={m:{[key]:{id:'task',status:'completed',results:[null,{id:'second',status:'succeeded',[urlKey]:'/second'},{id:'failed',status:'failed',[urlKey]:'/failed'}]}}}
    const results=sessionResults([message],tasks)
    assert.equal(results.length,1);assert.equal(results[0].taskResultIndex,1);assert.equal(results[0].source.result_id,'second')
    assert.equal(hasRenderableResult(tasks.m),true)
    tasks.m[key].results=[null];assert.equal(hasRenderableResult(tasks.m),false)
  }
})

test('真实作品版本计算也拒绝失败曲目，保留第二首歌词与原序号，失败任务不暴露处理URL',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const code=ts.transpileModule(studio.slice(studio.indexOf('const canvasVersions='),studio.indexOf('const musicToolOptions=')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  for(const status of ['completed','failed','processing']){
    const sourceTask={value:{id:'music',status}},fixture={computed,playableMusicSong,readyResult,activeResult:{value:{music:sourceTask.value}},sourceTask,songs:{value:[{status:'failed',audio_url:'/old.mp3'},{status:'completed',audio_url:'/good.mp3',lyrics:'第二首歌词'}]},mediaLinks:{value:[]},allResults:{value:[]},resultGroup:{value:''},focused:{value:{id:'message'}},session:{value:{artifacts:[]}},canvasSelected:{value:''},libraryService:{}}
    const result=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return canvasVersions.value`)(fixture)
    assert.equal(result.length,status==='completed'?1:0)
    if(result.length){assert.equal(result[0].source.audio_index,1);assert.equal(result[0].lyrics,'第二首歌词')}
    fixture.songs={value:[]};fixture.mediaLinks={value:[{id:'media:fixed',url:'/old.wav',video:false}]}
    const processed=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return canvasVersions.value`)(fixture)
    assert.equal(processed.length,status==='completed'?1:0)
    fixture.activeResult={value:{images:{id:'image',status,results:[{id:'old',status:'failed',imageUrl:'/old.png'},{id:'good',status:'succeeded',imageUrl:'/good.png'},null]},video:{id:'video',status,results:[{id:'old',status:'failed',videoUrl:'/old.mp4'},{id:'good',status:'succeeded',videoUrl:'/good.mp4'},null]}}}
    fixture.sourceTask={value:null};fixture.mediaLinks={value:[]}
    const media=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return canvasVersions.value`)(fixture)
    assert.equal(media.length,status==='completed'?2:0)
    if(media.length)assert.deepEqual(media.map(v=>v.key),['good','good'])
  }
})

test('音乐部分失败不展示残留文件，成功歌曲保留真实序号；空条目不使目录崩溃',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes('for(const [index,song] of songs.value.entries())if(playableMusicSong(song))'))
  assert.ok(studio.includes("sourceTask.value&&['completed','succeeded','success'].includes(sourceTask.value.status)"))
  const messages=[{id:'m',created_at:'1',task_type:'music',task_id:'music',content:{prompt:'两首配乐'}}]
  for(const status of ['queued','running','failed','needs_review']){
    const music={id:'music',status:'completed',result:{music:[{status,audio_url:'https://example.test/old.mp3'}]}}
    assert.equal(hasRenderableResult({music}),false)
    assert.deepEqual(sessionResults(messages,{m:{music}}),[])
  }
  const music={id:'music',status:'completed',result:{music:[{status:'failed',audio_url:'https://example.test/old.mp3'},{status:'completed',audio_url:'https://example.test/second.mp3'},null]}}
  const result=sessionResults(messages,{m:{music}})
  assert.equal(result.length,1);assert.equal(result[0].source.audio_index,1)
  assert.equal(hasRenderableResult({music}),true)
})

test('嵌套处理分支只读取真实成功文件，不误把数值HTTP状态当失败',()=>{
  const result={status:200,data:{failed:{status:'failed',audio_url:'https://example.test/old.wav'},pending:{status:'processing',video_url:'https://example.test/pending.mp4'},ready:{status:'completed',audio_url:'https://example.test/done.wav'}}}
  assert.deepEqual(processingResults(result).map(v=>v.url),['https://example.test/done.wav'])
  assert.equal(processingResults(result)[0].id,processingFileId(['data','ready','audio_url']))
})

test('同音乐任务多份处理结果来源独立，JSON字段重排不改变身份或版本顺序',()=>{
  // 与后端使用同一向量证明编码合同，不把JSON引号混进图形库节点编号。
  assert.equal(processingFileId(['data','stems',1,'audio_url']),'media:WyJkYXRhIiwic3RlbXMiLDEsImF1ZGlvX3VybCJd')
  const result={stems:[{audio_url:'https://example.test/vocal.wav'},{audio_url:'https://example.test/accompaniment.wav'}],video_url:'https://example.test/lyrics.mp4',cover_url:'https://example.test/cover.png'}
  const reordered={video_url:result.video_url,cover_url:result.cover_url,stems:result.stems}
  assert.deepEqual(processingResults(result),processingResults(reordered))
  const messages=[{id:'m',created_at:'1',task_type:'music',task_id:'processed',content:{prompt:'分轨与歌词视频'}}]
  const values=sessionResults(messages,{m:{music:{id:'processed',result}}})
  assert.equal(values.length,3);assert.equal(new Set(values.map(value=>value.source.result_id)).size,3)
  assert.equal(Buffer.from(values[1].source.result_id.slice(6),'base64url').toString(),'["stems",1,"audio_url"]')
  assert.ok(values.every(value=>/^media:[A-Za-z0-9_-]+$/.test(value.source.result_id)))
  assert.ok(values.every(value=>value.source.audio_index===undefined&&value.versionKey===value.source.result_id))
  assert.deepEqual(values.map(value=>value.kind),['audio','audio','video'])
})

test('失败或未完成任务的残留文件不显示为完成作品，实际成功后才回填',()=>{
  const messages=[{id:'m',created_at:'1',content:{prompt:'生成作品'}}]
  for(const status of ['queued','running','failed','needs_review']){
    const task={music:{id:'m',status,result:{audio_url:'https://example.test/stem.wav'}},images:{id:'i',status,results:[{id:'image',status:'success',imageUrl:'/old.png'}]},video:{id:'v',status,results:[{id:'video',status:'succeeded',videoUrl:'/old.mp4'}]}}
    assert.equal(hasRenderableResult(task),false);assert.deepEqual(sessionResults(messages,{m:task}),[])
  }
  const done={music:{id:'m',status:'completed',result:{audio_url:'https://example.test/stem.wav'}}}
  assert.equal(hasRenderableResult(done),true);assert.equal(sessionResults(messages,{m:done}).length,1)
})

test('复用作品工具弹窗时画布必须占满正文，不能按 size 容器固有宽度缩成一列',()=>{
  // 静态契约防止 flex 子项回归；图片真实可见、旋转和撤销另由浏览器验收。
  const css=readFileSync(new URL('../assets/css/creative-canvas.css',import.meta.url),'utf8')
  assert.match(css,/\.creative-tools-dialog-body>\.liv-canvas\{flex:1 1 0%;width:100%;min-width:0\}/)
})
test('滚轮缩放方向、上下界及鼠标锚点保持一致',()=>{
  const result=zoomAt(100,{x:10,y:20},{x:80,y:60},-100)
  assert.ok(result.zoom>100)
  assert.ok(Math.abs((80-result.pan.x)/(result.zoom/100)-70)<1e-8)
  assert.equal(zoomAt(400,{x:0,y:0},{x:0,y:0},-9999).zoom,400)
  assert.equal(zoomAt(25,{x:0,y:0},{x:0,y:0},9999).zoom,25)
  assert.equal(modelDisplayName('Seedance (ToAPIs)'),'Seedance')
})
test('图片视频音频按消息顺序归集，同一来源去重，不混入编辑版本',()=>{
  const message=(id,time)=>({id,created_at:time,content:{prompt:id}})
  const tasks={a:{images:{id:'i',results:[{id:'i1',imageUrl:'image'},{id:'i2',imageUrl:'image2'}]}},b:{video:{id:'v',results:[{id:'v1',videoUrl:'video',coverUrl:'cover'}]}},c:{music:{id:'m',result:{music:[{audio_url:'audio'}]}}}}
  const results=sessionResults([message('c','3'),message('a','1'),message('b','2'),message('a','1')],tasks)
  assert.deepEqual(results.map(v=>v.kind),['image','image','video','audio'])
  assert.equal(new Set(results.map(v=>v.key)).size,4)
  assert.equal(hasRenderableResult(tasks.a),true)
  assert.equal(hasRenderableResult({images:{results:[]}}),false)
  assert.equal(hasRenderableResult(tasks.c),true)
})
test('产物条位于说明文字下方与画布底边之间的空白中点',()=>{
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  const footer=canvas.slice(canvas.indexOf('<footer'),canvas.indexOf('</footer>'))
  assert.ok(!footer.includes('<CreationResultRail'))
  assert.ok(canvas.includes('textBottom+(root.height-textBottom-railHeight)/2'))
  assert.ok(canvas.indexOf('<CreationResultRail')>canvas.indexOf('</footer>'))
  assert.equal((canvas.match(/<CreationResultRail/g)||[]).length,1)
})

test('画布为工具栏和产物条预留真实高度，放大后的图片在媒体区裁切',()=>{
  // 静态契约防止固定内边距回归；真实几何间距另由浏览器检查。
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  assert.ok(canvas.includes('footerHeight+railHeight+40'))
  assert.ok(canvas.includes("canvasLayoutStyle.value['--canvas-bottom-space']!==bottomSpace"))
  assert.ok(canvas.includes('nextTick(positionTools);return'))
  assert.match(canvas,/margin:64px 0 var\(--canvas-bottom-space,192px\);padding:0 24px;overflow:hidden/)
  assert.ok(canvas.includes('visibleBottom-root.top+8'))
})

test('菜单图标不伸展，模型菜单使用紧凑宽度及等宽分类',()=>{
  const css=readFileSync(new URL('../assets/css/creation.css',import.meta.url),'utf8')
  const composer=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8')
  assert.match(css,/creation-menu-row>\.iconify\{flex:0 0 18px/)
  assert.ok(composer.includes("popover==='model'?'min(320px, calc(100vw - 24px))'"))
  assert.match(composer,/creation-model-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
  assert.match(composer,/creation-model-icon\{display:grid;place-items:center/)
  assert.ok(composer.includes('role="tablist" aria-label="模型分类"'))
})

test('失败原因从历史接口映射到工作台与对话轻量提示',()=>{
  const adapter=readFileSync(new URL('../shared/api/adapters/httpAdapter.ts',import.meta.url),'utf8')
  const workspace=readFileSync(new URL('../features/creation/useCreationWorkspace.ts',import.meta.url),'utf8')
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.ok(adapter.includes("errorMessage: raw.error_message || ''"))
  assert.ok(workspace.includes("detail: images.errorMessage || images.currentStep || ''"))
  assert.ok(workspace.includes('detail: video.errorMessage || video.currentStep'))
  assert.ok(studio.includes('<CreationTaskNotice'))
  assert.ok(studio.includes(':detail="taskData[item.id]?.detail"'))
})

test('编辑产物和参考素材不展示没有真实接口的收藏按钮',()=>{
  // 收藏权限随节点业务来源决定，旧工作台不传时仍兼容原行为。
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.ok(canvas.includes("version.source.kind==='image'&&canFavorite!==false"))
  assert.ok(studio.includes(":can-favorite=\"graphToolNode?.data.source?.kind==='image'\""))
})
