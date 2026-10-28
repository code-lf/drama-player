// 音乐画布菜单只验证已有任务与操作目录，不访问音乐供应商或创建收费任务。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/musicCanvasTools.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {listCanvasMusicTools,resolveCanvasMusicTool}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('节点音乐播放器限制纵向视窗而非缩小控件，沉浸布局保留',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue')
  assert.match(canvas,/\.liv-canvas\.is-inline-node>\.canvas-stage\.is-music-stage\{max-height:280px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain\}/)
  assert.ok(canvas.includes('.liv-music-player:not(.is-immersive)'))
  assert.ok(canvas.includes('<MusicPlayer v-else'))
  assert.ok(canvas.includes(':controls-target="toolbarTarget"'))
  assert.equal((canvas.match(/aria-label="更多音频工具"/g)||[]).length,1)
  const graphCss=read('assets/css/creative-canvas.css')
  assert.ok(graphCss.includes('@media(max-height:650px){.creative-prompt-dock.has-node-tools:not(.is-expanded)>.creation-canvas-composer>.creation-editor'))
})

test('音乐工具菜单只出现在当前原歌曲节点，处理结果和错任务不显示',()=>{
  const options=[{code:'coverSong',name:'翻唱'},{code:'remix',name:'改造'},{code:'coverSong',name:'重复翻唱'},{code:' ',name:'空操作'}]
  const source={kind:'music',id:'task-1',audio_index:1}
  assert.deepEqual(listCanvasMusicTools('audio',source,'task-1',options),[{code:'coverSong',name:'翻唱'},{code:'remix',name:'改造'}])
  assert.deepEqual(listCanvasMusicTools('audio',{...source,result_id:'processed-1'},'task-1',options),[])
  assert.deepEqual(listCanvasMusicTools('video',source,'task-1',options),[])
  assert.deepEqual(listCanvasMusicTools('audio',source,'task-2',options),[])
  assert.deepEqual(listCanvasMusicTools('audio',{...source,audio_index:-1},'task-1',options),[])
})

test('音频工具确认入口绑定真实任务、可播放曲目序号和启用操作白名单',()=>{
  const source={kind:'music',id:'task-1',audio_index:1}
  const task={id:'task-1',provider_task_id:'provider-1',status:'completed'}
  const tracks=[{status:'completed',audio_url:'https://media.test/one.mp3'},{status:'success',url:'https://media.test/two.mp3'}]
  const options=[{code:'coverSong',name:'翻唱'}]
  assert.deepEqual(resolveCanvasMusicTool('coverSong',source,task,tracks,options),{operation:'coverSong',sourceTaskId:'task-1',sourceAudioIndex:1})
  assert.deepEqual(resolveCanvasMusicTool('coverSong',source,task,[tracks[0],{status:'complete',audio_url:'https://media.test/legacy.mp3'}],options),{operation:'coverSong',sourceTaskId:'task-1',sourceAudioIndex:1})
  assert.equal(resolveCanvasMusicTool('other',source,task,tracks,options),undefined)
  assert.equal(resolveCanvasMusicTool('coverSong',{...source,id:'task-2'},task,tracks,options),undefined)
  assert.equal(resolveCanvasMusicTool('coverSong',{...source,result_id:'processed-1'},task,tracks,options),undefined)
  assert.equal(resolveCanvasMusicTool('coverSong',source,{...task,status:'failed'},tracks,options),undefined)
  assert.equal(resolveCanvasMusicTool('coverSong',source,{...task,provider_task_id:''},tracks,options),undefined)
  assert.equal(resolveCanvasMusicTool('coverSong',{...source,audio_index:3},task,tracks,options),undefined)
  assert.equal(resolveCanvasMusicTool('coverSong',source,task,[tracks[0],{status:'failed',url:'https://media.test/two.mp3'}],options),undefined)
})

test('画布播放器挂载真实目录菜单，工作台工具固定节点曲目而非聊天选择序号',()=>{
  const resultCanvas=read('features/creation/components/CreationResultCanvas.vue')
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(resultCanvas.includes('audioToolItems'))
  assert.ok(resultCanvas.includes('audioTool:[operation:string,source:WorkspaceSource]'))
  assert.ok(studio.includes('function openCanvasMusicTool'))
  assert.ok(studio.includes(':source-audio-index="musicToolSource?.audioIndex"'))
  assert.ok(!studio.includes('source-audio-index="Number(canvasSelected.split'))
  assert.ok(studio.includes('@audio-tool="openCanvasMusicTool"'))
})
