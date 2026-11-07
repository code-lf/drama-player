// 紧凑媒体与任务只读投影；不请求真实模型、不采购媒体。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
function load(path){const result={};new Function('exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(result);return result}
const {waveformPeaks,readAudioWaveform}=load('features/music/utils/audioWaveform.ts')
const {canvasCompletionNotices}=load('features/creation/canvasTaskNotices.ts')
const {canvasGroupLabel}=load('features/creation/canvasGroups.ts')
const node=(id,kind='video',runId='one',status='completed')=>({id,data:{title:id,kind,runId,status,url:`/${id}.mp4`}})

test('波形来自各声道真实峰值，静音保持零，不按时间随机生成',()=>{
  assert.deepEqual(waveformPeaks([new Float32Array([0,.5,0,1])],2),[.5,1])
  assert.deepEqual(waveformPeaks([new Float32Array(4)],2),[0,0])
  assert.deepEqual(waveformPeaks([new Float32Array([.1,.1]),new Float32Array([1,.5])],2),[1,.5])
  assert.deepEqual(waveformPeaks([],72),[])
})
test('波形下载有上限，超限和取消不解码，不携带账户凭据',async()=>{
  const original=globalThis.fetch
  try{
    let options
    globalThis.fetch=async(_url,config)=>{options=config;return{ok:true,headers:new Headers({'content-length':String(25*1024*1024)}),body:{}}}
    await assert.rejects(readAudioWaveform('/authorized.mp3',new AbortController().signal))
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error')
  }finally{globalThis.fetch=original}
})
test('完成提示最多三批且只取成功文件，同批合并，不把待核对或空文件算成功',()=>{
  const inputs=[node('a','image'),node('b','image'),node('pending','video','wait','needs_review'),node('music','audio','music'),node('c','video','two'),{...node('empty'),data:{...node('empty').data,url:''}}]
  const before=JSON.stringify(inputs),notices=canvasCompletionNotices(inputs)
  assert.equal(notices.length,3);assert.equal(notices[0].node.id,'c')
  assert.equal(notices[2].count,2);assert.equal(notices[2].node.id,'b')
  assert.equal(JSON.stringify(inputs),before)
})
test('合成以真实任务身份区分，不与同批源视频合并；组名优先真实作品，手工名称不变',()=>{
  const first=node('镜头1'),film={...node('宣传成片'),data:{...node('宣传成片').data,source:{kind:'composition',id:'job'}}}
  assert.equal(canvasCompletionNotices([first,film]).length,2)
  assert.equal(canvasGroupLabel({id:'group:auto-one',title:'分镜视频',members:[first.id,film.id]},[first,film]),'宣传成片')
  assert.equal(canvasGroupLabel({id:'group:manual',title:'我的分组',members:[first.id]},[first]),'我的分组')
})
test('紧凑音乐不生成第二个audio，组名与任务尺寸复用令牌',()=>{
  const music=readFileSync('features/music/components/MusicPlayer.vue','utf8'),css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.equal((music.match(/<audio /g)||[]).length,1)
  assert.ok(music.includes('canvasMini&&!immersive'))
  assert.ok(css.includes('height:var(--liv-canvas-task-height)'))
  assert.ok(css.includes('font-size:var(--liv-canvas-group-label-size)'))
})
test('工具切换只恢复本页真实进度，不自动播放，不落盘私人文件地址',()=>{
  const {rememberCanvasPosition,readCanvasPosition}=load('features/music/utils/canvasPlaybackPosition.ts')
  rememberCanvasPosition('/owned.mp3',17);assert.equal(readCanvasPosition('/owned.mp3'),17)
  rememberCanvasPosition('/owned.mp3',NaN);assert.equal(readCanvasPosition('/owned.mp3'),17)
  assert.equal(readCanvasPosition('/other.mp3'),0)
})
