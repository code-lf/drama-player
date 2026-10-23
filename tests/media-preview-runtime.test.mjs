// 执行真实组件逻辑，隔离播放器和可见性输入，不访问媒体网络。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url),vr=createRequire(require.resolve('vue'))
const {parse,compileScript}=vr('@vue/compiler-sfc'),{renderToString}=vr('@vue/server-renderer')
async function setup(autoplay){
  const source=readFileSync(new URL('../features/creation/components/CreationPreviewMedia.vue',import.meta.url),'utf8')
  const script=compileScript(parse(source).descriptor,{id:'media-preview-runtime'})
  const module={exports:{}}
  new Function('require','module','exports',ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>vue,module,module.exports)
  const component=module.exports.default,original=component.setup;let b
  component.setup=(props,ctx)=>{b=original(props,ctx);return b};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,{cover:'/cover.jpg',video:'/preview.mp4',alt:'模板',autoplay}))
  let plays=0,pauses=0
  const player={muted:false,play(){plays++;return Promise.resolve()},pause(){pauses++}}
  b.player.value=player
  return {b,player,plays:()=>plays,pauses:()=>pauses}
}
test('模板只在可见时静音播放，离屏立即暂停',async()=>{
  const {b,player,plays,pauses}=await setup(true)
  b.syncPlayback();assert.equal(plays(),0);assert.equal(pauses(),1)
  b.visible.value=true;b.syncPlayback();assert.equal(plays(),1);assert.equal(player.muted,true)
  b.visible.value=false;b.syncPlayback();assert.equal(pauses(),2)
})
test('案例仅悬停播放，离开或媒体失败时暂停',async()=>{
  const {b,plays,pauses}=await setup(false)
  b.visible.value=true;b.syncPlayback();assert.equal(plays(),0)
  b.hovered.value=true;b.syncPlayback();assert.equal(plays(),1)
  b.hovered.value=false;b.syncPlayback();assert.equal(pauses(),2)
  b.failed.value=true;b.hovered.value=true;b.syncPlayback();assert.equal(plays(),1)
})
