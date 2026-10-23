// 真实方法配合媒体桩验证，不联网播放、不产生生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationCaseViewer.vue','utf8')
test('播放完成后同步真实状态，暂停立即切回播放图标，有声音为默认值',async()=>{
  const element={paused:true,ended:false,muted:true,play:async()=>{element.paused=false},pause:()=>{element.paused=true}}
  const media={value:element},playing={value:false},muted={value:false},playbackError={value:''}
  const code=source.slice(source.indexOf('async function togglePlay('),source.indexOf('function toggleMute('))
  const toggle=new Function('media','playing','muted','playbackError',ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return togglePlay')(media,playing,muted,playbackError)
  await toggle();assert.equal(playing.value,true);assert.equal(element.muted,false)
  await toggle();assert.equal(playing.value,false)
  element.play=async()=>{throw Error('blocked')}
  await toggle();assert.equal(playing.value,false);assert.ok(playbackError.value)
  assert.match(source,/muted=ref\(false\)/)
  assert.match(source,/<UIcon :key="playing\?'pause':'play'"/)
})
test('引导共享五个用途目录并保留原封面布局，重置仅修改本账号已读',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.match(studio,/v-for="item in visibleCreationEntries"[^>]*creation-onboarding-card/)
  assert.match(studio,/body:\{onboarding_seen:false\}/)
  assert.match(studio,/delete query.onboarding/)
  const css=readFileSync('assets/css/creation.css','utf8')
  assert.ok(css.includes('grid-template-columns:var(--liv-onboarding-free-width) repeat(2,minmax(0,1fr))'))
})
