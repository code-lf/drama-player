// 只验证案例排版和原复刻事件，不执行收费任务或修改用户草稿。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('短剧只隐藏输入框模板按钮，不删除案例复刻',()=>{
  assert.match(read('features/creation/components/CreationComposer.vue'),/v-if="entry!=='drama'"[^>]*text="选择创作模板"/)
  assert.match(read('features/creation/components/CreationStudio.vue'),/<CreationCaseViewer[^>]*@replica="makeSame"/)
})
test('按真实媒体尺寸排版，播放不裁切，操作为视频内图标',()=>{
  const source=read('features/creation/components/CreationCaseViewer.vue')
  assert.match(source,/target.videoWidth>0&&target.videoHeight>0/)
  assert.match(source,/@loadedmetadata="metadata"/)
  assert.match(source,/header:'sr-only'/)
  assert.match(source,/class="case-viewer-replica"/)
  assert.match(source,/:muted="muted" autoplay playsinline/)
  assert.doesNotMatch(source,/ controls[ >]/)
  assert.match(source,/<USlider[^>]*aria-label="视频播放进度"/)
  assert.match(source,/@select|emit\('select'/)
  const css=read('assets/css/creation.css')
  assert.match(css,/\.creation-case-window.is-mini\{inset:auto 16px 16px auto!important/)
  assert.match(css,/\.case-viewer-stage>video,[^}]*height:auto[^}]*object-fit:contain/)
  assert.match(css,/\.case-viewer-hover-controls\{opacity:0;pointer-events:none/)
  assert.match(css,/\.is-expanded \.case-viewer-layout\{display:grid/)
  assert.match(css,/\.creation-case-cover>\.creation-preview-media\{[^}]*height:100%[^}]*aspect-ratio:16\/9!important/)
})
test('案例播放器脚本和模板编译',()=>{
  const filename='features/creation/components/CreationCaseViewer.vue'
  const {descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:filename})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:filename,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})

test('进度跳转只写入合法范围，真实列表边界不产生虚构案例',()=>{
  const source=read('features/creation/components/CreationCaseViewer.vue')
  const method=source.slice(source.indexOf('function seek('),source.indexOf('async function togglePlay'))
  const media={value:{currentTime:0}},duration={value:10},current={value:0}
  const seek=new Function('media','duration','current',ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return seek')(media,duration,current)
  seek(5);assert.equal(media.value.currentTime,5)
  seek(100);assert.equal(media.value.currentTime,10)
  seek(-1);assert.equal(media.value.currentTime,0)
  seek(NaN);assert.equal(media.value.currentTime,0)
  duration.value=0;seek(5);assert.equal(media.value.currentTime,0)
  assert.match(source,/const item=props.items\[position.value\+offset\];if\(item\)emit\('select',item\)/)
})

test('自动播放失败保持暂停状态，不伪造播放成功',async()=>{
  const source=read('features/creation/components/CreationCaseViewer.vue')
  const method=source.slice(source.indexOf('async function autoplay('),source.indexOf('watch(()=>props.item'))
  const media={value:{muted:false,play:async()=>{throw new Error('浏览器拒绝')}}},playing={value:true}
  const autoplay=new Function('media','props','muted','playing',ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return autoplay')(media,{item:{media_type:'video'}},{value:true},playing)
  await autoplay();assert.equal(playing.value,false);assert.equal(media.value.muted,true)
  assert.match(source,/:key="item.id"/)
  assert.doesNotMatch(source,/:key="expanded"|v-if="expanded"[^>]*<video/)
})

test('底部常驻且无时间文字，进度细线和大按钮统一手形',()=>{
  const source=read('features/creation/components/CreationCaseViewer.vue')
  assert.match(source,/class="case-viewer-footer"/)
  assert.doesNotMatch(source,/class="case-viewer-footer case-viewer-hover-controls"|case-viewer-clock/)
  assert.match(source,/:aria-valuetext="`\$\{timeLabel\(current\)\}/)
  const tokens=read('assets/css/main.css'),css=read('assets/css/creation.css')
  assert.match(tokens,/--liv-case-control-button-size: 44px/)
  assert.match(tokens,/--liv-case-progress-track: 3px/)
  assert.match(tokens,/--liv-case-progress-thumb: 10px/)
  assert.match(css,/\.creation-case-window button,[^}]*cursor:pointer!important/)
  assert.match(css,/button:disabled,[^}]*cursor:not-allowed!important/)
})
